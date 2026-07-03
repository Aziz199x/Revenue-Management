import {
  UnitStatus,
  PaymentStatus,
  RepairStatus,
  BillStatus,
  BillType,
} from "./types";

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  occupied: "مؤجرة",
  vacant: "شاغرة",
  maintenance: "تحت الصيانة",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  partial: "مدفوع جزئياً",
  overdue: "متأخر",
};

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  pending: "معلق",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  paid: "مدفوعة",
  unpaid: "غير مدفوعة",
};

export const BILL_TYPE_LABELS: Record<BillType, string> = {
  electricity: "كهرباء",
  water: "ماء",
  other: "أخرى",
};

export const UNIT_TYPES = ["شقة", "محل", "غرفة", "مكتب", "مستودع", "أخرى"];

export const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  unpaid: "bg-slate-200 text-slate-700",
  partial: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-700",
  occupied: "bg-emerald-100 text-emerald-800",
  vacant: "bg-slate-200 text-slate-700",
  maintenance: "bg-amber-100 text-amber-800",
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-500",
};
