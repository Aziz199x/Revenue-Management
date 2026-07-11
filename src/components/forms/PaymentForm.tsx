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
