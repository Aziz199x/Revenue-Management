import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Payment, PaymentMethod, PaymentReceiveMethod, PaymentStatus } from "@/data/types";
import { PAYMENT_RECEIVE_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/data/labels";
import { isValidDate, todayISO, parseLocalDate, getPaymentReportYearMonth, getPaymentLessorCapacity } from "@/data/helpers";
import { useStore } from "@/data/store";
import { showError } from "@/utils/toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export interface PaymentFormValues {
  amount: number;
  paidAmount?: number;
  receivedAmount?: number;
  paymentDate: string;
  nextDueDate?: string;
  paymentDeadlineGregorian?: string;
  status: PaymentStatus;
  receivedDate?: string;
  paymentMethod?: PaymentMethod;
  receiveMethod?: PaymentReceiveMethod;
  notes?: string;
  reportingMonthMode?: "auto" | "due_month" | "next_month";
  reportingYearMonth?: string;
  ownerTransferred?: boolean;
  ownerTransferDate?: string | null;
  ownerTransferMethod?: PaymentMethod | null;
}

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const shiftMonthKey = (isoDate: string, offset: number): string => {
  const parsed = parseLocalDate(isoDate) || new Date();
  return monthKey(new Date(parsed.getFullYear(), parsed.getMonth() + offset, 1));
};

const monthLabel = (yearMonth: string): string => {
  const parsed = parseLocalDate(`${yearMonth}-01`);
  if (!parsed) return yearMonth;
  const name = parsed.toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { month: "long", year: "numeric" });
  return `شهر ${parsed.getMonth() + 1} — ${name}`;
};

interface Props {
  initial?: Payment;
  defaultAmount?: number;
  lessorCapacity?: "owner" | "representative";
  onSubmit: (values: PaymentFormValues) => void;
}

