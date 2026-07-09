import { useState, useRef, useEffect } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EjarImportData, EjarImportPayment, Contract, Payment, RentPeriodNew } from "@/data/types";
import { importEjarContract, createEmptyEjarData } from "@/utils/ejarImport";
import { genId } from "@/data/store";
import { todayISO, validateContractForPayments, generatePaymentsFromContract } from "@/data/helpers";
import { EJAR_PAYMENT_PERIOD_OPTIONS, RENT_PERIOD_LABELS } from "@/data/labels";
import { showSuccess, showError } from "@/utils/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  buildingId: string;
  buildingName: string;
  unitName: string;
  collectionFeePercent?: number;
  onSave: (contract: Contract, payments: Payment[]) => void | Promise<void>;
}

export default function EjarImportDialog({
  open,
  onOpenChange,
  unitId,
  buildingName,
  unitName,
  collectionFeePercent = 0,
  onSave,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"select" | "processing" | "review">("select");
  const [importData, setImportData] = useState<EjarImportData>(createEmptyEjarData());
  const [saving, setSaving] = useState(false);

  // Editable state
  const [contractNumber, setContractNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [electricityMeterNumber, setElectricityMeterNumber] = useState("");
  const [waterMeterNumber, setWaterMeterNumber] = useState("");
  const [paymentCycle, setPaymentCycle] = useState("monthly");
  const [totalContractValue, setTotalContractValue] = useState("");
  const [numberOfPayments, setNumberOfPayments] = useState("");
  const [payments, setPayments] = useState<EjarImportPayment[]>([]);
  const [endDateNeedsReview, setEndDateNeedsReview] = useState(false);

  useEffect(() => {
    if (stage === "review") {
      setContractNumber(importData.contract.contractNumber ?? "");
      setStartDate(importData.contract.startDate ?? "");
      setEndDate(importData.contract.endDate ?? "");
      setElectricityMeterNumber(importData.unit.electricityMeterNumber ?? (importData.unit.electricityMeterNumber === "-" ? "" : importData.unit.electricityMeterNumber ?? ""));
      setWaterMeterNumber(importData.unit.waterMeterNumber ?? (importData.unit.waterMeterNumber === "-" ? "" : importData.unit.waterMeterNumber ?? ""));
      setPaymentCycle(importData.financial.paymentCycle || "monthly");
      setTotalContractValue(importData.financial.totalContractValue ?? "");
      setNumberOfPayments(importData.financial.numberOfPayments ?? "");
      setPayments(importData.payments);
      setEndDateNeedsReview(
        !!importData.contract.endDate &&
        importData.contract.endDate === importData.contract.startDate
      );
    }
  }, [stage, importData]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage("processing");
    try {
      const result = await importEjarContract(file);
      setImportData(result.data);
      const hasData = !!(result.data.contract.contractNumber || result.data.contract.startDate || result.data.payments.length > 0);
      if (!hasData) {
        showError("تعذر استخراج بيانات العقد تلقائيًا، يمكنك إدخال البيانات يدويًا.");
      }
      setStage("review");
    } catch (err) {
      console.error("[PDF Import] failed:", err);
      showError("تعذر استيراد العقد. يرجى المحاولة مرة أخرى أو إدخال البيانات يدويًا.");
      setImportData(createEmptyEjarData());
      setStage("review");
    }
  };

  const handleCancel = () => {
    setStage("select");
    setImportData(createEmptyEjarData());
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!tenantName.trim()) {
      showError("يرجى إدخال اسم المستأجر");
      return;
    }
    if (endDateNeedsReview && (!endDate || endDate === startDate)) {
      showError("تاريخ نهاية العقد لا يمكن أن يساوي تاريخ البداية، يرجى التعديل");
      return;
    }

    setSaving(true);
    try {
      const contract: Contract = {
        id: genId(),
        unitId,
        createdAt: todayISO(),
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim() || undefined,
        contractNumber: contractNumber || undefined,
        startDate: startDate || todayISO(),
        endDate: endDate || todayISO(),
        paymentFrequency: paymentCycle as RentPeriodNew,
        contractDurationType: "custom",
        expiryReminderDays: 60,
        autoRenewal: false,
        totalContractValue: totalContractValue ? Number(totalContractValue) : undefined,
        numberOfPayments: numberOfPayments ? Number(numberOfPayments) : undefined,
        electricityMeterNumber: electricityMeterNumber && electricityMeterNumber !== "-" ? electricityMeterNumber : undefined,
        waterMeterNumber: waterMeterNumber && waterMeterNumber !== "-" ? waterMeterNumber : undefined,
        importedFromEjar: true,
        collectionFeePercent,
      };

      const validationError = validateContractForPayments(contract);
      if (validationError) {
        showError(validationError);
        return;
      }

      let paymentRecords: Payment[] = payments.map((ep, idx) => {
        const amount = Number(ep.amount) || contract.rentAmount || 0;
        const feeAmount = Math.round(amount * collectionFeePercent) / 100;
        return {
        id: genId(),
        unitId,
        contractId: contract.id,
        amount,
        grossAmount: amount,
        collectionFeePercent,
        collectionFeeAmount: feeAmount,
        netAmountAfterCollectionFee: amount - feeAmount,
        maintenanceDeductionAmount: 0,
        netAmountToTransferToOwner: amount - feeAmount,
        ownerTransferred: false,
        paymentDate: ep.dueDateGregorian || contract.startDate,
        nextDueDate: ep.dueDateGregorian || contract.startDate,
        status: "unpaid" as const,
        buildingName,
        unitName,
        tenantName: contract.tenantName || "",
        paymentNumber: ep.paymentNumber || idx + 1,
        dueDateGregorian: ep.dueDateGregorian,
        paymentDeadlineGregorian: ep.paymentDeadlineGregorian,
        createdAt: new Date().toISOString(),
      };
      });

      if (paymentRecords.length === 0) {
        paymentRecords = generatePaymentsFromContract(contract, buildingName, unitName, contract.tenantName || "");
      }

      await withTimeout(
        Promise.resolve().then(() => onSave(contract, paymentRecords)),
        10000,
        "انتهت مهلة حفظ العقد",
      );
      setStage("select");
      setImportData(createEmptyEjarData());
    } catch (err) {
      console.error("[Save Contract] failed:", err);
      showError("تعذر حفظ العقد، يرجى المحاولة مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="max-w-[95vw] rounded-3xl dialog-safe max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right">
            {stage === "review" ? "مراجعة بيانات العقد" : "استيراد عقد إيجار"}
          </DialogTitle>
          <DialogDescription className="text-right">
            {stage === "select" && "اختر ملف عقد الإيجار الإلكتروني (PDF)"}
            {stage === "processing" && "جاري تحليل العقد..."}
            {stage === "review" && "تم استخراج البيانات الرقمية فقط من العقد. يرجى إدخال اسم المستأجر ومراجعة البيانات قبل الحفظ."}
          </DialogDescription>
        </DialogHeader>

        {stage === "select" && (
          <div className="space-y-4 pt-2">
            <div
              className="flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border p-8 hover:border-primary/50"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">اختيار ملف PDF</p>
              <p className="text-xs text-muted-foreground">عقد إيجار إلكتروني بصيغة PDF</p>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.PDF" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" className="w-full rounded-xl" onClick={handleCancel}>إلغاء</Button>
          </div>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">تحليل العقد واستخراج البيانات...</p>
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-800">
                تم استخراج البيانات الرقمية فقط من العقد. يرجى إدخال اسم المستأجر ومراجعة البيانات قبل الحفظ.
              </p>
            </div>

            {/* Extracted fields display */}
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <p className="text-xs font-bold text-muted-foreground">البيانات المستخرجة من العقد</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {contractNumber && <><span className="text-muted-foreground">رقم العقد:</span><span dir="ltr">{contractNumber}</span></>}
                {startDate && <><span className="text-muted-foreground">تاريخ البداية:</span><span>{startDate}</span></>}
                {endDate && <><span className="text-muted-foreground">تاريخ النهاية:</span><span>{endDate}{endDateNeedsReview ? " (يحتاج مراجعة)" : ""}</span></>}
                {electricityMeterNumber && <><span className="text-muted-foreground">عداد الكهرباء:</span><span>{electricityMeterNumber}</span></>}
                {waterMeterNumber && <><span className="text-muted-foreground">عداد المياه:</span><span>{waterMeterNumber}</span></>}
                {totalContractValue && <><span className="text-muted-foreground">قيمة العقد:</span><span>{totalContractValue} ر.س</span></>}
                {numberOfPayments && <><span className="text-muted-foreground">عدد الدفعات:</span><span>{numberOfPayments}</span></>}
              </div>
            </div>

            {/* Payment schedule */}
            {payments.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                <p className="text-xs font-bold text-muted-foreground">جدول الدفعات</p>
                {payments.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-border/50 pb-1 text-xs">
                    <span className="text-muted-foreground">الدفعة #{p.paymentNumber}</span>
                    <span>{p.dueDateGregorian} {p.amount ? `- ${p.amount} ر.س` : ""}</span>
                  </div>
                ))}
              </div>
            )}

            {payments.length === 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  تعذر استخراج جدول الدفعات، سيتم توليد الدفعات حسب بيانات العقد.
                </p>
              </div>
            )}

            {/* Editable fields */}
            <div className="space-y-3">
              <p className="text-sm font-bold">الرجاء إكمال البيانات المطلوبة</p>

              <div className="space-y-1.5">
                <Label className="text-xs">اسم المستأجر *</Label>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="أدخل اسم المستأجر" className="rounded-xl text-xs h-9" />
                <Label className="text-xs">جوال المستأجر</Label>
                <Input type="tel" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="05xxxxxxxx" className="rounded-xl text-xs h-9" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">رقم العقد</Label>
                  <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} className="rounded-xl text-xs h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">دورة الدفع</Label>
                  <Select value={paymentCycle} onValueChange={setPaymentCycle}>
                    <SelectTrigger className="rounded-xl text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EJAR_PAYMENT_PERIOD_OPTIONS.map((period) => (
                        <SelectItem key={period} value={period}>{RENT_PERIOD_LABELS[period]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">تاريخ البداية *</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl text-xs h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">تاريخ النهاية *</Label>
                  <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setEndDateNeedsReview(false); }} className="rounded-xl text-xs h-9" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">عداد الكهرباء</Label>
                  <Input value={electricityMeterNumber} onChange={(e) => setElectricityMeterNumber(e.target.value)} className="rounded-xl text-xs h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">عداد المياه</Label>
                  <Input value={waterMeterNumber} onChange={(e) => setWaterMeterNumber(e.target.value)} className="rounded-xl text-xs h-9" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">إجمالي قيمة العقد</Label>
                  <Input type="number" value={totalContractValue} onChange={(e) => setTotalContractValue(e.target.value)} className="rounded-xl text-xs h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">عدد الدفعات</Label>
                  <Input type="number" value={numberOfPayments} onChange={(e) => setNumberOfPayments(e.target.value)} className="rounded-xl text-xs h-9" />
                </div>
              </div>

              {payments.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-1">جدول الدفعات</p>
                  {payments.map((payment, index) => (
                    <div key={payment.paymentNumber || index} className="space-y-2 rounded-xl border border-border p-2 mb-2">
                      <p className="text-xs font-bold">الدفعة #{payment.paymentNumber || index + 1}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">موعد السداد</Label>
                          <Input type="date" value={payment.dueDateGregorian ?? ""}
                            onChange={(value) => setPayments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dueDateGregorian: value.target.value } : item))}
                            className="rounded-xl text-xs h-9" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">المهلة</Label>
                          <Input type="date" value={payment.paymentDeadlineGregorian ?? ""}
                            onChange={(value) => setPayments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, paymentDeadlineGregorian: value.target.value } : item))}
                            className="rounded-xl text-xs h-9" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">المبلغ</Label>
                        <Input type="number" value={payment.amount ?? ""}
                          onChange={(value) => setPayments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: value.target.value } : item))}
                          className="rounded-xl text-xs h-9" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {importData.warnings?.map((warning, i) => (
                <div key={i} className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">{warning}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setStage("select"); setImportData(createEmptyEjarData()); }}>
                إعادة التحليل
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : null}
                حفظ العقد
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { window.clearTimeout(timeoutId); resolve(value); },
      (error) => { window.clearTimeout(timeoutId); reject(error); },
    );
  });
}
