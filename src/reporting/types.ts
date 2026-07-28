import { CollectionFeeStatus, PaymentReceiveMethod } from "@/data/types";

/**
 * ERP reporting engine — core accounting principle:
 *
 *  - Due Date decides the obligation month (with no day-of-month shifting).
 *  - Collection Date decides the cash month.
 *
 * A payment due in June and paid early in May is reported against June. A payment
 * due in June and collected in July closes June as "Paid Late" and is additionally
 * counted in July's late cash collections with both dates shown clearly.
 */

export type UnitMonthStatus =
  | "occupied_paid"
  | "occupied_paid_late"
  | "occupied_partial"
  | "occupied_unpaid"
  | "occupied_ejar"
  | "occupied_no_due"
  | "maintenance"
  | "vacant"
  | "no_contract"
  | "future_contract"
  | "contract_starts_next_month";

export interface UnitMonthRow {
  unitId: string;
  unitName: string;
  buildingId: string;
  tenantName?: string;
  tenantPhone?: string;
  status: UnitMonthStatus;
  contractId?: string;
  paymentId?: string;
  dueDate?: string;
  rentAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  collectionDate?: string;
  delayDays: number;
  collectionMethod?: PaymentReceiveMethod;
  officeFeeAmount: number;
  officeFeeStatus?: CollectionFeeStatus;
  officeFeeOutstanding: number;
  /** Extra payment records beyond the expected installment schedule (data-quality flag). */
  duplicatePaymentIds: string[];
  message: string;
}

export interface LateCollectionRow {
  id: string;
  paymentId: string;
  unitId: string;
  unitName: string;
  tenantName?: string;
  dueMonth: string;
  dueDate: string;
  collectionDate: string;
  delayDays: number;
  amount: number;
  officeFeeAmount: number;
  collectionMethod?: PaymentReceiveMethod;
}

export interface LatePaymentRow {
  id: string;
  paymentId: string;
  unitId: string;
  unitName: string;
  tenantName?: string;
  tenantPhone?: string;
  dueDate: string;
  delayDays: number;
  outstandingAmount: number;
  rentAmount: number;
  isPartial: boolean;
}

export interface MonthlyReport {
  buildingId: string;
  buildingName: string;
  yearMonth: string;
  expectedRent: number;
  collectedForMonth: number;
  outstanding: number;
  collectionRate: number;
  latePaymentsCount: number;
  lateCollectionsCount: number;
  lateCollectionsAmount: number;
  officeFeesDue: number;
  officeFeesCollected: number;
  officeFeesOutstanding: number;
  collectedThroughEjar: number;
  ownerNet: number;
  maintenanceCost: number;
  propertyProfit: number;
  vacantUnits: number;
  occupiedUnits: number;
  lateUnits: number;
  totalUnits: number;
  averageDelayDays: number;
  renewalsThisMonth: number;
  expirationsWithin45Days: number;
  duplicatePaymentsCount: number;
  unitRows: UnitMonthRow[];
  lateCollections: LateCollectionRow[];
  latePayments: LatePaymentRow[];
}

export type TrendDirection = "up" | "down" | "stable";

export interface KpiItem {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  unit: "%" | "sar" | "days" | "count";
  trend: TrendDirection;
  trendIsGood: boolean | null;
  deltaLabel: string;
}

export interface ComparisonSnapshot {
  label: string;
  yearMonth: string | null;
  collectionRate: number | null;
  occupancyRate: number | null;
  outstanding: number | null;
  maintenanceCost: number | null;
  propertyProfit: number | null;
  latePaymentsCount: number | null;
}

export type HealthLabel = "excellent" | "good" | "average" | "needs_attention" | "critical";
export type RiskLabel = "low" | "medium" | "high" | "critical";

export interface HealthScoreResult {
  score: number;
  label: HealthLabel;
  breakdown: { key: string; label: string; weight: number; score: number }[];
}

export interface RiskScoreResult {
  label: RiskLabel;
  score: number;
  factors: string[];
}

export type ExceptionCategory = "critical" | "warning" | "info" | "success";

export interface ExceptionRecommendation {
  priority: "urgent" | "high" | "medium" | "low";
  reason: string;
  action: string;
  deadline?: string;
  responsible?: string;
}

export interface ManagementException {
  id: string;
  category: ExceptionCategory;
  title: string;
  description: string;
  unitId?: string;
  unitName?: string;
  amount?: number;
  date?: string;
  recommendation?: ExceptionRecommendation;
}

export interface ExecutiveAction {
  id: string;
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  reason: string;
  action: string;
  deadline?: string;
  responsible?: string;
  unitId?: string;
}

export interface ManagementAlert {
  id: string;
  level: ExceptionCategory;
  title: string;
  description: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  icon: "payment" | "late" | "maintenance" | "contract" | "office_fee" | "reminder" | "vacancy";
  title: string;
  subtitle?: string;
}

export interface TopStat {
  key: string;
  label: string;
  unitName?: string;
  tenantName?: string;
  value: string;
}

export interface PropertyPerformance {
  label: "excellent" | "good" | "average" | "needs_attention" | "critical";
  labelText: string;
}