export default function PaymentForm({ initial, defaultAmount, lessorCapacity, onSubmit }: Props) {
  const { data } = useStore();
  const [amount, setAmount] = useState(
    initial?.amount?.toString() ?? (defaultAmount ? String(defaultAmount) : ""),
  );
  const [paidAmount, setPaidAmount] = useState(initial?.paidAmount?.toString() ?? "");
  const [paymentDate, setPaymentDate] = useState(initial?.paymentDate ?? todayISO());
  const [deadline, setDeadline] = useState(initial?.paymentDeadlineGregorian ?? "");
  const [status, setStatus] = useState<PaymentStatus>(initial?.status ?? "unpaid");
  const [receivedDate, setReceivedDate] = useState(initial?.receivedDate ?? todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentReceiveMethod | "">(initial?.receiveMethod ?? initial?.paymentMethod ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const resolvedLessorCapacity = lessorCapacity ?? (initial ? getPaymentLessorCapacity(data, initial) : "owner");
  const [ownerTransferred, setOwnerTransferred] = useState(initial?.ownerTransferred ?? false);
  const [ownerTransferDate, setOwnerTransferDate] = useState(initial?.ownerTransferDate ?? initial?.receivedDate ?? todayISO());
  const cutoffDay = data.settings.reportMonthCutoffDay;
  const initialPaymentDate = initial?.paymentDate ?? todayISO();
  const [reportMonth, setReportMonth] = useState<string>(() => {
    if (initial?.reportingYearMonth) return initial.reportingYearMonth;
    if (initial?.reportingMonthMode === "due_month") return shiftMonthKey(initialPaymentDate, 0);
    if (initial?.reportingMonthMode === "next_month") return shiftMonthKey(initialPaymentDate, 1);
    return "auto";
  });
  const [pendingValues, setPendingValues] = useState<PaymentFormValues | null>(null);

  // Explicit month choices derived from the due date (previous, same, next, +2 months).
  const monthOptions = (() => {
    const base = isValidDate(paymentDate) ? paymentDate : todayISO();
    const options = [-1, 0, 1, 2].map((offset) => shiftMonthKey(base, offset));
    if (reportMonth !== "auto" && !options.includes(reportMonth)) options.unshift(reportMonth);
    return options;
  })();
  const autoMonth = getPaymentReportYearMonth(isValidDate(paymentDate) ? paymentDate : todayISO(), cutoffDay, "auto");
  const autoOwnerTransfer = status === "paid"
    && paymentMethod === "ejar_platform"
    && resolvedLessorCapacity === "owner";
  const effectiveOwnerTransferred = status === "paid" && (autoOwnerTransfer || ownerTransferred);

  const buildValues = (): PaymentFormValues => ({
    amount: Number(amount) || 0,
    paidAmount: status === "partial" ? Number(paidAmount) || 0 : undefined,
    receivedAmount: status === "paid" ? Number(amount) || 0 : status === "partial" ? Number(paidAmount) || 0 : undefined,
    paymentDate,
    nextDueDate: paymentDate,
    paymentDeadlineGregorian: deadline || undefined,
    status,
    receivedDate: status === "paid" ? receivedDate : undefined,
    paymentMethod: status === "paid" && paymentMethod !== "office_collection" ? paymentMethod || undefined : undefined,
    receiveMethod: status === "paid" ? paymentMethod || undefined : undefined,
    notes: notes.trim() || undefined,
    reportingMonthMode: reportMonth === "auto"
      ? "auto"
      : reportMonth === shiftMonthKey(paymentDate, 0)
        ? "due_month"
        : reportMonth === shiftMonthKey(paymentDate, 1)
          ? "next_month"
          : "auto",
    reportingYearMonth: reportMonth === "auto" ? undefined : reportMonth,
    ownerTransferred: effectiveOwnerTransferred,
    ownerTransferDate: effectiveOwnerTransferred ? (ownerTransferDate || receivedDate) : null,
    ownerTransferMethod: effectiveOwnerTransferred
      ? autoOwnerTransfer ? "ejar_platform" : initial?.ownerTransferMethod ?? "bank_transfer"
      : null,
  });

  const validate = (values: PaymentFormValues) => {
    if (values.amount <= 0) return "يرجى إدخال مبلغ صحيح";
    if (!isValidDate(values.paymentDate)) return "يرجى اختيار موعد سداد صحيح";
    if (values.status === "paid" && !values.receivedDate) return "يرجى اختيار تاريخ الاستلام";
    if (values.status === "paid" && !values.receiveMethod) return "يرجى اختيار طريقة الاستلام";
    if (values.ownerTransferred && !values.ownerTransferDate) return "يرجى اختيار تاريخ التحويل للمالك";
    return null;
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const values = buildValues();
        const error = validate(values);
        if (error) { showError(error); return; }
        if (initial?.status === "paid" && status !== "paid") { setPendingValues(values); return; }
        onSubmit(values);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>مبلغ الدفعة *</Label>
          <Input type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>حالة الدفعة</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["unpaid", "paid", "partial", "overdue"] as PaymentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>تُحتسب هذه الدفعة لشهر</Label>
        <Select value={reportMonth} onValueChange={setReportMonth}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">تلقائي حسب يوم القطع ({monthLabel(autoMonth)})</SelectItem>
            {monthOptions.map((option) => (
              <SelectItem key={option} value={option}>{monthLabel(option)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">الدفعة المسددة نهاية الشهر غالبًا دفعة مقدمة للشهر التالي — اختر الشهر الصحيح لاحتسابها في التقرير الشهري.</p>
      </div>
      {status === "partial" && (
        <div className="space-y-1.5">
          <Label>المبلغ المدفوع</Label>
          <Input type="number" inputMode="decimal" min={0} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="rounded-xl" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>موعد السداد</Label>
          <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>نهاية مهلة السداد</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="rounded-xl" />
        </div>
      </div>
      {status === "paid" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>تاريخ الاستلام</Label>
              <Input
                type="date"
                value={receivedDate}
                onChange={(event) => {
                  const previous = receivedDate;
                  setReceivedDate(event.target.value);
                  if (autoOwnerTransfer && (!ownerTransferDate || ownerTransferDate === previous)) {
                    setOwnerTransferDate(event.target.value);
                  }
                }}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>طريقة الاستلام</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => {
                  setPaymentMethod(value as PaymentReceiveMethod);
                  if (value === "ejar_platform" && resolvedLessorCapacity === "owner") {
                    setOwnerTransferDate(receivedDate);
                  }
                }}
              >
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر الطريقة" /></SelectTrigger>
                <SelectContent>{(["office_collection", "bank_transfer", "cash", "ejar_platform", "other"] as PaymentReceiveMethod[]).map((method) => <SelectItem key={method} value={method}>{PAYMENT_RECEIVE_METHOD_LABELS[method]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className={`space-y-2 rounded-2xl border p-3 ${autoOwnerTransfer ? "border-emerald-200 bg-emerald-50" : "border-border bg-muted/40"}`}>
            {autoOwnerTransfer ? (
              <p className="text-xs font-semibold text-emerald-800">
                تم التحويل للمالك تلقائيًا لأن التحصيل عبر منصة إيجار وصفة المؤجر «مالك العقار».
              </p>
            ) : (
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={ownerTransferred} onChange={(event) => setOwnerTransferred(event.target.checked)} />
                تم تحويل الدفعة للمالك
              </label>
            )}
            {effectiveOwnerTransferred && (
              <div className="space-y-1.5">
                <Label>تاريخ التحويل للمالك</Label>
                <Input type="date" value={ownerTransferDate} onChange={(event) => setOwnerTransferDate(event.target.value)} className="rounded-xl bg-background" />
              </div>
            )}
            {paymentMethod === "ejar_platform" && resolvedLessorCapacity === "representative" && (
              <p className="text-[11px] text-amber-700">صفة المؤجر «ممثل»، لذلك يلزم تأكيد التحويل للمالك يدويًا.</p>
            )}
          </div>
        </>
      )}
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "تسجيل الدفعة"}
      </Button>
      <AlertDialog open={!!pendingValues} onOpenChange={(open) => !open && setPendingValues(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="text-right">إلغاء تسجيل الاستلام</AlertDialogTitle><AlertDialogDescription className="text-right">سيتم إلغاء تسجيل استلام هذه الدفعة ومسح بيانات الاستلام. هل تريد المتابعة؟</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel type="button">إلغاء</AlertDialogCancel><AlertDialogAction type="button" onClick={() => { if (pendingValues) onSubmit(pendingValues); setPendingValues(null); }}>تأكيد</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
