import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tenant } from "@/data/types";

export interface TenantFormValues {
  name: string;
  phone?: string;
  nationalId?: string;
  email?: string;
  notes?: string;
  extraInfo?: string;
  electricityAccountName?: string;
  electricityAccountNumber?: string;
  electricityMeterNumber?: string;
  electricityNotes?: string;
}

interface Props {
  initial?: Tenant;
  onSubmit: (values: TenantFormValues) => void;
}

export default function TenantForm({ initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [nationalId, setNationalId] = useState(initial?.nationalId ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [extraInfo, setExtraInfo] = useState(initial?.extraInfo ?? "");
  const [electricityAccountName, setElectricityAccountName] = useState(
    initial?.electricityAccountName ?? "",
  );
  const [electricityAccountNumber, setElectricityAccountNumber] = useState(
    initial?.electricityAccountNumber ?? "",
  );
  const [electricityMeterNumber, setElectricityMeterNumber] = useState(
    initial?.electricityMeterNumber ?? "",
  );
  const [electricityNotes, setElectricityNotes] = useState(
    initial?.electricityNotes ?? "",
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          phone: phone.trim() || undefined,
          nationalId: nationalId.trim() || undefined,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
          extraInfo: extraInfo.trim() || undefined,
          electricityAccountName: electricityAccountName.trim() || undefined,
          electricityAccountNumber: electricityAccountNumber.trim() || undefined,
          electricityMeterNumber: electricityMeterNumber.trim() || undefined,
          electricityNotes: electricityNotes.trim() || undefined,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label>اسم المستأجر *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>رقم الجوال</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" className="rounded-xl text-right" />
        </div>
        <div className="space-y-1.5">
          <Label>الهوية / الإقامة</Label>
          <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} inputMode="numeric" dir="ltr" className="rounded-xl text-right" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>البريد الإلكتروني (اختياري)</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className="rounded-xl text-right" />
      </div>
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>معلومات إضافية</Label>
        <Textarea value={extraInfo} onChange={(e) => setExtraInfo(e.target.value)} placeholder="أي معلومات أخرى تريد حفظها" className="rounded-xl" />
      </div>

      {/* Electricity Account Section */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="font-bold text-sm">بيانات حساب الكهرباء</p>
        <div className="space-y-1.5">
          <Label>اسم صاحب حساب الكهرباء</Label>
          <Input value={electricityAccountName} onChange={(e) => setElectricityAccountName(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>رقم حساب الكهرباء</Label>
          <Input value={electricityAccountNumber} onChange={(e) => setElectricityAccountNumber(e.target.value)} inputMode="numeric" dir="ltr" className="rounded-xl text-right" />
        </div>
        <div className="space-y-1.5">
          <Label>رقم العداد</Label>
          <Input value={electricityMeterNumber} onChange={(e) => setElectricityMeterNumber(e.target.value)} dir="ltr" className="rounded-xl text-right" />
        </div>
        <div className="space-y-1.5">
          <Label>ملاحظات حساب الكهرباء</Label>
          <Textarea value={electricityNotes} onChange={(e) => setElectricityNotes(e.target.value)} className="rounded-xl" />
        </div>
      </div>

      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "إضافة المستأجر"}
      </Button>
    </form>
  );
}