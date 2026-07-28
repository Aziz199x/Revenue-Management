import { Payment } from "@/data/types";
import {
  getPaymentReportMonth,
  getPaymentReportYearMonth,
  paymentDueDateValue,
  parseLocalDate,
  todayISO,
  isPaymentPaid,
} from "@/data/helpers";

/** Difference in whole days between two ISO dates (a - b). */
export function diffDaysIso(a: string, b: string): number {
  const dateA = parseLocalDate(a);
  const dateB = parseLocalDate(b);
  if (!dateA || !dateB) return 0;
  return Math.round((dateA.getTime() - dateB.getTime()) / 86400000);
}

/** The obligation month (yyyy-mm) — always the real calendar month of the due date. */
export function getDueYearMonth(payment: Payment, cutoffDay: number | null = 25): string {
  return getPaymentReportMonth(payment, cutoffDay);
}

export function getDueDate(payment: Payment): string {
  return paymentDueDateValue(payment);
}

/**
 * The calendar month cash actually arrived, if it has. Only "paid" carries a reliable
 * receivedDate today (partial payments don't yet capture one in the data-entry form),
 * so a partial payment with no receivedDate is treated as "not collected yet" for
 * late-collection purposes even though part of the money is in hand.
 */
export function getCollectionYearMonth(payment: Payment): string | undefined {
  const collectionDate = getCollectionDate(payment);
  return collectionDate ? collectionDate.slice(0, 7) : undefined;
}

/**
 * Human-facing allocation rule used throughout the report:
 * - early/on-time payment stays attached to its due month;
 * - a payment collected in a later month keeps its obligation in the due month,
 *   while its cash is additionally reported in that later collection month.
 */
export function getPaymentAllocation(payment: Payment, cutoffDay: number | null = 25): {
  dueYearMonth: string;
  collectionYearMonth?: string;
  isEarly: boolean;
  isLate: boolean;
} {
  const dueYearMonth = getDueYearMonth(payment, cutoffDay);
  const collectionYearMonth = getCollectionYearMonth(payment);
  return {
    dueYearMonth,
    collectionYearMonth,
    isEarly: isEarlyCollection(payment),
    isLate: isLateCollection(payment),
  };
}

export function getCollectionDate(payment: Payment): string | undefined {
  if (payment.status === "paid" && payment.receivedDate) return payment.receivedDate;
  return undefined;
}

/**
 * True only when a fully-paid payment's cash arrived STRICTLY AFTER its due date.
 * Comparing calendar months here would wrongly flag early payments as "late"
 * (e.g. due 1 June, paid 25 May lands in a different month but is not late at
 * all). Paying on the due date itself is on time, not late.
 */
export function isLateCollection(payment: Payment): boolean {
  if (!isPaymentPaid(payment)) return false;
  const collectionDate = getCollectionDate(payment);
  const due = getDueDate(payment);
  if (!collectionDate || !due) return false;
  return collectionDate > due;
}

/** True when a fully-paid payment's cash arrived BEFORE its due date. */
export function isEarlyCollection(payment: Payment): boolean {
  if (!isPaymentPaid(payment)) return false;
  const collectionDate = getCollectionDate(payment);
  const due = getDueDate(payment);
  if (!collectionDate || !due) return false;
  return collectionDate < due;
}

/**
 * Delay in days:
 *  - fully paid with a collection date -> collection date minus due date (never negative)
 *  - still outstanding and past due -> today minus due date (an open, growing delay)
 *  - otherwise -> 0
 */
export function getDelayDays(payment: Payment, today = todayISO()): number {
  const due = getDueDate(payment);
  if (!due) return 0;
  const collectionDate = getCollectionDate(payment);
  if (collectionDate) return Math.max(0, diffDaysIso(collectionDate, due));
  if (!isPaymentPaid(payment) && due < today) return Math.max(0, diffDaysIso(today, due));
  return 0;
}

export function monthStart(yearMonth: string): string {
  return `${yearMonth}-01`;
}

export function monthEnd(yearMonth: string): string {
  const date = parseLocalDate(`${yearMonth}-01`) || new Date();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

export function shiftYearMonth(yearMonth: string, months: number): string {
  const date = parseLocalDate(`${yearMonth}-01`) || new Date();
  const shifted = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

export function currentYearMonth(): string {
  return todayISO().slice(0, 7);
}

export function formatYearMonthLabel(yearMonth: string): string {
  const date = parseLocalDate(`${yearMonth}-01`);
  if (!date) return yearMonth;
  return date.toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { year: "numeric", month: "long" });
}

export { getPaymentReportYearMonth };
