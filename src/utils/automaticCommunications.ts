import {
  AppData,
  CommunicationChannel,
  CommunicationLog,
  Contract,
  Payment,
  Tenant,
} from "@/data/types";
import {
  effectiveStatus,
  formatMoney,
  getRemainingPaymentAmount,
  hasContinuingContractForUnit,
  isPaymentPaid,
  paymentDueDateValue,
} from "@/data/helpers";
import { fillTemplate, validatePhone } from "@/utils/whatsapp";
import { sendAutomaticSms } from "@/utils/sms";
import {
  sendGmailEmail,
  sendOutlookEmail,
  sendWhatsAppTemplate,
} from "@/utils/communicationAccounts";

export interface AutomaticCommunicationJob {
  channel: CommunicationChannel;
  recipient: string;
  tenantId?: string;
  tenantName?: string;
  unitName?: string;
  paymentId?: string;
  contractId?: string;
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  templateKind: "paymentReminder" | "overduePayment" | "contractExpiry";
  provider: "gmail" | "outlook" | "whatsapp_business" | "device_sms";
  subject?: string;
  body: string;
  dedupeKey: string;
  scheduledFor: string;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
// The manager checks every five minutes. Keep one extra polling interval so a
// small timer delay does not turn an on-time run into a missed occurrence.
const SCHEDULE_WINDOW_MS = 10 * 60_000;
// Catch-up should not fire a message that lands too close to the next
// legitimately scheduled one. If less than this much time remains before the
// next anchored slot, skip the immediate catch-up and just wait for it.
const MIN_GAP_BEFORE_NEXT_OCCURRENCE_MS = 6 * HOUR;
let running: Promise<CommunicationLog[]> | null = null;

export function isCommunicationOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function localDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateValue(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

function formatFormalDate(value?: string): string {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { year: "numeric", month: "long", day: "numeric" });
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function getTenantEmailAddresses(tenant?: Tenant): string[] {
  const addresses = tenant?.emailAddresses?.length
    ? tenant.emailAddresses.filter((item) => item.enabled !== false).map((item) => item.email.trim())
    : tenant?.email
    ? [tenant.email.trim()]
    : [];
  return Array.from(new Set(addresses.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))));
}

export function findTenantForPayment(
  data: Pick<AppData, "tenants" | "contracts">,
  payment: Payment,
): Tenant | undefined {
  const contractTenantId = payment.contractId
    ? data.contracts.find((contract) => contract.id === payment.contractId)?.tenantId
    : undefined;
  const linkedTenantId = payment.tenantId || contractTenantId;
  if (linkedTenantId) {
    const linkedTenant = data.tenants.find((tenant) => tenant.id === linkedTenantId);
    if (linkedTenant) return linkedTenant;
  }

  const unitTenants = data.tenants.filter((tenant) => tenant.unitId === payment.unitId);
  if (payment.tenantName) {
    const namedTenant = unitTenants.find((tenant) => tenant.name.trim() === payment.tenantName?.trim());
    if (namedTenant) return namedTenant;
  }

  return [...unitTenants].sort((a, b) => {
    const aMatchesContract = a.activeContractId === payment.contractId ? 1 : 0;
    const bMatchesContract = b.activeContractId === payment.contractId ? 1 : 0;
    return bMatchesContract - aMatchesContract
      || (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "");
  })[0];
}

export function getTenantPhoneNumbers(tenant?: Tenant): string[] {
  const numbers = tenant?.phoneNumbers?.length
    ? tenant.phoneNumbers.filter((item) => item.enabled !== false).map((item) => item.phone.trim())
    : tenant?.phone
    ? [tenant.phone.trim()]
    : [];
  return Array.from(new Set(
    numbers
      .map((phone) => validatePhone(phone))
      .filter((phone): phone is string => Boolean(phone)),
  ));
}

