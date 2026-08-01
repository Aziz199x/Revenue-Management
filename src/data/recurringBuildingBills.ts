import { AppData, RecurringBuildingBill, Repair } from "./types";

function lastDayOfMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function nextMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function recurringBillOccurrenceId(billId: string, yearMonth: string): string {
  return `recurring-bill:${billId}:${yearMonth}`;
}

export function recurringBillDueDate(bill: RecurringBuildingBill, yearMonth: string): string {
  const day = Math.min(Math.max(1, Number(bill.dueDay) || 1), lastDayOfMonth(yearMonth));
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}

export function getRecurringBillMonths(
  bill: RecurringBuildingBill,
  throughYearMonth: string,
): string[] {
  if (!/^\d{4}-\d{2}$/.test(bill.startYearMonth) || bill.startYearMonth > throughYearMonth) {
    return [];
  }
  const configuredEnds = [bill.endYearMonth, bill.pausedYearMonth]
    .filter((value): value is string => Boolean(value))
    .sort();
  const configuredEnd = configuredEnds[0];
  const end = configuredEnd && configuredEnd < throughYearMonth ? configuredEnd : throughYearMonth;
  const months: string[] = [];
  let cursor = bill.startYearMonth;
  while (cursor <= end && months.length < 240) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }
  return months;
}

export function getOutstandingRecurringBillRepairs(
  data: Pick<AppData, "recurringBuildingBills" | "repairs">,
  buildingId: string,
  throughDate = new Date().toISOString().slice(0, 10),
): Repair[] {
  const throughYearMonth = throughDate.slice(0, 7);
  const materialized = new Set(
    data.repairs
      .filter((repair) => repair.recurringBillId && repair.recurringYearMonth)
      .map((repair) => `${repair.recurringBillId}:${repair.recurringYearMonth}`),
  );

  return data.recurringBuildingBills
    .filter((bill) => bill.buildingId === buildingId)
    .flatMap((bill) =>
      getRecurringBillMonths(bill, throughYearMonth)
        .filter((yearMonth) => !materialized.has(`${bill.id}:${yearMonth}`))
        .map((yearMonth): Repair => ({
          id: recurringBillOccurrenceId(bill.id, yearMonth),
          buildingId,
          description: `${bill.name} - ${yearMonth}`,
          repairDate: recurringBillDueDate(bill, yearMonth),
          cost: Number(bill.amount) || 0,
          status: "pending",
          notes: bill.notes || `فاتورة شهرية متكررة للعقار عن ${yearMonth}`,
          createdAt: bill.createdAt,
          isDeductedFromOwnerTransfer: false,
          deductedFromPaymentId: null,
          expenseKind: "recurring_bill",
          recurringBillId: bill.id,
          recurringYearMonth: yearMonth,
        })),
    )
    .filter((repair) => repair.cost > 0)
    .sort((a, b) => a.repairDate.localeCompare(b.repairDate));
}

export function isRecurringBillRepair(repair: Repair): boolean {
  return repair.expenseKind === "recurring_bill" || Boolean(repair.recurringBillId);
}
