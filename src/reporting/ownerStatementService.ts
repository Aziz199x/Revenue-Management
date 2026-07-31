import { AppData, Payment } from "@/data/types";
import { getCollectedRentAmount } from "@/data/helpers";

export type OwnerStatementEventKind =
  | "rent"
  | "office_fee"
  | "maintenance"
  | "settlement"
  | "owner_transfer"
  | "adjustment";

export interface OwnerStatementEvent {
  id: string;
  date: string;
  kind: OwnerStatementEventKind;
  title: string;
  description: string;
  unitName?: string;
  tenantName?: string;
  credit: number;
  debit: number;
  balanceChange: number;
  runningBalance: number;
  sourceId?: string;
}

export interface OwnerStatement {
  buildingId: string;
  yearMonth: string;
  openingBalance: number;
  closingBalance: number;
  events: OwnerStatementEvent[];
  totals: {
    rentReceived: number;
    officeFees: number;
    maintenance: number;
    settlements: number;
    ownerTransfers: number;
    adjustments: number;
  };
}

function paymentGross(payment: Payment): number {
  return Math.max(0, getCollectedRentAmount(payment));
}

function transferredAmount(payment: Payment): number {
  if (Number.isFinite(payment.netAmountToTransferToOwner)) {
    return Math.max(0, Number(payment.netAmountToTransferToOwner));
  }
  const gross = paymentGross(payment);
  const fee = payment.collectionFeeStatus === "collected" ? Number(payment.collectionFeeAmount || 0) : 0;
  return Math.max(0, gross - fee - Number(payment.maintenanceDeductionAmount || 0));
}

function paymentContext(data: AppData, payment: Payment) {
  const unit = data.units.find((item) => item.id === payment.unitId);
  const tenant = payment.tenantName
    || data.tenants.find((item) => item.id === payment.tenantId)?.name
    || data.tenants.find((item) => item.unitId === payment.unitId)?.name;
  return {
    unitName: unit?.name || payment.unitName || "وحدة غير محددة",
    tenantName: tenant || "مستأجر غير محدد",
  };
}

