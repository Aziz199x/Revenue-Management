<<<<<<< HEAD
import { AppData, Payment, Contract, Tenant, PaymentStatus, RentPeriod, RentPeriodNew, ContractDurationType, EjarImportPayment, Building, Unit, PaymentReceiveMethod, CollectionFeeStatus } from "./types";
import { genId } from "./store";
import { isCorruptedArabic } from "@/utils/ejarParser";
import { normalizeId } from "./unitStatus";

export function calcCollectionFee(amount: number, feePercent: number): {
  collectionFeeAmount: number;
  netAmountAfterCollectionFee: number;
} {
  const collectionFeeAmount = amount * feePercent / 100;
  const netAmountAfterCollectionFee = amount - collectionFeeAmount;
  return {
    collectionFeeAmount: Math.round(collectionFeeAmount * 100) / 100,
    netAmountAfterCollectionFee: Math.round(netAmountAfterCollectionFee * 100) / 100,
  };
}

export function getResolvedCollectionFeePercent(building?: Building | null, unit?: Unit | null): number {
  if (unit?.collectionFeeOverrideEnabled === true && unit.collectionFeePercent !== null && unit.collectionFeePercent !== undefined) {
    return Number(unit.collectionFeePercent) || 0;
  }
  return Number(building?.collectionFeePercent) || 0;
}

export const EJAR_COLLECTION_FEE_REASON = "الدفع تم عبر منصة إيجار ووصل المبلغ للمالك مباشرة، ولم يتم تحصيل نسبة المكتب";

export function normalizeReceiveMethod(method?: string | null): PaymentReceiveMethod {
  const value = String(method || "").trim().toLowerCase();
  if (value === "office_collection" || value.includes("office") || value.includes("مكتب")) return "office_collection";
  if (value === "bank_transfer" || value.includes("bank") || value.includes("تحويل")) return "bank_transfer";
  if (value === "cash" || value.includes("نقد")) return "cash";
  if (value === "ejar_platform" || value.includes("ejar") || value.includes("إيجار") || value.includes("ايجار")) return "ejar_platform";
  if (value === "other" || value === "others" || value === "other_method" || value.includes("أخرى") || value.includes("اخرى")) return "other";
  return "other";
}

export function getPaymentReceiveMethod(payment: Payment): PaymentReceiveMethod {
  return normalizeReceiveMethod(payment.receiveMethod ?? payment.paymentMethod);
}

export function getCollectionFeeStatusForReceiveMethod(receiveMethod?: PaymentReceiveMethod, current?: CollectionFeeStatus): CollectionFeeStatus {
  const normalized = normalizeReceiveMethod(receiveMethod);
  if (current === "waived" || current === "settled" || current === "partially_settled") return current;
  if (normalized === "ejar_platform") return "uncollected";
  if (normalized === "office_collection" || normalized === "cash" || normalized === "bank_transfer" || normalized === "other") return "collected";
  return current ?? "uncollected";
}

export function isCollectionFeeCollected(status?: CollectionFeeStatus): boolean {
  return status === "collected" || status === "settled";
}

export function getCollectionFeeSettledAmount(data: Pick<AppData, "collectionFeeSettlements">, payment: Payment): number {
  const direct = payment.collectionFeeSettledAmount ?? 0;
  const fromSettlements = (data.collectionFeeSettlements || [])
    .filter((settlement) => settlement.paymentId === payment.id || settlement.targetPaymentId === payment.id)
    .reduce((sum, settlement) => sum + (Number(settlement.amount) || 0), 0);
  return Math.min(payment.collectionFeeAmount ?? 0, Math.max(direct, fromSettlements));
}

export function getCollectionFeeRemainingAmount(data: Pick<AppData, "collectionFeeSettlements">, payment: Payment): number {
  const fee = payment.collectionFeeAmount ?? 0;
  if (isCollectionFeeCollected(payment.collectionFeeStatus) || payment.collectionFeeStatus === "waived") return 0;
  return Math.max(0, Math.round((fee - getCollectionFeeSettledAmount(data, payment)) * 100) / 100);
}

export function isCollectionFeeOutstanding(data: Pick<AppData, "collectionFeeSettlements">, payment: Payment): boolean {
  return getCollectionFeeRemainingAmount(data, payment) > 0;
}

export function calculateNetAmountToTransferToOwner(payment: Payment): number {
  const gross = payment.grossAmount ?? payment.amount;
  const fee = payment.collectionFeeAmount ?? 0;
  const maintenance = payment.maintenanceDeductionAmount ?? 0;
  const feeDeductedBeforeOwnerTransfer = isCollectionFeeCollected(payment.collectionFeeStatus);
  return Math.round((gross - (feeDeductedBeforeOwnerTransfer ? fee : 0) - maintenance) * 100) / 100;
}

export function getCollectedRentAmount(payment: Payment): number {
  const gross = payment.grossAmount ?? payment.amount;
  if (payment.status === "paid") return payment.receivedAmount ?? payment.paidAmount ?? gross;
  if (payment.status === "partial") return payment.receivedAmount ?? payment.paidAmount ?? 0;
  return 0;
}

export function normalizePaymentFinancials(payment: Payment, feePercent = payment.collectionFeePercent ?? payment.collectionFeePercentage ?? 0): Payment {
  const grossAmount = payment.grossAmount ?? payment.amount;
  const receiveMethod = getPaymentReceiveMethod(payment);
  const collectionFeePercent = feePercent;
  const collectionFeeAmount = payment.collectionFeeAmount ?? calcCollectionFee(grossAmount, collectionFeePercent).collectionFeeAmount;
  const collectionFeeStatus = payment.status === "paid"
    ? getCollectionFeeStatusForReceiveMethod(receiveMethod, payment.collectionFeeStatus)
    : payment.collectionFeeStatus;
  const maintenanceDeductionAmount = payment.maintenanceDeductionAmount ?? 0;
  const nextPayment = {
    ...payment,
    grossAmount,
    paymentMethod: payment.paymentMethod ?? (receiveMethod === "office_collection" ? undefined : receiveMethod),
    receiveMethod,
    collectionFeePercent,
    collectionFeePercentage: payment.collectionFeePercentage ?? collectionFeePercent,
    collectionFeeAmount,
    collectionFeeStatus,
    collectionFeeReason: collectionFeeStatus === "uncollected" && receiveMethod === "ejar_platform"
      ? (payment.collectionFeeReason || EJAR_COLLECTION_FEE_REASON)
      : payment.collectionFeeReason,
    netAmountAfterCollectionFee: payment.netAmountAfterCollectionFee ?? Math.round((grossAmount - collectionFeeAmount) * 100) / 100,
    maintenanceDeductionAmount,
    ownerTransferred: payment.ownerTransferred ?? false,
    ownerTransferDate: payment.ownerTransferDate ?? null,
    ownerTransferMethod: payment.ownerTransferMethod ?? null,
    ownerTransferNotes: payment.ownerTransferNotes ?? "",
  };
  return {
    ...nextPayment,
    netAmountToTransferToOwner: payment.netAmountToTransferToOwner === undefined
      ? calculateNetAmountToTransferToOwner(nextPayment)
      : calculateNetAmountToTransferToOwner(nextPayment),
  };
}

