import {
  AppData,
  Building,
  CollectionFeeSettlement,
  FinancialAuditAction,
  FinancialAuditEntry,
  FinancialAuditEntityType,
  Payment,
  Repair,
} from "./types";

export interface FinancialAuditContext {
  reason?: string;
  suppressAudit?: boolean;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function snapshot(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isSame(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

function shiftYearMonth(yearMonth: string): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  if (!year || !month) return yearMonth;
  const shifted = new Date(year, month, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function paymentYearMonth(payment: Payment, cutoffDay: number | null): string {
  if (payment.reportingYearMonth && /^\d{4}-\d{2}$/.test(payment.reportingYearMonth)) {
    return payment.reportingYearMonth;
  }
  const dueDate = payment.dueDateGregorian || payment.nextDueDate || payment.paymentDate || "";
  const yearMonth = dueDate.slice(0, 7);
  const day = Number(dueDate.slice(8, 10));
  const mode = payment.reportingMonthMode ?? "auto";
  return mode === "next_month" || (mode === "auto" && cutoffDay !== null && day >= cutoffDay)
    ? shiftYearMonth(yearMonth)
    : yearMonth;
}

function actionLabel(action: FinancialAuditAction): string {
  const labels: Record<FinancialAuditAction, string> = {
    payment_created: "إنشاء دفعة",
    payment_received: "استلام دفعة",
    payment_updated: "تعديل دفعة",
    payment_deleted: "حذف دفعة",
    owner_transferred: "تحويل دفعة للمالك",
    maintenance_deducted: "خصم صيانة من الإيجار",
    maintenance_updated: "تعديل مصروف صيانة",
    maintenance_deleted: "حذف مصروف صيانة",
    settlement_created: "إنشاء تسوية رسوم تحصيل",
    settlement_updated: "تعديل تسوية رسوم تحصيل",
    settlement_deleted: "حذف تسوية رسوم تحصيل",
    building_ownership_updated: "تغيير ملاك العقار ونسبهم",
  };
  return labels[action];
}

function inferPaymentAction(before?: Payment, after?: Payment): FinancialAuditAction {
  if (!after || (!before?.deletedAt && after.deletedAt)) return "payment_deleted";
  if (!before) return after.status === "paid" || after.status === "partial" ? "payment_received" : "payment_created";
  if (!before.ownerTransferred && after.ownerTransferred) return "owner_transferred";
  if ((before.maintenanceDeductionAmount || 0) !== (after.maintenanceDeductionAmount || 0)
    || before.ownerSettledByMaintenance !== after.ownerSettledByMaintenance) return "maintenance_deducted";
  if (before.status !== after.status || before.receivedDate !== after.receivedDate || before.receivedAmount !== after.receivedAmount) {
    return "payment_received";
  }
  return "payment_updated";
}

function entityLabel(data: AppData, entityType: FinancialAuditEntityType, entity: Payment | Repair | CollectionFeeSettlement | Building): string {
  if (entityType === "building") return (entity as Building).name;
  if (entityType === "payment") {
    const payment = entity as Payment;
    const unit = data.units.find((item) => item.id === payment.unitId);
    const tenant = payment.tenantName || data.tenants.find((item) => item.id === payment.tenantId)?.name;
    return [unit?.name || payment.unitName || "دفعة", tenant].filter(Boolean).join(" · ");
  }
  if (entityType === "repair") {
    const repair = entity as Repair;
    return repair.description || "مصروف صيانة";
  }
  return "تسوية رسوم تحصيل";
}

function resolveBuildingId(data: AppData, entityType: FinancialAuditEntityType, entity: Payment | Repair | CollectionFeeSettlement | Building): string | undefined {
  if (entityType === "building") return (entity as Building).id;
  if (entityType === "collection_fee_settlement") return (entity as CollectionFeeSettlement).propertyId;
  const unitId = entityType === "payment" ? (entity as Payment).unitId : (entity as Repair).unitId;
  return entityType === "repair" && (entity as Repair).buildingId
    ? (entity as Repair).buildingId
    : data.units.find((item) => item.id === unitId)?.buildingId;
}

function resolveUnitId(entityType: FinancialAuditEntityType, entity: Payment | Repair | CollectionFeeSettlement | Building): string | undefined {
  if (entityType === "building") return undefined;
  if (entityType === "payment") return (entity as Payment).unitId;
  if (entityType === "repair") return (entity as Repair).unitId;
  return (entity as CollectionFeeSettlement).targetUnitId || (entity as CollectionFeeSettlement).sourceUnitId;
}

function resolveYearMonth(
  data: AppData,
  entityType: FinancialAuditEntityType,
  entity: Payment | Repair | CollectionFeeSettlement | Building,
): string | undefined {
  if (entityType === "payment") return paymentYearMonth(entity as Payment, data.settings.reportMonthCutoffDay);
  if (entityType === "repair") {
    const repair = entity as Repair;
    const payment = repair.deductedFromPaymentId
      ? data.payments.find((item) => item.id === repair.deductedFromPaymentId)
      : undefined;
    return payment
      ? paymentYearMonth(payment, data.settings.reportMonthCutoffDay)
      : repair.repairDate?.slice(0, 7);
  }
  if (entityType === "building") return undefined;
  return (entity as CollectionFeeSettlement).date?.slice(0, 7);
}

function entryForChange(
  previousData: AppData,
  nextData: AppData,
  entityType: FinancialAuditEntityType,
  entityId: string,
  before: Payment | Repair | CollectionFeeSettlement | Building | undefined,
  after: Payment | Repair | CollectionFeeSettlement | Building | undefined,
  action: FinancialAuditAction,
  transactionId: string,
  createdAt: string,
  reason?: string,
): FinancialAuditEntry {
  const entity = after || before!;
  const yearMonth = resolveYearMonth(nextData, entityType, entity);
  const isPostCloseAdjustment = !!yearMonth && previousData.financialMonthClosures.some((item) => item.yearMonth === yearMonth);
  const label = actionLabel(action);
  return {
    id: createId("audit"),
    transactionId,
    createdAt,
    action,
    entityType,
    entityId,
    yearMonth,
    buildingId: resolveBuildingId(nextData, entityType, entity),
    unitId: resolveUnitId(entityType, entity),
    label: entityLabel(nextData, entityType, entity),
    reason: reason?.trim() || (isPostCloseAdjustment ? `تسوية بعد إقفال الشهر: ${label}` : label),
    before: snapshot(before),
    after: snapshot(after),
    isPostCloseAdjustment,
  };
}

function collectPaymentEntries(
  previousData: AppData,
  nextData: AppData,
  transactionId: string,
  createdAt: string,
  reason?: string,
): FinancialAuditEntry[] {
  const entries: FinancialAuditEntry[] = [];
  const beforeById = new Map(previousData.payments.map((item) => [item.id, item]));
  const afterById = new Map(nextData.payments.map((item) => [item.id, item]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  for (const id of ids) {
    const before = beforeById.get(id);
    const after = afterById.get(id);
    if (isSame(before, after)) continue;
    entries.push(entryForChange(
      previousData,
      nextData,
      "payment",
      id,
      before,
      after,
      inferPaymentAction(before, after),
      transactionId,
      createdAt,
      reason,
    ));
  }
  return entries;
}

function collectRepairEntries(
  previousData: AppData,
  nextData: AppData,
  transactionId: string,
  createdAt: string,
  reason?: string,
): FinancialAuditEntry[] {
  const entries: FinancialAuditEntry[] = [];
  const beforeById = new Map(previousData.repairs.map((item) => [item.id, item]));
  const afterById = new Map(nextData.repairs.map((item) => [item.id, item]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  for (const id of ids) {
    const before = beforeById.get(id);
    const after = afterById.get(id);
    if (isSame(before, after)) continue;
    const action: FinancialAuditAction = !after
      ? "maintenance_deleted"
      : after.isDeductedFromOwnerTransfer && !before?.isDeductedFromOwnerTransfer
      ? "maintenance_deducted"
      : "maintenance_updated";
    entries.push(entryForChange(previousData, nextData, "repair", id, before, after, action, transactionId, createdAt, reason));
  }
  return entries;
}

function collectSettlementEntries(
  previousData: AppData,
  nextData: AppData,
  transactionId: string,
  createdAt: string,
  reason?: string,
): FinancialAuditEntry[] {
  const entries: FinancialAuditEntry[] = [];
  const beforeById = new Map(previousData.collectionFeeSettlements.map((item) => [item.settlementId, item]));
  const afterById = new Map(nextData.collectionFeeSettlements.map((item) => [item.settlementId, item]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  for (const id of ids) {
    const before = beforeById.get(id);
    const after = afterById.get(id);
    if (isSame(before, after)) continue;
    const action: FinancialAuditAction = !before
      ? "settlement_created"
      : !after
      ? "settlement_deleted"
      : "settlement_updated";
    entries.push(entryForChange(
      previousData,
      nextData,
      "collection_fee_settlement",
      id,
      before,
      after,
      action,
      transactionId,
      createdAt,
      reason,
    ));
  }
  return entries;
}

function collectBuildingOwnershipEntries(
  previousData: AppData,
  nextData: AppData,
  transactionId: string,
  createdAt: string,
  reason?: string,
): FinancialAuditEntry[] {
  const entries: FinancialAuditEntry[] = [];
  const beforeById = new Map(previousData.buildings.map((item) => [item.id, item]));
  for (const after of nextData.buildings) {
    const before = beforeById.get(after.id);
    if (!before) continue;
    const beforeOwnership = {
      multipleOwnersEnabled: before.multipleOwnersEnabled,
      owners: before.owners,
      ownershipHistory: before.ownershipHistory,
    };
    const afterOwnership = {
      multipleOwnersEnabled: after.multipleOwnersEnabled,
      owners: after.owners,
      ownershipHistory: after.ownershipHistory,
    };
    if (isSame(beforeOwnership, afterOwnership)) continue;
    entries.push(entryForChange(
      previousData,
      nextData,
      "building",
      after.id,
      before,
      after,
      "building_ownership_updated",
      transactionId,
      createdAt,
      reason,
    ));
  }
  return entries;
}

export function buildFinancialAuditEntries(
  previousData: AppData,
  nextData: AppData,
  context: FinancialAuditContext = {},
): FinancialAuditEntry[] {
  if (context.suppressAudit) return [];
  const createdAt = new Date().toISOString();
  const transactionId = createId("tx");
  return [
    ...collectPaymentEntries(previousData, nextData, transactionId, createdAt, context.reason),
    ...collectRepairEntries(previousData, nextData, transactionId, createdAt, context.reason),
    ...collectSettlementEntries(previousData, nextData, transactionId, createdAt, context.reason),
    ...collectBuildingOwnershipEntries(previousData, nextData, transactionId, createdAt, context.reason),
  ];
}

function restoreEntity<T extends { id?: string; settlementId?: string }>(
  items: T[],
  entityId: string,
  before: Record<string, unknown> | null | undefined,
  idKey: "id" | "settlementId",
): T[] {
  const withoutCurrent = items.filter((item) => String(item[idKey]) !== entityId);
  if (!before) return withoutCurrent;
  return [...withoutCurrent, before as T];
}

export function undoFinancialAuditEntry(data: AppData, entry: FinancialAuditEntry): AppData {
  const transactionEntries = data.financialAuditLog.filter((item) =>
    item.transactionId ? item.transactionId === entry.transactionId : item.id === entry.id
  );
  const entries = transactionEntries.length > 0 ? transactionEntries : [entry];
  let payments = data.payments;
  let repairs = data.repairs;
  let settlements = data.collectionFeeSettlements;
  let buildings = data.buildings;
  for (const transactionEntry of entries) {
    if (transactionEntry.entityType === "payment") {
      payments = restoreEntity(payments, transactionEntry.entityId, transactionEntry.before, "id");
    } else if (transactionEntry.entityType === "repair") {
      repairs = restoreEntity(repairs, transactionEntry.entityId, transactionEntry.before, "id");
    } else if (transactionEntry.entityType === "collection_fee_settlement") {
      settlements = restoreEntity(settlements, transactionEntry.entityId, transactionEntry.before, "settlementId");
    } else {
      buildings = restoreEntity(buildings, transactionEntry.entityId, transactionEntry.before, "id");
    }
  }
  const undoneAt = new Date().toISOString();
  const undoneIds = new Set(entries.map((item) => item.id));
  return {
    ...data,
    payments,
    repairs,
    buildings,
    collectionFeeSettlements: settlements,
    financialAuditLog: data.financialAuditLog.map((item) =>
      undoneIds.has(item.id) ? { ...item, undoneAt } : item
    ),
  };
}
