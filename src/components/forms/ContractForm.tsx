import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Contract, RentPeriod } from "@/data/types";
import { RENT_PERIOD_LABELS } from "@/data/labels";
import { todayISO, addMonths } from "@/data/helpers";

export interface ContractFormValues {
  tenantName: string;
  tenantPhone?: string;
  contractNumber?: string;
  electricityAccountNumber?: string;
  electricityMeterNumber?: string;
  startDate: string;
  endDate: string;
  annualRent: number;
  paymentCycle: RentPeriod;
  autoRenewal: boolean;
  reminderDays: number;
  collectionPercentage?: number;
  notes?: string;
}

interface Props {
  initial?: Contract;
  defaultBuildingCollectionPct?: number;
  onSubmit: (values: ContractFormValues) => void;
}

export default function ContractForm({ initial, defaultBuildingCollectionPct, onSubmit }: Props) {
  const [tenantName, setTenantName] = useState(initial?.tenantName ?? "");
  const [tenantPhone, setTenantPhone] = useState(initial?.tenantPhone ?? "");
  const [contractNumber, setContractNumber] = useState(initial?.contractNumber ?? "");
  const [electricityAccountNumber, setElectricityAccountNumber] = useState(
    initial?.electricityAccountNumber ?? "",
  );
  const [electricityMeterNumber, setElectricityMeterNumber] = useState(
    initial?.electricityMeterNumber ?? "",
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(
    initial?.endDate ?? addMonths(todayISO(), 12),
  );
  const [annualRent, setAnnualRent] = useState(initial?.annualRent?.toString() ?? "");
  const [paymentCycle, setPaymentCycle] = useState<RentPeriod>(
    initial?.paymentCycle ?? "monthly",
  );
  const [autoRenewal, setAutoRenewal] = useState(initial?.autoRenewal ?? true);
  const [reminderDays, setReminderDays] = useState(String(initial?.reminderDays ?? 30));
  const [collectionPercentage, setCollectionPercentage] = useState(
    initial?.collectionPercentage != null
      ? String(initial.collectionPercentage)
      : defaultBuildingCollectionPct != null
        ? String(defaultBuildingCollectionPct)
        : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const durationMonths =
    startDate && endDate
      ? Math.round(
          (new Date(endDate + "T00:00:00").getTime() -
            new Date(startDate + "T00:00:00").getTime()) /
            (86400000 * 30.44),
        )
      : null;

  const rentNum = Number(annualRent) || 0;
  const monthsPerCycle: Record<RentPeriod, number> = {
    monthly: 1,
    quarterly: 3,
    semi_annually: 6,
    yearly: 12,
  };
  const perPayment = rentNum > 0 ? Math.round((rentNum * monthsPerCycle[paymentCycle]) / 12) : 0;
  const numPayments = durationMonths && durationMonths > 0
    ? Math.ceil(durationMonths / monthsPerCycle[paymentCycle])
    : 0;
  const totalPayments = perPayment * numPayments;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tenantName.trim() || !endDate || rentNum <= 0) return;
        onSubmit({
          tenantName: tenantName.trim(),
          tenantPhone: tenantPhone.trim() || undefined,
          contractNumber: contractNumber.trim() || undefined,
          electricityAccountNumber: electricityAccountNumber.trim() || undefined,
          electricityMeterNumber: electricityMeterNumber.trim() || undefined,
          startDate,
          endDate,
          annualRent: rentNum,
          paymentCycle,
          autoRenewal,
          reminderDays: Number(reminderDays),
          collectionPercentage: collectionPercentage !== "" ? Number(collectionPercentage) : undefined,
          notes: notes.trim() || undefined,
        });
      }}
    >
      {/* Tenant Info */}
      <div className="space-y-1.5">
        <Label>اسم المستأجر *</Label>
        <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} required className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>رقم جوال المستأجر</Label>
          <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} inputMode="tel" dir="ltr" className="rounded-xl text-right" />
        </div>
        <div className="space-y-1.5">
          <Label>رقم العقد</Label>
          <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} className="rounded-xl" />
        </div>
      </div>

      {/* Electricity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>رقم حساب الكهرباء</Label>
          <Input value={electricityAccountNumber} onChange={(e) => setElectricityAccountNumber(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>رقم العداد</Label>
          <Input value={electricityMeterNumber} onChange={(e) => setElectricityMeterNumber(e.target.value)} className="rounded-xl" />
        </div>
      </div>

      {/* Dates */}
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
      {durationMonths !== null && durationMonths > 0 && (
        <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          مدة العقد: {durationMonths} شهر تقريباً
        </p>
      )}

      {/* Rent & Payment Cycle */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>الإيجار السنوي *</Label>
          <Input type="number" inputMode="decimal" min={0} value={annualRent} onChange={(e) => setAnnualRent(e.target.value)} placeholder="0" required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>دورة الدفع</Label>
          <Select value={paymentCycle} onValueChange={(v) => setPaymentCycle(v as RentPeriod)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RENT_PERIOD_LABELS) as RentPeriod[]).map((p) => (
                <SelectItem key={p} value={p}>{RENT_PERIOD_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {rentNum > 0 && numPayments > 0 && (
        <div className="rounded-xl bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          <p>عدد الدفعات: {numPayments} × {perPayment.toLocaleString("ar-SA")} ر.س</p>
          <p className="text-xs opacity-80">الإجمالي: {totalPayments.toLocaleString("ar-SA")} ر.س</p>
        </div>
      )}

      {/* Auto renewal */}
      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <div>
          <Label>تجديد تلقائي</Label>
          <p className="text-xs text-muted-foreground">يُجدد العقد تلقائياً عند انتهائه</p>
        </div>
        <Switch checked={autoRenewal} onCheckedChange={setAutoRenewal} />
      </div>

      {/* Reminder & Collection */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>تذكير قبل الانتهاء</Label>
          <Select value={reminderDays} onValueChange={setReminderDays}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 أيام</SelectItem>
              <SelectItem value="15">15 يوم</SelectItem>
              <SelectItem value="30">30 يوم</SelectItem>
              <SelectItem value="60">60 يوم</SelectItem>
              <SelectItem value="80">80 يوم</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>نسبة تحصيل المكتب %</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={collectionPercentage}
            onChange={(e) => setCollectionPercentage(e.target.value)}
            placeholder="من العقار"
            className="rounded-xl"
          />
        </div>
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
