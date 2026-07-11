import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { showError } from "@/utils/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Unit, UnitStatus, RentPeriod } from "@/data/types";
import { UNIT_TYPES, UNIT_STATUS_LABELS, RENT_PERIOD_LABELS, UNIT_RENT_PERIOD_OPTIONS } from "@/data/labels";

export interface UnitFormValues {
  name: string;
  floor?: string;
  area?: string;
  type: string;
  rentAmount: number;
  rentPeriod: RentPeriod;
  status: UnitStatus;
  notes?: string;
  collectionFeeOverrideEnabled: boolean;
  collectionFeePercent: number | null;
}

interface Props {
  initial?: Unit;
  hasActiveContract?: boolean;
  onSubmit: (values: UnitFormValues) => void;
}

export default function UnitForm({ initial, hasActiveContract = false, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [floor, setFloor] = useState(initial?.floor ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [type, setType] = useState(initial?.type ?? "شقة");
  const [customType, setCustomType] = useState(
    initial && !UNIT_TYPES.includes(initial.type) ? initial.type : "",
  );
  const [rentAmount, setRentAmount] = useState(initial?.rentAmount?.toString() ?? "");
  const initialRentPeriod = initial?.rentPeriod as string | undefined;
  const [rentPeriod, setRentPeriod] = useState<RentPeriod>(
    initialRentPeriod === "annual"
      ? "yearly"
      : initialRentPeriod === "semi_annual"
        ? "semi_annually"
        : initial?.rentPeriod ?? "monthly",
  );
  const [status, setStatus] = useState<UnitStatus>(initial?.manualStatus ?? (initial?.status === "maintenance" ? "maintenance" : "vacant"));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [collectionFeeOverrideEnabled, setCollectionFeeOverrideEnabled] = useState(initial?.collectionFeeOverrideEnabled ?? false);
  const [collectionFeePercent, setCollectionFeePercent] = useState(String(initial?.collectionFeePercent ?? 0));

  const effectiveType = type === "أخرى" ? customType.trim() || "أخرى" : type;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const fee = Number(collectionFeePercent || 0);
        if (collectionFeeOverrideEnabled && (!Number.isFinite(fee) || fee < 0 || fee > 100)) {
          showError("يرجى إدخال نسبة صحيحة بين 0 و 100");
          return;
        }
        onSubmit({
          name: name.trim(),
          floor: floor.trim() || undefined,
          area: area.trim() || undefined,
          type: effectiveType,
          rentAmount: Number(rentAmount) || 0,
          rentPeriod,
          status,
          notes: notes.trim() || undefined,
          collectionFeeOverrideEnabled,
          collectionFeePercent: collectionFeeOverrideEnabled ? fee : null,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>اسم / رقم الوحدة *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="شقة 1" required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>الطابق</Label>
          <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="الأول" className="rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>المساحة</Label>
          <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="م²" className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>نوع الوحدة</Label>
          <Select value={UNIT_TYPES.includes(type) ? type : "أخرى"} onValueChange={setType}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {type === "أخرى" && (
        <Input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="اكتب نوع الوحدة" className="rounded-xl" />
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>قيمة الإيجار</Label>
          <Input type="number" inputMode="decimal" min={0} value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} placeholder="0" className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>فترة الإيجار</Label>
          <Select value={rentPeriod} onValueChange={(v) => setRentPeriod(v as RentPeriod)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIT_RENT_PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {RENT_PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>الحالة اليدوية</Label>
        <Select value={status === "maintenance" ? "maintenance" : "vacant"} onValueChange={(v) => setStatus(v as UnitStatus)}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="vacant">{UNIT_STATUS_LABELS.vacant}</SelectItem>
            <SelectItem value="maintenance">{UNIT_STATUS_LABELS.maintenance}</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveContract && status !== "maintenance" && (
          <p className="text-xs text-muted-foreground">
            تم تحديد الحالة تلقائياً بسبب وجود عقد ساري
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-xl border p-3">
          <Label>تخصيص رسوم التحصيل لهذه الوحدة</Label>
          <Switch checked={collectionFeeOverrideEnabled} onCheckedChange={setCollectionFeeOverrideEnabled} />
        </div>
        {collectionFeeOverrideEnabled ? (
          <div className="space-y-1.5"><Label>نسبة رسوم التحصيل لهذه الوحدة</Label><Input type="number" inputMode="decimal" min={0} max={100} step={0.1} value={collectionFeePercent} onChange={(event) => setCollectionFeePercent(event.target.value)} placeholder="مثال: 5" className="rounded-xl" /></div>
        ) : <p className="text-xs text-muted-foreground">سيتم استخدام نسبة العقار</p>}
      </div>

      <Separator />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-100 p-1.5"><Zap className="h-4 w-4 text-amber-600" /></div>
          <Label className="text-sm font-bold">بيانات حساب الكهرباء</Label>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">اسم صاحب حساب الكهرباء</Label>
          <Input value={electricityAccountName} onChange={(e) => setElectricityAccountName(e.target.value)} className="rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">رقم حساب الكهرباء</Label>
            <Input value={electricityAccountNumber} onChange={(e) => setElectricityAccountNumber(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">رقم العداد</Label>
            <Input value={electricityMeterNumber} onChange={(e) => setElectricityMeterNumber(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">ملاحظات حساب الكهرباء</Label>
          <Textarea value={electricityNotes} onChange={(e) => setElectricityNotes(e.target.value)} className="rounded-xl" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "إضافة الوحدة"}
      </Button>
    </form>
  );
}