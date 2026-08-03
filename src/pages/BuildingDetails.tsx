import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Plus,
  DoorOpen,
  Pencil,
  Trash2,
  Wrench,
  CalendarClock,
  Wallet,
  BarChart3,
  FileSpreadsheet,
  FileText,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import RepairForm from "@/components/forms/RepairForm";
import RecurringBuildingBillForm from "@/components/forms/RecurringBuildingBillForm";
import EvidenceAttachments from "@/components/shared/EvidenceAttachments";
import { useStore, genId } from "@/data/store";
import { buildingStats, formatMoney, formatDate, todayISO, normalizePaymentFinancials, parseLocalDate, effectiveStatus, getPaymentReceiveMethod, isCollectionFeeCollected, getPaymentReportMonth, getPaymentReportYearMonth, calculateInstallmentAmount, generatePaymentDueDates, getContractEndDate, getRemainingPaymentAmount, getCollectionFeeRemainingAmount, getCollectionFeeSettledAmount, getCollectedRentAmount, isPaymentOverdue } from "@/data/helpers";
import { UNIT_STATUS_LABELS, RENT_PERIOD_LABELS, PAYMENT_RECEIVE_METHOD_LABELS, COLLECTION_FEE_STATUS_LABELS, UNIT_MONTH_STATUS_LABELS, REPAIR_STATUS_LABELS } from "@/data/labels";
import { Contract, Payment, PaymentReceiveMethod, PaymentStatus, RecurringBuildingBill, Repair, Unit } from "@/data/types";
import { showSuccess, showError } from "@/utils/toast";
import { buildMonthlyReportBundle } from "@/reporting/reportBundle";
import { exportBuildingExcel } from "@/utils/buildingExcelExport";
import ExecutiveDashboard from "@/components/reports/ExecutiveDashboard";
import MonthlyExceptionsCard from "@/components/reports/MonthlyExceptionsCard";
import LateCollectionsList from "@/components/reports/LateCollectionsList";
import { UnitMonthStatus, UnitMonthRow } from "@/reporting/types";
import { formatYearMonthLabel } from "@/reporting/dateUtils";
import { appendOwnershipVersion, ownersForDate, ownershipChanged } from "@/data/buildingOwnership";
import { useAppDialog } from "@/components/shared/AppDialogProvider";
import { getOutstandingRecurringBillRepairs } from "@/data/recurringBuildingBills";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isoYearMonth(value?: string): string {
  return /^\d{4}-\d{2}/.test(value || "") ? String(value).slice(0, 7) : "";
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
  const appDialog = useAppDialog();
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [statusFilter, setStatusFilter] = useState<UnitMonthStatus | "all">("all");
  const [receiveMethodFilter, setReceiveMethodFilter] = useState<PaymentReceiveMethod | "all">("all");
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelFrom, setExcelFrom] = useState(`${new Date().getFullYear()}-01`);
  const [excelTo, setExcelTo] = useState(monthKey(new Date()));
  const [excelExporting, setExcelExporting] = useState(false);
  const [addBuildingRepairOpen, setAddBuildingRepairOpen] = useState(false);
  const [maintenanceRepeatsMonthly, setMaintenanceRepeatsMonthly] = useState(false);
  const [editBuildingRepair, setEditBuildingRepair] = useState<Repair | null>(null);
  const [maintenanceMonthFilter, setMaintenanceMonthFilter] = useState("all");
  const [maintenanceDayFilter, setMaintenanceDayFilter] = useState("all");
  const [recurringBillFormOpen, setRecurringBillFormOpen] = useState(false);
  const [editRecurringBill, setEditRecurringBill] = useState<RecurringBuildingBill | null>(null);
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab === "overdue"
    ? "units"
    : requestedTab === "recurring-bills"
      ? "maintenance"
      : requestedTab || "units";
  const focusedItemId = searchParams.get("item");
  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "units") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: false });
  };

  useEffect(() => {
    if (!focusedItemId || activeTab !== "maintenance") return;
    const timer = window.setTimeout(() => {
      document.getElementById(`building-repair-${focusedItemId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeTab, focusedItemId]);

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
  const currentOwners = ownersForDate(building, todayISO());
  const bundle = reportBundle!;

  const stats = buildingStats(data, building.id);
  const units = data.units.filter((u) => u.buildingId === building.id);
  const recurringBills = data.recurringBuildingBills.filter((bill) => bill.buildingId === building.id);
  const outstandingRecurringBills = getOutstandingRecurringBillRepairs(data, building.id);
  const deductedRecurringBills = data.repairs
    .filter((repair) => repair.buildingId === building.id && repair.recurringBillId)
    .sort((a, b) => b.repairDate.localeCompare(a.repairDate));
  const monthlyRecurringTotal = recurringBills
    .filter((bill) => bill.active)
    .reduce((sum, bill) => sum + bill.amount, 0);
  const buildingRepairs = data.repairs
    .filter((repair) => repair.buildingId === building.id && !repair.unitId && !repair.recurringBillId)
    .sort((a, b) => b.repairDate.localeCompare(a.repairDate));
  const maintenanceHistory = [...buildingRepairs, ...outstandingRecurringBills, ...deductedRecurringBills];
  const maintenanceMonths = Array.from(new Set(
    maintenanceHistory.map((repair) => isoYearMonth(repair.repairDate)).filter(Boolean),
  )).sort((a, b) => b.localeCompare(a));
  const monthFilteredBuildingRepairs = maintenanceMonthFilter === "all"
    ? buildingRepairs
    : buildingRepairs.filter((repair) => isoYearMonth(repair.repairDate) === maintenanceMonthFilter);
  const monthFilteredMaintenanceHistory = maintenanceMonthFilter === "all"
    ? maintenanceHistory
    : maintenanceHistory.filter((repair) => isoYearMonth(repair.repairDate) === maintenanceMonthFilter);
  const maintenanceDays = Array.from(new Set(
    monthFilteredMaintenanceHistory.map((repair) => repair.repairDate).filter(Boolean),
  )).sort((a, b) => b.localeCompare(a));
  const filteredBuildingRepairs = maintenanceDayFilter === "all"
    ? monthFilteredBuildingRepairs
    : monthFilteredBuildingRepairs.filter((repair) => repair.repairDate === maintenanceDayFilter);
  const filteredMaintenanceTotal = filteredBuildingRepairs
    .filter((repair) => repair.status !== "cancelled")
    .reduce((sum, repair) => sum + repair.cost, 0);
  const filteredOutstandingRecurringBills = outstandingRecurringBills.filter((repair) =>
    (maintenanceMonthFilter === "all" || isoYearMonth(repair.repairDate) === maintenanceMonthFilter)
    && (maintenanceDayFilter === "all" || repair.repairDate === maintenanceDayFilter)
  );
  const filteredDeductedRecurringBills = deductedRecurringBills.filter((repair) =>
    (maintenanceMonthFilter === "all" || isoYearMonth(repair.repairDate) === maintenanceMonthFilter)
    && (maintenanceDayFilter === "all" || repair.repairDate === maintenanceDayFilter)
  );
  const filteredRecurringBillsTotal = filteredOutstandingRecurringBills.reduce((sum, repair) => sum + repair.cost, 0)
    + filteredDeductedRecurringBills.reduce((sum, repair) => sum + repair.cost, 0);
  const unifiedMaintenanceTotal = filteredMaintenanceTotal + filteredRecurringBillsTotal;
  const overdueUnitSummaries = units
    .map((unit) => {
      const overduePayments = data.payments
        .filter((payment) => payment.unitId === unit.id && isPaymentOverdue(payment))
        .sort((a, b) => paymentDueDate(a).localeCompare(paymentDueDate(b)));
      return {
        unit,
        payments: overduePayments,
        months: new Set(overduePayments.map((payment) =>
          getPaymentReportMonth(payment, data.settings.reportMonthCutoffDay)
        )).size,
        total: overduePayments.reduce((sum, payment) => sum + getRemainingPaymentAmount(payment), 0),
      };
    })
    .filter((item) => item.payments.length > 0)
    .sort((a, b) => b.payments.length - a.payments.length);
  const overduePaymentsCount = overdueUnitSummaries
    .reduce((sum, item) => sum + item.payments.length, 0);
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
        backTo="/buildings"
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
              onClick={() => setExcelOpen(true)}
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
        <div className="mb-4 rounded-2xl border border-primary/20 bg-secondary/50 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-bold">ملاك العقار وتوزيع المستحقات</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {currentOwners.length > 1 ? `${currentOwners.length} ملاك` : "مالك واحد 100%"}
                {building.ownershipHistory?.length ? ` · ${building.ownershipHistory.length} تغيير موثق` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" onClick={() => setEditOpen(true)}>
              إدارة الملاك
            </Button>
          </div>
          {currentOwners.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {currentOwners.map((owner) => (
                <span key={owner.id} className="rounded-full bg-background px-2.5 py-1 font-semibold">
                  {owner.name} · {owner.percentage}%
                </span>
              ))}
            </div>
          )}
        </div>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          dir="rtl"
          className="min-[500px]:grid min-[500px]:grid-cols-[13rem_minmax(0,1fr)] min-[500px]:items-start min-[500px]:gap-5 min-[500px]:[direction:ltr]"
        >
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[500px]:sticky min-[500px]:top-[calc(50vh-10rem)] min-[500px]:col-start-1 min-[500px]:row-start-1 min-[500px]:self-start min-[500px]:translate-y-0 min-[500px]:flex-col min-[500px]:gap-2 min-[500px]:overflow-visible min-[500px]:rounded-3xl min-[500px]:border min-[500px]:border-border min-[500px]:bg-card min-[500px]:p-3 min-[500px]:shadow-sm min-[500px]:[direction:rtl]">
            <TabsTrigger value="units" className="min-w-[78px] shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold min-[500px]:w-full min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              الوحدات
            </TabsTrigger>
            <TabsTrigger value="financial" className="min-w-[78px] shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold min-[500px]:w-full min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              المالية
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="min-w-[128px] shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold min-[500px]:w-full min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              <span>صيانة المبنى</span>
              {(buildingRepairs.length + outstandingRecurringBills.length) > 0 && (
                <span className="mr-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
                  {buildingRepairs.length + outstandingRecurringBills.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="performance" className="min-w-[78px] shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold min-[500px]:w-full min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              الأداء
            </TabsTrigger>
            <TabsTrigger value="recurring-bills" className="hidden">
              <ReceiptText className="ml-1 h-3.5 w-3.5" />
              الفواتير
              {outstandingRecurringBills.length > 0 && (
                <span className="mr-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] text-white">
                  {outstandingRecurringBills.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="mt-4 space-y-4 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
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

          <TabsContent value="performance" className="mt-4 space-y-4 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
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

          <TabsContent value="maintenance" className="mt-4 space-y-3 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
            <div className="flex items-center justify-between gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <div>
                <p className="font-bold text-amber-900">أعمال صيانة المبنى</p>
                <p className="mt-1 text-xs text-amber-800">
                  صيانة عامة على العقار وغير مرتبطة بوحدة محددة
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="rounded-full bg-amber-200/70 px-2 py-1 text-amber-900">
                    غير متكررة: {formatMoney(filteredMaintenanceTotal)}
                  </span>
                  <span className="rounded-full bg-sky-200/70 px-2 py-1 text-sky-900">
                    شهرية{maintenanceMonthFilter === "all" ? "" : ` (${formatYearMonthLabel(maintenanceMonthFilter)})`}: {formatMoney(filteredRecurringBillsTotal)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-bold text-amber-900">
                  {maintenanceMonthFilter === "all" ? "الإجمالي" : `الإجمالي خلال ${formatYearMonthLabel(maintenanceMonthFilter)}`}: {formatMoney(unifiedMaintenanceTotal)}
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 rounded-full"
                onClick={() => {
                  setMaintenanceRepeatsMonthly(false);
                  setAddBuildingRepairOpen(true);
                }}
              >
                <Plus className="ml-1 h-4 w-4" />
                إضافة صيانة
              </Button>
            </div>
            {maintenanceHistory.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold">فلترة حسب شهر الصيانة</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {filteredBuildingRepairs.length + filteredOutstandingRecurringBills.length + filteredDeductedRecurringBills.length} بند صيانة ظاهر
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
                <Select value={maintenanceMonthFilter} onValueChange={(value) => {
                  setMaintenanceMonthFilter(value);
                  setMaintenanceDayFilter("all");
                }}>
                  <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:w-[155px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الشهور</SelectItem>
                    {maintenanceMonths.map((yearMonth) => (
                      <SelectItem key={yearMonth} value={yearMonth}>
                        {formatYearMonthLabel(yearMonth)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={maintenanceDayFilter} onValueChange={setMaintenanceDayFilter}>
                  <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:w-[125px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأيام</SelectItem>
                    {maintenanceDays.map((day) => (
                      <SelectItem key={day} value={day}>{formatDate(day)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
              </div>
            )}
            {buildingRepairs.length === 0 && recurringBills.length === 0 ? (
              <EmptyState icon={Wrench} title="لا توجد صيانة عامة للمبنى" description="أضف أعمال الصيانة التي تخص العقار كاملًا من هنا" />
            ) : filteredBuildingRepairs.length === 0
              && filteredOutstandingRecurringBills.length === 0
              && filteredDeductedRecurringBills.length === 0
              && recurringBills.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center">
                <Wrench className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-bold">لا توجد أعمال صيانة في هذا الشهر</p>
                <Button variant="link" size="sm" onClick={() => setMaintenanceMonthFilter("all")}>
                  عرض كل الشهور
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredBuildingRepairs.map((repair) => {
                  const linkedPayment = repair.deductedFromPaymentId
                    ? data.payments.find((payment) => payment.id === repair.deductedFromPaymentId)
                    : undefined;
                  const linkedUnit = linkedPayment
                    ? data.units.find((unit) => unit.id === linkedPayment.unitId)
                    : undefined;
                  const linkedTenant = linkedPayment?.tenantId
                    ? data.tenants.find((tenant) => tenant.id === linkedPayment.tenantId)
                    : undefined;
                  const paymentSeries = linkedPayment
                    ? data.payments
                        .filter((payment) => {
                          if (payment.deletedAt) return false;
                          if (linkedPayment.contractId) return payment.contractId === linkedPayment.contractId;
                          return payment.unitId === linkedPayment.unitId;
                        })
                        .sort((a, b) => paymentDueDate(a).localeCompare(paymentDueDate(b)))
                    : [];
                  const inferredPaymentIndex = linkedPayment
                    ? paymentSeries.findIndex((payment) => payment.id === linkedPayment.id)
                    : -1;
                  const linkedPaymentNumber = linkedPayment?.paymentNumber
                    ?? (inferredPaymentIndex >= 0 ? inferredPaymentIndex + 1 : undefined);
                  const linkedPaymentMonth = linkedPayment
                    ? getPaymentReportMonth(linkedPayment, data.settings.reportMonthCutoffDay)
                    : "";

                  return (
                    <div
                      key={repair.id}
                      id={`building-repair-${repair.id}`}
                      className={`rounded-3xl border border-border bg-card p-4 text-xs ${
                        focusedItemId === repair.id ? "ring-2 ring-primary ring-offset-2" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold">{repair.description}</p>
                          <p className="mt-1 text-muted-foreground">{formatDate(repair.repairDate)}</p>
                          {repair.contractor && <p className="mt-1 text-muted-foreground">المنفذ: {repair.contractor}</p>}
                        </div>
                        <div className="shrink-0 text-left">
                          <StatusBadge status={repair.status} label={REPAIR_STATUS_LABELS[repair.status]} />
                          <p className="mt-2 font-bold text-amber-700">{formatMoney(repair.cost)}</p>
                        </div>
                      </div>
                      {repair.notes && <p className="mt-3 rounded-2xl bg-muted p-2.5 text-muted-foreground">{repair.notes}</p>}
                      {linkedPayment ? (
                        <div className="mt-2 rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-900">
                          <p className="font-bold">
                            خُصم من إيجار {linkedUnit?.name || linkedPayment.unitName || "وحدة غير محددة"}
                          </p>
                          <p className="mt-1">
                            المستأجر: {linkedPayment.tenantName || linkedTenant?.name || "غير محدد"}
                          </p>
                          <p className="mt-1">
                            {linkedPaymentNumber ? `الدفعة رقم ${linkedPaymentNumber}` : "دفعة إيجار"}
                            {linkedPaymentMonth ? ` · دفعة ${formatYearMonthLabel(linkedPaymentMonth)}` : ""}
                          </p>
                          <p className="mt-1 text-violet-700">
                            موعد الاستحقاق: {formatDate(paymentDueDate(linkedPayment))}
                          </p>
                          {linkedPayment.receivedDate && (
                            <p className="mt-1 text-violet-700">
                              تاريخ الاستلام: {formatDate(linkedPayment.receivedDate)}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-8 rounded-full border-violet-200 bg-white text-[11px] text-violet-800"
                            onClick={() => navigate(`/units/${encodeURIComponent(linkedPayment.unitId)}?tab=payments&item=${encodeURIComponent(linkedPayment.id)}`)}
                          >
                            عرض الدفعة
                          </Button>
                        </div>
                      ) : repair.isDeductedFromOwnerTransfer ? (
                        <p className="mt-2 rounded-2xl bg-violet-50 p-2.5 font-semibold text-violet-800">
                          تم خصم هذا البند من دفعة إيجار قديمة، لكن سجل الدفعة المرتبط غير موجود
                        </p>
                      ) : null}
                      <div className="mt-3 flex justify-end gap-1 border-t border-border pt-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditBuildingRepair(repair)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-destructive"
                          onClick={async () => {
                            const reason = await appDialog.prompt({
                              title: "حذف الصيانة",
                              description: linkedPayment
                                ? `هذا البند مخصوم من دفعة ${linkedUnit?.name || linkedPayment.unitName || "غير محددة"}. سيُحدَّث مبلغ الصيانة المخصوم في تلك الدفعة تلقائيًا بعد الحذف.\n\nاكتب سبب الحذف ليُحفظ في سجل التدقيق المالي.`
                                : "اكتب سبب الحذف ليُحفظ في سجل التدقيق المالي.",
                              inputLabel: "سبب الحذف",
                              confirmLabel: "حذف الصيانة",
                              tone: "destructive",
                              required: true,
                            });
                            if (!reason?.trim()) {
                              return;
                            }
                            update(
                              (prev) => {
                                const remainingRepairs = prev.repairs.filter((item) => item.id !== repair.id);
                                if (!repair.deductedFromPaymentId) {
                                  return { ...prev, repairs: remainingRepairs };
                                }
                                return {
                                  ...prev,
                                  repairs: remainingRepairs,
                                  payments: prev.payments.map((payment) => {
                                    if (payment.id !== repair.deductedFromPaymentId) return payment;
                                    // Subtract this repair's cost directly rather than re-deriving the
                                    // total from remaining linked repairs: getPaymentMaintenanceDeductionAmount
                                    // falls back to the stored maintenanceDeductionAmount when no repairs
                                    // are linked, which would incorrectly return the stale pre-deletion
                                    // total once this was the last linked item.
                                    const newMaintenanceDeductionAmount = Math.max(
                                      0,
                                      Math.round(((payment.maintenanceDeductionAmount || 0) - repair.cost) * 100) / 100,
                                    );
                                    // ownerSettledByMaintenance means deductions exactly covered the
                                    // remaining amount, so the owner transfer was skipped. Removing a
                                    // deducted item here can only ever create a positive remainder
                                    // equal to the drop in the deduction total — reopen the transfer.
                                    const wasFullySettledByMaintenance = payment.ownerSettledByMaintenance === true;
                                    return normalizePaymentFinancials({
                                      ...payment,
                                      maintenanceDeductionAmount: newMaintenanceDeductionAmount,
                                      notes: [
                                        payment.notes,
                                        `تم حذف بند صيانة بقيمة ${formatMoney(repair.cost)} (${repair.description}) وتحديث مبلغ الصيانة المخصوم إلى ${formatMoney(newMaintenanceDeductionAmount)}.`,
                                      ].filter(Boolean).join("\n"),
                                      ...(wasFullySettledByMaintenance
                                        ? {
                                            ownerTransferred: false,
                                            ownerSettledByMaintenance: false,
                                            ownerTransferDate: null,
                                            ownerTransferMethod: null,
                                            ownerTransferNotes: `أُعيدت الدفعة إلى بانتظار التحويل للمالك بعد حذف بند صيانة كان يغطيها بالكامل.`,
                                          }
                                        : {}),
                                    });
                                  }),
                                };
                              },
                              { reason: reason.trim() },
                            );
                            showSuccess(linkedPayment ? "تم حذف بند الصيانة وتحديث الدفعة المرتبطة" : "تم حذف بند الصيانة");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4 space-y-4 min-[500px]:col-start-2 min-[500px]:row-start-2 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-amber-950">الصيانة الشهرية للمبنى</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    بنود صيانة وخدمات متكررة مثل المياه والحارس والنظافة، وتظهر تلقائيًا كمقترح خصم عند استلام إيجار من العقار.
                  </p>
                  <p className="mt-2 text-sm font-bold text-amber-950">
                    الإجمالي الشهري: {formatMoney(monthlyRecurringTotal)}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => {
                    setMaintenanceRepeatsMonthly(true);
                    setAddBuildingRepairOpen(true);
                  }}
                >
                  <Plus className="ml-1 h-4 w-4" /> إضافة صيانة شهرية
                </Button>
              </div>
            </div>

            {recurringBills.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="لا توجد صيانة شهرية"
                description="أضف بند مياه أو حارس أو نظافة أو أي صيانة متكررة للمبنى"
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {recurringBills.map((bill) => {
                  const pendingCount = outstandingRecurringBills.filter((item) => item.recurringBillId === bill.id).length;
                  const settledCount = deductedRecurringBills.filter((item) => item.recurringBillId === bill.id).length;
                  return (
                    <div key={bill.id} className="rounded-3xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold">{bill.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${bill.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                              {bill.active ? "نشطة" : "متوقفة"}
                            </span>
                          </div>
                          <p className="mt-1 text-lg font-bold text-amber-700">{formatMoney(bill.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            تستحق يوم {bill.dueDay} من كل شهر · منذ {bill.startYearMonth}
                          </p>
                          <p className="mt-2 text-[11px]">
                            <span className="text-amber-700">{pendingCount} بانتظار الخصم</span>
                            <span className="mx-2 text-muted-foreground">·</span>
                            <span className="text-emerald-700">{settledCount} تمت تسويتها</span>
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => {
                              setEditRecurringBill(bill);
                              setRecurringBillFormOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-destructive"
                            onClick={async () => {
                              const confirmed = await appDialog.confirm({
                                title: "حذف الفاتورة الشهرية؟",
                                description: "سيُحذف جدول الأشهر غير المسددة، مع الاحتفاظ بالفواتير التي خُصمت سابقًا داخل سجل الدفعات.",
                                confirmLabel: "حذف الفاتورة",
                                tone: "destructive",
                              });
                              if (!confirmed) return;
                              await update((prev) => ({
                                ...prev,
                                recurringBuildingBills: prev.recurringBuildingBills.filter((item) => item.id !== bill.id),
                              }));
                              showSuccess("تم حذف الفاتورة الشهرية");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 border-t border-border pt-3">
                        <EvidenceAttachments
                          entityType="recurring_bill"
                          entityId={bill.id}
                          kind="maintenance_invoice"
                          buildingId={building.id}
                          compact
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredOutstandingRecurringBills.length > 0 && (
              <div className="rounded-3xl border border-amber-200 bg-card p-4">
                <p className="font-bold">الصيانة الشهرية غير المخصومة</p>
                <p className="mt-1 text-xs text-muted-foreground">ستظهر هذه البنود في نافذة استلام الدفعة للعقار نفسه.</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {filteredOutstandingRecurringBills.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl bg-amber-50 p-3 text-xs">
                      <div>
                        <p className="font-bold">{item.description}</p>
                        <p className="text-muted-foreground">الاستحقاق: {formatDate(item.repairDate)}</p>
                      </div>
                      <p className="font-bold text-amber-800">{formatMoney(item.cost)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredDeductedRecurringBills.length > 0 && (
              <div className="rounded-3xl border border-emerald-200 bg-card p-4">
                <p className="font-bold">سجل الصيانة الشهرية المخصومة</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  يوضح من أي إيجار خُصمت كل فاتورة شهرية، مع الاحتفاظ بالسجل حتى عند حذف جدول الفاتورة.
                </p>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {filteredDeductedRecurringBills.map((item) => {
                    const linkedPayment = item.deductedFromPaymentId
                      ? data.payments.find((payment) => payment.id === item.deductedFromPaymentId)
                      : undefined;
                    const linkedUnit = linkedPayment
                      ? data.units.find((unit) => unit.id === linkedPayment.unitId)
                      : undefined;
                    const linkedPaymentMonth = linkedPayment
                      ? getPaymentReportMonth(linkedPayment, data.settings.reportMonthCutoffDay)
                      : "";

                    return (
                      <div key={item.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{item.description}</p>
                            <p className="mt-1 text-emerald-800">
                              فاتورة شهر {item.recurringYearMonth ? formatYearMonthLabel(item.recurringYearMonth) : formatDate(item.repairDate)}
                            </p>
                          </div>
                          <p className="shrink-0 font-bold text-amber-800">{formatMoney(item.cost)}</p>
                        </div>
                        {linkedPayment ? (
                          <div className="mt-2 border-t border-emerald-200 pt-2 text-muted-foreground">
                            <p>
                              خُصمت من دفعة {linkedUnit?.name || linkedPayment.unitName || "وحدة غير محددة"}
                              {linkedPayment.paymentNumber ? ` رقم ${linkedPayment.paymentNumber}` : ""}
                            </p>
                            {linkedPaymentMonth && <p className="mt-1">شهر الدفعة: {formatYearMonthLabel(linkedPaymentMonth)}</p>}
                            {linkedPayment.receivedDate && <p className="mt-1">تاريخ الاستلام: {formatDate(linkedPayment.receivedDate)}</p>}
                          </div>
                        ) : (
                          <p className="mt-2 border-t border-emerald-200 pt-2 text-muted-foreground">
                            الدفعة المرتبطة غير متاحة حاليًا، وتم الاحتفاظ بسجل الفاتورة.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="units" className="mt-4 space-y-4 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
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
        <details className="group rounded-2xl border border-red-200 bg-red-50 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-xs font-bold text-red-800">حالات الوحدات المتأخرة</p>
                <p className="text-[10px] text-red-700">اضغط لعرض عدد الدفعات والشهور لكل وحدة</p>
              </div>
            </div>
            <div className="shrink-0 text-left">
              <p className="text-sm font-bold text-red-700">{overdueUnitSummaries.length} وحدة</p>
              <p className="text-[10px] text-red-600">{overduePaymentsCount} دفعة</p>
            </div>
          </summary>
          <div className="mt-3 space-y-2 border-t border-red-200 pt-3">
            {overdueUnitSummaries.length === 0 ? (
              <p className="rounded-xl bg-white/70 p-2 text-xs text-emerald-700">لا توجد وحدات متأخرة حاليًا.</p>
            ) : overdueUnitSummaries.map((item) => {
              const oldestPayment = item.payments[0];
              const tenant = data.tenants.find((tenantItem) => tenantItem.unitId === item.unit.id);
              return (
                <Link
                  key={item.unit.id}
                  to={`/units/${encodeURIComponent(item.unit.id)}?tab=payments&item=${encodeURIComponent(oldestPayment.id)}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white p-2.5 text-xs transition-transform active:scale-[0.98]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">{item.unit.name}</p>
                    {tenant?.name && <p className="truncate text-[10px] text-muted-foreground">{tenant.name}</p>}
                    <p className="mt-1 text-[10px] text-red-700">
                      {item.payments.length} دفعة · {item.months} {item.months === 1 ? "شهر" : "أشهر"}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="font-bold text-red-700">{formatMoney(item.total)}</p>
                    <p className="text-[10px] text-muted-foreground">أقدمها {formatDate(paymentDueDate(oldestPayment))}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </details>
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

      <FormSheet
        open={recurringBillFormOpen}
        onOpenChange={(open) => {
          setRecurringBillFormOpen(open);
          if (!open) setEditRecurringBill(null);
        }}
        title={editRecurringBill ? "تعديل الصيانة الشهرية" : "إضافة صيانة شهرية"}
      >
        <RecurringBuildingBillForm
          key={editRecurringBill?.id || "new-recurring-bill"}
          initial={editRecurringBill || undefined}
          onSubmit={async (values) => {
            const pausedYearMonth = values.active ? undefined : monthKey(new Date());
            await update((prev) => ({
              ...prev,
              recurringBuildingBills: editRecurringBill
                ? prev.recurringBuildingBills.map((bill) =>
                    bill.id === editRecurringBill.id ? { ...bill, ...values, pausedYearMonth } : bill
                  )
                : [
                    ...prev.recurringBuildingBills,
                    {
                      id: genId(),
                      buildingId: building.id,
                      createdAt: new Date().toISOString(),
                      pausedYearMonth,
                      ...values,
                    },
                  ],
            }));
            setRecurringBillFormOpen(false);
            setEditRecurringBill(null);
            showSuccess(editRecurringBill ? "تم تعديل الصيانة الشهرية" : "تمت إضافة الصيانة الشهرية");
          }}
        />
      </FormSheet>

      <FormSheet open={excelOpen} onOpenChange={setExcelOpen} title="تصدير تقرير إكسل">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            حدد الفترة المطلوبة — سيشمل التقرير الدفعات (حسب شهر الدفعة) وأعمال الصيانة خلالها، مع ملخص الوحدات والعقود وتواريخ التأجير.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">من شهر</label>
              <input
                type="month"
                value={excelFrom}
                onChange={(e) => setExcelFrom(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">إلى شهر</label>
              <input
                type="month"
                value={excelTo}
                onChange={(e) => setExcelTo(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <Button
            className="w-full rounded-xl"
            disabled={excelExporting}
            onClick={async () => {
              if (!/^\d{4}-\d{2}$/.test(excelFrom) || !/^\d{4}-\d{2}$/.test(excelTo)) {
                showError("يرجى تحديد الفترة من والى");
                return;
              }
              if (excelFrom > excelTo) {
                showError("بداية الفترة يجب أن تسبق نهايتها");
                return;
              }
              setExcelExporting(true);
              try {
                await exportBuildingExcel(data, building, { fromMonth: excelFrom, toMonth: excelTo });
                setExcelOpen(false);
                showSuccess("تم إنشاء ملف الإكسل");
              } catch (err) {
                console.error("Excel export failed:", err);
                showError("تعذر تصدير ملف الإكسل");
              } finally {
                setExcelExporting(false);
              }
            }}
          >
            {excelExporting ? "جارٍ التصدير..." : "تصدير التقرير"}
          </Button>
        </div>
      </FormSheet>

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
          onSubmit={async (values) => {
            const { ownershipEffectiveFrom, ownershipChangeReason, ...buildingValues } = values;
            const feeChanged = values.collectionFeePercent !== (building.collectionFeePercent ?? 0);
            const ownersChanged = ownershipChanged(building.owners, values.owners)
              || !!building.multipleOwnersEnabled !== values.multipleOwnersEnabled;
            const updatePayments = feeChanged
              ? await appDialog.confirm({
                  title: "تحديث رسوم الدفعات؟",
                  description: "هل تريد تطبيق نسبة التحصيل الجديدة على الدفعات غير المدفوعة التابعة لهذا العقار؟\n\nيمكن الإلغاء لحفظ بيانات العقار دون تعديل الدفعات الحالية.",
                  confirmLabel: "تحديث الدفعات",
                })
              : false;
            update((prev) => ({
              ...prev,
              buildings: prev.buildings.map((b) =>
                b.id === building.id ? {
                  ...b,
                  ...buildingValues,
                  ownershipHistory: ownersChanged
                    ? appendOwnershipVersion(b, values.owners, ownershipEffectiveFrom, ownershipChangeReason)
                    : b.ownershipHistory,
                } : b,
              ),
              payments: updatePayments ? prev.payments.map((payment) => {
                if (payment.status === "paid") return payment;
                const paymentUnit = prev.units.find((item) => item.id === payment.unitId);
                if (paymentUnit?.buildingId !== building.id || paymentUnit.collectionFeeOverrideEnabled) return payment;
                const gross = payment.grossAmount ?? payment.amount;
                const fee = Math.round(gross * values.collectionFeePercent) / 100;
                return normalizePaymentFinancials({ ...payment, grossAmount: gross, collectionFeePercent: values.collectionFeePercent, collectionFeePercentage: values.collectionFeePercent, collectionFeeAmount: fee, netAmountAfterCollectionFee: gross - fee });
              }) : prev.payments,
            }), { reason: ownersChanged ? ownershipChangeReason : "تعديل بيانات العقار" });
            setEditOpen(false);
            showSuccess("تم حفظ التعديلات");
          }}
        />
      </FormSheet>
      <FormSheet open={addBuildingRepairOpen} onOpenChange={setAddBuildingRepairOpen} title="إضافة صيانة للمبنى">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <span>
              <span className="block text-sm font-bold text-amber-950">تتكرر هذه الصيانة شهريًا</span>
              <span className="mt-1 block text-[10px] leading-5 text-amber-800">
                عند تفعيلها ينشئ التطبيق استحقاقًا جديدًا كل شهر ويقترح خصمه من دفعات إيجار العقار.
              </span>
            </span>
            <Switch checked={maintenanceRepeatsMonthly} onCheckedChange={setMaintenanceRepeatsMonthly} />
          </label>
          {maintenanceRepeatsMonthly ? (
            <RecurringBuildingBillForm
              showActiveToggle={false}
              onSubmit={async (values) => {
                const pausedYearMonth = values.active ? undefined : monthKey(new Date());
                await update((prev) => ({
                  ...prev,
                  recurringBuildingBills: [
                    ...prev.recurringBuildingBills,
                    {
                      id: genId(),
                      buildingId: building.id,
                      createdAt: new Date().toISOString(),
                      pausedYearMonth,
                      ...values,
                    },
                  ],
                }));
                setAddBuildingRepairOpen(false);
                showSuccess("تمت إضافة صيانة شهرية للمبنى");
              }}
            />
          ) : (
            <RepairForm
              onSubmit={(values) => {
                update((prev) => ({
                  ...prev,
                  repairs: [
                    ...prev.repairs,
                    {
                      id: genId(),
                      buildingId: building.id,
                      createdAt: new Date().toISOString(),
                      ...values,
                    },
                  ],
                }));
                setAddBuildingRepairOpen(false);
                showSuccess("تمت إضافة صيانة المبنى");
              }}
            />
          )}
        </div>
      </FormSheet>
      <FormSheet open={!!editBuildingRepair} onOpenChange={(open) => !open && setEditBuildingRepair(null)} title="تعديل صيانة المبنى">
        {editBuildingRepair && (
          <RepairForm
            initial={editBuildingRepair}
            onSubmit={async (values) => {
              const reason = await appDialog.prompt({
                title: "تعديل صيانة المبنى",
                description: "اكتب سبب التعديل ليُحفظ في سجل التدقيق المالي.",
                inputLabel: "سبب التعديل",
                confirmLabel: "حفظ التعديل",
                required: true,
              });
              if (!reason?.trim()) {
                return;
              }
              update((prev) => ({
                ...prev,
                repairs: prev.repairs.map((repair) =>
                  repair.id === editBuildingRepair.id
                    ? { ...repair, ...values, buildingId: building.id, unitId: undefined }
                    : repair
                ),
              }), { reason: reason.trim() });
              setEditBuildingRepair(null);
              showSuccess("تم حفظ صيانة المبنى");
            }}
          />
        )}
      </FormSheet>
    </div>
  );
}
