import { AppData } from "@/data/types";
import { getContractEndDate, getDaysUntilDate, formatMoney } from "@/data/helpers";
import { generateMonthlyReport } from "./financialReportEngine";
import { getDueYearMonth, shiftYearMonth, currentYearMonth } from "./dateUtils";
import {
  ComparisonSnapshot,
  HealthScoreResult,
  KpiItem,
  MonthlyReport,
  RiskScoreResult,
  TrendDirection,
} from "./types";

function snapshotFromReport(label: string, report: MonthlyReport | null): ComparisonSnapshot {
  if (!report) {
    return { label, yearMonth: null, collectionRate: null, occupancyRate: null, outstanding: null, maintenanceCost: null, propertyProfit: null, latePaymentsCount: null };
  }
  const occupancyRate = report.totalUnits > 0 ? Math.round((report.occupiedUnits / report.totalUnits) * 100) : 0;
  return {
    label,
    yearMonth: report.yearMonth,
    collectionRate: report.collectionRate,
    occupancyRate,
    outstanding: report.outstanding,
    maintenanceCost: report.maintenanceCost,
    propertyProfit: report.propertyProfit,
    latePaymentsCount: report.latePaymentsCount,
  };
}

export interface MonthlyComparisons {
  previousMonth: ComparisonSnapshot;
  sameMonthLastYear: ComparisonSnapshot;
  sixMonthAverage: {
    label: string;
    collectionRate: number | null;
    occupancyRate: number | null;
    outstanding: number | null;
    maintenanceCost: number | null;
    propertyProfit: number | null;
  };
}

/** Smart Comparison — previous month, same month last year, and the trailing 6-month average. */
export function buildComparisons(data: AppData, buildingId: string, yearMonth: string): MonthlyComparisons {
  const previousMonth = generateMonthlyReport(data, buildingId, shiftYearMonth(yearMonth, -1));
  const sameMonthLastYear = generateMonthlyReport(data, buildingId, shiftYearMonth(yearMonth, -12));

  const last6 = Array.from({ length: 6 }, (_, i) => generateMonthlyReport(data, buildingId, shiftYearMonth(yearMonth, -(i + 1))));
  const avg = (values: number[]) => (values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100 : null);

  return {
    previousMonth: snapshotFromReport("الشهر السابق", previousMonth),
    sameMonthLastYear: snapshotFromReport("نفس الشهر العام الماضي", sameMonthLastYear),
    sixMonthAverage: {
      label: "متوسط 6 أشهر",
      collectionRate: avg(last6.map((r) => r.collectionRate)),
      occupancyRate: avg(last6.map((r) => (r.totalUnits > 0 ? (r.occupiedUnits / r.totalUnits) * 100 : 0))),
      outstanding: avg(last6.map((r) => r.outstanding)),
      maintenanceCost: avg(last6.map((r) => r.maintenanceCost)),
      propertyProfit: avg(last6.map((r) => r.propertyProfit)),
    },
  };
}

function trendFor(current: number, previous: number | null, epsilon = 0.5): TrendDirection {
  if (previous === null || previous === undefined) return "stable";
  if (current - previous > epsilon) return "up";
  if (previous - current > epsilon) return "down";
  return "stable";
}

function deltaLabel(current: number, previous: number | null, unit: "%" | "sar" | "days" | "count"): string {
  if (previous === null || previous === undefined) return "لا توجد بيانات مقارنة";
  const delta = Math.round((current - previous) * 100) / 100;
  if (Math.abs(delta) < 0.5) return "بدون تغيير عن الشهر السابق";
  const sign = delta > 0 ? "+" : "";
  const suffix = unit === "%" ? "%" : unit === "sar" ? " ر.س" : unit === "days" ? " يوم" : "";
  return `${sign}${delta.toLocaleString("en-US")}${suffix} عن الشهر السابق`;
}