function buildAllEvents(data: AppData, buildingId: string): Omit<OwnerStatementEvent, "runningBalance">[] {
  const units = data.units.filter((unit) => unit.buildingId === buildingId);
  const unitIds = new Set(units.map((unit) => unit.id));
  const events: Omit<OwnerStatementEvent, "runningBalance">[] = [];
  const settlementPaymentIds = new Set(
    data.collectionFeeSettlements
      .filter((settlement) => settlement.propertyId === buildingId)
      .map((settlement) => settlement.paymentId),
  );

  for (const payment of data.payments.filter((item) => unitIds.has(item.unitId) && !item.deletedAt)) {
    const context = paymentContext(data, payment);
    const gross = paymentGross(payment);
    if (gross > 0 && payment.receivedDate) {
      events.push({
        id: `rent-${payment.id}`,
        date: payment.receivedDate,
        kind: "rent",
        title: "إيجار مستلم",
        description: `دفعة ${context.unitName} · ${context.tenantName}`,
        ...context,
        credit: gross,
        debit: 0,
        balanceChange: gross,
        sourceId: payment.id,
      });
    }

    const fee = Number(payment.collectionFeeAmount || 0);
    if (gross > 0 && fee > 0 && payment.collectionFeeStatus === "collected") {
      events.push({
        id: `fee-${payment.id}`,
        date: payment.receivedDate || payment.paymentDate,
        kind: "office_fee",
        title: "رسوم المكتب",
        description: `رسوم تحصيل ${context.unitName}`,
        ...context,
        credit: 0,
        debit: fee,
        balanceChange: -fee,
        sourceId: payment.id,
      });
    } else if (
      gross > 0
      && fee > 0
      && (payment.collectionFeeStatus === "settled" || payment.collectionFeeStatus === "partially_settled")
      && !settlementPaymentIds.has(payment.id)
    ) {
      const settled = Number(payment.collectionFeeSettledAmount || fee);
      if (settled > 0) {
        events.push({
          id: `settled-fee-${payment.id}`,
          date: payment.collectionFeeSettledAt || payment.receivedDate || payment.paymentDate,
          kind: "settlement",
          title: "تسوية رسوم المكتب",
          description: payment.collectionFeeSettlementNote || `تسوية رسوم ${context.unitName}`,
          ...context,
          credit: 0,
          debit: settled,
          balanceChange: -settled,
          sourceId: payment.id,
        });
      }
    }

    if (payment.ownerTransferred && payment.ownerTransferDate) {
      const transferred = transferredAmount(payment);
      events.push({
        id: `transfer-${payment.id}`,
        date: payment.ownerTransferDate,
        kind: "owner_transfer",
        title: "تحويل للمالك",
        description: payment.ownerTransferNotes || `تحويل صافي دفعة ${context.unitName}`,
        ...context,
        credit: 0,
        debit: transferred,
        balanceChange: -transferred,
        sourceId: payment.id,
      });
    }
  }

  for (const repair of data.repairs.filter((item) =>
    item.status !== "cancelled"
    && (item.buildingId === buildingId || (!!item.unitId && unitIds.has(item.unitId)))
  )) {
    const unitName = units.find((unit) => unit.id === repair.unitId)?.name;
    const cost = Math.max(0, Number(repair.cost) || 0);
    if (cost <= 0) continue;
    events.push({
      id: `maintenance-${repair.id}`,
      date: repair.repairDate,
      kind: "maintenance",
      title: "مصروف صيانة",
      description: repair.description,
      unitName: unitName || "صيانة عامة للعقار",
      credit: 0,
      debit: cost,
      balanceChange: -cost,
      sourceId: repair.id,
    });
  }

  for (const settlement of data.collectionFeeSettlements.filter((item) => item.propertyId === buildingId)) {
    const payment = data.payments.find((item) => item.id === settlement.paymentId);
    const context = payment ? paymentContext(data, payment) : {};
    const amount = Math.max(0, Number(settlement.amount) || 0);
    if (amount <= 0) continue;
    events.push({
      id: `settlement-${settlement.settlementId}`,
      date: settlement.date,
      kind: "settlement",
      title: "تسوية رسوم المكتب",
      description: settlement.note || "تسوية رسوم تحصيل من دفعة أخرى",
      ...context,
      credit: 0,
      debit: amount,
      balanceChange: -amount,
      sourceId: settlement.settlementId,
    });
  }

  for (const audit of data.financialAuditLog.filter((item) =>
    item.buildingId === buildingId && item.isPostCloseAdjustment && !item.undoneAt
  )) {
    events.push({
      id: `adjustment-${audit.id}`,
      date: audit.createdAt.slice(0, 10),
      kind: "adjustment",
      title: "تسوية بعد الإقفال",
      description: audit.reason,
      unitName: data.units.find((unit) => unit.id === audit.unitId)?.name,
      credit: 0,
      debit: 0,
      balanceChange: 0,
      sourceId: audit.id,
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function buildOwnerStatement(data: AppData, buildingId: string, yearMonth: string): OwnerStatement {
  const allEvents = buildAllEvents(data, buildingId);
  const monthStart = `${yearMonth}-01`;
  const monthEnd = `${yearMonth}-31`;
  const openingBalance = allEvents
    .filter((event) => event.date < monthStart)
    .reduce((sum, event) => sum + event.balanceChange, 0);
  let runningBalance = openingBalance;
  const events = allEvents
    .filter((event) => event.date >= monthStart && event.date <= monthEnd)
    .map((event) => {
      runningBalance += event.balanceChange;
      return { ...event, runningBalance };
    });

  const sumDebit = (kind: OwnerStatementEventKind) =>
    events.filter((event) => event.kind === kind).reduce((sum, event) => sum + event.debit, 0);
  return {
    buildingId,
    yearMonth,
    openingBalance,
    closingBalance: runningBalance,
    events,
    totals: {
      rentReceived: events.filter((event) => event.kind === "rent").reduce((sum, event) => sum + event.credit, 0),
      officeFees: sumDebit("office_fee"),
      maintenance: sumDebit("maintenance"),
      settlements: sumDebit("settlement"),
      ownerTransfers: sumDebit("owner_transfer"),
      adjustments: events.filter((event) => event.kind === "adjustment").length,
    },
  };
}

