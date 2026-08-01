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
  isPaymentPaid,
  paymentDueDateValue,
} from "@/data/helpers";
import { fillTemplate, validatePhone } from "@/utils/whatsapp";
import {
  sendGmailEmail,
  sendOutlookEmail,
  sendWhatsAppTemplate,
} from "@/utils/communicationAccounts";

export interface AutomaticCommunicationJob {
  channel: CommunicationChannel;
  recipient: string;
  tenantId?: string;
  paymentId?: string;
  contractId?: string;
  templateKind: "paymentReminder" | "overduePayment" | "contractExpiry";
  provider: "gmail" | "outlook" | "whatsapp_business";
  subject?: string;
  body: string;
  dedupeKey: string;
}

const DAY = 86_400_000;
let running: Promise<CommunicationLog[]> | null = null;

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

export function getTenantPhoneNumbers(tenant?: Tenant): string[] {
  const numbers = tenant?.phoneNumbers?.length
    ? tenant.phoneNumbers.filter((item) => item.enabled !== false).map((item) => item.phone.trim())
    : tenant?.phone
    ? [tenant.phone.trim()]
    : [];
  return Array.from(new Set(numbers.filter(Boolean)));
}

export function getFormalTenantGreeting(tenant?: Tenant, fallbackName = ""): string {
  const name = tenant?.name || fallbackName;
  return tenant?.tenantType === "company"
    ? `السادة/ ${name} المحترمون`
    : `السيد/السيدة ${name} المحترم/ة`;
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
    dueDate: formatFormalDate(paymentDueDateValue(payment)),
    periodStart: formatFormalDate(period.start),
    periodEnd: formatFormalDate(period.end),
    contractEndDate: "",
    ownerName: "",
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
  const template = data.settings.emailTemplates[kind];
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
  const emailTemplate = data.settings.emailTemplates.contractExpiry;
  return {
    emailSubject: fillTenantTemplate(emailTemplate.subject, vars, tenant),
    emailBody: fillTenantTemplate(emailTemplate.body, vars, tenant),
    whatsappBody: fillTemplate(data.settings.whatsappTemplates.contractExpiry, vars),
  };
}

