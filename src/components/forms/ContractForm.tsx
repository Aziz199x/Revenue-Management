import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Contract, RentPeriod, RentPeriodNew, ContractDurationType } from "@/data/types";
import { todayISO, calculateEndDate, getContractDurationMonths, isValidDate, calculateInstallmentAmount, generatePaymentDueDates, formatMoney } from "@/data/helpers";
import { RENT_PERIOD_LABELS, CONTRACT_DURATION_OPTIONS, REMINDER_OPTIONS, AUTO_RENEWAL_LABEL } from "@/data/labels";
import { showError } from "@/utils/toast";

export interface ContractFormValues {
  tenantName: string;
  tenantPhone?: string;
  tenantIdNumber?: string;
  tenantEmail?: string;
  rentAmount: number;
  paymentFrequency: RentPeriod | RentPeriodNew;
  startDate: string;
  endDate: string;
  contractDurationType: ContractDurationType;
  customDurationMonths?: number;
  expiryReminderDays: number;
  autoRenewal: boolean;
  tenantRenewalPreference: "unknown" | "renewing" | "not_renewing";
  notes?: string;
  contractNumber?: string;
  collectionFeePercent?: number;
}

interface Props {
  initial?: Contract;
  defaultTenantName?: string;
  defaultRentAmount?: number;
  defaultPaymentFrequency?: RentPeriod;
  defaultExpiryReminderDays?: number;
  onSubmit: (values: ContractFormValues) => void | Promise<void>;
}