/** PropertyStatisticsService — the 12 monthly KPIs with trend arrows against the previous month. */
export function buildKpis(current: MonthlyReport, previous: MonthlyReport | null): KpiItem[] {
  const occupancyRate = current.totalUnits > 0 ? Math.round((current.occupiedUnits / current.totalUnits) * 100) : 0;
  const previousOccupancyRate = previous && previous.totalUnits > 0 ? Math.round((previous.occupiedUnits / previous.totalUnits) * 100) : null;
  const vacancyRate = 100 - occupancyRate;
  const previousVacancyRate = previousOccupancyRate === null ? null : 100 - previousOccupancyRate;
  const maintenanceRatio = current.expectedRent > 0 ? Math.round((current.maintenanceCost / current.expectedRent) * 100) : 0;
  const previousMaintenanceRatio = previous && previous.expectedRent > 0 ? Math.round((previous.maintenanceCost / previous.expectedRent) * 100) : null;
  const officeFeeRate = current.officeFeesDue > 0 ? Math.round((current.officeFeesCollected / current.officeFeesDue) * 100) : 100;
  const previousOfficeFeeRate = previous ? (previous.officeFeesDue > 0 ? Math.round((previous.officeFeesCollected / previous.officeFeesDue) * 100) : 100) : null;
  const netCashFlow = Math.round((current.collectedForMonth + current.lateCollectionsAmount - current.maintenanceCost) * 100) / 100;
  const previousNetCashFlow = previous ? Math.round((previous.collectedForMonth + previous.lateCollectionsAmount - previous.maintenanceCost) * 100) / 100 : null;
  const renewalRate = current.totalUnits > 0 ? Math.round((current.renewalsThisMonth / current.totalUnits) * 100) : 0;
  const previousRenewalRate = previous && previous.totalUnits > 0 ? Math.round((previous.renewalsThisMonth / previous.totalUnits) * 100) : null;

  const rows: { key: string; label: string; value: number; previous: number | null; unit: KpiItem["unit"]; higherIsBetter: boolean | null; format?: (n: number) => string }[] = [
    { key: "collectionRate", label: "نسبة التحصيل", value: current.collectionRate, previous: previous?.collectionRate ?? null, unit: "%", higherIsBetter: true },
    { key: "occupancyRate", label: "نسبة الإشغال", value: occupancyRate, previous: previousOccupancyRate, unit: "%", higherIsBetter: true },
    { key: "averageDelay", label: "متوسط أيام التأخير", value: current.averageDelayDays, previous: previous?.averageDelayDays ?? null, unit: "days", higherIsBetter: false },
    { key: "outstandingRent", label: "الإيجار المستحق غير المحصل", value: current.outstanding, previous: previous?.outstanding ?? null, unit: "sar", higherIsBetter: false, format: formatMoney },
    { key: "lateCollections", label: "التحصيلات المتأخرة هذا الشهر", value: current.lateCollectionsCount, previous: previous?.lateCollectionsCount ?? null, unit: "count", higherIsBetter: null },
    { key: "maintenanceRatio", label: "نسبة الصيانة إلى الإيجار", value: maintenanceRatio, previous: previousMaintenanceRatio, unit: "%", higherIsBetter: false },
    { key: "officeFeeRate", label: "نسبة تحصيل عمولة المكتب", value: officeFeeRate, previous: previousOfficeFeeRate, unit: "%", higherIsBetter: true },
    { key: "ownerNetIncome", label: "صافي دخل المالك", value: current.ownerNet, previous: previous?.ownerNet ?? null, unit: "sar", higherIsBetter: true, format: formatMoney },
    { key: "propertyProfit", label: "ربحية العقار", value: current.propertyProfit, previous: previous?.propertyProfit ?? null, unit: "sar", higherIsBetter: true, format: formatMoney },
    { key: "netCashFlow", label: "صافي التدفق النقدي", value: netCashFlow, previous: previousNetCashFlow, unit: "sar", higherIsBetter: true, format: formatMoney },
    { key: "vacancyRate", label: "نسبة الشواغر", value: vacancyRate, previous: previousVacancyRate, unit: "%", higherIsBetter: false },
    { key: "renewalRate", label: "نسبة التجديد", value: renewalRate, previous: previousRenewalRate, unit: "%", higherIsBetter: true },
  ];

  return rows.map((row): KpiItem => {
    const trend = trendFor(row.value, row.previous, row.unit === "sar" ? 1 : 0.5);
    const trendIsGood = row.higherIsBetter === null || trend === "stable" ? null : row.higherIsBetter ? trend === "up" : trend === "down";
    return {
      key: row.key,
      label: row.label,
      value: row.value,
      displayValue: row.format ? row.format(row.value) : row.unit === "%" ? `${row.value}%` : row.unit === "days" ? `${row.value} يوم` : `${row.value}`,
      unit: row.unit,
      trend,
      trendIsGood,
      deltaLabel: deltaLabel(row.value, row.previous, row.unit),
    };
  });
}

const HEALTH_WEIGHTS = {
  collectionRate: 25,
  occupancy: 20,
  outstanding: 15,
  maintenance: 10,
  contractStability: 10,
  officeFeeCollection: 10,
  latePayments: 10,
};

