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
import { Contract } from "@/data/types";
import { todayISO } from "@/data/helpers";

export interface ContractFormValues {
  startDate: string;
  endDate: string;
  reminderDays: number;
  notes?: string;
}

interface Props {
  initial?: Contract;
  onSubmit: (values: ContractFormValues) => void;
}

export default function ContractForm({ initial, onSubmit }: Props) {
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [reminderDays, setReminderDays] = useState(String(initial?.reminderDays ?? 30));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const durationDays =
    startDate && endDate
      ? Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
        )
      : null;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!endDate) return;
        onSubmit({
          startDate,
          endDate,
          reminderDays: Number(reminderDays),
          notes: notes.trim() || undefined,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>بداية العقد *</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>نهاية العقد *</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="rounded-xl" />
        </div>
      </div>
      {durationDays !== null && durationDays > 0 && (
        <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          مدة العقد: {durationDays} يوم (~{Math.round(durationDays / 30)} شهر)
        </p>
      )}
      <div className="space-y-1.5">
        <Label>التذكير قبل الانتهاء</Label>
        <Select value={reminderDays} onValueChange={setReminderDays}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 أيام</SelectItem>
            <SelectItem value="15">15 يوم</SelectItem>
            <SelectItem value="30">30 يوم</SelectItem>
            <SelectItem value="60">60 يوم</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>ملاحظات العقد</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "حفظ العقد"}
      </Button>
    </form>
  );
}