export function getFormalTenantGreeting(tenant?: Tenant, fallbackName = ""): string {
  const name = tenant?.name || fallbackName;
  return tenant?.tenantType === "company"
    ? `السادة/ ${name} المحترمون`
    : `السيد/السيدة ${name} المحترم/ة`;
}

export function getWhatsAppTemplatesForTenant(data: AppData, tenant?: Tenant) {
  return tenant?.tenantType === "company"
    ? (data.settings.companyWhatsappTemplates || data.settings.whatsappTemplates)
    : data.settings.whatsappTemplates;
}

export function getEmailTemplatesForTenant(data: AppData, tenant?: Tenant) {
  return tenant?.tenantType === "company"
    ? (data.settings.companyEmailTemplates || data.settings.emailTemplates)
    : data.settings.emailTemplates;
}

function fillTenantTemplate(
  template: string,
  vars: Record<string, string | undefined>,
  tenant?: Tenant,
): string {
  const greeting = getFormalTenantGreeting(tenant, vars.tenantName || "");
  const filled = fillTemplate(template, { ...vars, recipientGreeting: greeting });
  if (tenant?.tenantType !== "company") return filled;
  return filled.replace(
    `السيد/السيدة ${vars.tenantName || ""} المحترم/ة`,
    greeting,
  );
}

function paymentPeriod(data: AppData, payment: Payment): { start: string; end: string } {
  const start = paymentDueDateValue(payment);
  const next = data.payments
    .filter((item) =>
      item.id !== payment.id
      && item.unitId === payment.unitId
      && (!payment.contractId || item.contractId === payment.contractId)
      && paymentDueDateValue(item) > start
    )
    .sort((a, b) => paymentDueDateValue(a).localeCompare(paymentDueDateValue(b)))[0];
  if (next) return { start, end: addDays(paymentDueDateValue(next), -1) };
  if (payment.rentalPeriod?.includes(" - ")) {
    const [periodStart, periodEnd] = payment.rentalPeriod.split(" - ").map((item) => item.trim());
    if (periodStart && periodEnd) return { start: periodStart, end: periodEnd };
  }
  return { start, end: addDays(start, 29) };
}

function templateVars(data: AppData, payment: Payment, tenant: Tenant | undefined) {
  const unit = data.units.find((item) => item.id === payment.unitId);
  const building = data.buildings.find((item) => item.id === unit?.buildingId);
  const period = paymentPeriod(data, payment);
  return {
    tenantName: tenant?.name || payment.tenantName || "",
    buildingName: building?.name || payment.buildingName || "",
    unitName: unit?.name || payment.unitName || "",
    amount: formatMoney(getRemainingPaymentAmount(payment)),
    paymentNumber: String(payment.paymentNumber || getPaymentSequenceNumber(data, payment)),
    dueDate: formatFormalDate(paymentDueDateValue(payment)),
    periodStart: formatFormalDate(period.start),
    periodEnd: formatFormalDate(period.end),
    contractEndDate: "",
    ownerName: "",
  };
}

function getPaymentSequenceNumber(data: AppData, payment: Payment): number {
  const related = data.payments
    .filter((item) =>
      !item.deletedAt
      && item.status !== "cancelled"
      && item.unitId === payment.unitId
      && (!payment.contractId || item.contractId === payment.contractId)
    )
    .sort((a, b) =>
      paymentDueDateValue(a).localeCompare(paymentDueDateValue(b))
      || a.id.localeCompare(b.id)
    );
  const index = related.findIndex((item) => item.id === payment.id);
  return index >= 0 ? index + 1 : 1;
}

export function buildPaymentMessageContent(
  data: AppData,
  payment: Payment,
  tenant?: Tenant,
  forcedKind?: "paymentReminder" | "overduePayment",
) {
  const dueDate = paymentDueDateValue(payment);
  const kind = forcedKind || (effectiveStatus(payment) === "overdue" || dueDate < localDate(new Date())
    ? "overduePayment"
    : "paymentReminder");
  const vars = templateVars(data, payment, tenant);
  return {
    kind,
    message: fillTenantTemplate(getWhatsAppTemplatesForTenant(data, tenant)[kind], vars, tenant),
  };
}

