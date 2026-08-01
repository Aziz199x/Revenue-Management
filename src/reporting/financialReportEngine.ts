import { AppData } from "@/data/types";
import {
  normalizePaymentFinancials,
  getPaymentReceiveMethod,
  isPaymentOverdue,
  getRemainingPaymentAmount,
  shouldShowContractExpiryReminder,
  getContractEndDate,
  getDaysUntilDate,
  hasContinuingContractForUnit,
} from "@/data/helpers";
import { normalizeId } from "@/data/unitStatus";
import { buildUnitMonthRows, hasLiveContractForMonth } from "./unitMonthStatus";
import { getDueYearMonth, getCollectionYearMonth, getDelayDays, getCollectionDate } from "./dateUtils";
import { LateCollectionRow, LatePaymentRow, MonthlyReport } from "./types";

/**
 * LateCollectionService — cash received during yearMonth that was due in a
 * STRICTLY EARLIER month. Pure cash-flow view; never changes the original due
 * month's expected rent. A payment due next month that happens to get paid
 * early (different calendar month, but not yet due) is NOT a late collection —
 * only `dueYearMonth < yearMonth` counts.
 */
export function generateLateCollectionsReport(data: AppData, buildingId: string, yearMonth: string): LateCollectionRow[] {
  const unitIds = new Set(data.units.filter((u) => u.buildingId === buildingId).map((u) => u.id));
  return data.payments
    .filter((p) => !p.deletedAt && unitIds.has(p.unitId))
    .map((p) => normalizePaymentFinancials(p))
    .filter((p) => p.status === "paid" && getCollectionYearMonth(p) === yearMonth && getDueYearMonth(p, data.settings.reportMonthCutoffDay) < yearMonth)
    .map((p): LateCollectionRow => {
      const unit = data.units.find((u) => u.id === p.unitId);
      return {
        id: p.id,
        paymentId: p.id,
        unitId: p.unitId,
        unitName: unit?.name || p.unitName || "وحدة محذوفة",
        tenantName: p.tenantName,
        dueMonth: getDueYearMonth(p, data.settings.reportMonthCutoffDay),
        dueDate: p.dueDateGregorian || p.nextDueDate || p.paymentDate,
        collectionDate: getCollectionDate(p) || p.receivedDate || "",
        delayDays: getDelayDays(p),
        amount: p.grossAmount ?? p.amount,
        officeFeeAmount: p.collectionFeeAmount ?? 0,
        collectionMethod: getPaymentReceiveMethod(p),
      };
    })
    .sort((a, b) => b.delayDays - a.delayDays);
}

/**
 * LatePaymentService — payments still outstanding past their due date, regardless of
 * the selected report month. Represents money owed today, not a historical accounting
 * month. A payment only counts here if the unit actually had a LIVE contract covering
 * its due month — otherwise it's an orphaned/stale record (e.g. left over from a
 * contract that was later deleted or shortened) on a unit that was truly vacant at the
 * time, and must never be shown as a tenant owing money.
 */
export function generateLatePaymentsReport(data: AppData, buildingId: string): LatePaymentRow[] {
  const unitIds = new Set(data.units.filter((u) => u.buildingId === buildingId).map((u) => u.id));
  return data.payments
    .filter((p) => !p.deletedAt && unitIds.has(p.unitId))
    .map((p) => normalizePaymentFinancials(p))
    .filter((p) => isPaymentOverdue(p) && hasLiveContractForMonth(data, p.unitId, getDueYearMonth(p, data.settings.reportMonthCutoffDay)))
    .map((p): LatePaymentRow => {
      const unit = data.units.find((u) => u.id === p.unitId);
      return {
        id: p.id,
        paymentId: p.id,
        unitId: p.unitId,
        unitName: unit?.name || p.unitName || "وحدة محذوفة",
        tenantName: p.tenantName,
        tenantPhone: p.tenantPhone,
        dueDate: p.dueDateGregorian || p.nextDueDate || p.paymentDate,
        delayDays: getDelayDays(p),
        outstandingAmount: getRemainingPaymentAmount(p),
        rentAmount: p.grossAmount ?? p.amount,
        isPartial: p.status === "partial",
      };
    })
    .sort((a, b) => b.delayDays - a.delayDays);
}

/**
 * Memo cache: AppData snapshots are immutable (the store replaces the object on
 * every update), so a WeakMap keyed by the snapshot gives O(1) reuse with
 * automatic invalidation and no leaks. Repeated renders, previous-month lookups
 * and multi-month comparisons all hit this cache.
 */
const reportCache = new WeakMap<AppData, Map<string, MonthlyReport>>();

/** FinancialReportEngine / MonthlySummaryService — the single source of truth for a building's monthly report. Everything on screen is derived from this, never recomputed ad-hoc in the UI. */
export function generateMonthlyReport(data: AppData, buildingId: string, yearMonth: string): MonthlyReport {
  let byKey = reportCache.get(data);
  if (!byKey) {
    byKey = new Map();
    reportCache.set(data, byKey);
  }
  const cacheKey = `${buildingId}|${yearMonth}`;
  const cached = byKey.get(cacheKey);
  if (cached) return cached;
  const report = computeMonthlyReport(data, buildingId, yearMonth);
  byKey.set(cacheKey, report);
  return report;
}

