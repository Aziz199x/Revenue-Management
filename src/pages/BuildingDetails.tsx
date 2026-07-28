import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Plus,
  DoorOpen,
  Pencil,
  Trash2,
  Wrench,
  CalendarClock,
  Wallet,
  MessageCircle,
  CheckCircle2,
  BarChart3,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormSheet from "@/components/shared/FormSheet";
import StatusBadge from "@/components/shared/StatusBadge";
import BuildingForm from "@/components/forms/BuildingForm";
import UnitForm from "@/components/forms/UnitForm";
import WhatsappPreview from "@/components/shared/WhatsappPreview";
import { useStore, genId } from "@/data/store";
import { buildingStats, formatMoney, formatDate, todayISO, normalizePaymentFinancials, parseLocalDate, effectiveStatus, getPaymentReceiveMethod, isCollectionFeeCollected, getPaymentReportMonth, getPaymentReportYearMonth, calculateInstallmentAmount, generatePaymentDueDates, getContractEndDate, getRemainingPaymentAmount, getPaymentAmount, formatSarAmount, daysUntil, getCollectionFeeRemainingAmount, getCollectionFeeSettledAmount, getCollectedRentAmount, isPaymentOverdue } from "@/data/helpers";
import { UNIT_STATUS_LABELS, RENT_PERIOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_RECEIVE_METHOD_LABELS, COLLECTION_FEE_STATUS_LABELS, UNIT_MONTH_STATUS_LABELS } from "@/data/labels";
import { Contract, Payment, PaymentReceiveMethod, PaymentStatus, Unit } from "@/data/types";
import { buildPaymentReminderMessage } from "@/utils/whatsapp";
import { showSuccess, showError } from "@/utils/toast";
import { buildMonthlyReportBundle } from "@/reporting/reportBundle";
import { exportBuildingExcel } from "@/utils/buildingExcelExport";
import ExecutiveDashboard from "@/components/reports/ExecutiveDashboard";
import MonthlyExceptionsCard from "@/components/reports/MonthlyExceptionsCard";
import LateCollectionsList from "@/components/reports/LateCollectionsList";
import { UnitMonthStatus, UnitMonthRow, LatePaymentRow } from "@/reporting/types";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function paymentDueDate(payment: { dueDateGregorian?: string; nextDueDate?: string; paymentDate: string }): string {
  return payment.dueDateGregorian || payment.nextDueDate || payment.paymentDate;
}

type MonthlyReportStatus = PaymentStatus | "vacant";

type MonthlyUnitReportRow = {
  unit: Unit;
  contract?: Contract;
  payment?: Payment;
  tenantName?: string;
  tenantPhone?: string;
  dueDate?: string;
  status: MonthlyReportStatus;
  expectedAmount: number;
  collectedAmount: number;
  remainingAmount: number;
  receiveMethod?: PaymentReceiveMethod;
  collectionFeeAmount: number;
  collectionFeeSettledAmount: number;
  collectionFeeRemainingAmount: number;
  collectionFeeStatus?: Payment["collectionFeeStatus"];
};

function reportMonthStart(yearMonth: string): string {
  return `${yearMonth}-01`;
}

