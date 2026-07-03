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
import { Unit, UnitStatus, RentPeriod } from "@/data/types";
import { UNIT_TYPES, UNIT_STATUS_LABELS, RENT_PERIOD_LABELS } from "@/data/labels";

export interface UnitFormValues {
  name: string;
  floor?: string;
  type: string;
  rentAmount: number;
  rentPeriod: RentPeriod;
  status: UnitStatus;
  notes?: string;
}

interface Props {
  initial?: Unit;
  onSubmit: (values: UnitFormValues) => void;
}

export default function UnitForm({ initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [floor, setFloor] = useState(initial?.floor ?? "");
  const [type, setType] = useState(initial?.type ?? "شقة");
  const [customType, setCustomType] = useState(
    initial && !UNIT_TYPES.includes(initial.type) ? initial.type : "",
  );
  const [rentAmount, setRentAmount] = useState(initial?.rentAmount?.toString() ?? "");
  const [rentPeriod, setRentPeriod] = useState<RentPeriod>(initial?.rentPeriod ?? "monthly");
  const [status, setStatus] = useState<UnitStatus>(initial?.status ?? "vacant");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const effectiveType =
    initial && !UNIT_TYPES.includes(initial.type) && customType ? customType : type;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          floor: floor.trim() || undefined,
          type: type === "أخرى" ? customType.trim() || "أخرى" : effectiveType,
          rentAmount: Number(rentAmount) || 0,
          rentPeriod,
          status,
          notes: notes.trim() || undefined,
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
      <div className="space-y-1.5">
        <Label>نوع الوحدة</Label>
        <Select value={UNIT_TYPES.includes(type) ? type : "أخرى"} onValueChange={setType}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {type === "أخرى" && (
          <Input
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="اكتب نوع الوحدة"
            className="mt-2 rounded-xl"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>قيمة الإيجار</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            value={rentAmount}
            onChange={(e) => setRentAmount(e.target.value)}
            placeholder="0"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label>فترة الإيجار</Label>
          <Select value={rentPeriod} onValueChange={(v) => setRentPeriod(v as RentPeriod)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RENT_PERIOD_LABELS) as RentPeriod[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {RENT_PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>الحالة</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as UnitStatus)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(UNIT_STATUS_LABELS) as UnitStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{UNIT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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