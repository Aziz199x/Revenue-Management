import { AppData } from "@/data/types";
import { formatMoney, getContractEndDate } from "@/data/helpers";
import { MonthlyReport, TimelineEvent } from "./types";

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

/** PaymentTimelineService — chronological, month-scoped view of what actually happened. */
export function buildMonthlyTimeline(data: AppData, buildingId: string, report: MonthlyReport): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const unitIds = new Set(data.units.filter((u) => u.buildingId === buildingId).map((u) => u.id));

  for (const row of report.unitRows) {
    if (row.status === "occupied_paid" || row.status === "occupied_ejar") {
      const date = row.collectionDate || row.dueDate;
      if (date) events.push({ id: nextId("tl"), date, icon: "payment", title: `${row.unitName} - تم السداد`, subtitle: formatMoney(row.collectedAmount) });
    } else if (row.status === "occupied_paid_late" && row.collectionDate) {
      events.push({ id: nextId("tl"), date: row.collectionDate, icon: "late", title: `${row.unitName} - سداد متأخر`, subtitle: `تأخر ${row.delayDays} يوم` });
    } else if (row.status === "occupied_partial" && row.dueDate) {
      events.push({ id: nextId("tl"), date: row.dueDate, icon: "payment", title: `${row.unitName} - سداد جزئي`, subtitle: formatMoney(row.collectedAmount) });
    } else if (row.status === "occupied_unpaid" && row.dueDate) {
      events.push({ id: nextId("tl"), date: row.dueDate, icon: "reminder", title: `${row.unitName} - إيجار مستحق`, subtitle: formatMoney(row.rentAmount) });
    }
  }

  for (const row of report.lateCollections) {
    events.push({ id: nextId("tl"), date: row.collectionDate, icon: "late", title: `${row.unitName} - تحصيل متأخر من ${row.dueMonth}`, subtitle: formatMoney(row.amount) });
  }

  const monthRepairs = data.repairs.filter((r) => r.repairDate.startsWith(report.yearMonth) && (r.buildingId === buildingId || (r.unitId ? unitIds.has(r.unitId) : false)));
  for (const repair of monthRepairs) {
    const unit = data.units.find((u) => u.id === repair.unitId);
    events.push({
      id: nextId("tl"),
      date: repair.repairDate,
      icon: "maintenance",
      title: repair.status === "completed" ? `صيانة مكتملة - ${unit?.name || "العقار"}` : `صيانة مسجلة - ${unit?.name || "العقار"}`,
      subtitle: `${repair.description} - ${formatMoney(repair.cost)}`,
    });
  }

  const buildingContracts = data.contracts.filter((c) => unitIds.has(c.unitId) && !c.deletedAt);
  for (const contract of buildingContracts) {
    const unit = data.units.find((u) => u.id === contract.unitId);
    if ((contract.startDate || "").slice(0, 7) === report.yearMonth) {
      events.push({ id: nextId("tl"), date: contract.startDate, icon: "contract", title: `عقد جديد - ${unit?.name || ""}`, subtitle: contract.tenantName });
    }
    const end = getContractEndDate(contract) || contract.endDate;
    if (end && end.slice(0, 7) === report.yearMonth && ["expired", "terminated", "eviction_completed"].includes(contract.status || "")) {
      events.push({ id: nextId("tl"), date: end, icon: "contract", title: `انتهاء عقد - ${unit?.name || ""}`, subtitle: contract.tenantName });
    }
  }

  const settlements = data.collectionFeeSettlements.filter((s) => s.propertyId === buildingId && (s.date || "").slice(0, 7) === report.yearMonth);
  for (const settlement of settlements) {
    events.push({ id: nextId("tl"), date: settlement.date, icon: "office_fee", title: "تحويل عمولة مكتب", subtitle: formatMoney(settlement.amount) });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