function reportMonthEnd(yearMonth: string): string {
  const date = parseLocalDate(`${yearMonth}-01`) || new Date();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

function isContractInReportMonth(contract: Contract, yearMonth: string): boolean {
  if (contract.deletedAt) return false;
  if (["cancelled", "terminated", "eviction_completed"].includes(contract.status || "")) return false;
  const start = contract.startDate;
  const end = getContractEndDate(contract) || contract.endDate;
  if (!start || !end) return false;
  return start <= reportMonthEnd(yearMonth) && end >= reportMonthStart(yearMonth);
}

function expectedContractDueDate(contract: Contract, yearMonth: string): string | undefined {
  const endDate = getContractEndDate(contract) || contract.endDate;
  const dueDates = generatePaymentDueDates(contract.startDate, endDate, contract.paymentFrequency || "monthly");
  return dueDates.find((dueDate) => getPaymentReportYearMonth(dueDate) === yearMonth);
}

function expectedContractInstallment(contract: Contract, unit: Unit): number {
  const cycle = contract.paymentFrequency || unit.rentPeriod || "monthly";
  const annualRent = contract.annualRent ?? contract.totalContractValue ?? contract.rentAmount ?? unit.rentAmount;
  return calculateInstallmentAmount(Number(annualRent) || 0, cycle);
}

export default function BuildingDetails() {
  const { buildingId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, update } = useStore();
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [statusFilter, setStatusFilter] = useState<UnitMonthStatus | "all">("all");
  const [receiveMethodFilter, setReceiveMethodFilter] = useState<PaymentReceiveMethod | "all">("all");
  const [whatsappPreview, setWhatsappPreview] = useState<{ phone: string; message: string } | null>(null);
  const activeTab = searchParams.get("tab") || "units";
  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "units") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: false });
  };

  const building = data.buildings.find((b) => b.id === buildingId);
  const reportBundle = useMemo(
    () => (building ? buildMonthlyReportBundle(data, building.id, selectedMonth) : null),
    [data, building, selectedMonth],
  );
  if (!building) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold">العقار غير موجود</p>
        <Button className="mt-4 rounded-xl" onClick={() => navigate("/buildings")}>
          العودة للعقارات
        </Button>
      </div>
    );
  }
  const bundle = reportBundle!;

  const stats = buildingStats(data, building.id);
  const units = data.units.filter((u) => u.buildingId === building.id);
  const unitIds = new Set(units.map((u) => u.id));
  const filteredUnitRows: UnitMonthRow[] = bundle.report.unitRows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (receiveMethodFilter !== "all" && row.collectionMethod !== receiveMethodFilter) return false;
    return true;
  });
  const selectedMonthDate = parseLocalDate(`${selectedMonth}-01`) || new Date();
  const prevMonth = () => {
    const date = new Date(selectedMonthDate);
    date.setMonth(date.getMonth() - 1);
    setSelectedMonth(monthKey(date));
  };
  const nextMonth = () => {
    const date = new Date(selectedMonthDate);
    date.setMonth(date.getMonth() + 1);
    setSelectedMonth(monthKey(date));
  };
  const paidCount = bundle.report.unitRows.filter((row) => row.status === "occupied_paid" || row.status === "occupied_paid_late" || row.status === "occupied_ejar").length;
  const unpaidCount = bundle.report.unitRows.filter((row) => row.status === "occupied_unpaid").length;
  const partialCount = bundle.report.unitRows.filter((row) => row.status === "occupied_partial").length;
  const ejarCount = bundle.report.unitRows.filter((row) => row.collectionMethod === "ejar_platform").length;

  const openPaymentWhatsapp = (row: LatePaymentRow) => {
    if (!row.outstandingAmount) {
      showError("مبلغ الدفعة غير صحيح");
      return;
    }
    if (!row.tenantPhone) {
      showError("رقم جوال المستأجر غير موجود");
      return;
    }
    const message = buildPaymentReminderMessage({
      tenantName: row.tenantName,
      buildingName: building.name,
      unitName: row.unitName,
      amount: formatSarAmount(row.outstandingAmount),
      dueDate: formatDate(row.dueDate),
      isOverdue: true,
    });
    setWhatsappPreview({ phone: row.tenantPhone, message });
  };

  const deleteBuilding = () => {
    update((prev) => {
      const unitIds = new Set(
        prev.units.filter((u) => u.buildingId === building.id).map((u) => u.id),
      );
      return {
        ...prev,
        buildings: prev.buildings.filter((b) => b.id !== building.id),
        units: prev.units.filter((u) => u.buildingId !== building.id),
        tenants: prev.tenants.filter((t) => !unitIds.has(t.unitId)),
        payments: prev.payments.filter((p) => !unitIds.has(p.unitId)),
        contracts: prev.contracts.filter((c) => !unitIds.has(c.unitId)),
        bills: prev.bills.filter((b) => !unitIds.has(b.unitId)),
        repairs: prev.repairs.filter((r) => r.buildingId !== building.id && (!r.unitId || !unitIds.has(r.unitId))),
      };
    });
    showSuccess("تم حذف العقار");
    navigate("/buildings");
  };

  return (
    <div>
      <PageHeader
        title={building.name}
        subtitle={building.address}
        back
        action={
          <div className="flex gap-1">
            <Button
              variant={activeTab === "performance" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-full"
              title="تقرير الأداء"
              aria-label="فتح تقرير الأداء"
              onClick={() => setActiveTab("performance")}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              title="تصدير إكسل"
              aria-label="تصدير تقرير إكسل للعقار"
              onClick={async () => {
                try {
                  await exportBuildingExcel(data, building);
                  showSuccess("تم إنشاء ملف الإكسل");
                } catch (err) {
                  console.error("Excel export failed:", err);
                  showError("تعذر تصدير ملف الإكسل");
                }
              }}
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              title="تقرير المالك الشهري"
              aria-label="فتح تقرير المالك الشهري"
              onClick={() => navigate(`/reports/owner/${building.id}`)}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[90vw] rounded-3xl">
                <AlertDialogHeader className="text-right">
                  <AlertDialogTitle>حذف العقار؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم حذف العقار وجميع الوحدات والبيانات المرتبطة به نهائياً.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row gap-2">
                  <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                  <AlertDialogAction className="rounded-xl bg-destructive" onClick={deleteBuilding}>
                    حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted p-1">
            <TabsTrigger value="units" className="rounded-xl py-2 text-xs font-bold">
              الوحدات
            </TabsTrigger>
            <TabsTrigger value="financial" className="rounded-xl py-2 text-xs font-bold">
              المالية
            </TabsTrigger>
            <TabsTrigger value="overdue" className="rounded-xl py-2 text-xs font-bold">
              <span>المتأخرة</span>
              {bundle.report.latePayments.length > 0 && (
                <span className="mr-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
                  {bundle.report.latePayments.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="mt-4 space-y-4">
        <details className="group rounded-3xl border border-border bg-card p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold">
            <span>الملخص التراكمي للعقار</span>
            <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold text-muted-foreground">جميع الشهور · اضغط للعرض</span>
          </summary>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-3xl bg-primary p-4 text-primary-foreground">
            <Wallet className="mb-1 h-5 w-5 opacity-80" />
            <p className="text-xs opacity-80">صافي دخل المالك</p>
            <p className="text-lg font-bold">{formatMoney(stats.totalIncome)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <Wallet className="mb-1 h-5 w-5 text-emerald-600" />
            <p className="text-xs text-muted-foreground">إجمالي الدخل</p>
            <p className="text-lg font-bold">{formatMoney(stats.totalGrossIncome)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <Wallet className="mb-1 h-5 w-5 text-amber-600" />
            <p className="text-xs text-muted-foreground">رسوم التحصيل المحصلة</p>
            <p className="text-lg font-bold">{formatMoney(stats.collectedCollectionFees)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <Wallet className="mb-1 h-5 w-5 text-orange-600" />
            <p className="text-xs text-muted-foreground">رسوم التحصيل غير المحصلة</p>
            <p className="text-lg font-bold">{formatMoney(stats.uncollectedCollectionFees)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <Wrench className="mb-1 h-5 w-5 text-amber-600" />
            <p className="text-xs text-muted-foreground">تكاليف الصيانة</p>
            <p className="text-lg font-bold">{formatMoney(stats.maintenanceCost)}</p>
          </div>
          </div>
          <div className="mt-3 space-y-2 rounded-2xl bg-muted/60 p-3 text-xs">
          <p className="font-medium">
            {(building.collectionFeePercent ?? 0) > 0
              ? `نسبة رسوم التحصيل: ${building.collectionFeePercent}%`
              : "لا توجد رسوم تحصيل"}
          </p>
          <p className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-primary" />
            أقرب استحقاق إيجار:
            <span className="font-semibold">{formatDate(stats.upcomingDue)}</span>
          </p>
          <p className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-amber-600" />
            أقرب انتهاء عقد:
            <span className="font-semibold">{formatDate(stats.nearestExpiry)}</span>
          </p>
          </div>
        </details>

        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">التقرير المالي الشهري للعقار</h2>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={prevMonth}>السابق</Button>
              <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={nextMonth}>التالي</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value || monthKey(new Date()))}
              className="col-span-2 h-10 rounded-xl border border-input bg-background px-3 text-xs md:col-span-1"
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as UnitMonthStatus | "all")}>
              <SelectTrigger className="rounded-xl bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {(["occupied_paid", "occupied_paid_late", "occupied_partial", "occupied_unpaid", "occupied_ejar", "vacant"] as UnitMonthStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>{UNIT_MONTH_STATUS_LABELS[status]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={receiveMethodFilter} onValueChange={(value) => setReceiveMethodFilter(value as PaymentReceiveMethod | "all")}>
              <SelectTrigger className="rounded-xl bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل طرق الاستلام</SelectItem>
                {(["office_collection", "bank_transfer", "cash", "ejar_platform", "other"] as PaymentReceiveMethod[]).map((method) => (
                  <SelectItem key={method} value={method}>{PAYMENT_RECEIVE_METHOD_LABELS[method]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={data.settings.reportMonthCutoffDay === null ? "none" : String(data.settings.reportMonthCutoffDay)}
              onValueChange={(value) => update((prev) => ({
                ...prev,
                settings: { ...prev.settings, reportMonthCutoffDay: value === "none" ? null : Number(value) },
              }))}
            >
              <SelectTrigger className="rounded-xl bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون ترحيل تلقائي</SelectItem>
                {[25, 26, 27, 28, 29, 30, 31].map((day) => (
                  <SelectItem key={day} value={String(day)}>الترحيل من يوم {day}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data.settings.reportMonthCutoffDay === null
              ? "قاعدة التقرير: كل دفعة تُحتسب في شهر موعدها، ويمكن تغيير شهر دفعة منفردة عند تعديلها."
              : `قاعدة التقرير: موعد السداد من يوم ${data.settings.reportMonthCutoffDay} حتى نهاية الشهر يُحتسب ضمن الشهر التالي. ويمكن تجاوز القاعدة لكل دفعة عند تعديلها.`}
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">مستحقات الشهر</p><p className="font-bold">{formatMoney(bundle.report.expectedRent)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">المحصل من مستحقات الشهر</p><p className="font-bold text-emerald-700">{formatMoney(bundle.report.collectedForMonth)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">غير محصل</p><p className="font-bold text-red-700">{formatMoney(bundle.report.outstanding)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">نسبة التحصيل</p><p className="font-bold">{bundle.report.collectionRate}%</p></div>
          </div>
          <details className="rounded-2xl border border-border p-3">
            <summary className="cursor-pointer text-xs font-bold">عرض التفاصيل المالية الإضافية</summary>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
              <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">متأخرات حُصلت هذا الشهر</p><p className="font-bold text-emerald-700">{formatMoney(bundle.report.lateCollectionsAmount)}</p></div>
              <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">رسوم المكتب المستحقة</p><p className="font-bold">{formatMoney(bundle.report.officeFeesDue)}</p></div>
              <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">رسوم المكتب المحصلة</p><p className="font-bold text-emerald-700">{formatMoney(bundle.report.officeFeesCollected)}</p></div>
              <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">رسوم المكتب غير المحصلة</p><p className="font-bold text-orange-700">{formatMoney(bundle.report.officeFeesOutstanding)}</p></div>
              <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">مدفوع عبر إيجار</p><p className="font-bold">{formatMoney(bundle.report.collectedThroughEjar)}</p></div>
              <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">تكاليف الصيانة</p><p className="font-bold text-amber-700">{formatMoney(bundle.report.maintenanceCost)}</p></div>
              <div className="col-span-2 rounded-2xl bg-primary/10 p-3 md:col-span-1"><p className="text-muted-foreground">صافي دخل المالك</p><p className="font-bold text-primary">{formatMoney(bundle.report.ownerNet)}</p></div>
            </div>
          </details>
          <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
            <div className="rounded-2xl border border-border p-2"><p className="font-bold text-emerald-700">{paidCount}</p><p className="text-muted-foreground">مدفوعة</p></div>
            <div className="rounded-2xl border border-border p-2"><p className="font-bold text-amber-700">{partialCount}</p><p className="text-muted-foreground">جزئية</p></div>
            <div className="rounded-2xl border border-border p-2"><p className="font-bold text-red-700">{unpaidCount}</p><p className="text-muted-foreground">غير مدفوعة</p></div>
            <div className="rounded-2xl border border-border p-2"><p className="font-bold text-primary">{ejarCount}</p><p className="text-muted-foreground">إيجار</p></div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold">دفعات الشهر</h3>
            {filteredUnitRows.length === 0 ? (
              <p className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">لا توجد وحدات مطابقة لهذا الشهر داخل هذا العقار.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filteredUnitRows.map((row) => (
                <Link key={row.unitId} to={`/units/${row.unitId}`} className="block rounded-2xl border border-border p-3 text-xs transition-transform active:scale-[0.98]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{row.unitName}{row.tenantName ? ` - ${row.tenantName}` : ""}</p>
                      <p className="mt-1 text-muted-foreground">{row.message}</p>
                      {row.collectionMethod && (
                        <p className="mt-1 text-muted-foreground">طريقة الاستلام: {PAYMENT_RECEIVE_METHOD_LABELS[row.collectionMethod]}</p>
                      )}
                      {row.officeFeeAmount > 0 && (
                        <p className={row.officeFeeOutstanding > 0 ? "mt-1 text-orange-700" : "mt-1 text-muted-foreground"}>
                          رسوم المكتب: {formatMoney(row.officeFeeAmount)}{row.officeFeeOutstanding > 0 ? ` - متبقي ${formatMoney(row.officeFeeOutstanding)}` : " - محصلة"}
                        </p>
                      )}
                      {row.duplicatePaymentIds.length > 0 && (
                        <p className="mt-1 font-semibold text-red-700">⚠ يوجد {row.duplicatePaymentIds.length} سجل دفع مكرر لهذه الوحدة هذا الشهر — راجع الدفعات</p>
                      )}
                    </div>
                    <div className="shrink-0 text-left">
                      <StatusBadge status={row.status} label={UNIT_MONTH_STATUS_LABELS[row.status] || row.status} />
                      {row.rentAmount > 0 && <p className="mt-2 font-bold text-primary">{formatMoney(row.rentAmount)}</p>}
                    </div>
                  </div>
                </Link>
              ))}
              </div>
            )}
          </div>
          {bundle.report.lateCollections.length > 0 && (
            <details className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
              <summary className="cursor-pointer text-xs font-bold text-amber-800">
                التحصيلات المتأخرة لهذا الشهر ({bundle.report.lateCollections.length})
              </summary>
              <div className="mt-3">
                <LateCollectionsList rows={bundle.report.lateCollections} yearMonth={selectedMonth} />
              </div>
            </details>
          )}
        </div>

          </TabsContent>

          <TabsContent value="performance" className="mt-4 space-y-4">
            <div className="rounded-3xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold">تقرير أداء العقار</h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">تحليل المؤشرات والمخاطر والتنبيهات للشهر المحدد</p>
                </div>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value || monthKey(new Date()))}
                  className="h-9 w-32 rounded-xl border border-input bg-background px-2 text-xs"
                />
              </div>
            </div>
            <ExecutiveDashboard bundle={bundle} />
            <MonthlyExceptionsCard exceptions={bundle.exceptions} />
          </TabsContent>

          <TabsContent value="overdue" className="mt-4 space-y-3">
            {bundle.report.latePayments.length === 0 ? (
              <EmptyState icon={CalendarClock} title="لا توجد دفعات متأخرة" description="جميع دفعات هذا العقار محصلة أو لم يحن موعدها بعد" />
            ) : (
              bundle.report.latePayments.map((row) => (
                <div key={row.id} className="rounded-3xl border border-border bg-card p-4 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{row.tenantName || "مستأجر غير محدد"}</p>
                      <p className="mt-1 text-muted-foreground">{row.unitName}</p>
                      <p className="mt-1 text-muted-foreground">موعد السداد: {formatDate(row.dueDate)} - متأخرة {row.delayDays} يوم</p>
                      {row.isPartial && (
                        <p className="mt-1 text-amber-700">دفعة جزئية — تبقى {formatMoney(row.outstandingAmount)}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-left">
                      <StatusBadge status="overdue" label={PAYMENT_STATUS_LABELS.overdue} />
                      <p className="mt-2 font-bold text-red-700">{formatMoney(row.outstandingAmount)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-muted p-2"><p className="text-muted-foreground">المستحق</p><p className="font-bold">{formatMoney(row.rentAmount)}</p></div>
                    <div className="rounded-2xl bg-muted p-2"><p className="text-muted-foreground">المدفوع</p><p className="font-bold text-emerald-700">{formatMoney(Math.max(0, row.rentAmount - row.outstandingAmount))}</p></div>
                    <div className="rounded-2xl bg-muted p-2"><p className="text-muted-foreground">المتبقي</p><p className="font-bold text-red-700">{formatMoney(row.outstandingAmount)}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-full text-xs" onClick={() => openPaymentWhatsapp(row)}>
                      <MessageCircle className="ml-1 h-4 w-4" /> واتساب
                    </Button>
                    <Button size="sm" className="flex-1 rounded-full text-xs" onClick={() => navigate(`/units/${row.unitId}`)}>
                      <CheckCircle2 className="ml-1 h-4 w-4" /> تسجيل استلام
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="units" className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-lg font-bold">{stats.unitsCount}</p>
            <p className="text-[11px] text-muted-foreground">الوحدات</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-lg font-bold text-emerald-700">{stats.occupied}</p>
            <p className="text-[11px] text-muted-foreground">مؤجرة</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-lg font-bold text-slate-600">{stats.vacant}</p>
            <p className="text-[11px] text-muted-foreground">شاغرة</p>
          </div>
        </div>
        {building.notes && (
          <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
            {building.notes}
          </p>
        )}

        {/* Units */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold">الوحدات</h2>
          <Button size="sm" className="rounded-full" onClick={() => setAddUnitOpen(true)}>
            <Plus className="ml-1 h-4 w-4" /> وحدة جديدة
          </Button>
        </div>

        {units.length === 0 ? (
          <EmptyState icon={DoorOpen} title="لا توجد وحدات" description="أضف وحدات مثل شقق أو محلات لهذا العقار" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{units.map((u) => {
            const tenant = data.tenants.find((t) => t.unitId === u.id);
            return (
              <Link
                key={u.id}
                to={`/units/${u.id}`}
                className="flex items-center justify-between rounded-3xl border border-border bg-card p-4 transition-transform active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-secondary p-2.5">
                    <DoorOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.type}
                      {u.floor ? ` · طابق ${u.floor}` : ""}
                      {tenant ? ` · ${tenant.name}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <StatusBadge status={u.status} label={UNIT_STATUS_LABELS[u.status]} />
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {formatMoney(u.rentAmount)}
                    <span className="text-muted-foreground"> / {RENT_PERIOD_LABELS[u.rentPeriod]}</span>
                  </p>
                </div>
              </Link>
            );
          })}</div>
        )}
          </TabsContent>
        </Tabs>
      </div>

      <FormSheet open={addUnitOpen} onOpenChange={setAddUnitOpen} title="إضافة وحدة جديدة">
        <UnitForm
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              units: [
                ...prev.units,
                { id: genId(), buildingId: building.id, createdAt: todayISO(), ...values, manualStatus: values.status },
              ],
            }));
            setAddUnitOpen(false);
            showSuccess("تمت إضافة الوحدة");
          }}
        />
      </FormSheet>

      <FormSheet open={editOpen} onOpenChange={setEditOpen} title="تعديل العقار">
        <BuildingForm
          initial={building}
          onSubmit={(values) => {
            const feeChanged = values.collectionFeePercent !== (building.collectionFeePercent ?? 0);
            const updatePayments = feeChanged && window.confirm("هل تريد تحديث رسوم التحصيل للدفعات غير المدفوعة التابعة لهذا العقار؟\nموافق: تحديث الدفعات\nإلغاء: حفظ بدون تحديث الدفعات");
            update((prev) => ({
              ...prev,
              buildings: prev.buildings.map((b) =>
                b.id === building.id ? { ...b, ...values } : b,
              ),
              payments: updatePayments ? prev.payments.map((payment) => {
                if (payment.status === "paid") return payment;
                const paymentUnit = prev.units.find((item) => item.id === payment.unitId);
                if (paymentUnit?.buildingId !== building.id || paymentUnit.collectionFeeOverrideEnabled) return payment;
                const gross = payment.grossAmount ?? payment.amount;
                const fee = Math.round(gross * values.collectionFeePercent) / 100;
                return normalizePaymentFinancials({ ...payment, grossAmount: gross, collectionFeePercent: values.collectionFeePercent, collectionFeePercentage: values.collectionFeePercent, collectionFeeAmount: fee, netAmountAfterCollectionFee: gross - fee });
              }) : prev.payments,
            }));
            setEditOpen(false);
            showSuccess("تم حفظ التعديلات");
          }}
        />
      </FormSheet>
      {whatsappPreview && (
        <WhatsappPreview
          open={!!whatsappPreview}
          onOpenChange={(open) => !open && setWhatsappPreview(null)}
          phone={whatsappPreview.phone}
          message={whatsappPreview.message}
        />
      )}
    </div>
  );
}
