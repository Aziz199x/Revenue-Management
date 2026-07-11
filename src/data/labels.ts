import {
  UnitStatus,
  PaymentStatus,
  RepairStatus,
  BillStatus,
  BillType,
  RentPeriod,
  ContractStatus,
  RequestStatus,
  RequestPriority,
  PaymentMethod,
} from "./types";

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  occupied: "مؤجرة",
  vacant: "شاغرة",
  maintenance: "تحت الصيانة",
  occupied_no_renewal: "مؤجرة - لا يرغب بالتجديد",
  expired_not_vacated: "عقد منتهي والمستأجر لم يخرج",
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

export const RENT_PERIOD_LABELS: Record<RentPeriod, string> = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semi_annually: "نصف سنوي",
  yearly: "سنوي",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "ساري",
  future: "مستقبلي",
  expired: "منتهي",
  ending_soon: "ينتهي قريباً",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  ejar: "إيجار",
  "": "—",
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  maintenance: "طلب صيانة",
  plumbing: "مشكلة سباكة",
  electrical: "مشكلة كهرباء",
  ac: "مشكلة تكييف",
  cleaning: "طلب نظافة",
  complaint: "شكوى",
  contract: "طلب متعلق بالعقد",
  payment: "طلب متعلق بالدفع",
  other: "أخرى",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "جديد",
  pending: "معلق",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

export const UNIT_TYPES = ["شقة", "محل", "غرفة", "مكتب", "مستودع", "أخرى"];

export const STATUS_COLORS: Record<string, string> = {
  // payments
  paid: "bg-emerald-100 text-emerald-800",
  unpaid: "bg-slate-200 text-slate-700",
  partial: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-700",
  // units
  occupied: "bg-emerald-100 text-emerald-800",
  vacant: "bg-slate-200 text-slate-700",
  maintenance: "bg-amber-100 text-amber-800",
  occupied_no_renewal: "bg-orange-100 text-orange-800",
  expired_not_vacated: "bg-red-100 text-red-700",
  // repairs
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-500",
  // contracts
  active: "bg-emerald-100 text-emerald-800",
  future: "bg-sky-100 text-sky-700",
  expired: "bg-red-100 text-red-700",
  ending_soon: "bg-amber-100 text-amber-800",
  // request statuses
  req_new: "bg-sky-100 text-sky-700",
  req_pending: "bg-amber-100 text-amber-800",
  req_in_progress: "bg-blue-100 text-blue-700",
  req_completed: "bg-emerald-100 text-emerald-800",
  req_cancelled: "bg-slate-200 text-slate-500",
  // request priorities
  pri_low: "bg-slate-200 text-slate-600",
  pri_medium: "bg-sky-100 text-sky-700",
  pri_high: "bg-amber-100 text-amber-800",
  pri_urgent: "bg-red-100 text-red-700",
};

export function statusColorKey(kind: string, status: string): string {
  if (kind === "request") return `req_${status}`;
  if (kind === "priority") return `pri_${status}`;
  return status;
}
