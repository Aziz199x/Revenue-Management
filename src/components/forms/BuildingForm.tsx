import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building } from "@/data/types";

interface Props {
  initial?: Building;
  onSubmit: (values: { name: string; address?: string; notes?: string; collectionPercentage?: number }) => void;
}

export default function BuildingForm({ initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [collectionPercentage, setCollectionPercentage] = useState(
    initial?.collectionPercentage != null ? String(initial.collectionPercentage) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          collectionPercentage: collectionPercentage !== "" ? Number(collectionPercentage) : undefined,
        });
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
        <Label>نسبة تحصيل المكتب الافتراضية %</Label>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          value={collectionPercentage}
          onChange={(e) => setCollectionPercentage(e.target.value)}
          placeholder="مثال: 5"
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">النسبة الافتراضية لكل الوحدات (يمكن تغييرها لكل عقد)</p>
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