export function buildPaymentEmailContent(
  data: AppData,
  payment: Payment,
  tenant?: Tenant,
  forcedKind?: "paymentReminder" | "overduePayment",
) {
  const dueDate = paymentDueDateValue(payment);
  const kind = forcedKind || (effectiveStatus(payment) === "overdue" || dueDate < localDate(new Date())
    ? "overduePayment"
    : "paymentReminder");
  const template = getEmailTemplatesForTenant(data, tenant)[kind];
  const vars = templateVars(data, payment, tenant);
  return {
    kind,
    subject: fillTenantTemplate(template.subject, vars, tenant),
    body: fillTenantTemplate(template.body, vars, tenant),
  };
}

export function buildContractCommunicationContent(data: AppData, contract: Contract, tenant?: Tenant) {
  const unit = data.units.find((item) => item.id === contract.unitId);
  const building = data.buildings.find((item) => item.id === unit?.buildingId);
  const vars = {
    tenantName: tenant?.name || contract.tenantName || "",
    buildingName: building?.name || "",
    unitName: unit?.name || "",
    amount: "",
    dueDate: "",
    periodStart: formatFormalDate(contract.startDate),
    periodEnd: formatFormalDate(contract.endDate),
    contractEndDate: formatFormalDate(contract.endDate),
    ownerName: "",
  };
  const emailTemplate = getEmailTemplatesForTenant(data, tenant).contractExpiry;
  const whatsappTemplate = getWhatsAppTemplatesForTenant(data, tenant).contractExpiry;
  return {
    emailSubject: fillTenantTemplate(emailTemplate.subject, vars, tenant),
    emailBody: fillTenantTemplate(emailTemplate.body, vars, tenant),
    whatsappBody: fillTemplate(whatsappTemplate, vars),
  };
}