export function applyCollectionFeeToPayment(payment: Payment, feePercent: number): Payment {
  return normalizePaymentFinancials({ ...payment, collectionFeeAmount: undefined }, feePercent);
}

export function migratePaymentsForFees(payments: Payment[]): Payment[] {
  return payments.map((p) => normalizePaymentFinancials(p, p.collectionFeePercent ?? 0));
}

export function ownerTransferStats(payments: Payment[]) {
  const paid = payments.filter((p) => p.status === "paid");
  const normalized = paid.map((p) => normalizePaymentFinancials(p));
  return {
    grossCollected: normalized.reduce((sum, p) => sum + (p.grossAmount ?? p.amount), 0),
    collectionFees: normalized.reduce((sum, p) => sum + (isCollectionFeeCollected(p.collectionFeeStatus) ? (p.collectionFeeAmount ?? 0) : 0), 0),
    uncollectedCollectionFees: normalized.reduce((sum, p) => sum + (p.collectionFeeStatus === "uncollected" ? (p.collectionFeeAmount ?? 0) : 0), 0),
    maintenanceDeductions: normalized.reduce((sum, p) => sum + (p.maintenanceDeductionAmount ?? 0), 0),
    netTransferred: normalized.filter((p) => p.ownerTransferred).reduce((sum, p) => sum + calculateNetAmountToTransferToOwner(p), 0),
    pendingTransfer: normalized.filter((p) => !p.ownerTransferred).reduce((sum, p) => sum + calculateNetAmountToTransferToOwner(p), 0),
  };
}

