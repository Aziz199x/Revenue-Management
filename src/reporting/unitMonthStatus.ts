import { AppData, Contract, Payment, Unit } from "@/data/types";
import {
  getContractEndDate,
  generatePaymentDueDates,
  calculateInstallmentAmount,
  normalizePaymentFinancials,
  getCollectedRentAmount,
  getPaymentReceiveMethod,
  getCollectionFeeRemainingAmount,
  formatDate,
  formatMoney,
  todayISO,
} from "@/data/helpers";
import { normalizeId } from "@/data/unitStatus";
import { UnitMonthRow } from "./types";
import {
  getDueYearMonth,
  getDueDate,
  getCollectionDate,
  getDelayDays,
  isLateCollection,
  isEarlyCollection,
  monthStart,
  monthEnd,
  shiftYearMonth,
  getPaymentReportYearMonth,
  currentYearMonth,
} from "./dateUtils";

/**
 * Deleted and cancelled contracts create no reporting obligation. A contract
 * that ended normally (or was terminated after occupancy) keeps the history
 * of the months covered by its recorded start/end dates.
 */
function isLiveContract(contract: Contract): boolean {
  return !contract.deletedAt && contract.status !== "cancelled";
}

/**
 * The real end of occupancy for month-overlap purposes. eviction_completed
 * contracts keep their originally-planned endDate on record even though the
 * tenancy actually ended earlier — evictionCompletedDate (when set) is the
 * true end of occupancy, so months after it correctly fall back to vacant
 * instead of being treated as still occupied.
 */
function contractEffectiveEndDate(contract: Contract): string | null {
  if (contract.status === "eviction_completed" && contract.evictionCompletedDate) {
    return contract.evictionCompletedDate;
  }
  return getContractEndDate(contract) || contract.endDate || null;
}

/**
 * A contract with no (parsable) end date is OPEN-ENDED, not non-existent.
 * It overlaps every month from its start date onwards. Requiring an end date
 * here was silently reporting occupied units as vacant.
 */
function contractOverlapsMonth(contract: Contract, yearMonth: string): boolean {
  const start = contract.startDate;
  if (!start) return false;
  const end = contractEffectiveEndDate(contract);
  return start <= monthEnd(yearMonth) && (!end || end >= monthStart(yearMonth));
}

/**
 * True if the unit had a live contract covering the given accounting month.
 * Used to filter out orphaned payment records (e.g. leftover installments
 * from a contract that was deleted/shortened) from "late payments" — a unit
 * that was genuinely vacant during a month must never show owed money for it.
 */
export function hasLiveContractForMonth(data: AppData, unitId: string, yearMonth: string): boolean {
  const key = normalizeId(unitId);
  return data.contracts.some(
    (c) => isLiveContract(c) && normalizeId(c.unitId) === key && contractOverlapsMonth(c, yearMonth),
  );
}

// ---------------------------------------------------------------------------
// InstallmentScheduleService
// ---------------------------------------------------------------------------
// The single source of EXPECTED money. Amount and due dates come from the
// CONTRACT — never from payment records. Payments only settle installments.

export interface ExpectedInstallment {
  dueDate: string;
  dueYearMonth: string;
  amount: number;
}

export function getContractInstallmentsForMonth(
  contract: Contract,
  unit: Unit,
  yearMonth: string,
  cutoffDay: number | null = 25,
  recordedPayments: Payment[] = [],
): ExpectedInstallment[] {
  if (!contract.startDate) return [];
  const cycle = contract.paymentFrequency || unit.rentPeriod || "monthly";
  // Open-ended contract: synthesize a horizon just past the requested month so
  // the schedule generator can emit the installment(s) for that month.
  const endDate = getContractEndDate(contract) || contract.endDate || monthEnd(shiftYearMonth(yearMonth, 1));
  const amount = expectedInstallmentAmount(contract, unit);
  return generatePaymentDueDates(contract.startDate, endDate, cycle)
    .map((dueDate): ExpectedInstallment => {
      const recorded = recordedPayments.find((payment) => getDueDate(payment) === dueDate);
      return {
        dueDate,
        dueYearMonth: (recorded?.reportingYearMonth && /^\d{4}-\d{2}$/.test(recorded.reportingYearMonth))
          ? recorded.reportingYearMonth
          : getPaymentReportYearMonth(dueDate, cutoffDay, recorded?.reportingMonthMode ?? "auto"),
        amount,
      };
    })
    .filter((inst) => inst.dueYearMonth === yearMonth);
}