function wasRecentlyAttempted(
  data: AppData,
  dedupeKey: string,
  scheduledFor: string,
  now: Date,
  frequencyHours: number,
  retryFailedNow = false,
): boolean {
  const matching = [...(data.communicationLogs || [])]
    .filter((log) => log.dedupeKey === dedupeKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (matching.length === 0) return false;
  const cooldown = Math.max(1, frequencyHours) * HOUR;
  const scheduledAt = new Date(scheduledFor).getTime();
  const sameOccurrence = matching.filter((log) => log.scheduledFor === scheduledFor);
  if (sameOccurrence.some((log) => log.status === "sent" || log.status === "queued")) {
    return true;
  }

  // Keep fixed schedule anchors without sending two reminders too close
  // together. A normal delay inside the run window does not shift the next
  // occurrence, while a very late catch-up can intentionally skip a nearby
  // occurrence and resume at the following anchored slot.
  const latestDelivered = matching.find((log) => log.status === "sent" || log.status === "queued");
  if (latestDelivered) {
    const nextAllowedSlot = new Date(latestDelivered.createdAt).getTime()
      + cooldown
      - (retryFailedNow ? 0 : SCHEDULE_WINDOW_MS);
    if (scheduledAt < nextAllowedSlot) return true;
  }

  const latestFailure = sameOccurrence.find((log) => log.status === "failed")
    || matching.find((log) => log.status === "failed" && !log.scheduledFor);
  if (!latestFailure) return false;
  if (retryFailedNow) return false;
  const elapsed = now.getTime() - new Date(latestFailure.createdAt).getTime();
  const retryWindow = Math.min(cooldown, HOUR);
  return elapsed < retryWindow;
}

type ScheduleKind = "paymentReminder" | "overduePayment" | "contractExpiry";

function scheduleIsActive(data: AppData, now: Date): boolean {
  // There is no separate master switch anymore — enabling any one channel
  // (email/WhatsApp/SMS) below is what turns automatic sending on for that
  // channel. This only gates the optional date range.
  const settings = data.settings.automaticCommunications;
  if (!settings) return false;
  const today = localDate(now);
  if (settings.activeFrom && today < settings.activeFrom) return false;
  if (settings.activeUntil && today > settings.activeUntil) return false;
  return true;
}

function resolvedSchedule(data: AppData, kind: ScheduleKind) {
  const settings = data.settings.automaticCommunications;
  const custom = kind === "paymentReminder"
    ? settings.paymentReminderSchedule
    : kind === "overduePayment"
      ? settings.overduePaymentSchedule
      : settings.contractExpirySchedule;
  const useCustom = !!custom?.useCustomSchedule;
  const legacyFrequencyDays = Math.max(
    1,
    Number(useCustom ? custom.frequencyDays : settings.frequencyDays) || 1,
  );
  return {
    enabled: !useCustom || custom.enabled,
    frequencyHours: Math.max(
      1,
      Number(useCustom ? custom.frequencyHours : settings.frequencyHours) || legacyFrequencyDays * 24,
    ),
    sendTime: (useCustom ? custom.sendTime : settings.sendTime) || "09:00",
    daysBeforeDue: Math.max(0, Number(useCustom ? custom.daysBeforeDue : settings.daysBeforeDue) || 0),
    overdueTailDays: Math.max(0, Number(useCustom ? custom.overdueTailDays : settings.overdueTailDays) || 0),
    contractReminderDays: Math.max(
      1,
      Number(useCustom ? custom.contractReminderDays : data.settings.contractReminderDays) || 60,
    ),
  };
}

function scheduledTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(
    year,
    Math.max(0, (month || 1) - 1),
    day || 1,
    hour || 0,
    minute || 0,
    0,
    0,
  );
}

function scheduledOccurrenceFor(
  data: AppData,
  kind: ScheduleKind,
  firstEligibleDate: string,
  now: Date,
  force: boolean,
): Date | null {
  const rule = resolvedSchedule(data, kind);
  if (!rule.enabled) return null;
  if (force) return now;

  const activeFrom = data.settings.automaticCommunications.activeFrom;
  const scheduleStartDate = activeFrom && activeFrom > firstEligibleDate
    ? activeFrom
    : firstEligibleDate;
  const firstOccurrence = scheduledTime(scheduleStartDate, rule.sendTime);
  const elapsed = now.getTime() - firstOccurrence.getTime();
  if (elapsed < 0) return null;

  const frequencyMs = Math.max(1, rule.frequencyHours) * HOUR;
  const latestOccurrence = new Date(
    firstOccurrence.getTime() + Math.floor(elapsed / frequencyMs) * frequencyMs,
  );
  const delay = now.getTime() - latestOccurrence.getTime();
  if (delay < SCHEDULE_WINDOW_MS) return latestOccurrence;

  // The occurrence was missed. Catch-up only fires it immediately if the
  // next anchored slot is still comfortably far away — otherwise a message
  // sent now would land within hours of the next legitimately scheduled
  // one, so it is better to just let the schedule catch itself up normally.
  if (!data.settings.automaticCommunications.sendMissedAsSoonAsPossible) return null;
  const nextOccurrence = latestOccurrence.getTime() + frequencyMs;
  const gapUntilNext = nextOccurrence - now.getTime();
  return gapUntilNext >= MIN_GAP_BEFORE_NEXT_OCCURRENCE_MS ? latestOccurrence : null;
}

