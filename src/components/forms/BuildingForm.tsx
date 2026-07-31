import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Building, BuildingOwner } from "@/data/types";
import { normalizeOwners, ownersAreValid, ownershipChanged } from "@/data/buildingOwnership";
import { showError } from "@/utils/toast";

export interface BuildingFormValues {
  name: string;
  address?: string;
  notes?: string;
  collectionFeePercent: number;
  multipleOwnersEnabled: boolean;
  owners: BuildingOwner[];
  ownershipEffectiveFrom: string;
  ownershipChangeReason: string;
}

interface Props {
  initial?: Building;
  onSubmit: (values: BuildingFormValues) => void;
}

const newOwner = (): BuildingOwner => ({
  id: `owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  name: "",
  percentage: 0,
});

export default function BuildingForm({ initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [collectionFeePercent, setCollectionFeePercent] = useState(String(initial?.collectionFeePercent ?? 0));
  const [multipleOwnersEnabled, setMultipleOwnersEnabled] = useState(initial?.multipleOwnersEnabled ?? false);
  const [owners, setOwners] = useState<BuildingOwner[]>(
    initial?.owners?.length ? initial.owners : [newOwner(), newOwner()],
  );
  const [ownershipEffectiveFrom, setOwnershipEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [ownershipChangeReason, setOwnershipChangeReason] = useState("");
  const totalPercentage = useMemo(
    () => Math.round(owners.reduce((sum, owner) => sum + (Number(owner.percentage) || 0), 0) * 100) / 100,
    [owners],
  );

  const updateOwner = (id: string, patch: Partial<BuildingOwner>) => {
    setOwners((current) => current.map((owner) => owner.id === id ? { ...owner, ...patch } : owner));
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        const fee = Number(collectionFeePercent || 0);
        if (!Number.isFinite(fee) || fee < 0 || fee > 100) {
          showError("يرجى إدخال نسبة رسوم صحيحة بين 0 و100");
          return;
        }
        const normalizedOwners = multipleOwnersEnabled ? normalizeOwners(owners) : [];
        if (multipleOwnersEnabled && (normalizedOwners.length < 2 || !ownersAreValid(normalizedOwners))) {
          showError("أضف مالكين على الأقل وتأكد أن مجموع نسب الملكية يساوي 100%");
          return;
        }
        const changed = ownershipChanged(initial?.owners, normalizedOwners)
          || !!initial?.multipleOwnersEnabled !== multipleOwnersEnabled;
        if (initial && changed && !ownershipChangeReason.trim()) {
          showError("يرجى كتابة سبب تغيير الملاك أو النسب لتوثيقه");
          return;
        }
        onSubmit({
          name: name.trim(),
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          collectionFeePercent: fee,
          multipleOwnersEnabled,
          owners: normalizedOwners,
          ownershipEffectiveFrom,
          ownershipChangeReason: ownershipChangeReason.trim() || "إعداد ملاك العقار",
        });
      }}
    >
      <div className="space-y-1.5">
        <Label>اسم العقار *</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: عمارة الياسمين" required className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>العنوان</Label>
        <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="الحي، الشارع، المدينة" className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>نسبة رسوم تحصيل الإيجار للعقار</Label>
        <div className="relative">
          <Input type="number" inputMode="decimal" min={0} max={100} step="0.1" value={collectionFeePercent} onChange={(event) => setCollectionFeePercent(event.target.value)} placeholder="مثال: 5" className="rounded-xl pl-9" />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-primary/20 bg-secondary/50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>العقار مملوك لأكثر من مالك</Label>
            <p className="mt-1 text-[11px] text-muted-foreground">تُوزع مستحقات جميع وحدات العقار حسب النسب أدناه.</p>
          </div>
          <Switch checked={multipleOwnersEnabled} onCheckedChange={setMultipleOwnersEnabled} />
        </div>

        {multipleOwnersEnabled && (
          <div className="space-y-3">
            {owners.map((owner, index) => (
              <div key={owner.id} className="space-y-2 rounded-2xl bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">المالك {index + 1}</p>
                  {owners.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setOwners((current) => current.filter((item) => item.id !== owner.id))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_95px] gap-2">
                  <Input value={owner.name} onChange={(event) => updateOwner(owner.id, { name: event.target.value })} placeholder="اسم المالك" className="rounded-xl" />
                  <div className="relative">
                    <Input type="number" min={0.01} max={100} step="0.01" value={owner.percentage || ""} onChange={(event) => updateOwner(owner.id, { percentage: Number(event.target.value) })} placeholder="النسبة" className="rounded-xl pl-7" />
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={owner.phone || ""} onChange={(event) => updateOwner(owner.id, { phone: event.target.value })} placeholder="رقم الجوال (اختياري)" className="rounded-xl" />
                  <Input value={owner.bankAccount || ""} onChange={(event) => updateOwner(owner.id, { bankAccount: event.target.value })} placeholder="الآيبان (اختياري)" className="rounded-xl" />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setOwners((current) => [...current, newOwner()])}>
                <Plus className="ml-1 h-4 w-4" /> إضافة مالك
              </Button>
              <p className={`text-xs font-bold ${Math.abs(totalPercentage - 100) < 0.01 ? "text-emerald-700" : "text-red-600"}`}>
                مجموع النسب: {totalPercentage}%
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label>سريان التغيير من تاريخ</Label>
                <Input type="date" value={ownershipEffectiveFrom} onChange={(event) => setOwnershipEffectiveFrom(event.target.value)} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>سبب التغيير {initial ? "*" : ""}</Label>
                <Input value={ownershipChangeReason} onChange={(event) => setOwnershipChangeReason(event.target.value)} placeholder="إضافة مالك أو تعديل النسب" className="mt-1 rounded-xl" />
              </div>
            </div>
          </div>
        )}
        {!multipleOwnersEnabled && initial?.multipleOwnersEnabled && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label>سريان العودة إلى مالك واحد من تاريخ</Label>
              <Input type="date" value={ownershipEffectiveFrom} onChange={(event) => setOwnershipEffectiveFrom(event.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>سبب التغيير *</Label>
              <Input value={ownershipChangeReason} onChange={(event) => setOwnershipChangeReason(event.target.value)} placeholder="خروج أحد الملاك أو انتقال الملكية" className="mt-1 rounded-xl" />
            </div>
          </div>
        )}
      </div>

      {initial?.ownershipHistory?.length ? (
        <div className="space-y-2 rounded-2xl bg-muted p-3 text-xs">
          <p className="font-bold">سجل تغيّر الملكية</p>
          {[...initial.ownershipHistory].reverse().map((version) => (
            <div key={version.id} className="rounded-xl bg-background p-2">
              <p className="font-semibold">{version.effectiveFrom} · {version.reason}</p>
              <p className="mt-1 text-muted-foreground">
                {version.owners.length
                  ? version.owners.map((owner) => `${owner.name} ${owner.percentage}%`).join("، ")
                  : "مالك واحد غير مسمى 100%"}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="تفاصيل إضافية..." className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "إضافة العقار"}
      </Button>
    </form>
  );
}
