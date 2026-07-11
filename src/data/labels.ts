import {
  UnitStatus,
  PaymentStatus,
  RepairStatus,
  BillStatus,
  BillType,
  RentPeriod,
<<<<<<< HEAD
  RentPeriodNew,
  PaymentMethod,
  PaymentReceiveMethod,
  CollectionFeeStatus,
  ContractDurationType,
  RequestType,
  RequestStatus,
  RequestPriority,
=======
  ContractStatus,
  RequestStatus,
  RequestPriority,
  PaymentMethod,
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
} from "./types";

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  occupied: "مؤجرة",
  rented_not_renewing: "مؤجرة - لا يرغب بالتجديد",
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

export const RENT_PERIOD_LABELS: Record<RentPeriod | RentPeriodNew, string> = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semi_annually: "نصف سنوي",
  semi_annual: "نصف سنوي",
  yearly: "سنوي",
<<<<<<< HEAD
  annual: "سنوي",
  flexible: "مرن (غير محدد)",
  custom: "مخصص",
  imported_schedule: "حسب جدول العقد",
};

// Use canonical values in selectors. Legacy aliases remain in the label map so
// old imported records still render correctly without creating duplicate rows.
export const UNIT_RENT_PERIOD_OPTIONS: RentPeriod[] = [
  "monthly",
  "quarterly",
  "semi_annually",
  "yearly",
  "flexible",
];

export const EJAR_PAYMENT_PERIOD_OPTIONS: (RentPeriod | RentPeriodNew)[] = [
  "monthly",
  "quarterly",
  "semi_annually",
  "yearly",
  "flexible",
  "custom",
  "imported_schedule",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "تحويل بنكي",
  cash: "نقدا",
  ejar_platform: "منصة إيجار",
  other: "أخرى",
};

export const PAYMENT_RECEIVE_METHOD_LABELS: Record<PaymentReceiveMethod, string> = {
  office_collection: "تحصيل المكتب",
  bank_transfer: "تحويل بنكي",
  cash: "نقدا",
  ejar_platform: "منصة إيجار",
  other: "أخرى",
};

export const COLLECTION_FEE_STATUS_LABELS: Record<CollectionFeeStatus, string> = {
  collected: "محصلة",
  uncollected: "مستحقة للمكتب وغير محصلة",
  waived: "متنازل عنها",
  settled: "تمت تسويتها",
  partially_settled: "مسواة جزئيا",
};

export const CONTRACT_DURATION_LABELS: Record<ContractDurationType, string> = {
  "6_months": "6 أشهر",
  "1_year": "سنة",
  "2_years": "سنتين",
  custom: "مدة مخصصة",
  manual_end: "تاريخ نهاية يدوي",
};

export const CONTRACT_DURATION_OPTIONS = [
  { value: "6_months" as ContractDurationType, label: "6 أشهر" },
  { value: "1_year" as ContractDurationType, label: "سنة" },
  { value: "2_years" as ContractDurationType, label: "سنتين" },
  { value: "custom" as ContractDurationType, label: "مدة مخصصة" },
  { value: "manual_end" as ContractDurationType, label: "تاريخ نهاية يدوي" },
];

export const REMINDER_OPTIONS = [
  { value: "7", label: "7 أيام" },
  { value: "15", label: "15 يوم" },
  { value: "30", label: "30 يوم" },
  { value: "60", label: "60 يوم" },
  { value: "80", label: "80 يوم" },
  { value: "custom", label: "مدة مخصصة" },
];

export const AUTO_RENEWAL_LABEL = "تجديد تلقائي للعقد";

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
=======
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
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
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

<<<<<<< HEAD
export const REQUEST_TYPES = [
  { value: "maintenance" as RequestType, label: "طلب صيانة" },
  { value: "plumbing" as RequestType, label: "مشكلة سباكة" },
  { value: "electrical" as RequestType, label: "مشكلة كهرباء" },
  { value: "ac" as RequestType, label: "مشكلة تكييف" },
  { value: "cleaning" as RequestType, label: "طلب نظافة" },
  { value: "complaint" as RequestType, label: "شكوى" },
  { value: "contract" as RequestType, label: "طلب متعلق بالعقد" },
  { value: "payment" as RequestType, label: "طلب متعلق بالدفع" },
  { value: "other" as RequestType, label: "أخرى" },
];

=======
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
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
<<<<<<< HEAD
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};
=======
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
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
