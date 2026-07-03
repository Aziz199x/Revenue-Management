import { AppData, Payment, Contract, PaymentStatus } from "./types";

export function formatMoney(n: number): string {
  return `${n.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntil(iso: string): number {
  const today = new Date(todayISO() + "T00:00:00").getTime();
  const target = new Date(iso + "T00:00:00").getTime();
  return Math.round((target - today) / 86400000);
}

/** Effective status: unpaid/partial past due date becomes overdue */
export function effectiveStatus(p: Payment): PaymentStatus {
  if (p.status === "paid") return "paid";
  if (p.nextDueDate && daysUntil(p.nextDueDate) < 0) return "overdue";
  return p.status;
}

export function buildingStats(data: AppData, buildingId: string) {
  const units = data.units.filter((u) => u.buildingId === buildingId);
  const unitIds = new Set(units.map((u) => u.id));
  const payments = data.payments.filter((p) => unitIds.has(p.unitId));
  const contracts = data.contracts.filter((c) => unitIds.has(c.unitId));
  const repairs = data.repairs.filter((r) => unitIds.has(r.unitId));

  const totalIncome = payments
    .filter((p) => p.status === "paid" || p.status === "partial")
    .reduce((s, p) => s + (p.status === "paid" ? p.amount : p.paidAmount || 0), 0);

  const upcomingDue = payments
    .map((p) => p.nextDueDate)
    .filter((d): d is string => !!d && daysUntil(d) >= 0)
    .sort()[0];

  const nearestExpiry = contracts
    .map((c) => c.endDate)
    .filter((d) => daysUntil(d) >= 0)
    .sort()[0];

  const maintenanceCost = repairs
    .filter((r) => r.status !== "cancelled")
    .reduce((s, r) => s + r.cost, 0);

  return {
    unitsCount: units.length,
    occupied: units.filter((u) => u.status === "occupied").length,
    vacant: units.filter((u) => u.status === "vacant").length,
    maintenance: units.filter((u) => u.status === "maintenance").length,
    totalIncome,
    upcomingDue,
    nearestExpiry,
    maintenanceCost,
  };
}

export function globalStats(data: AppData) {
  const paidTotal = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const partialTotal = data.payments
    .filter((p) => p.status === "partial")
    .reduce((s, p) => s + (p.paidAmount || 0), 0);
  const unpaidTotal = data.payments
    .filter((p) => effectiveStatus(p) === "unpaid")
    .reduce((s, p) => s + p.amount, 0);
  const overdueTotal = data.payments
    .filter((p) => effectiveStatus(p) === "overdue")
    .reduce((s, p) => s + (p.amount - (p.paidAmount || 0)), 0);
  const maintenanceTotal = data.repairs
    .filter((r) => r.status !== "cancelled")
    .reduce((s, r) => s + r.cost, 0);

  return {
    totalIncome: paidTotal + partialTotal,
    paidTotal,
    unpaidTotal,
    overdueTotal,
    maintenanceTotal,
  };
}

export interface ReminderItem {
  id: string;
  kind: "rent" | "contract" | "maintenance" | "bill";
  title: string;
  subtitle: string;
  date: string;
  days: number;
  unitId: string;
}

export function collectReminders(data: AppData): ReminderItem[] {
  const items: ReminderItem[] = [];
  const unitName = (unitId: string) => {
    const u = data.units.find((x) => x.id === unitId);
    if (!u) return "وحدة محذوفة";
    const b = data.buildings.find((x) => x.id === u.buildingId);
    return b ? `${u.name} - ${b.name}` : u.name;
  };

  for (const p of data.payments) {
    if (p.status === "paid" || !p.nextDueDate) continue;
    items.push({
      id: `pay-${p.id}`,
      kind: "rent",
      title: "استحقاق إيجار",
      subtitle: unitName(p.unitId),
      date: p.nextDueDate,
      days: daysUntil(p.nextDueDate),
      unitId: p.unitId,
    });
  }

  for (const c of data.contracts) {
    const days = daysUntil(c.endDate);
    if (days < -30) continue;
    items.push({
      id: `con-${c.id}`,
      kind: "contract",
      title: "انتهاء عقد",
      subtitle: unitName(c.unitId),
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
      subtitle: unitName(r.unitId),
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

  return items.sort((a, b) => a.days - b.days);
}
