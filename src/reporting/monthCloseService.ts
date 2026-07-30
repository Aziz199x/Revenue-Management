import { AppData, FinancialMonthCloseSnapshot, Payment } from "@/data/types";
import {
  calculateNetAmountToTransferToOwner,
  findEarlierUnreceivedPayments,
  findPotentialDuplicateReceivedPayments,
  getCollectedRentAmount,
  getCollectionFeeRemainingAmount,
  getContractEndDate,
  getPaymentAmount,
  getPaymentReportMonth,
  isPaymentPaid,
  normalizePaymentFinancials,
  paymentDueDateValue,
} from "@/data/helpers";
import { generateMonthlyReport } from "./financialReportEngine";

export type MonthCloseIssueSeverity = "blocking" | "warning" | "info";
export type MonthCloseIssueKind =
  | "duplicate_payment"
  | "payment_sequence"
  | "owner_transfer"
  | "collection_fee"
  | "maintenance"
  | "received_amount"
  | "vacant_unit"
  | "expired_contract";

export interface MonthCloseIssue {
  id: string;
  kind: MonthCloseIssueKind;
  severity: MonthCloseIssueSeverity;
  title: string;
  description: string;
  amount?: number;
  buildingId?: string;
  buildingName?: string;
  unitId?: string;
  unitName?: string;
  paymentId?: string;
  route?: string;
}

export interface MonthCloseBuildingReview {
  buildingId: string;
  buildingName: string;
  expectedRent: number;
  collectedRent: number;
  outstanding: number;
  officeFeesOutstanding: number;
  maintenanceCost: number;
  pendingOwnerTransfers: number;
}

export interface MonthCloseReview {
  yearMonth: string;
  issues: MonthCloseIssue[];
  blockingIssues: number;
  warningIssues: number;
  informationalIssues: number;
  expectedRent: number;
  collectedRent: number;
  outstanding: number;
  officeFeesOutstanding: number;
  maintenanceCost: number;
  pendingOwnerTransfers: number;
  buildings: MonthCloseBuildingReview[];
}

function routeToPayment(payment: Payment): string {
  return `/units/${encodeURIComponent(payment.unitId)}?tab=payments&item=${encodeURIComponent(payment.id)}`;
}

