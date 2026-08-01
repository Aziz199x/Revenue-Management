import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RecurringBuildingBill } from "@/data/types";

export type RecurringBuildingBillFormValues = Omit<
  RecurringBuildingBill,
  "id" | "buildingId" | "createdAt"
>;

interface Props {
  initial?: RecurringBuildingBill;
  onSubmit: (values: RecurringBuildingBillFormValues) => void | Promise<void>;
  showActiveToggle?: boolean;
}

export default function RecurringBuildingBillForm({ initial, onSubmit, showActiveToggle = true }: Props) {
  const nowMonth = new Date().toISOString().slice(0, 7);
  const [name, setName] = useState(initial?.name || "");
  const [amount, setAmount] = useState(String(initial?.amount || ""));
  const [dueDay, setDueDay] = useState(String(initial?.dueDay || 1));
  const [startYearMonth, setStartYearMonth] = useState(initial?.startYearMonth || nowMonth);
  const [endYearMonth, setEndYearMonth] = useState(initial?.endYearMonth || "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [notes, setNotes] = useState(initial?.notes || "");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!name.trim() || numericAmount <= 0 || !startYearMonth) return;
    await onSubmit({
      name: name.trim(),
      amount: Math.round(numericAmount * 100) / 100,
      dueDay: Math.min(31, Math.max(1, Number(dueDay) || 1)),
      startYearMonth,
      endYearMonth: endYearMonth || undefined,
      active,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label>اسم بند الصيانة *</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: المياه أو الحارس أو نظافة المبنى" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>التكلفة الشهرية *</Label>
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>يوم الاستحقاق</Label>
          <Input type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>تبدأ من شهر *</Label>
          <Input type="month" value={startYearMonth} onChange={(event) => setStartYearMonth(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>تنتهي في شهر</Label>
          <Input type="month" min={startYearMonth} value={endYearMonth} onChange={(event) => setEndYearMonth(event.target.value)} />
        </div>
      </div>
      {showActiveToggle && <label className="flex items-center justify-between rounded-2xl bg-muted p-3">
        <span>
          <span className="block text-sm font-bold">إنشاء الاستحقاق شهريًا</span>
          <span className="block text-[10px] text-muted-foreground">يمكن إيقاف الفاتورة دون حذف سجل الأشهر السابقة.</span>
        </span>
        <Switch checked={active} onCheckedChange={setActive} />
      </label>}
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="رقم الاشتراك أو تفاصيل مزود الخدمة" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "إضافة الصيانة الشهرية"}
      </Button>
    </form>
  );
}