export function upsertTenant(
  tenants: Tenant[],
  data: {
    name: string;
    phone?: string;
    nationalId?: string;
    email?: string;
    unitId: string;
    buildingId?: string;
    contractId?: string;
  },
): { tenant: Tenant; isNew: boolean } {
  const phone = data.phone?.replace(/[^\d]/g, "");
  const nationalId = data.nationalId?.replace(/[^\d]/g, "");

  let existing: Tenant | undefined;

  if (phone) {
    existing = tenants.find(
      (t) => t.phone?.replace(/[^\d]/g, "") === phone,
    );
  }

  if (!existing && nationalId) {
    existing = tenants.find(
      (t) => t.nationalId?.replace(/[^\d]/g, "") === nationalId,
    );
  }

  if (!existing) {
    existing = tenants.find(
      (t) => t.name.trim().toLowerCase() === data.name.trim().toLowerCase() && t.unitId === data.unitId,
    );
  }

  if (existing) {
    const updated: Tenant = {
      ...existing,
      name: existing.name || data.name,
      phone: existing.phone || phone,
      nationalId: existing.nationalId || nationalId,
      email: existing.email || data.email,
      buildingId: existing.buildingId || data.buildingId,
      activeContractId: data.contractId || existing.activeContractId,
      updatedAt: new Date().toISOString(),
    };
    return { tenant: updated, isNew: false };
  }

  const tenant: Tenant = {
    id: genId(),
    unitId: data.unitId,
    buildingId: data.buildingId,
    name: data.name,
    phone,
    nationalId,
    email: data.email,
    activeContractId: data.contractId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { tenant, isNew: true };
}
=======
import {
  AppData,
  Payment,
  Contract,
  PaymentStatus,
  Unit,
  UnitStatus,
  ContractStatus,
  RentPeriod,
} from "./types";
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

// ===================== Formatting =====================
export function formatMoney(n: number): string {
  return `${(n || 0).toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
}

export function getPaymentAmount(payment: { grossAmount?: number; amount?: number; rentAmount?: number }): number {
  const value = payment.grossAmount ?? payment.amount ?? payment.rentAmount ?? 0;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  return numericValue;
}

export function formatSarAmount(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0 ر.س";
  return `${amount.toLocaleString("ar-SA")} ر.س`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function todayISO(): string {
<<<<<<< HEAD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
=======
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
}

export function daysUntil(iso: string): number {
  const today = new Date(todayISO() + "T00:00:00").getTime();
  const target = new Date(iso + "T00:00:00").getTime();
  return Math.round((target - today) / 86400000);
}

<<<<<<< HEAD
export function normalizeDateToIso(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  console.warn("[Contract Reminder] Could not normalize date:", value);
  return null;
}

export function getDaysUntilDate(dateValue?: unknown): number | null {
  const normalized = normalizeDateToIso(dateValue);
  if (!normalized) return null;
  const target = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(target.getTime())) {
    console.warn("[Contract Reminder] Invalid date:", dateValue);
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getContractEndDate(contract: Contract): string | null {
  const value = contract as Contract & { contractEndDate?: string; expiryDate?: string; end_date?: string; leaseEndDate?: string };
  return normalizeDateToIso(value.endDate || value.contractEndDate || value.expiryDate || value.end_date || value.leaseEndDate);
}

export function shouldShowContractExpiryReminder(contract: Contract | null | undefined, reminderDaysOverride?: number): boolean {
  if (!contract) return false;
  if (contract.deletedAt) return false;
  const excludedStatuses = ["cancelled", "terminated", "eviction_completed", "deleted"];
  if (excludedStatuses.includes(contract.status || "")) return false;
  const today = todayISO();
  const startDate = normalizeDateToIso(contract.startDate);
  const endDate = getContractEndDate(contract);
  if (!startDate || !endDate || startDate > today || endDate < today) return false;
  const daysRemaining = getDaysUntilDate(endDate);
  if (daysRemaining === null) return false;
  if (daysRemaining < 0) return false;
  const reminderDays = Number(reminderDaysOverride ?? contract.expiryReminderDays ?? 80);
  return daysRemaining <= reminderDays;
}

export function hasContinuingContractForUnit(current: Contract, allContracts: Contract[]): boolean {
  const currentEnd = getContractEndDate(current);
  if (!currentEnd) return false;
  const end = new Date(`${currentEnd}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const nextDay = formatLocalDate(end);
  return allContracts.some((contract) => {
    if (contract.id === current.id || normalizeId(contract.unitId) !== normalizeId(current.unitId)) return false;
    if (contract.deletedAt || contract.status === "cancelled" || contract.status === "terminated" || contract.status === "eviction_completed") return false;
    const start = normalizeDateToIso(contract.startDate);
    const contractEnd = getContractEndDate(contract);
    return !!start && !!contractEnd && start <= nextDay && contractEnd > currentEnd;
  });
}

/** Nearest-expiry statistics skip active contracts already covered by renewal. */
export function getActiveContractsNeedingAttention(contracts: Contract[]): Contract[] {
  const today = todayISO();
  return contracts.filter((contract) => {
    if (contract.deletedAt || contract.status === "cancelled" || contract.status === "terminated" || contract.status === "eviction_completed") return false;
    const startDate = normalizeDateToIso(contract.startDate);
    const endDate = getContractEndDate(contract);
    if (!startDate || !endDate || startDate > today || endDate < today) return false;
    return !hasContinuingContractForUnit(contract, contracts);
  }).sort((a, b) => (getContractEndDate(a) || "").localeCompare(getContractEndDate(b) || ""));
}

export function getNearestActiveContractNeedingAttention(contracts: Contract[]): Contract | null {
  return getActiveContractsNeedingAttention(contracts)[0] ?? null;
}

export interface ContractExpiryReminder {
  id: string;
  kind: "contract";
  title: string;
  subtitle: string;
  date: string;
  daysRemaining: number;
  unitId: string;
  contractId: string;
  autoRenewal: boolean;
  reminderWindow: number;
  contractNumber?: string;
  tenantName?: string;
  lessorName?: string;
  unitName?: string;
  buildingName?: string;
}

export function buildContractExpiryReminders(contracts: Contract[], units: { id: string; name: string; buildingId: string }[], buildings: { id: string; name: string }[], reminderDaysOverride?: number): ContractExpiryReminder[] {
  const activeNeedingAttention = new Set(getActiveContractsNeedingAttention(contracts).map((contract) => contract.id));
  return contracts
    .filter((contract) => activeNeedingAttention.has(contract.id) && shouldShowContractExpiryReminder(contract, reminderDaysOverride))
    .map((contract) => {
      const endDate = getContractEndDate(contract);
      const daysRemaining = getDaysUntilDate(endDate);
      const unit = units.find((u) => normalizeId(u.id) === normalizeId(contract.unitId));
      const building = buildings.find((b) => b.id === unit?.buildingId);
      return {
        id: `contract-expiry-${contract.id}`,
        kind: "contract" as const,
        title: contract.autoRenewal
          ? "العقد شارف على الانتهاء وسيتم تجديده تلقائيا"
          : "العقد شارف على الانتهاء ويحتاج إجراء في منصة إيجار",
        subtitle: `${contract.tenantName || "مستأجر غير محدد"}${unit ? ` - ${unit.name}` : ""}${building ? ` - ${building.name}` : ""}`,
        date: endDate || "",
        daysRemaining: daysRemaining ?? 0,
        unitId: String(contract.unitId),
        contractId: contract.id,
        autoRenewal: contract.autoRenewal === true,
        reminderWindow: Number(reminderDaysOverride ?? contract.expiryReminderDays ?? 80),
        contractNumber: contract.contractNumber,
        tenantName: contract.tenantName,
        lessorName: contract.lessorName,
        unitName: unit?.name,
        buildingName: building?.name,
      };
    });
}

export function effectiveStatus(p: Payment): PaymentStatus {
  if (isPaymentPaid(p)) return "paid";
  const dueDate = paymentDueDateValue(p);
  if (dueDate && daysUntil(dueDate) < 0) return "overdue";
  return p.status;
}

export function paymentDueDateValue(payment: { dueDateGregorian?: string; nextDueDate?: string; paymentDate: string }): string {
  return payment.dueDateGregorian || payment.nextDueDate || payment.paymentDate;
}

export function isPaymentPaid(payment: Payment): boolean {
  const value = payment as Payment & { isReceived?: boolean; dueAmount?: number; isDeleted?: boolean; cancelled?: boolean };
  const due = Number(payment.grossAmount ?? payment.amount ?? value.dueAmount ?? 0);
  const received = Number(payment.receivedAmount ?? payment.paidAmount ?? 0);
  return payment.status === "paid" || value.isReceived === true || (due > 0 && received >= due);
}

export function getRemainingPaymentAmount(payment: Payment): number {
  const value = payment as Payment & { dueAmount?: number };
  const due = Number(payment.grossAmount ?? payment.amount ?? value.dueAmount ?? 0);
  const received = isPaymentPaid(payment)
    ? due
    : Number(payment.receivedAmount ?? payment.paidAmount ?? 0);
  return Math.max(0, Math.round((due - received) * 100) / 100);
}

export function isPaymentOverdue(payment: Payment, today = todayISO()): boolean {
  const value = payment as Payment & { isDeleted?: boolean };
  const dueDate = paymentDueDateValue(payment);
  return !!payment
    && !payment.deletedAt
    && !value.isDeleted
    && payment.status !== "cancelled"
    && !isPaymentPaid(payment)
    && !!dueDate
    && dueDate < today
    && getRemainingPaymentAmount(payment) > 0;
}

export function isPaymentUpcoming(payment: Payment, today = todayISO(), reminderDays = 7): boolean {
  const value = payment as Payment & { isDeleted?: boolean };
  const dueDate = paymentDueDateValue(payment);
  const days = dueDate ? daysUntil(dueDate) : Number.POSITIVE_INFINITY;
  return !!payment
    && !payment.deletedAt
    && !value.isDeleted
    && payment.status !== "cancelled"
    && !isPaymentPaid(payment)
    && !!dueDate
    && days >= 0
    && days <= reminderDays;
}

export function isPaymentOverdueForNotification(payment: Payment, today = todayISO()): boolean {
  return isPaymentOverdue(payment, today);
}

export function getPaymentReportYearMonth(paymentDueDate: string): string {
  const dueDate = paymentDueDate;
  const parsed = parseLocalDate(dueDate);
  if (!parsed) return dueDate.slice(0, 7);
  if (parsed.getDate() >= 25) {
    parsed.setMonth(parsed.getMonth() + 1);
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

export function getPaymentReportMonth(payment: { dueDateGregorian?: string; nextDueDate?: string; paymentDate: string }): string {
  const dueDate = payment.dueDateGregorian || payment.nextDueDate || payment.paymentDate;
  return getPaymentReportYearMonth(dueDate);
}

export function getPaymentMaintenanceDeductions(data: AppData, paymentId: string) {
  return data.repairs
    .filter((repair) => repair.deductedFromPaymentId === paymentId && repair.status !== "cancelled")
    .map((repair) => {
      const unit = data.units.find((item) => item.id === repair.unitId);
      const building = data.buildings.find((item) => item.id === (repair.buildingId || unit?.buildingId));
      return {
        repair,
        unit,
        building,
      };
    });
}

export function getPaymentMaintenanceDeductionAmount(data: AppData, payment: Payment): number {
  const linkedTotal = getPaymentMaintenanceDeductions(data, payment.id)
    .reduce((sum, item) => sum + item.repair.cost, 0);
  return linkedTotal || payment.maintenanceDeductionAmount || 0;
}

/** Display-only projection. It never mutates or removes stored installments. */
export function getVisiblePaymentsByContract(
  payments: Payment[],
  options: {
    includePaidHistory?: boolean;
    forceShowAll?: boolean;
    statusFilter?: string;
  } = {},
): Payment[] {
  const cleanPayments = payments.filter((payment) => !payment.deletedAt);
  if (options.statusFilter === "paid") return cleanPayments.filter((payment) => isPaymentPaid(payment));
  if (options.statusFilter === "partial") return cleanPayments.filter((payment) => payment.status === "partial");
  if (options.statusFilter === "overdue") {
    return cleanPayments.filter((payment) => isPaymentOverdue(payment));
  }
  if (options.forceShowAll) {
    return options.includePaidHistory
      ? cleanPayments
      : cleanPayments.filter((payment) => !isPaymentPaid(payment));
  }

  const visible: Payment[] = options.includePaidHistory
    ? cleanPayments.filter((payment) => isPaymentPaid(payment))
    : [];
  const groups = new Map<string, Payment[]>();
  for (const payment of cleanPayments.filter((item) => !isPaymentPaid(item))) {
    const key = payment.contractId || `unit:${payment.unitId || payment.id}`;
    groups.set(key, [...(groups.get(key) || []), payment]);
  }
  for (const group of groups.values()) {
    const dueDate = (payment: Payment) => paymentDueDateValue(payment);
    const sorted = [...group].sort((a, b) => dueDate(a).localeCompare(dueDate(b)));
    const overdue = sorted.filter((payment) => dueDate(payment) < todayISO());
    if (options.statusFilter === "unpaid") {
      const nearestUpcoming = sorted.find((payment) => dueDate(payment) >= todayISO());
      if (nearestUpcoming) visible.push(nearestUpcoming);
    } else {
      visible.push(...(overdue.length ? overdue : sorted.slice(0, 1)));
    }
  }
  return visible.sort((a, b) =>
    (a.dueDateGregorian || a.nextDueDate || a.paymentDate)
      .localeCompare(b.dueDateGregorian || b.nextDueDate || b.paymentDate),
  );
}

=======
// ===================== Date Helpers =====================
/** Adds months to a date string, preserving the day as closely as possible. */
export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Handle month overflow (e.g., Jan 31 + 1 month = Mar 3)
  if (d.getDate() < day) {
    d.setDate(0); // go to last day of previous month
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateLTE(a: string, b: string): boolean {
  return a <= b;
}

export function dateGTE(a: string, b: string): boolean {
  return a >= b;
}

export function dateLT(a: string, b: string): boolean {
  return a < b;
}

// ===================== Payment Status =====================
export function effectiveStatus(p: Payment): PaymentStatus {
  if (p.status === "paid") return "paid";
  if (p.status === "partial") return "partial";
  if (daysUntil(p.dueDate) < 0) return "overdue";
  return "unpaid";
}

// ===================== Contract Status =====================
export function calculateContractStatus(c: Contract, today?: string): ContractStatus {
  const t = today ?? todayISO();
  if (dateLT(c.startDate, t)) return "future";
  if (dateLT(c.endDate, t)) return "expired";
  const daysLeft = daysUntil(c.endDate);
  if (daysLeft <= (c.reminderDays || 30)) return "ending_soon";
  return "active";
}

/** Does this contract cover the given date? */
export function contractCoversDate(c: Contract, dateStr: string): boolean {
  return dateGTE(dateStr, c.startDate) && dateLTE(dateStr, c.endDate);
}

/** Is there another future contract for the same unit starting after this one? */
export function hasNextContract(unitId: string, contracts: Contract[], afterDate: string): boolean {
  return contracts.some(
    (c) => c.unitId === unitId && dateGTE(c.startDate, afterDate) && !dateLT(c.startDate, c.endDate),
  );
}

// ===================== Unit Status Calculation =====================
export function calculateUnitStatus(
  unit: Unit,
  contracts: Contract[],
  today?: string,
): UnitStatus {
  const t = today ?? todayISO();

  // Maintenance takes priority if explicitly set
  if (unit.status === "maintenance" && contracts.filter((c) => c.unitId === unit.id).length === 0) {
    return "maintenance";
  }

  const unitContracts = contracts
    .filter((c) => c.unitId === unit.id)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Find active contract (covers today)
  const active = unitContracts.find((c) => contractCoversDate(c, t));

  if (active) {
    // Check if active contract is ending soon
    const daysLeft = daysUntil(active.endDate);
    if (daysLeft <= (active.reminderDays || 30) && daysLeft >= 0) {
      if (!active.autoRenewal) {
        // Check for next/future contract
        const hasFuture = unitContracts.some(
          (c) =>
            c.id !== active.id &&
            dateGTE(c.startDate, active.endDate) &&
            dateLTE(c.startDate, addMonths(t, 12)),
        );
        if (!hasFuture) {
          return "occupied_no_renewal";
        }
      }
    }
    return "occupied";
  }

  // Check if there's an expired contract but tenant hasn't left
  // (expired recently and no new contract)
  const recentlyExpired = unitContracts.find((c) => {
    const status = calculateContractStatus(c, t);
    return status === "expired" && daysUntil(c.endDate) >= -60;
  });
  if (recentlyExpired) {
    // Check if there's any active or future contract
    const hasActiveOrFuture = unitContracts.some(
      (c) => contractCoversDate(c, t) || dateGTE(c.startDate, t),
    );
    if (!hasActiveOrFuture) {
      return "expired_not_vacated";
    }
  }

  // If only future contracts exist, unit is vacant
  return "vacant";
}

// ===================== Payment Generation =====================
const MONTHS_PER_CYCLE: Record<RentPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annually: 6,
  yearly: 12,
};

export interface GeneratedPayment {
  dueDate: string;
  amount: number;
}

/**
 * Generates a payment schedule for a contract.
 * Total payments always equal annualRent * (duration in years).
 * Each payment = annualRent / (12 / monthsPerCycle) = annualRent * monthsPerCycle / 12
 *
 * Example: annualRent=18000, yearly → 1 payment of 18000 (not 36000)
 * Example: annualRent=18000, monthly → 12 payments of 1500 each
 */
export function generatePaymentSchedule(c: Contract): GeneratedPayment[] {
  const result: GeneratedPayment[] = [];
  const monthsPerCycle = MONTHS_PER_CYCLE[c.paymentCycle] || 1;
  const paymentAmount = Math.round((c.annualRent * monthsPerCycle) / 12);

  let current = c.startDate;
  const endStr = c.endDate;
  // Safety: prevent infinite loops
  let count = 0;
  const maxCount = 480;

  while (dateLTE(current, endStr) && count < maxCount) {
    result.push({ dueDate: current, amount: paymentAmount });
    current = addMonths(current, monthsPerCycle);
    count++;
  }

  // If no payments generated (edge case), create at least one
  if (result.length === 0) {
    result.push({ dueDate: c.startDate, amount: c.annualRent });
  }

  return result;
}

/**
 * Creates full Payment objects from a contract's schedule.
 * Links building/unit/tenant names.
 */
export function generatePaymentsForContract(
  c: Contract,
  data: AppData,
): Payment[] {
  const unit = data.units.find((u) => u.id === c.unitId);
  const building = unit ? data.buildings.find((b) => b.id === unit.buildingId) : undefined;
  const schedule = generatePaymentSchedule(c);

  const buildingPct = building?.collectionPercentage ?? data.settings.collectionFeePercentage ?? 0;
  const contractPct = c.collectionPercentage ?? buildingPct;

  return schedule.map((s, idx) => {
    const collectionFee = Math.round((s.amount * contractPct) / 100);
    return {
      id: `gen-${c.id}-${idx}`,
      contractId: c.id,
      unitId: c.unitId,
      buildingId: unit?.buildingId,
      tenantName: c.tenantName,
      buildingName: building?.name,
      unitName: unit?.name,
      amount: s.amount,
      dueDate: s.dueDate,
      status: "unpaid" as PaymentStatus,
      collectionFeeAmount: collectionFee,
      transferredToOwner: false,
      createdAt: new Date().toISOString(),
    };
  });
}

/**
 * Regenerates payments for a contract while preserving received/paid payments.
 * Called when a contract is edited.
 */
export function regenerateContractPayments(
  contract: Contract,
  existingPayments: Payment[],
  data: AppData,
): Payment[] {
  const newSchedule = generatePaymentsForContract(contract, data);
  // Map existing received/paid payments by dueDate to preserve them
  const receivedMap = new Map<string, Payment>();
  for (const p of existingPayments) {
    if (p.contractId === contract.id && (p.status === "paid" || p.status === "partial")) {
      receivedMap.set(p.dueDate, p);
    }
  }
  return newSchedule.map((np) => {
    const existing = receivedMap.get(np.dueDate);
    if (existing) {
      return { ...np, ...existing, amount: np.amount, contractId: contract.id };
    }
    return np;
  });
}

// ===================== Collection Fee & Owner Net =====================
export function calculateCollectionFee(payment: Payment, data: AppData): number {
  if (payment.collectionFeeAmount != null) return payment.collectionFeeAmount;
  const contract = payment.contractId
    ? data.contracts.find((c) => c.id === payment.contractId)
    : undefined;
  if (contract?.collectionPercentage != null) {
    return Math.round((payment.amount * contract.collectionPercentage) / 100);
  }
  const unit = data.units.find((u) => u.id === payment.unitId);
  const building = unit ? data.buildings.find((b) => b.id === unit.buildingId) : undefined;
  const pct = building?.collectionPercentage ?? data.settings.collectionFeePercentage ?? 0;
  return Math.round((payment.amount * pct) / 100);
}

export function calculateOwnerNet(
  payment: Payment,
  data: AppData,
): number {
  if (payment.status !== "paid" && payment.status !== "partial") return 0;
  const gross = payment.status === "paid" ? payment.amount : payment.paidAmount || 0;
  const fee = calculateCollectionFee(payment, data);
  const deduction = payment.maintenanceDeduction || 0;
  return gross - fee - deduction;
}

// ===================== Building Stats =====================
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
export function buildingStats(data: AppData, buildingId: string) {
  const units = data.units.filter((u) => u.buildingId === buildingId);
  const unitIds = new Set(units.map((u) => u.id));
  const contracts = data.contracts.filter((c) => unitIds.has(c.unitId));
<<<<<<< HEAD
  const repairs = data.repairs.filter((r) => r.buildingId === buildingId || (r.unitId ? unitIds.has(r.unitId) : false));

  const paidPayments = payments
    .filter((p) => p.status === "paid" || p.status === "partial")
    .map((payment) => normalizePaymentFinancials(payment));
  const totalGrossIncome = paidPayments.reduce((s, p) => s + getCollectedRentAmount(p), 0);
  const paymentCollectionFee = (payment: Payment) => payment.collectionFeeAmount
    ?? calcCollectionFee(payment.grossAmount ?? payment.amount, payment.collectionFeePercent ?? 0).collectionFeeAmount;
  const collectedCollectionFees = paidPayments.reduce((s, p) => s + (isCollectionFeeCollected(p.collectionFeeStatus) ? paymentCollectionFee(p) : 0), 0);
  const uncollectedCollectionFees = paidPayments.reduce((s, p) => s + getCollectionFeeRemainingAmount(data, p), 0);
=======
  const payments = data.payments.filter((p) => unitIds.has(p.unitId));
  const repairs = data.repairs.filter(
    (r) => unitIds.has(r.unitId || "") || r.buildingId === buildingId,
  );

  const totalIncome = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

  const totalAnnualRent = contracts.reduce((s, c) => s + c.annualRent, 0);

  const unpaidTotal = payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + p.amount, 0);

  const maintenanceCost = repairs
    .filter((r) => r.status !== "cancelled")
    .reduce((s, r) => s + r.cost, 0);
  const totalNetIncome = Math.round((totalGrossIncome - collectedCollectionFees - maintenanceCost) * 100) / 100;

  const collectionFeeTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + calculateCollectionFee(p, data), 0);

  const netToOwner = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + calculateOwnerNet(p, data), 0);

  const occupied = units.filter((u) =>
    ["occupied", "occupied_no_renewal", "expired_not_vacated"].includes(
      calculateUnitStatus(u, data.contracts),
    ),
  ).length;
  const vacant = units.filter(
    (u) => calculateUnitStatus(u, data.contracts) === "vacant",
  ).length;
  const maintCount = units.filter(
    (u) => calculateUnitStatus(u, data.contracts) === "maintenance",
  ).length;

  const unitPayments = data.payments.filter((p) => unitIds.has(p.unitId));
  const upcomingDue = unitPayments
    .filter((p) => p.status !== "paid" && daysUntil(p.dueDate) >= 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate;

  const nearestExpiry = contracts
    .filter((c) => calculateContractStatus(c) !== "expired")
    .sort((a, b) => a.endDate.localeCompare(b.endDate))[0]?.endDate;

  return {
    unitsCount: units.length,
<<<<<<< HEAD
    occupied: units.filter((u) => u.status === "occupied" || u.status === "rented_not_renewing").length,
    vacant: units.filter((u) => u.status === "vacant").length,
    maintenance: units.filter((u) => u.status === "maintenance").length,
    totalIncome: totalNetIncome,
    totalGrossIncome,
    totalCollectionFees: collectedCollectionFees,
    collectedCollectionFees,
    uncollectedCollectionFees,
    totalNetIncome,
=======
    occupied,
    vacant,
    maintenance: maintCount,
    totalIncome,
    totalAnnualRent,
    unpaidTotal,
    maintenanceCost,
    collectionFeeTotal,
    netToOwner,
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
    upcomingDue,
    nearestExpiry,
  };
}

// ===================== Global Stats =====================
export function globalStats(data: AppData) {
<<<<<<< HEAD
  const paidPayments = data.payments.filter((p) => p.status === "paid").map((payment) => normalizePaymentFinancials(payment));
  const partialPayments = data.payments.filter((p) => p.status === "partial");
  const paidTotal = paidPayments.reduce((s, p) => s + getCollectedRentAmount(p), 0);
  const partialTotal = partialPayments.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const totalGrossIncome = paidPayments.reduce((s, p) => s + getCollectedRentAmount(p), 0);
  const totalCollectionFees = paidPayments.reduce((s, p) => s + (isCollectionFeeCollected(p.collectionFeeStatus) ? (p.collectionFeeAmount ?? 0) : 0), 0);
  const totalUncollectedCollectionFees = paidPayments.reduce((s, p) => s + getCollectionFeeRemainingAmount(data, p), 0);
  const unpaidTotal = data.payments
    .filter((p) => effectiveStatus(p) === "unpaid")
    .reduce((s, p) => s + p.amount, 0);
  const overdueTotal = data.payments
    .filter((p) => effectiveStatus(p) === "overdue")
    .reduce((s, p) => s + (p.amount - (p.paidAmount || 0)), 0);
=======
  const paidTotal = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  const unpaidPayments = data.payments.filter((p) => effectiveStatus(p) === "unpaid");
  const overduePayments = data.payments.filter((p) => effectiveStatus(p) === "overdue");
  const partialTotal = data.payments
    .filter((p) => p.status === "partial")
    .reduce((s, p) => s + (p.paidAmount || 0), 0);

  const unpaidTotal = unpaidPayments.reduce((s, p) => s + p.amount, 0);
  const overdueTotal = overduePayments.reduce((s, p) => s + p.amount, 0);

>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
  const maintenanceTotal = data.repairs
    .filter((r) => r.status !== "cancelled")
    .reduce((s, r) => s + r.cost, 0);
  const totalNetIncome = Math.round((totalGrossIncome - totalCollectionFees - maintenanceTotal) * 100) / 100;
  const transfer = ownerTransferStats(paidPayments);

  const collectionFeeTotal = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + calculateCollectionFee(p, data), 0);

  const netToOwner = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + calculateOwnerNet(p, data), 0);

  const transferredToOwner = data.payments
    .filter((p) => p.status === "paid" && p.transferredToOwner)
    .reduce((s, p) => s + calculateOwnerNet(p, data), 0);

  const notTransferredToOwner = data.payments
    .filter((p) => p.status === "paid" && !p.transferredToOwner)
    .reduce((s, p) => s + calculateOwnerNet(p, data), 0);

  return {
    totalIncome: totalNetIncome,
    paidTotal,
    totalGrossIncome,
    totalCollectionFees,
    totalUncollectedCollectionFees,
    totalNetIncome,
    unpaidTotal,
    overdueTotal,
    maintenanceTotal,
<<<<<<< HEAD
    ...transfer,
  };
}