export function buildAutomaticCommunicationJobs(data: AppData, now = new Date(), force = false): AutomaticCommunicationJob[] {
  if (!scheduleIsActive(data, now)) return [];
  const settings = data.settings.automaticCommunications;
  const today = localDate(now);
  const jobs: AutomaticCommunicationJob[] = [];

  for (const payment of data.payments) {
    if (payment.deletedAt || isPaymentPaid(payment) || getRemainingPaymentAmount(payment) <= 0) continue;
    if (payment.automaticReminderHoldUntil && now.getTime() < new Date(payment.automaticReminderHoldUntil).getTime()) continue;
    if (payment.communicationGraceUntil && today <= payment.communicationGraceUntil) continue;
    const dueDate = paymentDueDateValue(payment);
    const daysUntilDue = Math.ceil((dateValue(dueDate) - dateValue(today)) / DAY);
    const tenant = findTenantForPayment(data, payment);
    const kind = effectiveStatus(payment) === "overdue" || daysUntilDue < 0 ? "overduePayment" : "paymentReminder";
    const rule = resolvedSchedule(data, kind);
    if (kind === "paymentReminder" && daysUntilDue > rule.daysBeforeDue) continue;
    if (kind === "overduePayment" && daysUntilDue < -rule.overdueTailDays) continue;
    const firstEligibleDate = kind === "paymentReminder"
      ? addDays(dueDate, -rule.daysBeforeDue)
      : addDays(dueDate, 1);
    const scheduledOccurrence = scheduledOccurrenceFor(data, kind, firstEligibleDate, now, force);
    if (!scheduledOccurrence) continue;
    const scheduledFor = scheduledOccurrence.toISOString();
    const vars = templateVars(data, payment, tenant);
    const period = paymentPeriod(data, payment);
    const emailContent = buildPaymentEmailContent(data, payment, tenant, kind);

    if (settings.emailEnabled && settings.emailProvider) {
      for (const recipient of getTenantEmailAddresses(tenant)) {
        const dedupeKey = `${payment.id}:email:${recipient}:${kind}`;
        if (wasRecentlyAttempted(data, dedupeKey, scheduledFor, now, rule.frequencyHours, force)) continue;
        jobs.push({
          channel: "email",
          recipient,
          tenantId: tenant?.id,
          tenantName: tenant?.name || payment.tenantName || "",
          unitName: vars.unitName,
          paymentId: payment.id,
          contractId: payment.contractId,
          periodStart: period.start,
          periodEnd: period.end,
          dueDate,
          templateKind: kind,
          provider: settings.emailProvider,
          subject: emailContent.subject,
          body: emailContent.body,
          dedupeKey,
          scheduledFor,
        });
      }
    }

    if (settings.whatsappEnabled) {
      for (const phone of getTenantPhoneNumbers(tenant)) {
        const recipient = validatePhone(phone);
        if (!recipient) continue;
        const dedupeKey = `${payment.id}:whatsapp:${recipient}:${kind}`;
      if (!wasRecentlyAttempted(data, dedupeKey, scheduledFor, now, rule.frequencyHours, force)) {
        jobs.push({
          channel: "whatsapp",
          recipient,
          tenantId: tenant?.id,
          tenantName: tenant?.name || payment.tenantName || "",
          unitName: vars.unitName,
          paymentId: payment.id,
          contractId: payment.contractId,
          periodStart: period.start,
          periodEnd: period.end,
          dueDate,
          templateKind: kind,
          provider: "whatsapp_business",
          body: fillTemplate(getWhatsAppTemplatesForTenant(data, tenant)[kind], vars),
          dedupeKey,
          scheduledFor,
        });
      }
      }
    }

    if (settings.smsEnabled) {
      for (const phone of getTenantPhoneNumbers(tenant)) {
        const recipient = validatePhone(phone);
        if (!recipient) continue;
        const dedupeKey = `${payment.id}:sms:${recipient}:${kind}`;
        if (wasRecentlyAttempted(data, dedupeKey, scheduledFor, now, rule.frequencyHours, force)) continue;
        jobs.push({
          channel: "sms",
          recipient,
          tenantId: tenant?.id,
          tenantName: tenant?.name || payment.tenantName || "",
          unitName: vars.unitName,
          paymentId: payment.id,
          contractId: payment.contractId,
          periodStart: period.start,
          periodEnd: period.end,
          dueDate,
          templateKind: kind,
          provider: "device_sms",
          body: fillTemplate(getWhatsAppTemplatesForTenant(data, tenant)[kind], vars),
          dedupeKey,
          scheduledFor,
        });
      }
    }
  }
  for (const contract of data.contracts) {
    if (contract.deletedAt || contract.status === "cancelled" || contract.status === "terminated" || !contract.endDate) continue;
    if (hasContinuingContractForUnit(contract, data.contracts)) continue;
    if (contract.responseGraceUntil && today <= contract.responseGraceUntil) continue;
    const rule = resolvedSchedule(data, "contractExpiry");
    const daysUntilEnd = Math.ceil((dateValue(contract.endDate) - dateValue(today)) / DAY);
    if (daysUntilEnd < 0 || daysUntilEnd > rule.contractReminderDays) continue;
    const firstEligibleDate = addDays(contract.endDate, -rule.contractReminderDays);
    const scheduledOccurrence = scheduledOccurrenceFor(
      data,
      "contractExpiry",
      firstEligibleDate,
      now,
      force,
    );
    if (!scheduledOccurrence) continue;
    const scheduledFor = scheduledOccurrence.toISOString();
    const tenant = data.tenants.find((item) =>
      item.id === contract.tenantId
      || (!contract.tenantId && item.unitId === contract.unitId)
    );
    const content = buildContractCommunicationContent(data, contract, tenant);
    const unit = data.units.find((item) => item.id === contract.unitId);
    if (settings.emailEnabled && settings.emailProvider) {
      for (const recipient of getTenantEmailAddresses(tenant)) {
        const dedupeKey = `${contract.id}:email:${recipient}:contractExpiry`;
        if (wasRecentlyAttempted(data, dedupeKey, scheduledFor, now, rule.frequencyHours, force)) continue;
        jobs.push({
          channel: "email",
          recipient,
          tenantId: tenant?.id,
          tenantName: tenant?.name || contract.tenantName || "",
          unitName: unit?.name || "",
          contractId: contract.id,
          periodStart: contract.startDate,
          periodEnd: contract.endDate,
          templateKind: "contractExpiry",
          provider: settings.emailProvider,
          subject: content.emailSubject,
          body: content.emailBody,
          dedupeKey,
          scheduledFor,
        });
      }
    }
    if (settings.whatsappEnabled) {
      for (const phone of getTenantPhoneNumbers(tenant)) {
      const recipient = validatePhone(phone);
      if (!recipient) continue;
      const dedupeKey = `${contract.id}:whatsapp:${recipient}:contractExpiry`;
      if (!wasRecentlyAttempted(data, dedupeKey, scheduledFor, now, rule.frequencyHours, force)) {
        jobs.push({
          channel: "whatsapp",
          recipient,
          tenantId: tenant?.id,
          tenantName: tenant?.name || contract.tenantName || "",
          unitName: unit?.name || "",
          contractId: contract.id,
          periodStart: contract.startDate,
          periodEnd: contract.endDate,
          templateKind: "contractExpiry",
          provider: "whatsapp_business",
          body: content.whatsappBody,
          dedupeKey,
          scheduledFor,
        });
      }
      }
    }
    if (settings.smsEnabled) {
      for (const phone of getTenantPhoneNumbers(tenant)) {
        const recipient = validatePhone(phone);
        if (!recipient) continue;
        const dedupeKey = `${contract.id}:sms:${recipient}:contractExpiry`;
        if (wasRecentlyAttempted(data, dedupeKey, scheduledFor, now, rule.frequencyHours, force)) continue;
        jobs.push({
          channel: "sms",
          recipient,
          tenantId: tenant?.id,
          tenantName: tenant?.name || contract.tenantName || "",
          unitName: unit?.name || "",
          contractId: contract.id,
          periodStart: contract.startDate,
          periodEnd: contract.endDate,
          templateKind: "contractExpiry",
          provider: "device_sms",
          body: content.whatsappBody,
          dedupeKey,
          scheduledFor,
        });
      }
    }
  }
  // A tenant number can be stored more than once using local and international
  // formatting. Keep exactly one executable job for each logical message.
  return Array.from(
    new Map(jobs.map((job) => [job.dedupeKey, job])).values(),
  ).slice(0, 100);
}

