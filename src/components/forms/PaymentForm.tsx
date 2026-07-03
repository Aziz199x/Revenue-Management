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
import { Payment, PaymentStatus } from "@/data/types";
import { PAYMENT_STATUS_LABELS } from "@/data/labels";
import { todayISO } from "@/data/helpers";

export interface PaymentFormValues {
  amount: number;
  paidAmount?: number;
  paymentDate: string;
  nextDueDate?: string;
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
  const [paidAmount, setPaidAmount] = useState(initial?.paidAmount?.toString() ?? "");
  const [paymentDate, setPaymentDate] = useState(initial?.paymentDate ?? todayISO());
  const [nextDueDate, setNextDueDate] = useState(initial?.nextDueDate ?? "");
  const [status, setStatus] = useState<PaymentStatus>(initial?.status ?? "unpaid");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          amount: Number(amount) || 0,
          paidAmount: status === "partial" ? Number(paidAmount) || 0 : undefined,
          paymentDate,
          nextDueDate: nextDueDate || undefined,
          status,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>مبلغ الإيجار *</Label>
          <Input type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>حالة الدفع</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => (
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
          <Label>تاريخ الدفعة</Label>
          <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>تاريخ الاستحقاق القادم</Label>
          <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="rounded-xl" />
        </div>
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
