<<<<<<< HEAD
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
import { isValidDate, todayISO } from "@/data/helpers";
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
}

interface Props {
  initial?: Payment;
  defaultAmount?: number;
  onSubmit: (values: PaymentFormValues) => void;
}

export default function PaymentForm({ initial, defaultAmount, onSubmit }: Props) {
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
  const [pendingValues, setPendingValues] = useState<PaymentFormValues | null>(null);

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
  });

  const validate = (values: PaymentFormValues) => {
    if (values.amount <= 0) return "يرجى إدخال مبلغ صحيح";
    if (!isValidDate(values.paymentDate)) return "يرجى اختيار موعد سداد صحيح";
    if (values.status === "paid" && !values.receivedDate) return "يرجى اختيار تاريخ الاستلام";
    if (values.status === "paid" && !values.receiveMethod) return "يرجى اختيار طريقة الاستلام";
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>تاريخ الاستلام</Label><Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label>طريقة الاستلام</Label><Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentReceiveMethod)}><SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر الطريقة" /></SelectTrigger><SelectContent>{(["office_collection", "bank_transfer", "cash", "ejar_platform", "other"] as PaymentReceiveMethod[]).map((method) => <SelectItem key={method} value={method}>{PAYMENT_RECEIVE_METHOD_LABELS[method]}</SelectItem>)}</SelectContent></Select></div>
        </div>
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
=======
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Payment, PaymentStatus } from "@/data/types";
import { todayISO } from "@/data/helpers";

export interface PaymentFormValues {
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  notes?: string;
}

interface Props {
  initial?: Payment;
  defaultAmount?: number;
  onSubmit: (values: PaymentFormValues) => void;
}

export default function PaymentForm({ initial, defaultAmount, onSubmit }: Props) {
  const [amount, setAmount] = useState(
    initial?.amount?.toString() ?? (defaultAmount ? String(defaultAmount) : ""),
  );
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? todayISO());
  const [status, setStatus] = useState<PaymentStatus>(initial?.status ?? "unpaid");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          amount: Number(amount) || 0,
          dueDate,
          status,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>المبلغ *</Label>
          <Input type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>تاريخ الاستحقاق</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>الحالة</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unpaid">غير مدفوع</SelectItem>
            <SelectItem value="paid">مدفوع</SelectItem>
            <SelectItem value="partial">مدفوع جزئياً</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "تسجيل الدفعة"}
      </Button>
    </form>
  );
}
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