export interface MonthlyOfficeCollectionReportRow {
  key: string;
  year: number;
  month: number;
  propertyId: string;
  propertyName: string;
  totalDue: number;
  ownerCollected: number;
  rentUncollected: number;
  collectionFeeDue: number;
  collectionFeeCollected: number;
  collectionFeeUncollected: number;
  ejarPayments: number;
  rentCollectionRate: number;
  officeFeeCollectionRate: number;
}

export function monthlyOfficeCollectionReport(data: AppData): MonthlyOfficeCollectionReportRow[] {
  const rows = new Map<string, MonthlyOfficeCollectionReportRow>();
  for (const payment of data.payments.filter((item) => !item.deletedAt)) {
    const reportMonth = getPaymentReportMonth(payment);
    const parsed = parseLocalDate(`${reportMonth}-01`);
    if (!parsed) continue;
    const unit = data.units.find((item) => item.id === payment.unitId);
    const building = data.buildings.find((item) => item.id === unit?.buildingId);
    if (!unit || !building) continue;
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}-${building.id}`;
    const row = rows.get(key) ?? {
      key,
      year,
      month,
      propertyId: building.id,
      propertyName: building.name,
      totalDue: 0,
      ownerCollected: 0,
      rentUncollected: 0,
      collectionFeeDue: 0,
      collectionFeeCollected: 0,
      collectionFeeUncollected: 0,
      ejarPayments: 0,
      rentCollectionRate: 0,
      officeFeeCollectionRate: 0,
    };
    const normalized = normalizePaymentFinancials(payment);
    const gross = normalized.grossAmount ?? normalized.amount;
    const fee = normalized.collectionFeeAmount ?? 0;
    row.totalDue += gross;
    row.collectionFeeDue += fee;
    if (normalized.status === "paid" || normalized.status === "partial") {
      row.ownerCollected += getCollectedRentAmount(normalized);
      if (getPaymentReceiveMethod(normalized) === "ejar_platform") row.ejarPayments += getCollectedRentAmount(normalized);
      if (isCollectionFeeCollected(normalized.collectionFeeStatus)) row.collectionFeeCollected += fee;
      row.collectionFeeUncollected += getCollectionFeeRemainingAmount(data, normalized);
      row.rentUncollected += Math.max(0, gross - getCollectedRentAmount(normalized));
    } else {
      row.rentUncollected += Math.max(0, gross - (normalized.paidAmount ?? 0));
    }
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      totalDue: Math.round(row.totalDue * 100) / 100,
      ownerCollected: Math.round(row.ownerCollected * 100) / 100,
      rentUncollected: Math.round(row.rentUncollected * 100) / 100,
      collectionFeeDue: Math.round(row.collectionFeeDue * 100) / 100,
      collectionFeeCollected: Math.round(row.collectionFeeCollected * 100) / 100,
      collectionFeeUncollected: Math.round(row.collectionFeeUncollected * 100) / 100,
      ejarPayments: Math.round(row.ejarPayments * 100) / 100,
      rentCollectionRate: row.totalDue > 0 ? Math.round((row.ownerCollected / row.totalDue) * 100) : 0,
      officeFeeCollectionRate: row.collectionFeeDue > 0 ? Math.round((row.collectionFeeCollected / row.collectionFeeDue) * 100) : 0,
    }))
    .sort((a, b) => `${b.year}-${String(b.month).padStart(2, "0")}`.localeCompare(`${a.year}-${String(a.month).padStart(2, "0")}`) || a.propertyName.localeCompare(b.propertyName));
}

export function requestStats(data: AppData) {
  const all = data.tenantRequests;
  const open = all.filter((r) => r.status !== "completed" && r.status !== "cancelled");
  const urgent = all.filter((r) => r.priority === "urgent" && r.status !== "completed" && r.status !== "cancelled");
  const overdue = all.filter((r) => {
    if (r.status === "completed" || r.status === "cancelled") return false;
    if (!r.expectedCompletionDate) return false;
    return daysUntil(r.expectedCompletionDate) < 0;
  });
  const completedThisMonth = all.filter((r) => {
    if (r.status !== "completed" || !r.actualCompletionDate) return false;
    const d = new Date(r.actualCompletionDate + "T00:00:00");
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  return { open: open.length, urgent: urgent.length, overdue: overdue.length, completedThisMonth: completedThisMonth.length };
}

export interface ReminderItem {
  id: string;
  kind: "rent" | "contract" | "eviction" | "maintenance" | "bill" | "request";
=======
    collectionFeeTotal,
    netToOwner,
    transferredToOwner,
    notTransferredToOwner,
  };
}

// ===================== Reminders =====================
export interface ReminderItem {
  id: string;
  kind: "rent" | "contract" | "maintenance" | "bill" | "request";
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
  title: string;
  subtitle: string;
  date: string;
  days: number;
<<<<<<< HEAD
  unitId: string;
  reminderWindow?: number;
  amount?: number;
  tenantName?: string;
  autoRenewal?: boolean;
  unitName?: string;
=======
  unitId?: string;
  amount?: number;
  tenantName?: string;
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
}

export function collectReminders(data: AppData): ReminderItem[] {
  const items: ReminderItem[] = [];
  const unitName = (unitId?: string) => {
    if (!unitId) return "";
    const u = data.units.find((x) => x.id === unitId);
    if (!u) return "وحدة محذوفة";
    const b = data.buildings.find((x) => x.id === u.buildingId);
    return b ? `${u.name} - ${b.name}` : u.name;
  };

<<<<<<< HEAD
  for (const p of getVisiblePaymentsByContract(data.payments)) {
    const dueDate = p.dueDateGregorian || p.nextDueDate || p.paymentDate;
    items.push({
      id: `pay-${p.id}`,
      kind: "rent",
      title: "موعد سداد الإيجار",
      subtitle: unitName(p.unitId),
      date: dueDate,
      days: daysUntil(dueDate),
      unitId: p.unitId,
      amount: getRemainingPaymentAmount(p),
      tenantName: p.tenantName,
      unitName: data.units.find((unit) => normalizeId(unit.id) === normalizeId(p.unitId))?.name,
=======
  for (const p of data.payments) {
    if (p.status === "paid") continue;
    const days = daysUntil(p.dueDate);
    if (days < -90) continue; // skip very old
    const unit = data.units.find((u) => u.id === p.unitId);
    const bName = p.buildingName || (unit ? data.buildings.find((b) => b.id === unit.buildingId)?.name : "");
    items.push({
      id: `pay-${p.id}`,
      kind: "rent",
      title: days < 0 ? "إيجار متأخر" : "استحقاق إيجار",
      subtitle: unitName(p.unitId),
      date: p.dueDate,
      days,
      unitId: p.unitId,
      amount: p.amount,
      tenantName: p.tenantName,
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
    });
  }

  for (const c of data.contracts) {
<<<<<<< HEAD
    if (!c.deletedAt && c.status !== "eviction_completed" && (c.status === "eviction_needed" || c.status === "eviction_filed" || c.tenantDidNotLeave)) {
      const endDate = getContractEndDate(c);
      const days = getDaysUntilDate(endDate);
      if (days !== null) {
        const unit = data.units.find((item) => normalizeId(item.id) === normalizeId(c.unitId));
        const building = data.buildings.find((item) => item.id === unit?.buildingId);
        items.push({
          id: `eviction-${c.id}`,
          kind: "eviction",
          title: c.status === "eviction_filed" ? "معاملة إخلاء قيد المتابعة" : "عقد منتهي والمستأجر لم يخرج",
          subtitle: `${c.tenantName || "مستأجر غير محدد"} - ${unit?.name || "وحدة محذوفة"}${building ? ` - ${building.name}` : ""}${c.evictionCaseNumber ? ` - ${c.evictionCaseNumber}` : ""}`,
          date: endDate,
          days,
          unitId: String(c.unitId),
        });
      }
    }
  }

  // Visibility in the app is independent from phone notification permission.
  // The notification scheduler applies notificationsEnabled before scheduling.
  const contractExpiryReminders = buildContractExpiryReminders(
    data.contracts,
    data.units,
    data.buildings,
    data.settings.contractReminderDays,
  );
  for (const r of contractExpiryReminders) {
    items.push({
      id: r.id,
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      date: r.date,
      days: r.daysRemaining,
      unitId: r.unitId,
      reminderWindow: r.reminderWindow,
      autoRenewal: r.autoRenewal,
      unitName: data.units.find((unit) => normalizeId(unit.id) === normalizeId(r.unitId))?.name,
=======
    const status = calculateContractStatus(c);
    if (status === "expired") continue;
    if (status === "future") continue;
    const days = daysUntil(c.endDate);
    if (days < -30) continue;
    const sub = c.tenantName ? `${c.tenantName} - ${unitName(c.unitId)}` : unitName(c.unitId);
    items.push({
      id: `con-${c.id}`,
      kind: "contract",
      title: c.autoRenewal ? "انتهاء عقد (يتجدد تلقائياً)" : "انتهاء عقد",
      subtitle: sub,
      date: c.endDate,
      days,
      unitId: c.unitId,
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
    });
  }

  for (const r of data.repairs) {
    if (r.status !== "pending") continue;
    items.push({
      id: `rep-${r.id}`,
      kind: "maintenance",
      title: "صيانة معلقة",
      subtitle: r.description,
      date: r.repairDate,
      days: daysUntil(r.repairDate),
      unitId: r.unitId,
    });
  }

  for (const b of data.bills) {
    if (b.status === "paid" || !b.dueDate) continue;
    items.push({
      id: `bill-${b.id}`,
      kind: "bill",
      title: "فاتورة مستحقة",
      subtitle: unitName(b.unitId),
      date: b.dueDate,
      days: daysUntil(b.dueDate),
      unitId: b.unitId,
    });
  }

<<<<<<< HEAD
  for (const r of data.tenantRequests) {
    if (r.status === "completed" || r.status === "cancelled") continue;
    if (r.priority === "urgent") {
      items.push({
        id: `req-${r.id}`,
        kind: "request",
        title: `طلب عاجل: ${r.title}`,
        subtitle: unitName(r.unitId),
        date: r.requestDate,
        days: daysUntil(r.requestDate),
        unitId: r.unitId,
      });
    }
    if (r.expectedCompletionDate && r.status !== "completed") {
      const ed = daysUntil(r.expectedCompletionDate);
      if (ed >= 0 && ed <= 7) {
        items.push({
          id: `reqdue-${r.id}`,
          kind: "request",
          title: `موعد تسليم: ${r.title}`,
          subtitle: unitName(r.unitId),
          date: r.expectedCompletionDate,
          days: ed,
          unitId: r.unitId,
        });
      }
    }
=======
  for (const rq of data.tenantRequests) {
    if (rq.status === "completed" || rq.status === "cancelled") continue;
    if (!rq.expectedCompletionDate) continue;
    const days = daysUntil(rq.expectedCompletionDate);
    if (days < -30) continue;
    items.push({
      id: `req-${rq.id}`,
      kind: "request",
      title: rq.priority === "urgent" ? `طلب عاجل: ${rq.title}` : `طلب: ${rq.title}`,
      subtitle: unitName(rq.unitId),
      date: rq.expectedCompletionDate,
      days,
      unitId: rq.unitId,
    });
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
  }

  return items.sort((a, b) => a.days - b.days);
}

<<<<<<< HEAD
export interface PaymentCard {
  id: string;
  paymentId: string;
  tenantName: string;
  buildingName: string;
  unitName: string;
  amount: number;
  dueDate: string;
  days: number;
  status: "upcoming" | "overdue";
}

export function collectPaymentCards(data: AppData): PaymentCard[] {
  const cards: PaymentCard[] = [];

  for (const p of getVisiblePaymentsByContract(data.payments)) {
    const unit = data.units.find((u) => u.id === p.unitId);
    if (!unit) continue;
    const building = data.buildings.find((b) => b.id === unit.buildingId);
    const tenant = data.tenants.find((t) => t.unitId === p.unitId);
    const dueDate = p.dueDateGregorian || p.nextDueDate || p.paymentDate;
    const days = daysUntil(dueDate);

    cards.push({
      id: `pc-${p.id}`,
      paymentId: p.id,
      tenantName: p.tenantName && !isCorruptedArabic(p.tenantName)
        ? p.tenantName
        : tenant?.name && !isCorruptedArabic(tenant.name) ? tenant.name : "مستأجر غير محدد",
      buildingName: p.buildingName || building?.name || "—",
      unitName: p.unitName || unit.name,
      amount: p.amount,
      dueDate,
      days,
      status: days < 0 ? "overdue" : "upcoming",
    });
  }

  return cards.sort((a, b) => a.days - b.days);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0);
  }
  return d;
}

export function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addMonthsClamped(date: Date, months: number): Date {
  const originalDay = date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

export function generatePaymentDueDates(startDate: string, endDate: string, paymentCycle: string): string[] {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end || start > end) return [];
  const interval = getPaymentIntervalMonths(paymentCycle as RentPeriodNew);
  const dates: string[] = [];
  let current = new Date(start);
  while (current <= end) {
    dates.push(formatLocalDate(current));
    current = addMonthsClamped(current, interval);
  }
  return dates;
}

export function getPaymentIntervalMonths(frequency: RentPeriod | RentPeriodNew): number {
  switch (frequency) {
    case "monthly": return 1;
    case "quarterly": return 3;
    case "semi_annually":
    case "semi_annual": return 6;
    case "yearly":
    case "annual": return 12;
    case "flexible":
    case "custom":
    case "imported_schedule": return 1;
  }
}

export function getPaymentsPerYear(paymentCycle: string): number {
  switch (paymentCycle) {
    case "monthly": return 12;
    case "quarterly": return 4;
    case "semi_annually":
    case "semi_annual": return 2;
    case "yearly":
    case "annual": return 1;
    default: return 1;
  }
}

export function calculateInstallmentAmount(annualRent: number, paymentCycle: string): number {
  const paymentsPerYear = getPaymentsPerYear(paymentCycle);
  if (paymentsPerYear <= 0) return annualRent;
  return Number((annualRent / paymentsPerYear).toFixed(2));
}

export function getContractDurationMonths(
  durationType: ContractDurationType,
  customMonths?: number,
): number {
  switch (durationType) {
    case "6_months": return 6;
    case "1_year": return 12;
    case "2_years": return 24;
    case "custom": return Math.max(1, customMonths || 1);
    case "manual_end": return 0;
  }
}

export function calculateEndDate(
  startDate: string,
  durationType: ContractDurationType,
  customMonths?: number,
  manualEndDate?: string,
): string {
  if (durationType === "manual_end" && manualEndDate) {
    return manualEndDate;
  }
  const months = getContractDurationMonths(durationType, customMonths);
  if (months === 0) return "";
  if (!startDate) return "";
  const d = new Date(startDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const date = addMonths(d, months);
  // Contracts use an inclusive end date: one year from 2026-07-04 ends 2027-07-03.
  date.setDate(date.getDate() - 1);
  if (Number.isNaN(date.getTime())) return "";
  return toIsoDateOnly(date);
}

export function toIsoDateOnly(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function validateContractForPayments(contract: Contract): string | null {
  if (!contract.tenantName?.trim()) return "يرجى إدخال اسم المستأجر";
  if (!Number.isFinite(contract.rentAmount) || Number(contract.rentAmount) <= 0) {
    return "يرجى إدخال مبلغ إيجار صحيح";
  }
  if (!contract.paymentFrequency) return "يرجى اختيار دورة الدفع";
  if (!isValidDate(contract.startDate)) return "يرجى اختيار تاريخ بداية صحيح";
  if (!isValidDate(contract.endDate)) return "يرجى اختيار تاريخ نهاية صحيح";
  if (new Date(`${contract.endDate}T00:00:00`) <= new Date(`${contract.startDate}T00:00:00`)) {
    return "تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية";
  }
  if (!Number.isFinite(contract.expiryReminderDays) || contract.expiryReminderDays <= 0) {
    return "يرجى إدخال مدة تذكير صحيحة";
  }
  return null;
}

export function generatePaymentsFromContract(
  contract: Contract,
  buildingName: string,
  unitName: string,
  tenantName: string,
  tenantId?: string,
  tenantPhone?: string,
): Payment[] {
  const payments: Payment[] = [];
  if (validateContractForPayments(contract)) return payments;
  const freq = contract.paymentFrequency || "monthly";
  const annualRent = contract.rentAmount || 0;
  const installmentAmount = calculateInstallmentAmount(annualRent, freq);

  if (!contract.startDate || !contract.endDate) return payments;

  const dueDates = freq === "imported_schedule" ? [] : generatePaymentDueDates(contract.startDate, contract.endDate, freq);

  const feePercent = contract.collectionFeePercent ?? 0;

  for (let i = 0; i < dueDates.length; i++) {
    const dueStr = dueDates[i];
    const amount = installmentAmount;

    const { collectionFeeAmount, netAmountAfterCollectionFee } = calcCollectionFee(amount, feePercent);

    payments.push({
      id: genId(),
      unitId: contract.unitId,
      contractId: contract.id,
      tenantId,
      tenantPhone,
      amount,
      paymentDate: dueStr,
      nextDueDate: dueStr,
      status: "unpaid",
      buildingName,
      unitName,
      tenantName,
      paymentNumber: i + 1,
      grossAmount: amount,
      collectionFeePercent: feePercent,
      collectionFeeAmount,
      netAmountAfterCollectionFee,
      createdAt: new Date().toISOString(),
    });
  }

  console.log("[Payment Generation]", { contractId: contract.id, annualRent, paymentCycle: freq, dueDates, generatedPaymentsCount: payments.length, installmentAmount, totalContractValue: payments.reduce((sum, payment) => sum + payment.grossAmount!, 0) });

  return payments;
}

export function generatePaymentsFromEjarImport(
  contract: Contract,
  ejarPayments: EjarImportPayment[],
  buildingName: string,
  unitName: string,
  tenantName: string,
  tenantId?: string,
  tenantPhone?: string,
): Payment[] {
  const feePercent = contract.collectionFeePercent ?? 0;
  return ejarPayments.map((ep) => {
    const dueDate = ep.dueDateGregorian || contract.startDate;
    const amount = Number(ep.amount) || contract.rentAmount || 0;
    const { collectionFeeAmount, netAmountAfterCollectionFee } = calcCollectionFee(amount, feePercent);
    return {
      id: genId(),
      unitId: contract.unitId,
      contractId: contract.id,
      tenantId,
      tenantPhone,
      amount,
      paymentDate: dueDate,
      nextDueDate: dueDate,
      status: "unpaid",
      buildingName,
      unitName,
      tenantName,
      paymentNumber: ep.paymentNumber,
      dueDateGregorian: ep.dueDateGregorian,
      dueDateHijri: ep.dueDateHijri,
      paymentDeadlineGregorian: ep.paymentDeadlineGregorian,
      paymentDeadlineHijri: ep.paymentDeadlineHijri,
      rentalPeriod: ep.rentalPeriod,
      grossAmount: amount,
      collectionFeePercent: feePercent,
      collectionFeeAmount,
      netAmountAfterCollectionFee,
      createdAt: new Date().toISOString(),
    };
  });
}

export function regenerateUnpaidPayments(
  contract: Contract,
  existingPayments: Payment[],
  buildingName: string,
  unitName: string,
  tenantName: string,
  tenantId?: string,
  tenantPhone?: string,
): Payment[] {
  const newPayments = generatePaymentsFromContract(contract, buildingName, unitName, tenantName, tenantId, tenantPhone);
  const paidPayments = existingPayments.filter(
    (p) => p.status === "paid" || p.status === "partial",
  );
  const newPaidPayments = paidPayments.map((pp) => {
    const match = newPayments.find(
      (np) => np.paymentDate === pp.paymentDate && np.contractId === pp.contractId,
    );
    if (match) {
      return { ...match, ...pp };
    }
    return pp;
  });
  const unpaidNew = newPayments.filter(
    (np) => !paidPayments.some((pp) => pp.paymentDate === np.paymentDate),
  );
  return [...newPaidPayments, ...unpaidNew];
=======
// ===================== Tenant Helpers =====================
export function getActiveTenantForUnit(unitId: string, data: AppData): string | undefined {
  const t = todayISO();
  const activeContract = data.contracts.find(
    (c) => c.unitId === unitId && contractCoversDate(c, t),
  );
  if (activeContract) return activeContract.tenantName;
  const tenant = data.tenants.find((x) => x.unitId === unitId);
  return tenant?.name;
}

export function tenantStats(data: AppData, tenantName: string) {
  const payments = data.payments.filter((p) => p.tenantName === tenantName);
  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const unpaidTotal = payments
    .filter((p) => effectiveStatus(p) !== "paid")
    .reduce((s, p) => s + p.amount, 0);
  return { paidTotal, unpaidTotal, paymentCount: payments.length };
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
}
