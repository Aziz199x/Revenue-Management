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
import { Bill, BillType, BillStatus } from "@/data/types";
import { BILL_TYPE_LABELS, BILL_STATUS_LABELS } from "@/data/labels";
import { todayISO } from "@/data/helpers";

export interface BillFormValues {
  type: BillType;
  typeLabel?: string;
  amount: number;
  billDate: string;
  dueDate?: string;
  status: BillStatus;
  notes?: string;
}

interface Props {
  initial?: Bill;
  onSubmit: (values: BillFormValues) => void;
}

export default function BillForm({ initial, onSubmit }: Props) {
  const [type, setType] = useState<BillType>(initial?.type ?? "electricity");
  const [typeLabel, setTypeLabel] = useState(initial?.typeLabel ?? "");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [billDate, setBillDate] = useState(initial?.billDate ?? todayISO());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [status, setStatus] = useState<BillStatus>(initial?.status ?? "unpaid");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          type,
          typeLabel: type === "other" ? typeLabel.trim() || undefined : undefined,
          amount: Number(amount) || 0,
          billDate,
          dueDate: dueDate || undefined,
          status,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>نوع الفاتورة</Label>
          <Select value={type} onValueChange={(v) => setType(v as BillType)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BILL_TYPE_LABELS) as BillType[]).map((t) => (
                <SelectItem key={t} value={t}>{BILL_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>المبلغ *</Label>
          <Input type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required className="rounded-xl" />
        </div>
      </div>
      {type === "other" && (
        <div className="space-y-1.5">
          <Label>وصف نوع الفاتورة</Label>
          <Input value={typeLabel} onChange={(e) => setTypeLabel(e.target.value)} placeholder="مثال: إنترنت" className="rounded-xl" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>تاريخ الفاتورة</Label>
          <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>تاريخ الاستحقاق</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>حالة الدفع</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as BillStatus)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(BILL_STATUS_LABELS) as BillStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{BILL_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "إضافة الفاتورة"}
      </Button>
    </form>
  );
}