function paymentContext(data: AppData, payment: Payment) {
  const unit = data.units.find((item) => item.id === payment.unitId);
  const building = data.buildings.find((item) => item.id === unit?.buildingId);
  const tenant = payment.tenantName
    || data.tenants.find((item) => item.id === payment.tenantId)?.name
    || data.tenants.find((item) => item.unitId === payment.unitId)?.name;
  return {
    unit,
    building,
    tenant,
    label: [unit?.name, tenant].filter(Boolean).join(" · ") || "دفعة غير محددة",
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMonthCloseReview(data: AppData, yearMonth: string): MonthCloseReview {
  const issues: MonthCloseIssue[] = [];
  const duplicatePairs = new Set<string>();
  const sequencePairs = new Set<string>();
  const monthPayments = data.payments.filter((payment) =>
    !payment.deletedAt
    && getPaymentReportMonth(payment, data.settings.reportMonthCutoffDay) === yearMonth
  );

  for (const payment of monthPayments) {
    const context = paymentContext(data, payment);
    const baseIssue = {
      buildingId: context.building?.id,
      buildingName: context.building?.name,
      unitId: context.unit?.id || payment.unitId,
      unitName: context.unit?.name || payment.unitName,
      paymentId: payment.id,
      route: routeToPayment(payment),
    };

    if (payment.status === "paid" || payment.status === "partial") {
      for (const duplicate of findPotentialDuplicateReceivedPayments(data, payment)) {
        if (getPaymentReportMonth(duplicate, data.settings.reportMonthCutoffDay) !== yearMonth) continue;
        const pairKey = [payment.id, duplicate.id].sort().join("|");
        if (duplicatePairs.has(pairKey)) continue;
        duplicatePairs.add(pairKey);
        issues.push({
          id: `duplicate-${pairKey}`,
          kind: "duplicate_payment",
          severity: "blocking",
          title: "دفعة مكررة محتملة",
          description: `${context.label}: يوجد سجلان مستلمان لنفس الشهر والمبلغ. يجب مراجعة أحدهما قبل الإقفال.`,
          amount: getCollectedRentAmount(payment),
          ...baseIssue,
        });
      }

      for (const earlier of findEarlierUnreceivedPayments(data, payment)) {
        const pairKey = `${earlier.id}|${payment.id}`;
        if (sequencePairs.has(pairKey)) continue;
        sequencePairs.add(pairKey);
        issues.push({
          id: `sequence-${pairKey}`,
          kind: "payment_sequence",
          severity: "blocking",
          title: "خطأ في تسلسل الدفعات",
          description: `${context.label}: تم استلام دفعة بتاريخ ${payment.receivedDate || paymentDueDateValue(payment)} مع بقاء دفعة أقدم مستحقة بتاريخ ${paymentDueDateValue(earlier)}.`,
          amount: getPaymentAmount(earlier),
          ...baseIssue,
        });
      }
    }

    if (isPaymentPaid(payment) && !payment.ownerTransferred && !payment.ownerSettledByMaintenance) {
      const pendingAmount = calculateNetAmountToTransferToOwner(normalizePaymentFinancials(payment));
      if (pendingAmount > 0) {
        issues.push({
          id: `owner-transfer-${payment.id}`,
          kind: "owner_transfer",
          severity: "blocking",
          title: "دفعة لم تُحوّل للمالك",
          description: `${context.label}: تم استلام الإيجار ولم يُسجل تحويل صافي الدفعة للمالك.`,
          amount: pendingAmount,
          ...baseIssue,
        });
      }
    }

    if (isPaymentPaid(payment)) {
      const remainingFee = getCollectionFeeRemainingAmount(data, payment);
      if (remainingFee > 0) {
        issues.push({
          id: `collection-fee-${payment.id}`,
          kind: "collection_fee",
          severity: "blocking",
          title: "رسوم تحصيل غير محصلة",
          description: `${context.label}: توجد رسوم مكتب متبقية يجب تحصيلها أو تسويتها أو إعفاؤها قبل الإقفال.`,
          amount: remainingFee,
          ...baseIssue,
        });
      }
    }

    const expectedAmount = getPaymentAmount(payment);
    const receivedAmount = getCollectedRentAmount(payment);
    if (payment.status === "paid" && Math.abs(receivedAmount - expectedAmount) >= 0.01) {
      issues.push({
        id: `amount-${payment.id}`,
        kind: "received_amount",
        severity: "blocking",
        title: "اختلاف المبلغ المستلم عن المستحق",
        description: `${context.label}: المستحق ${expectedAmount} ر.س بينما المسجل كمستلم ${receivedAmount} ر.س.`,
        amount: Math.abs(expectedAmount - receivedAmount),
        ...baseIssue,
      });
    } else if (payment.status === "partial" && receivedAmount > 0) {
      issues.push({
        id: `partial-${payment.id}`,
        kind: "received_amount",
        severity: "warning",
        title: "دفعة مستلمة جزئيًا",
        description: `${context.label}: تم استلام ${receivedAmount} ر.س من أصل ${expectedAmount} ر.س.`,
        amount: Math.max(0, expectedAmount - receivedAmount),
        ...baseIssue,
      });
    }

    const linkedRepairs = data.repairs.filter((repair) =>
      repair.deductedFromPaymentId === payment.id && repair.status !== "cancelled"
    );
    const linkedMaintenance = roundMoney(linkedRepairs.reduce((sum, repair) => sum + repair.cost, 0));
    const storedMaintenance = roundMoney(payment.maintenanceDeductionAmount || 0);
    if (Math.abs(linkedMaintenance - storedMaintenance) >= 0.01) {
      issues.push({
        id: `maintenance-${payment.id}`,
        kind: "maintenance",
        severity: "blocking",
        title: "خصم صيانة غير مكتمل",
        description: `${context.label}: إجمالي بنود الصيانة المرتبطة ${linkedMaintenance} ر.س ولا يطابق الخصم المسجل ${storedMaintenance} ر.س.`,
        amount: Math.abs(linkedMaintenance - storedMaintenance),
        ...baseIssue,
      });
    } else if (payment.ownerSettledByMaintenance && linkedRepairs.length === 0 && !payment.maintenanceSettlementNote?.trim()) {
      issues.push({
        id: `maintenance-note-${payment.id}`,
        kind: "maintenance",
        severity: "blocking",
        title: "تسوية صيانة بلا تفاصيل",
        description: `${context.label}: سُجلت تسوية مقابل الصيانة دون بنود مرتبطة أو تعليق يوضح المصروفات.`,
        ...baseIssue,
      });
    }
  }

  for (const repair of data.repairs.filter((item) =>
    item.status !== "cancelled"
    && item.isDeductedFromOwnerTransfer
    && item.repairDate.startsWith(yearMonth)
    && !item.deductedFromPaymentId
  )) {
    const unit = data.units.find((item) => item.id === repair.unitId);
    const building = data.buildings.find((item) => item.id === (repair.buildingId || unit?.buildingId));
    issues.push({
      id: `orphan-maintenance-${repair.id}`,
      kind: "maintenance",
      severity: "blocking",
      title: "بند صيانة بلا دفعة مرتبطة",
      description: `${repair.description}: البند معلّم كمخصوم من الإيجار لكن لا توجد دفعة مرتبطة به.`,
      amount: repair.cost,
      buildingId: building?.id,
      buildingName: building?.name,
      unitId: unit?.id,
      unitName: unit?.name,
      route: unit
        ? `/units/${encodeURIComponent(unit.id)}?tab=maintenance&item=${encodeURIComponent(repair.id)}`
        : `/buildings/${encodeURIComponent(building?.id || "")}?tab=maintenance&item=${encodeURIComponent(repair.id)}`,
    });
  }

  const buildings: MonthCloseBuildingReview[] = data.buildings.map((building) => {
    const report = generateMonthlyReport(data, building.id, yearMonth);
    const unitIds = new Set(data.units.filter((unit) => unit.buildingId === building.id).map((unit) => unit.id));
    const pendingOwnerTransfers = monthPayments
      .filter((payment) =>
        unitIds.has(payment.unitId)
        && isPaymentPaid(payment)
        && !payment.ownerTransferred
        && !payment.ownerSettledByMaintenance
      )
      .reduce((sum, payment) => sum + Math.max(0, calculateNetAmountToTransferToOwner(normalizePaymentFinancials(payment))), 0);

    for (const row of report.unitRows.filter((item) => item.status === "vacant" || item.status === "no_contract")) {
      issues.push({
        id: `vacant-${building.id}-${row.unitId}`,
        kind: "vacant_unit",
        severity: "info",
        title: "وحدة شاغرة",
        description: `${row.unitName}: الوحدة شاغرة خلال هذا الشهر ولا توجد دفعة إيجار مستحقة عليها.`,
        buildingId: building.id,
        buildingName: building.name,
        unitId: row.unitId,
        unitName: row.unitName,
        route: `/units/${encodeURIComponent(row.unitId)}`,
      });
    }

    return {
      buildingId: building.id,
      buildingName: building.name,
      expectedRent: report.expectedRent,
      collectedRent: report.collectedForMonth,
      outstanding: report.outstanding,
      officeFeesOutstanding: report.officeFeesOutstanding,
      maintenanceCost: report.maintenanceCost,
      pendingOwnerTransfers: roundMoney(pendingOwnerTransfers),
    };
  });

  for (const contract of data.contracts.filter((item) =>
    !item.deletedAt
    && item.status !== "cancelled"
    && item.status !== "terminated"
    && (getContractEndDate(item) || item.endDate || "").slice(0, 7) === yearMonth
  )) {
    const unit = data.units.find((item) => item.id === contract.unitId);
    const building = data.buildings.find((item) => item.id === unit?.buildingId);
    issues.push({
      id: `expired-${contract.id}`,
      kind: "expired_contract",
      severity: "info",
      title: "عقد ينتهي خلال الشهر",
      description: `${unit?.name || "وحدة غير محددة"}: ينتهي عقد ${contract.tenantName || "المستأجر"} بتاريخ ${getContractEndDate(contract) || contract.endDate}.`,
      buildingId: building?.id,
      buildingName: building?.name,
      unitId: unit?.id,
      unitName: unit?.name,
      route: unit ? `/units/${encodeURIComponent(unit.id)}?tab=contract&item=${encodeURIComponent(contract.id)}` : undefined,
    });
  }

  const totals = buildings.reduce((result, building) => ({
    expectedRent: result.expectedRent + building.expectedRent,
    collectedRent: result.collectedRent + building.collectedRent,
    outstanding: result.outstanding + building.outstanding,
    officeFeesOutstanding: result.officeFeesOutstanding + building.officeFeesOutstanding,
    maintenanceCost: result.maintenanceCost + building.maintenanceCost,
    pendingOwnerTransfers: result.pendingOwnerTransfers + building.pendingOwnerTransfers,
  }), {
    expectedRent: 0,
    collectedRent: 0,
    outstanding: 0,
    officeFeesOutstanding: 0,
    maintenanceCost: 0,
    pendingOwnerTransfers: 0,
  });

  return {
    yearMonth,
    issues,
    blockingIssues: issues.filter((issue) => issue.severity === "blocking").length,
    warningIssues: issues.filter((issue) => issue.severity === "warning").length,
    informationalIssues: issues.filter((issue) => issue.severity === "info").length,
    expectedRent: roundMoney(totals.expectedRent),
    collectedRent: roundMoney(totals.collectedRent),
    outstanding: roundMoney(totals.outstanding),
    officeFeesOutstanding: roundMoney(totals.officeFeesOutstanding),
    maintenanceCost: roundMoney(totals.maintenanceCost),
    pendingOwnerTransfers: roundMoney(totals.pendingOwnerTransfers),
    buildings,
  };
}

export function createMonthCloseSnapshot(review: MonthCloseReview): FinancialMonthCloseSnapshot {
  return {
    expectedRent: review.expectedRent,
    collectedRent: review.collectedRent,
    outstanding: review.outstanding,
    officeFeesOutstanding: review.officeFeesOutstanding,
    maintenanceCost: review.maintenanceCost,
    pendingOwnerTransfers: review.pendingOwnerTransfers,
    blockingIssues: review.blockingIssues,
    warningIssues: review.warningIssues,
    informationalIssues: review.informationalIssues,
    buildings: review.buildings.map((building) => ({ ...building })),
  };
}