function wasRecentlyAttempted(
  data: AppData,
  dedupeKey: string,
  now: Date,
  frequencyDays: number,
): boolean {
  const latest = [...(data.communicationLogs || [])]
    .filter((log) => log.dedupeKey === dedupeKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return false;
  const elapsed = now.getTime() - new Date(latest.createdAt).getTime();
  const retryWindow = latest.status === "sent" ? frequencyDays * DAY : 6 * 60 * 60 * 1000;
  return elapsed < retryWindow;
}

function scheduleIsActive(data: AppData, now: Date, force = false): boolean {
  const settings = data.settings.automaticCommunications;
  if (!settings?.enabled) return false;
  const today = localDate(now);
  if (settings.activeFrom && today < settings.activeFrom) return false;
  if (settings.activeUntil && today > settings.activeUntil) return false;
  if (force) return true;
  const [hour, minute] = (settings.sendTime || "09:00").split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= (hour || 0) * 60 + (minute || 0);
}

export function buildAutomaticCommunicationJobs(data: AppData, now = new Date(), force = false): AutomaticCommunicationJob[] {
  if (!scheduleIsActive(data, now, force)) return [];
  const settings = data.settings.automaticCommunications;
  const today = localDate(now);
  const jobs: AutomaticCommunicationJob[] = [];
  const frequencyDays = Math.max(1, Number(settings.frequencyDays) || 1);

  for (const payment of data.payments) {
    if (payment.deletedAt || isPaymentPaid(payment) || getRemainingPaymentAmount(payment) <= 0) continue;
    const dueDate = paymentDueDateValue(payment);
    const daysUntilDue = Math.ceil((dateValue(dueDate) - dateValue(today)) / DAY);
    if (daysUntilDue > Math.max(0, settings.daysBeforeDue) || daysUntilDue < -Math.max(0, settings.overdueTailDays)) continue;
    const tenant = data.tenants.find((item) =>
      item.id === payment.tenantId
      || (!payment.tenantId && item.unitId === payment.unitId)
    );
    const kind = effectiveStatus(payment) === "overdue" || daysUntilDue < 0 ? "overduePayment" : "paymentReminder";
    const vars = templateVars(data, payment, tenant);
    const emailContent = buildPaymentEmailContent(data, payment, tenant, kind);

    if (settings.emailEnabled && settings.emailProvider) {
      for (const recipient of getTenantEmailAddresses(tenant)) {
        const dedupeKey = `${payment.id}:email:${recipient}:${kind}`;
        if (wasRecentlyAttempted(data, dedupeKey, now, frequencyDays)) continue;
        jobs.push({
          channel: "email",
          recipient,
          tenantId: tenant?.id,
          paymentId: payment.id,
          contractId: payment.contractId,
          templateKind: kind,
          provider: settings.emailProvider,
          subject: emailContent.subject,
          body: emailContent.body,
          dedupeKey,
        });
      }
    }

    if (settings.whatsappEnabled) {
      for (const phone of getTenantPhoneNumbers(tenant)) {
        const recipient = validatePhone(phone);
        if (!recipient) continue;
        const dedupeKey = `${payment.id}:whatsapp:${recipient}:${kind}`;
      if (!wasRecentlyAttempted(data, dedupeKey, now, frequencyDays)) {
        jobs.push({
          channel: "whatsapp",
          recipient,
          tenantId: tenant?.id,
          paymentId: payment.id,
          contractId: payment.contractId,
          templateKind: kind,
          provider: "whatsapp_business",
          body: fillTemplate(data.settings.whatsappTemplates[kind], vars),
          dedupeKey,
        });
      }
      }
    }
  }
  for (const contract of data.contracts) {
    if (contract.deletedAt || contract.status === "cancelled" || contract.status === "terminated" || !contract.endDate) continue;
    const daysUntilEnd = Math.ceil((dateValue(contract.endDate) - dateValue(today)) / DAY);
    if (daysUntilEnd < 0 || daysUntilEnd > Math.max(1, data.settings.contractReminderDays || 60)) continue;
    const tenant = data.tenants.find((item) =>
      item.id === contract.tenantId
      || (!contract.tenantId && item.unitId === contract.unitId)
    );
    const content = buildContractCommunicationContent(data, contract, tenant);
    if (settings.emailEnabled && settings.emailProvider) {
      for (const recipient of getTenantEmailAddresses(tenant)) {
        const dedupeKey = `${contract.id}:email:${recipient}:contractExpiry`;
        if (wasRecentlyAttempted(data, dedupeKey, now, frequencyDays)) continue;
        jobs.push({
          channel: "email",
          recipient,
          tenantId: tenant?.id,
          contractId: contract.id,
          templateKind: "contractExpiry",
          provider: settings.emailProvider,
          subject: content.emailSubject,
          body: content.emailBody,
          dedupeKey,
        });
      }
    }
    if (settings.whatsappEnabled) {
      for (const phone of getTenantPhoneNumbers(tenant)) {
      const recipient = validatePhone(phone);
      if (!recipient) continue;
      const dedupeKey = `${contract.id}:whatsapp:${recipient}:contractExpiry`;
      if (!wasRecentlyAttempted(data, dedupeKey, now, frequencyDays)) {
        jobs.push({
          channel: "whatsapp",
          recipient,
          tenantId: tenant?.id,
          contractId: contract.id,
          templateKind: "contractExpiry",
          provider: "whatsapp_business",
          body: content.whatsappBody,
          dedupeKey,
        });
      }
      }
    }
  }
  return jobs.slice(0, 100);
}

async function executeJob(job: AutomaticCommunicationJob): Promise<void> {
  if (job.provider === "gmail") {
    await sendGmailEmail(job.recipient, job.subject || "تذكير", job.body);
  } else if (job.provider === "outlook") {
    await sendOutlookEmail(job.recipient, job.subject || "تذكير", job.body);
  } else {
    await sendWhatsAppTemplate(job.recipient, job.templateKind, job.body);
  }
}

export async function runAutomaticCommunicationCycle(data: AppData, now = new Date(), force = false): Promise<CommunicationLog[]> {
  if (running) return running;
  running = (async () => {
    const jobs = buildAutomaticCommunicationJobs(data, now, force);
    const logs: CommunicationLog[] = [];
    for (const job of jobs) {
      const createdAt = new Date().toISOString();
      try {
        await executeJob(job);
        logs.push({
          id: `message-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt,
          sentAt: new Date().toISOString(),
          channel: job.channel,
          status: "sent",
          recipient: job.recipient,
          tenantId: job.tenantId,
          paymentId: job.paymentId,
          contractId: job.contractId,
          templateKind: job.templateKind,
          provider: job.provider,
          subject: job.subject,
          dedupeKey: job.dedupeKey,
        });
      } catch (error) {
        logs.push({
          id: `message-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt,
          channel: job.channel,
          status: "failed",
          recipient: job.recipient,
          tenantId: job.tenantId,
          paymentId: job.paymentId,
          contractId: job.contractId,
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
