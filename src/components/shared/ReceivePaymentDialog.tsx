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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PaymentMethod } from "@/data/types";
import { PAYMENT_METHOD_LABELS } from "@/data/labels";
import { todayISO } from "@/data/helpers";

export interface ReceivePaymentValues {
  receivedDate: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  onSubmit: (values: ReceivePaymentValues) => void;
}

export default function ReceivePaymentDialog({ open, onOpenChange, amount, onSubmit }: Props) {
  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] rounded-3xl sheet-safe-bottom">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right">تأكيد استلام الدفعة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-xl bg-secondary p-3 text-center">
            <p className="text-xs text-secondary-foreground">المبلغ المستلم</p>
            <p className="text-xl font-bold text-primary">
              {(amount || 0).toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الاستلام *</Label>
            <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>طريقة الدفع</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYMENT_METHOD_LABELS).filter((k) => k !== "")).map((m) => (
                  <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 sheet-safe-bottom">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              onSubmit({
                receivedDate,
                paymentMethod,
                notes: notes.trim() || undefined,
              });
              setNotes("");
              onOpenChange(false);
            }}
          >
            تأكيد الاستلام
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
