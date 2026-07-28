import { AppData } from "@/data/types";
import { generateMonthlyReport } from "./financialReportEngine";
import { buildComparisons, buildKpis, computeHealthScore, computeRiskScore, MonthlyComparisons } from "./propertyStatisticsService";
import { detectExceptions, buildExecutiveActions, buildManagementAlerts, buildFinancialInsights, buildExecutiveSummary, buildTopStats, classifyPropertyPerformance } from "./exceptionsEngine";
import { buildMonthlyTimeline } from "./paymentTimelineService";
import { shiftYearMonth } from "./dateUtils";
import {
  ExecutiveAction,
  HealthScoreResult,
  KpiItem,
  ManagementAlert,
  ManagementException,
  MonthlyReport,
  PropertyPerformance,
  RiskScoreResult,
  TimelineEvent,
  TopStat,
} from "./types";

export interface MonthlyReportBundle {
  report: MonthlyReport;
  previousReport: MonthlyReport;
  comparisons: MonthlyComparisons;
  kpis: KpiItem[];
  health: HealthScoreResult;
  risk: RiskScoreResult;
  performance: PropertyPerformance;
  exceptions: ManagementException[];
  actions: ExecutiveAction[];
  alerts: ManagementAlert[];
  insights: string[];
  summary: string;
  topStats: TopStat[];
  timeline: TimelineEvent[];
}

/**
 * Single entry point the UI should call. Generates the whole monthly bundle once so
 * the Executive Dashboard and the Monthly Exceptions card never recompute or disagree
 * with each other. In this in-memory, localStorage-backed app this runs in a single
 * pass over the building's payments/contracts/repairs and is well under 100ms for the
 * realistic data volumes involved.
 */
const bundleCache = new WeakMap<AppData, Map<string, MonthlyReportBundle>>();

export function buildMonthlyReportBundle(data: AppData, buildingId: string, yearMonth: string): MonthlyReportBundle {
  let byKey = bundleCache.get(data);
  if (!byKey) {
    byKey = new Map();
    bundleCache.set(data, byKey);
  }
  const cacheKey = `${buildingId}|${yearMonth}`;
  const cached = byKey.get(cacheKey);
  if (cached) return cached;
  const bundle = computeMonthlyReportBundle(data, buildingId, yearMonth);
  byKey.set(cacheKey, bundle);
  return bundle;
}

function computeMonthlyReportBundle(data: AppData, buildingId: string, yearMonth: string): MonthlyReportBundle {
  const report = generateMonthlyReport(data, buildingId, yearMonth);
  const previousReport = generateMonthlyReport(data, buildingId, shiftYearMonth(yearMonth, -1));
  const comparisons = buildComparisons(data, buildingId, yearMonth);
  const kpis = buildKpis(report, previousReport);
  const health = computeHealthScore(report);
  const risk = computeRiskScore(data, buildingId, report);
  const performance = classifyPropertyPerformance(health);
  const exceptions = detectExceptions(data, buildingId, report, comparisons.previousMonth);
  const actions = buildExecutiveActions(exceptions);
  const alerts = buildManagementAlerts(exceptions);
  const insights = buildFinancialInsights(report, comparisons);
  const summary = buildExecutiveSummary(report, health, comparisons);
  const topStats = buildTopStats(data, buildingId, report);
  const timeline = buildMonthlyTimeline(data, buildingId, report);

  return { report, previousReport, comparisons, kpis, health, risk, performance, exceptions, actions, alerts, insights, summary, topStats, timeline };
}