export default function ContractForm({
  initial,
  defaultTenantName,
  defaultRentAmount,
  defaultPaymentFrequency,
  defaultExpiryReminderDays = 80,
  onSubmit,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [tenantName, setTenantName] = useState(initial?.tenantName ?? defaultTenantName ?? "");
  const [tenantPhone, setTenantPhone] = useState(initial?.tenantPhone ?? "");
  const [tenantIdNumber, setTenantIdNumber] = useState(initial?.tenantIdNumber ?? "");
  const [tenantEmail, setTenantEmail] = useState(initial?.tenantEmail ?? "");
  const [contractNumber, setContractNumber] = useState(initial?.contractNumber ?? "");
  const [rentAmount, setRentAmount] = useState(
    initial?.rentAmount?.toString() ?? (defaultRentAmount ? String(defaultRentAmount) : ""),
  );
  const initialFrequency = initial?.paymentFrequency === "semi_annual"
    ? "semi_annually"
    : initial?.paymentFrequency === "annual"
      ? "yearly"
      : initial?.paymentFrequency;
  const [paymentFrequency, setPaymentFrequency] = useState<RentPeriod | RentPeriodNew>(
    initialFrequency ?? defaultPaymentFrequency ?? "monthly",
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [durationType, setDurationType] = useState<ContractDurationType>(
    initial?.contractDurationType ?? "1_year",
  );
  const [customMonths, setCustomMonths] = useState(
    initial?.customDurationMonths?.toString() ?? "3",
  );
  const [manualEndDate, setManualEndDate] = useState(
    initial?.endDate ?? "",
  );
  const [expiryReminderDays, setExpiryReminderDays] = useState(
    String(initial?.expiryReminderDays ?? defaultExpiryReminderDays),
  );
  const [customReminderDays, setCustomReminderDays] = useState("");
  const [autoRenewal, setAutoRenewal] = useState(initial?.autoRenewal ?? true);
  const [tenantRenewalPreference, setTenantRenewalPreference] = useState(initial?.tenantRenewalPreference ?? "unknown");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const endDate = useMemo(() => {
    if (!startDate) return "";
    if (durationType === "manual_end") return manualEndDate;
    return calculateEndDate(startDate, durationType, Number(customMonths) || 1);
  }, [startDate, durationType, customMonths, manualEndDate]);

  const durationMonths = useMemo(() => {
    if (durationType === "manual_end") return 0;
    return getContractDurationMonths(durationType, Number(customMonths) || 1);
  }, [durationType, customMonths]);

  const effectiveReminderDays = useMemo(() => {
    if (expiryReminderDays === "custom") return Number(customReminderDays) || 0;
    return Number(expiryReminderDays);
  }, [expiryReminderDays, customReminderDays]);

  const validationError = useMemo(() => {
    if (!tenantName.trim()) return "يرجى إدخال اسم المستأجر";
    if (!Number.isFinite(Number(rentAmount)) || Number(rentAmount) <= 0) return "يرجى إدخال مبلغ إيجار صحيح";
    if (!isValidDate(startDate)) return "يرجى اختيار تاريخ بداية صحيح";
    if (!isValidDate(endDate)) return "يرجى اختيار تاريخ نهاية صحيح";
    if (endDate <= startDate) return "تاريخ النهاية يجب أن يكون بعد تاريخ البداية";
    if (!paymentFrequency) return "يرجى اختيار دورة الدفع";
    if (expiryReminderDays === "custom" && (!customReminderDays || Number(customReminderDays) <= 0)) {
      return "يرجى إدخال عدد أيام التذكير الصحيح";
    }
    return null;
  }, [tenantName, rentAmount, startDate, endDate, paymentFrequency, expiryReminderDays, customReminderDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Contract] Manual save started");
    if (validationError) {
      showError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const formData = {
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim() || undefined,
        tenantIdNumber: tenantIdNumber.trim() || undefined,
        tenantEmail: tenantEmail.trim() || undefined,
        contractNumber: contractNumber.trim() || undefined,
        rentAmount: Number(rentAmount),
        paymentFrequency,
        startDate,
        endDate,
        contractDurationType: durationType,
        customDurationMonths: durationType === "custom" ? Number(customMonths) : undefined,
        expiryReminderDays: effectiveReminderDays,
        autoRenewal,
        tenantRenewalPreference,
        notes: notes.trim() || undefined,
      };
      console.log("[Contract] Form data:", formData);
      await onSubmit(formData);
    } catch (err) {
      console.error("[Contract] Save failed:", err);
      showError("حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label>اسم المستأجر *</Label>
        <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} required className="rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label>رغبة المستأجر في التجديد</Label>
        <Select value={tenantRenewalPreference} onValueChange={(value) => setTenantRenewalPreference(value as "unknown" | "renewing" | "not_renewing")}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="unknown">غير محدد</SelectItem><SelectItem value="renewing">يرغب بالتجديد</SelectItem><SelectItem value="not_renewing">لا يرغب بالتجديد</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>جوال المستأجر</Label>
        <Input type="tel" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="05xxxxxxxx" className="rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label>رقم العقد</Label>
        <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="رقم عقد الإيجار" className="rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label>مبلغ الإيجار السنوي *</Label>
        <Input type="number" inputMode="decimal" min={0} value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required className="rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label>دورة الدفع *</Label>
        <Select value={paymentFrequency} onValueChange={(v) => setPaymentFrequency(v as RentPeriod | RentPeriodNew)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["monthly", "quarterly", "semi_annually", "yearly"] as const).map((k) => (
              <SelectItem key={k} value={k}>{RENT_PERIOD_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Payment Preview */}
      {(() => {
        const annualVal = Number(rentAmount);
        if (!annualVal || annualVal <= 0) return null;
        const freq = paymentFrequency;
        const installment = calculateInstallmentAmount(annualVal, freq);
        if (!startDate || !endDate || endDate <= startDate) return null;
        const dueDates = generatePaymentDueDates(startDate, endDate, freq);
        const numPayments = dueDates.length;
        const totalValue = Number((installment * numPayments).toFixed(2));
        console.log("[Payment Preview]", { annualRent: annualVal, paymentCycle: freq, startDate, endDate, dueDates, paymentCount: numPayments, installmentAmount: installment, totalContractValue: totalValue });
        return (
          <div className="rounded-2xl bg-secondary p-3.5 text-sm text-secondary-foreground space-y-1">
            <p>سيتم إنشاء <strong>{numPayments}</strong> دفعة</p>
            <p>مبلغ كل دفعة: <strong>{formatMoney(installment)}</strong></p>
            <p>إجمالي العقد: <strong>{formatMoney(totalValue)}</strong></p>
          </div>
        );
      })()}

      <div className="space-y-1.5">
        <Label>تاريخ بداية العقد *</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label>مدة العقد</Label>
        <Select value={durationType} onValueChange={(v) => setDurationType(v as ContractDurationType)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTRACT_DURATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {durationType === "custom" && (
        <div className="space-y-1.5">
          <Label>عدد الأشهر</Label>
          <Input type="number" min={1} value={customMonths} onChange={(e) => setCustomMonths(e.target.value)} className="rounded-xl" />
        </div>
      )}

      {durationType === "manual_end" && (
        <div className="space-y-1.5">
          <Label>تاريخ نهاية العقد *</Label>
          <Input type="date" value={manualEndDate} onChange={(e) => setManualEndDate(e.target.value)} required className="rounded-xl" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>تاريخ نهاية العقد</Label>
        <Input
          type="date"
          value={endDate}
          readOnly={durationType !== "manual_end"}
          className={`rounded-xl ${durationType !== "manual_end" ? "bg-muted text-muted-foreground" : ""}`}
        />
      </div>

      {endDate && startDate && endDate > startDate && (
        <div className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground space-y-1">
          {durationMonths > 0 && (
            <p>مدة العقد: {durationMonths} شهر{durationMonths >= 12 ? ` (${Math.floor(durationMonths / 12)} سنة${durationMonths % 12 > 0 ? ` و ${durationMonths % 12} شهر` : ""})` : ""}</p>
          )}
          <p>ينتهي العقد في: {new Date(endDate + "T00:00:00").toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "2-digit" })}</p>
          {effectiveReminderDays > 0 && (
            <p>التذكير قبل الانتهاء: {effectiveReminderDays} يوم</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>التذكير قبل انتهاء العقد</Label>
        <Select value={expiryReminderDays} onValueChange={(v) => { setExpiryReminderDays(v); if (v !== "custom") setCustomReminderDays(""); }}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REMINDER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {expiryReminderDays === "custom" && (
          <Input
            type="number"
            min={1}
            placeholder="عدد الأيام قبل انتهاء العقد"
            value={customReminderDays}
            onChange={(e) => setCustomReminderDays(e.target.value)}
            className="mt-2 rounded-xl"
          />
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <div>
          <p className="text-sm font-bold">{AUTO_RENEWAL_LABEL}</p>
          <p className="text-xs text-muted-foreground">
            {autoRenewal ? "سيتم تجديد العقد تلقائياً" : "لا يوجد تجديد تلقائي"}
          </p>
        </div>
        <Switch checked={autoRenewal} onCheckedChange={setAutoRenewal} />
      </div>

      <div className="space-y-1.5">
        <Label>ملاحظات العقد</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>

      {validationError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{validationError}</p>
      )}

      <Button type="submit" className="w-full rounded-xl" disabled={submitting || !!validationError}>
        {submitting ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : null}
        {initial ? "حفظ التعديلات" : "حفظ العقد"}
      </Button>
    </form>
  );
}