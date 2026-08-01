import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tenant, TenantEmailAddress, TenantPhoneNumber } from "@/data/types";
import { showError } from "@/utils/toast";

export interface TenantFormValues {
  name: string;
  phone?: string;
  phoneNumbers?: TenantPhoneNumber[];
  nationalId?: string;
  email?: string;
  emailAddresses?: TenantEmailAddress[];
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
  const [phoneNumbers, setPhoneNumbers] = useState<TenantPhoneNumber[]>(
    initial?.phoneNumbers?.length
      ? initial.phoneNumbers
      : initial?.phone
      ? [{ id: `phone-${initial.id}-primary`, phone: initial.phone, label: "الرئيسي", enabled: true }]
      : [],
  );
  const [nationalId, setNationalId] = useState(initial?.nationalId ?? "");
  const [emailAddresses, setEmailAddresses] = useState<TenantEmailAddress[]>(
    initial?.emailAddresses?.length
      ? initial.emailAddresses
      : initial?.email
      ? [{ id: `email-${initial.id}-primary`, email: initial.email, label: "الرئيسي", enabled: true }]
      : [],
  );
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
        const normalizedPhones = phoneNumbers
          .map((item) => ({ ...item, phone: item.phone.trim(), label: item.label?.trim() || undefined }))
          .filter((item) => item.phone);
        const normalizedEmails = emailAddresses
          .map((item) => ({ ...item, email: item.email.trim(), label: item.label?.trim() || undefined }))
          .filter((item) => item.email);
        const invalidEmail = normalizedEmails.find((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email));
        if (invalidEmail) {
          showError(`البريد الإلكتروني غير صحيح: ${invalidEmail.email}`);
          return;
        }
        onSubmit({
          name: name.trim(),
          phone: normalizedPhones[0]?.phone,
          phoneNumbers: normalizedPhones,
          nationalId: nationalId.trim() || undefined,
          email: normalizedEmails[0]?.email,
          emailAddresses: normalizedEmails,
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
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label>أرقام الجوال وواتساب</Label>
            <p className="mt-1 text-[10px] text-muted-foreground">يمكن إضافة أكثر من رقم واختيار الإرسال لها بالتتابع.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-xs"
            onClick={() => setPhoneNumbers((current) => [...current, {
              id: `phone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              phone: "",
              label: current.length === 0 ? "الرئيسي" : "",
              enabled: true,
            }])}
          >
            <Plus className="ml-1 h-3.5 w-3.5" /> إضافة
          </Button>
        </div>
        {phoneNumbers.length === 0 ? (
          <button
            type="button"
            className="w-full rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground"
            onClick={() => setPhoneNumbers([{
              id: `phone-${Date.now().toString(36)}`,
              phone: "",
              label: "الرئيسي",
              enabled: true,
            }])}
          >
            إضافة رقم للمستأجر
          </button>
        ) : (
          <div className="space-y-2">
            {phoneNumbers.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_105px_36px] gap-2">
                <Input
                  value={item.phone}
                  onChange={(event) => setPhoneNumbers((current) => current.map((phone) => phone.id === item.id ? { ...phone, phone: event.target.value } : phone))}
                  inputMode="tel"
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  className="rounded-xl text-left"
                />
                <Input
                  value={item.label || ""}
                  onChange={(event) => setPhoneNumbers((current) => current.map((phone) => phone.id === item.id ? { ...phone, label: event.target.value } : phone))}
                  placeholder="الرئيسي"
                  className="rounded-xl"
                />
                <Button type="button" variant="ghost" size="icon" className="h-10 w-9 text-destructive" onClick={() => setPhoneNumbers((current) => current.filter((phone) => phone.id !== item.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>الهوية / الإقامة</Label>
        <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} inputMode="numeric" dir="ltr" className="rounded-xl text-right" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label>عناوين البريد الإلكتروني</Label>
            <p className="mt-1 text-[10px] text-muted-foreground">يمكن إضافة أكثر من بريد للشركات، وستصل الرسالة إلى جميع العناوين المسجلة.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-xs"
            onClick={() => setEmailAddresses((current) => [...current, {
              id: `email-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              email: "",
              label: current.length === 0 ? "الرئيسي" : "",
              enabled: true,
            }])}
          >
            <Plus className="ml-1 h-3.5 w-3.5" /> إضافة
          </Button>
        </div>
        {emailAddresses.length === 0 ? (
          <button
            type="button"
            className="w-full rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground"
            onClick={() => setEmailAddresses([{
              id: `email-${Date.now().toString(36)}`,
              email: "",
              label: "الرئيسي",
              enabled: true,
            }])}
          >
            إضافة بريد للمستأجر
          </button>
        ) : (
          <div className="space-y-2">
            {emailAddresses.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_105px_36px] gap-2">
                <Input
                  type="email"
                  value={item.email}
                  onChange={(event) => setEmailAddresses((current) => current.map((email) => email.id === item.id ? { ...email, email: event.target.value } : email))}
                  placeholder="name@company.com"
                  dir="ltr"
                  className="rounded-xl text-left"
                />
                <Input
                  value={item.label || ""}
                  onChange={(event) => setEmailAddresses((current) => current.map((email) => email.id === item.id ? { ...email, label: event.target.value } : email))}
                  placeholder="الحسابات"
                  className="rounded-xl"
                />
                <Button type="button" variant="ghost" size="icon" className="h-10 w-9 text-destructive" onClick={() => setEmailAddresses((current) => current.filter((email) => email.id !== item.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
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