export function expectedInstallmentAmount(contract: Contract, unit: Unit): number {
  const cycle = contract.paymentFrequency || unit.rentPeriod || "monthly";
  const annualRent = contract.annualRent ?? contract.totalContractValue ?? contract.rentAmount ?? unit.rentAmount;
  return calculateInstallmentAmount(Number(annualRent) || 0, cycle);
}

// ---------------------------------------------------------------------------
// PaymentMatchingService
// ---------------------------------------------------------------------------
// Matches payment records by unit + real due month. Contract ids in older data
// can become stale after contract edits/regeneration, so they are not allowed
// to hide an otherwise valid payment from its historical month.

export interface MatchedPayments {
  payments: Payment[];
  collectedAmount: number;
  /** Payment records beyond what the installment schedule expects. */
  duplicatePaymentIds: string[];
}

export function matchPaymentsForUnitMonth(
  unitPayments: Payment[],
  _contract: Contract | undefined,
  yearMonth: string,
  expectedCount: number,
  cutoffDay: number | null = 25,
): MatchedPayments {
  const matched = unitPayments
    .filter((p) => getDueYearMonth(p, cutoffDay) === yearMonth)
    .sort((a, b) => (getCollectedRentAmount(b) - getCollectedRentAmount(a)));

  // Duplicate detection: more meaningful records than expected installments.
  // Only the strongest expected records affect totals; duplicates are flagged
  // for review but cannot inflate revenue or the collection rate above reality.
  const meaningful = matched.filter((p) => (p.grossAmount ?? p.amount) > 0 || getCollectedRentAmount(p) > 0);
  const allowed = Math.max(expectedCount, 1);
  const canonical = meaningful.slice(0, allowed);
  const collectedAmount = Math.round(canonical.reduce((sum, p) => sum + getCollectedRentAmount(p), 0) * 100) / 100;
  const duplicatePaymentIds = meaningful.length > allowed ? meaningful.slice(allowed).map((p) => p.id) : [];

  return { payments: matched, collectedAmount, duplicatePaymentIds };
}

// ---------------------------------------------------------------------------
// Unit month rows
// ---------------------------------------------------------------------------

/**
 * One row per unit — units are NEVER hidden. Core rules:
 *  - Expected rent ALWAYS comes from the contract's installment schedule.
 *    A payment record (even a 0-amount placeholder) never defines what is due.
 *  - A unit with no active contract in the month is Vacant / Future Contract /
 *    No Contract — never Late or Unpaid.
 *  - Due date decides the obligation month. Early payments stay in that month;
 *    late cash is also exposed in the later month's late-collections view.
 */