async function executeJob(job: AutomaticCommunicationJob, requestId: string): Promise<{
  status?: CommunicationLog["status"];
  deliveryNote?: string;
  statusFinalizesAt?: string;
}> {
  if (job.provider === "gmail") {
    await sendGmailEmail(job.recipient, job.subject || "تذكير", job.body);
  } else if (job.provider === "outlook") {
    await sendOutlookEmail(job.recipient, job.subject || "تذكير", job.body);
  } else if (job.provider === "device_sms") {
    await sendAutomaticSms(job.recipient, job.body, requestId);
    return {
      status: "queued",
      deliveryNote: "جاري التحقق من نتيجة إرسال SMS لمدة تصل إلى 10 دقائق. لن تتكرر الرسالة خلال هذه المهلة.",
      statusFinalizesAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
  } else {
    await sendWhatsAppTemplate(job.recipient, job.templateKind, job.body);
  }
  return {};
}

export async function runAutomaticCommunicationCycle(data: AppData, now = new Date(), force = false): Promise<CommunicationLog[]> {
  if (!isCommunicationOnline()) {
    throw new Error("لا يوجد اتصال بالإنترنت؛ تم تأجيل الرسائل وستتم المحاولة تلقائيًا عند عودة الاتصال");
  }
  // Do not let multiple lifecycle listeners persist the same cycle result.
  // The first caller owns the running cycle; later callers will retry normally.
  if (running) return [];
  running = (async () => {
    const jobs = buildAutomaticCommunicationJobs(data, now, force);
    const logs: CommunicationLog[] = [];
    for (const job of jobs) {
      const createdAt = new Date().toISOString();
      const id = `message-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const execution = await executeJob(job, id);
        logs.push({
          id,
          createdAt,
          scheduledFor: job.scheduledFor,
          sentAt: execution.status === "queued" ? undefined : new Date().toISOString(),
          statusFinalizesAt: execution.statusFinalizesAt,
          channel: job.channel,
          status: execution.status || "sent",
          recipient: job.recipient,
          tenantId: job.tenantId,
          tenantName: job.tenantName,
          unitName: job.unitName,
          paymentId: job.paymentId,
          contractId: job.contractId,
          periodStart: job.periodStart,
          periodEnd: job.periodEnd,
          dueDate: job.dueDate,
          templateKind: job.templateKind,
          provider: job.provider,
          subject: job.subject,
          deliveryNote: execution.deliveryNote,
          dedupeKey: job.dedupeKey,
        });
      } catch (error) {
        logs.push({
          id,
          createdAt,
          scheduledFor: job.scheduledFor,
          channel: job.channel,
          status: "failed",
          recipient: job.recipient,
          tenantId: job.tenantId,
          tenantName: job.tenantName,
          unitName: job.unitName,
          paymentId: job.paymentId,
          contractId: job.contractId,
          periodStart: job.periodStart,
          periodEnd: job.periodEnd,
          dueDate: job.dueDate,
          templateKind: job.templateKind,
          provider: job.provider,
          subject: job.subject,
          error: error instanceof Error ? error.message : "تعذر الإرسال",
          dedupeKey: job.dedupeKey,
        });
      }
    }
    return logs;
  })().finally(() => {
    running = null;
  });
  return running;
}
