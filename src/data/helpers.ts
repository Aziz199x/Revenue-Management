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

// ===================== Formatting =====================
export function formatMoney(n: number): string {
  return `${(n || 0).toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntil(iso: string): number {
  const today = new Date(todayISO() + "T00:00:00").getTime();
  const target = new Date(iso + "T00:00:00").getTime();
  return Math.round((target - today) / 86400000);
}

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
export function buildingStats(data: AppData, buildingId: string) {
  const units = data.units.filter((u) => u.buildingId === buildingId);
  const unitIds = new Set(units.map((u) => u.id));
  const contracts = data.contracts.filter((c) => unitIds.has(c.unitId));
  const payments = data.payments.filter((p) => unitIds.has(p.unitId));
  const repairs = data.repairs.filter(
    (r) => unitIds.has(r.unitId || "") || r.buildingId === buildingId,
  );

  const totalIncome = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  const totalAnnualRent = contracts.reduce((s, c) => s + c.annualRent, 0);

  const unpaidTotal = payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + p.amount, 0);

  const maintenanceCost = repairs
    .filter((r) => r.status !== "cancelled")
    .reduce((s, r) => s + r.cost, 0);

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
    occupied,
    vacant,
    maintenance: maintCount,
    totalIncome,
    totalAnnualRent,
    unpaidTotal,
    maintenanceCost,
    collectionFeeTotal,
    netToOwner,
    upcomingDue,
    nearestExpiry,
  };
}

// ===================== Global Stats =====================
export function globalStats(data: AppData) {
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

  const maintenanceTotal = data.repairs
    .filter((r) => r.status !== "cancelled")
    .reduce((s, r) => s + r.cost, 0);

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
    totalIncome: paidTotal + partialTotal,
    paidTotal,
    unpaidTotal,
    overdueTotal,
    maintenanceTotal,
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
  title: string;
  subtitle: string;
  date: string;
  days: number;
  unitId?: string;
  amount?: number;
  tenantName?: string;
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
    });
  }

  for (const c of data.contracts) {
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
  }

  return items.sort((a, b) => a.days - b.days);
}

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
}