/** Property Health Index — weighted 0-100 score across the seven metrics called out in the spec. */
export function computeHealthScore(report: MonthlyReport): HealthScoreResult {
  const occupancyScore = report.totalUnits > 0 ? Math.round((report.occupiedUnits / report.totalUnits) * 100) : 100;
  const outstandingRatio = report.expectedRent > 0 ? report.outstanding / report.expectedRent : 0;
  const outstandingScore = Math.max(0, 100 - Math.round(outstandingRatio * 100));
  const maintenanceRatio = report.expectedRent > 0 ? report.maintenanceCost / report.expectedRent : 0;
  const maintenanceScore = Math.max(0, 100 - Math.round(maintenanceRatio * 150));
  const contractStabilityScore = report.totalUnits > 0
    ? Math.max(0, 100 - Math.round((report.expirationsWithin45Days / report.totalUnits) * 100))
    : 100;
  const officeFeeScore = report.officeFeesDue > 0 ? Math.round((report.officeFeesCollected / report.officeFeesDue) * 100) : 100;
  const latePaymentsScore = report.totalUnits > 0 ? Math.max(0, 100 - Math.round((report.latePaymentsCount / report.totalUnits) * 100)) : 100;

  const breakdown = [
    { key: "collectionRate", label: "نسبة التحصيل", weight: HEALTH_WEIGHTS.collectionRate, score: report.collectionRate },
    { key: "occupancy", label: "الإشغال", weight: HEALTH_WEIGHTS.occupancy, score: occupancyScore },
    { key: "outstanding", label: "الإيجار المستحق", weight: HEALTH_WEIGHTS.outstanding, score: outstandingScore },
    { key: "maintenance", label: "تكاليف الصيانة", weight: HEALTH_WEIGHTS.maintenance, score: maintenanceScore },
    { key: "contractStability", label: "استقرار العقود", weight: HEALTH_WEIGHTS.contractStability, score: contractStabilityScore },
    { key: "officeFeeCollection", label: "تحصيل عمولة المكتب", weight: HEALTH_WEIGHTS.officeFeeCollection, score: officeFeeScore },
    { key: "latePayments", label: "الدفعات المتأخرة", weight: HEALTH_WEIGHTS.latePayments, score: latePaymentsScore },
  ];

  const totalWeight = breakdown.reduce((sum, item) => sum + item.weight, 0);
  const score = Math.round(breakdown.reduce((sum, item) => sum + item.weight * item.score, 0) / totalWeight);

  const label = score >= 90 ? "excellent" : score >= 75 ? "good" : score >= 60 ? "average" : score >= 40 ? "needs_attention" : "critical";
  return { score, label, breakdown };
}

/** Financial Risk Score — Low / Medium / High / Critical, driven by outstanding rent, vacancy, contract expirations, maintenance spikes and unpaid office fees. */
export function computeRiskScore(data: AppData, buildingId: string, report: MonthlyReport): RiskScoreResult {
  const factors: string[] = [];
  let points = 0;

  const outstandingRatio = report.expectedRent > 0 ? report.outstanding / report.expectedRent : 0;
  if (outstandingRatio > 0.3) { points += 30; factors.push("الإيجار المستحق يتجاوز 30% من المستحق الشهري"); }
  else if (outstandingRatio > 0.15) { points += 15; factors.push("الإيجار المستحق مرتفع نسبياً"); }

  const vacancyRate = report.totalUnits > 0 ? report.vacantUnits / report.totalUnits : 0;
  if (vacancyRate > 0.3) { points += 20; factors.push("نسبة الشواغر مرتفعة"); }
  else if (vacancyRate > 0.15) { points += 10; factors.push("عدد ملحوظ من الوحدات الشاغرة"); }

  const unitIds = new Set(data.units.filter((u) => u.buildingId === buildingId).map((u) => u.id));
  const expiredContracts = data.contracts.filter((c) => {
    if (c.deletedAt || !unitIds.has(c.unitId)) return false;
    if (["cancelled", "terminated", "eviction_completed"].includes(c.status || "")) return false;
    const end = getContractEndDate(c);
    const days = end ? getDaysUntilDate(end) : null;
    return days !== null && days < 0;
  }).length;
  if (expiredContracts > 0) { points += 20; factors.push(`${expiredContracts} عقد منتهي دون تجديد`); }

  if (report.expirationsWithin45Days > 0) { points += 10; factors.push(`${report.expirationsWithin45Days} عقد سينتهي خلال 45 يوم`); }

  const maintenanceRatio = report.expectedRent > 0 ? report.maintenanceCost / report.expectedRent : 0;
  if (maintenanceRatio > 0.3) { points += 15; factors.push("تكاليف الصيانة مرتفعة جداً مقارنة بالإيجار"); }

  const officeFeeOutstandingRatio = report.officeFeesDue > 0 ? report.officeFeesOutstanding / report.officeFeesDue : 0;
  if (officeFeeOutstandingRatio > 0.5) { points += 10; factors.push("أكثر من نصف عمولة المكتب غير محصلة"); }

  points = Math.min(100, points);
  const label = points <= 20 ? "low" : points <= 45 ? "medium" : points <= 70 ? "high" : "critical";
  return { label, score: points, factors };
}
