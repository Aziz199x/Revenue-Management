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
import { Repair, RepairStatus } from "@/data/types";
import { REPAIR_STATUS_LABELS } from "@/data/labels";
import { todayISO } from "@/data/helpers";

export interface RepairFormValues {
  description: string;
  repairDate: string;
  cost: number;
  contractor?: string;
  status: RepairStatus;
  notes?: string;
}

interface Props {
  initial?: Repair;
  onSubmit: (values: RepairFormValues) => void;
}

export default function RepairForm({ initial, onSubmit }: Props) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [repairDate, setRepairDate] = useState(initial?.repairDate ?? todayISO());
  const [cost, setCost] = useState(initial?.cost?.toString() ?? "");
  const [contractor, setContractor] = useState(initial?.contractor ?? "");
  const [status, setStatus] = useState<RepairStatus>(initial?.status ?? "pending");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!description.trim()) return;
        onSubmit({
          description: description.trim(),
          repairDate,
          cost: Number(cost) || 0,
          contractor: contractor.trim() || undefined,
          status,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label>وصف الصيانة *</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="مثال: إصلاح تسريب مياه" required className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>التاريخ</Label>
          <Input type="date" value={repairDate} onChange={(e) => setRepairDate(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>التكلفة</Label>
          <Input type="number" inputMode="decimal" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className="rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>الفني / المقاول</Label>
          <Input value={contractor} onChange={(e) => setContractor(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>الحالة</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as RepairStatus)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REPAIR_STATUS_LABELS) as RepairStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{REPAIR_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "إضافة الصيانة"}
      </Button>
    </form>
  );
}