export function buildUnitMonthRows(data: AppData, buildingId: string, yearMonth: string): UnitMonthRow[] {
  const units = data.units.filter((u) => u.buildingId === buildingId);
  const unitIdSet = new Set(units.map((u) => normalizeId(u.id)));
  const contracts = data.contracts.filter((c) => isLiveContract(c) && unitIdSet.has(normalizeId(c.unitId)));
  const paymentsByUnit = new Map<string, Payment[]>();
  for (const raw of data.payments) {
    if (raw.deletedAt) continue;
    const key = normalizeId(raw.unitId);
    if (!unitIdSet.has(key)) continue;
    const list = paymentsByUnit.get(key) || [];
    list.push(normalizePaymentFinancials(raw));
    paymentsByUnit.set(key, list);
  }

  const today = todayISO();
  const isCurrentMonth = yearMonth === currentYearMonth();

  return units.map((unit): UnitMonthRow => {
    const base = {
      unitId: unit.id,
      unitName: unit.name,
      buildingId,
      rentAmount: 0,
      collectedAmount: 0,
      outstandingAmount: 0,
      delayDays: 0,
      officeFeeAmount: 0,
      officeFeeOutstanding: 0,
      duplicatePaymentIds: [] as string[],
    };

    // Unit-level "maintenance" is a live operational flag; applying it to past
    // months would rewrite history, so it only affects the current month.
    if (isCurrentMonth && unit.status === "maintenance") {
      return { ...base, status: "maintenance", message: "الوحدة تحت الصيانة هذا الشهر" };
    }

    const unitContracts = contracts
      .filter((c) => normalizeId(c.unitId) === normalizeId(unit.id))
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));

    if (unitContracts.length === 0) {
      return { ...base, status: "vacant", message: "الوحدة شاغرة ولم يتم تأجيرها خلال هذا الشهر" };
    }

    const overlapping = unitContracts
      .filter((c) => contractOverlapsMonth(c, yearMonth))
      .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    const contract = overlapping[0];

    if (!contract) {
      const futureContracts = unitContracts.filter((c) => (c.startDate || "") > monthEnd(yearMonth));
      const nextContract = futureContracts.sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      return {
        ...base,
        status: "vacant",
        message: nextContract
          ? `الوحدة شاغرة خلال هذا الشهر، والعقد التالي يبدأ بتاريخ ${formatDate(nextContract.startDate)}`
          : "الوحدة شاغرة ولم يتم تأجيرها خلال هذا الشهر",
      };
    }

    const unitPayments = paymentsByUnit.get(normalizeId(unit.id)) || [];
    // Expected money comes ONLY from the contract schedule. A per-payment
    // reporting override moves the matching scheduled obligation with it, so
    // the same installment can never appear as owed in two different months.
    const installments = getContractInstallmentsForMonth(contract, unit, yearMonth, data.settings.reportMonthCutoffDay, unitPayments);
    const scheduledExpectedAmount = Math.round(installments.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
    const primaryDueDate = installments.map((i) => i.dueDate).sort()[0];

    const match = matchPaymentsForUnitMonth(unitPayments, contract, yearMonth, installments.length, data.settings.reportMonthCutoffDay);
    // When an actual installment record exists, trust its stored due amount.
    // This keeps historical reports correct after the rent or contract amount
    // is edited later and prevents a fully-paid old installment from becoming
    // "partial" merely because today's contract amount is different.
    const recordedExpectedAmount = match.payments.reduce(
      (highest, payment) => Math.max(highest, Number(payment.grossAmount ?? payment.amount) || 0),
      0,
    );
    const expectedAmount = recordedExpectedAmount > 0 ? recordedExpectedAmount : scheduledExpectedAmount;
    const tenantName = match.payments[0]?.tenantName || contract.tenantName;
    const tenantPhone = match.payments[0]?.tenantPhone || contract.tenantPhone;

    // No installment expected AND nothing was actually collected either —
    // e.g. a quarterly contract between billing months. Never "late/unpaid".
    if (installments.length === 0 && match.payments.length === 0) {
      return {
        ...base,
        status: "occupied_no_due",
        contractId: contract.id,
        tenantName,
        tenantPhone,
        message: "لا يوجد استحقاق إيجار لهذه الوحدة هذا الشهر (دورة سداد غير شهرية)",
      };
    }

    const outstandingAmount = Math.max(0, Math.round((expectedAmount - match.collectedAmount) * 100) / 100);
    const paidPayment = match.payments.find((p) => p.status === "paid");
    const partialPayment = match.payments.find((p) => p.status === "partial");
    const primaryPayment = paidPayment || partialPayment || match.payments[0];

    const hasCollectedRent = match.collectedAmount > 0;
    const receiveMethod = hasCollectedRent && primaryPayment ? getPaymentReceiveMethod(primaryPayment) : undefined;
    const officeFeeAmount = hasCollectedRent ? match.payments.reduce((sum, p) => sum + (getCollectedRentAmount(p) > 0 ? (p.collectionFeeAmount ?? 0) : 0), 0) : 0;
    const officeFeeOutstanding = hasCollectedRent && primaryPayment ? getCollectionFeeRemainingAmount(data, primaryPayment) : 0;

    let status: UnitMonthRow["status"];
    let message: string;
    let delayDays = 0;
    let collectionDate: string | undefined;

    if (expectedAmount > 0 && match.collectedAmount >= expectedAmount && paidPayment) {
      delayDays = getDelayDays(paidPayment);
      collectionDate = getCollectionDate(paidPayment);
      if (isLateCollection(paidPayment)) {
        status = "occupied_paid_late";
        const cashMonth = getCollectionDate(paidPayment)?.slice(0, 7);
        message = collectionDate
          ? `تم السداد بتاريخ ${formatDate(collectionDate)} بعد موعد الاستحقاق ${formatDate(getDueDate(paidPayment))} بتأخير ${delayDays} يوم. أُغلق استحقاق ${yearMonth}، وسُجل التحصيل النقدي ضمن ${cashMonth || yearMonth}.`
          : `تم السداد متأخراً ${delayDays} يوم عن موعد الاستحقاق.`;
      } else if (receiveMethod === "ejar_platform") {
        status = "occupied_ejar";
        message = "تم التحصيل عبر منصة إيجار في الموعد";
      } else if (isEarlyCollection(paidPayment) && collectionDate) {
        status = "occupied_paid";
        message = `تم الدفع مبكراً بتاريخ ${formatDate(collectionDate)} قبل موعد الاستحقاق ${formatDate(getDueDate(paidPayment))}، وبقيت الدفعة محسوبة ضمن شهر الاستحقاق ${yearMonth}.`;
      } else {
        status = "occupied_paid";
        message = collectionDate ? `تم السداد في الموعد بتاريخ ${formatDate(collectionDate)}.` : "تم السداد في الموعد.";
      }
    } else if (match.collectedAmount > 0) {
      status = "occupied_partial";
      delayDays = primaryDueDate ? getDelayDays({ ...(partialPayment || match.payments[0]), dueDateGregorian: primaryDueDate, paymentDate: primaryDueDate, status: "unpaid" } as Payment, today) : 0;
      message = `تم سداد ${formatMoney(match.collectedAmount)} من أصل ${formatMoney(expectedAmount)}، المتبقي ${formatMoney(outstandingAmount)}.`;
    } else {
      status = "occupied_unpaid";
      const dueForDelay = primaryDueDate || primaryPayment?.dueDateGregorian || primaryPayment?.paymentDate;
      delayDays = dueForDelay ? getDelayDays({ dueDateGregorian: dueForDelay, paymentDate: dueForDelay, status: "unpaid" } as Payment, today) : 0;
      message = delayDays > 0
        ? `متأخر السداد منذ ${delayDays} يوم (موعد الاستحقاق ${formatDate(dueForDelay)}).`
        : dueForDelay && dueForDelay > today
          ? `لم يحن بعد موعد السداد (${formatDate(dueForDelay)}).`
          : "لم يتم تسجيل سداد لهذا الشهر.";
    }

    return {
      unitId: unit.id,
      unitName: unit.name,
      buildingId,
      tenantName,
      tenantPhone,
      status,
      contractId: contract.id,
      paymentId: primaryPayment?.id,
      dueDate: primaryDueDate || primaryPayment?.dueDateGregorian || primaryPayment?.paymentDate,
      rentAmount: expectedAmount,
      collectedAmount: match.collectedAmount,
      outstandingAmount,
      collectionDate,
      delayDays,
      collectionMethod: receiveMethod,
      officeFeeAmount: Math.round(officeFeeAmount * 100) / 100,
      officeFeeStatus: hasCollectedRent ? primaryPayment?.collectionFeeStatus : undefined,
      officeFeeOutstanding,
      duplicatePaymentIds: match.duplicatePaymentIds,
      message,
    };
  });
}