function computeMonthlyReport(data: AppData, buildingId: string, yearMonth: string): MonthlyReport {
  const building = data.buildings.find((b) => b.id === buildingId);
  const unitRows = buildUnitMonthRows(data, buildingId, yearMonth);
  const unitIds = new Set(data.units.filter((u) => u.buildingId === buildingId).map((u) => u.id));

  const expectedRent = unitRows.reduce((sum, row) => sum + row.rentAmount, 0);
  const collectedForMonth = unitRows.reduce((sum, row) => sum + row.collectedAmount, 0);
  const outstanding = Math.max(0, Math.round((expectedRent - collectedForMonth) * 100) / 100);
  const collectionRate = expectedRent > 0 ? Math.round((collectedForMonth / expectedRent) * 100) : 0;

  const lateUnitRows = unitRows.filter((row) => row.status === "occupied_paid_late" || (row.status === "occupied_unpaid" && row.delayDays > 0) || row.status === "occupied_partial");
  const latePaymentsCount = lateUnitRows.length;
  const averageDelayDays = lateUnitRows.length > 0
    ? Math.round(lateUnitRows.reduce((sum, row) => sum + row.delayDays, 0) / lateUnitRows.length)
    : 0;

  const lateCollections = generateLateCollectionsReport(data, buildingId, yearMonth);
  const lateCollectionsAmount = Math.round(lateCollections.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;

  const officeFeesDue = unitRows.reduce((sum, row) => sum + row.officeFeeAmount, 0);
  // Collected = fee minus whatever is still outstanding — one formula for every
  // fee status, so "collected + outstanding = due" always holds.
  const officeFeesCollected = unitRows.reduce((sum, row) => sum + Math.max(0, row.officeFeeAmount - row.officeFeeOutstanding), 0);
  const officeFeesOutstanding = unitRows.reduce((sum, row) => sum + row.officeFeeOutstanding, 0);
  const collectedThroughEjar = unitRows.filter((row) => row.collectionMethod === "ejar_platform").reduce((sum, row) => sum + row.collectedAmount, 0);

  const monthRepairs = data.repairs.filter((r) => r.status !== "cancelled" && r.repairDate.startsWith(yearMonth) && (r.buildingId === buildingId || (r.unitId ? unitIds.has(r.unitId) : false)));
  const maintenanceCost = monthRepairs.reduce((sum, r) => sum + r.cost, 0);

  const officeFeesDeducted = unitRows.reduce((sum, row) => sum + Math.max(0, row.officeFeeAmount - row.officeFeeOutstanding), 0);
  const ownerNet = Math.round((collectedForMonth - officeFeesDeducted - maintenanceCost) * 100) / 100;
  const propertyProfit = Math.round((collectedForMonth - maintenanceCost) * 100) / 100;

  const vacantUnits = unitRows.filter((row) => row.status === "vacant").length;
  const occupiedUnits = unitRows.filter((row) => row.status.startsWith("occupied")).length;
  const duplicatePaymentsCount = unitRows.reduce((sum, row) => sum + row.duplicatePaymentIds.length, 0);

  const buildingContracts = data.contracts.filter((c) => unitIds.has(c.unitId) && !c.deletedAt);
  const renewalsThisMonth = buildingContracts.filter((c) => (c.startDate || "").slice(0, 7) === yearMonth && c.status !== "cancelled").length;
  const expirationsWithin45Days = buildingContracts.filter((c) => {
    if (!shouldShowContractExpiryReminder(c, 45)) return false;
    if (hasContinuingContractForUnit(c, buildingContracts)) return false;
    const end = getContractEndDate(c);
    const days = end ? getDaysUntilDate(end) : null;
    return days !== null && days <= 45;
  }).length;

  return {
    buildingId,
    buildingName: building?.name || "",
    yearMonth,
    expectedRent: Math.round(expectedRent * 100) / 100,
    collectedForMonth: Math.round(collectedForMonth * 100) / 100,
    outstanding,
    collectionRate,
    latePaymentsCount,
    lateCollectionsCount: lateCollections.length,
    lateCollectionsAmount,
    officeFeesDue: Math.round(officeFeesDue * 100) / 100,
    officeFeesCollected: Math.round(officeFeesCollected * 100) / 100,
    officeFeesOutstanding: Math.round(officeFeesOutstanding * 100) / 100,
    collectedThroughEjar: Math.round(collectedThroughEjar * 100) / 100,
    ownerNet,
    maintenanceCost: Math.round(maintenanceCost * 100) / 100,
    propertyProfit,
    vacantUnits,
    occupiedUnits,
    lateUnits: latePaymentsCount,
    totalUnits: unitRows.length,
    averageDelayDays,
    renewalsThisMonth,
    expirationsWithin45Days,
    duplicatePaymentsCount,
    unitRows,
    lateCollections,
    latePayments: generateLatePaymentsReport(data, buildingId),
  };
}

export { normalizeId };
