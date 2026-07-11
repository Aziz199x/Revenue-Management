import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building } from "@/data/types";
import { showError } from "@/utils/toast";

interface Props {
  initial?: Building;
  onSubmit: (values: { name: string; address?: string; notes?: string; collectionFeePercent: number }) => void;
}

export default function BuildingForm({ initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [collectionFeePercent, setCollectionFeePercent] = useState(String(initial?.collectionFeePercent ?? 0));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const fee = Number(collectionFeePercent || 0);
        if (!Number.isFinite(fee) || fee < 0 || fee > 100) {
          showError("يرجى إدخال نسبة صحيحة بين 0 و 100");
          return;
        }
        onSubmit({ name: name.trim(), address: address.trim() || undefined, notes: notes.trim() || undefined, collectionFeePercent: fee });
      }}
    >
      <div className="space-y-1.5">
        <Label>اسم العقار *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عمارة الياسمين" required className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>العنوان</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="الحي، الشارع، المدينة" className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>نسبة رسوم تحصيل الإيجار للعقار</Label>
        <div className="relative">
          <Input type="number" inputMode="decimal" min={0} max={100} step="0.1" value={collectionFeePercent} onChange={(e) => setCollectionFeePercent(e.target.value)} placeholder="مثال: 5" className="rounded-xl pl-9" />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تفاصيل إضافية..." className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "إضافة العقار"}
      </Button>
    </form>
  );
}