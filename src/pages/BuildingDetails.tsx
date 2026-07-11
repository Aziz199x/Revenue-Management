import { useState } from "react";
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
import { UNIT_STATUS_LABELS, RENT_PERIOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_RECEIVE_METHOD_LABELS, COLLECTION_FEE_STATUS_LABELS } from "@/data/labels";
import { Contract, Payment, PaymentReceiveMethod, PaymentStatus, Unit } from "@/data/types";
import { buildPaymentReminderMessage } from "@/utils/whatsapp";
import { showSuccess, showError } from "@/utils/toast";

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
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
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

  const stats = buildingStats(data, building.id);
  const units = data.units.filter((u) => u.buildingId === building.id);
  const unitIds = new Set(units.map((u) => u.id));
  const selectedMonthPayments = data.payments
    .filter((payment) => unitIds.has(payment.unitId) && !payment.deletedAt && getPaymentReportMonth(payment) === selectedMonth)
    .map((payment) => normalizePaymentFinancials(payment))
    .sort((a, b) => paymentDueDate(a).localeCompare(paymentDueDate(b)));
  const monthlyUnitRows: MonthlyUnitReportRow[] = units.map((unit) => {
    const unitContracts = data.contracts
      .filter((contract) => contract.unitId === unit.id && isContractInReportMonth(contract, selectedMonth))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    const contract = unitContracts[0];
    const payment = selectedMonthPayments.find((item) =>
      item.unitId === unit.id && (!contract || !item.contractId || item.contractId === contract.id),
    );
    const tenant = data.tenants.find((item) => item.id === payment?.tenantId || item.id === contract?.tenantId || item.unitId === unit.id);

    if (!contract && !payment) {
      return {
        unit,
        status: "vacant",
        expectedAmount: 0,
        collectedAmount: 0,
        remainingAmount: 0,
        collectionFeeAmount: 0,
        collectionFeeSettledAmount: 0,
        collectionFeeRemainingAmount: 0,
      };
    }

    if (payment) {
      const expectedAmount = payment.grossAmount ?? payment.amount;
      const collectedAmount = getCollectedRentAmount(payment);
      const remainingAmount = Math.max(0, Math.round((expectedAmount - collectedAmount) * 100) / 100);
      const status = remainingAmount <= 0 ? "paid" : effectiveStatus(payment);
      const hasCollectedRent = collectedAmount > 0;
      const receiveMethod = hasCollectedRent ? getPaymentReceiveMethod(payment) : undefined;
      const collectionFeeRemainingAmount = hasCollectedRent ? getCollectionFeeRemainingAmount(data, payment) : 0;
      const collectionFeeSettledAmount = hasCollectedRent ? getCollectionFeeSettledAmount(data, payment) : 0;
      return {
        unit,
        contract,
        payment,
        tenantName: payment.tenantName || tenant?.name || contract?.tenantName,
        tenantPhone: payment.tenantPhone || tenant?.phone || contract?.tenantPhone,
        dueDate: paymentDueDate(payment),
        status,
        expectedAmount,
        collectedAmount,
        remainingAmount,
        receiveMethod,
        collectionFeeAmount: hasCollectedRent ? (payment.collectionFeeAmount ?? 0) : 0,
        collectionFeeSettledAmount,
        collectionFeeRemainingAmount,
        collectionFeeStatus: hasCollectedRent ? payment.collectionFeeStatus : undefined,
      };
    }

    const dueDate = contract ? expectedContractDueDate(contract, selectedMonth) : undefined;
    if (!dueDate) {
      return {
        unit,
        contract,
        tenantName: tenant?.name || contract?.tenantName,
        tenantPhone: tenant?.phone || contract?.tenantPhone,
        status: "vacant",
        expectedAmount: 0,
        collectedAmount: 0,
        remainingAmount: 0,
        collectionFeeAmount: 0,
        collectionFeeSettledAmount: 0,
        collectionFeeRemainingAmount: 0,
      };
    }
    const expectedAmount = contract ? expectedContractInstallment(contract, unit) : 0;
    const status: MonthlyReportStatus = dueDate < todayISO() ? "overdue" : "unpaid";
    return {
      unit,
      contract,
      tenantName: tenant?.name || contract?.tenantName,
      tenantPhone: tenant?.phone || contract?.tenantPhone,
      dueDate,
      status,
      expectedAmount,
      collectedAmount: 0,
      remainingAmount: expectedAmount,
      collectionFeeAmount: 0,
      collectionFeeSettledAmount: 0,
      collectionFeeRemainingAmount: 0,
    };
  });
  const filteredMonthlyRows = monthlyUnitRows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (receiveMethodFilter !== "all" && row.receiveMethod !== receiveMethodFilter) return false;
    return true;
  });
  const filteredMonthlyPayments = filteredMonthlyRows.map((row) => ({
    id: row.payment?.id || `unit-month-${row.unit.id}-${selectedMonth}`,
    unitId: row.unit.id,
    unitName: row.unit.name,
    tenantName: row.tenantName,
    tenantPhone: row.tenantPhone,
    amount: row.expectedAmount,
    grossAmount: row.expectedAmount,
    paidAmount: row.collectedAmount,
    paymentDate: row.dueDate || `${selectedMonth}-01`,
    dueDateGregorian: row.dueDate,
    nextDueDate: row.dueDate,
    status: row.status as PaymentStatus,
    receiveMethod: row.receiveMethod,
    collectionFeeAmount: row.collectionFeeAmount,
    collectionFeeSettledAmount: row.collectionFeeSettledAmount,
    collectionFeeRemainingAmount: row.collectionFeeRemainingAmount,
    collectionFeeStatus: row.collectionFeeStatus,
  }));
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
  const monthRepairs = data.repairs.filter((repair) =>
    repair.status !== "cancelled"
    && repair.repairDate.startsWith(selectedMonth)
    && (repair.buildingId === building.id || (repair.unitId ? unitIds.has(repair.unitId) : false)),
  );
  const totalDueRent = monthlyUnitRows.reduce((sum, row) => sum + row.expectedAmount, 0);
  const totalCollectedRent = monthlyUnitRows.reduce((sum, row) => sum + row.collectedAmount, 0);
  const totalUncollectedRent = Math.max(0, Math.round((totalDueRent - totalCollectedRent) * 100) / 100);
  const officeFeesDue = monthlyUnitRows.reduce((sum, row) => sum + row.collectionFeeAmount, 0);
  const officeFeesCollected = monthlyUnitRows.reduce((sum, row) => sum + (isCollectionFeeCollected(row.collectionFeeStatus) ? row.collectionFeeAmount : row.collectionFeeSettledAmount), 0);
  const officeFeesUncollected = monthlyUnitRows.reduce((sum, row) => sum + row.collectionFeeRemainingAmount, 0);
  const ejarPaymentsTotal = monthlyUnitRows
    .filter((row) => row.receiveMethod === "ejar_platform")
    .reduce((sum, row) => sum + row.collectedAmount, 0);
  const maintenanceMonthlyCost = monthRepairs.reduce((sum, repair) => sum + repair.cost, 0);
  const monthlyCollectionRate = totalDueRent > 0 ? Math.round((totalCollectedRent / totalDueRent) * 100) : 0;
  const sourceSettlementDeductions = data.collectionFeeSettlements
    .filter((settlement) => settlement.sourcePaymentId && selectedMonthPayments.some((payment) => payment.id === settlement.sourcePaymentId))
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const currentPaymentFeesDeducted = monthlyUnitRows
    .reduce((sum, row) => sum + (row.collectionFeeStatus === "collected" ? row.collectionFeeAmount : 0), 0);
  const monthlyNetOwnerIncome = Math.round((totalCollectedRent - currentPaymentFeesDeducted - sourceSettlementDeductions - maintenanceMonthlyCost) * 100) / 100;
  const paidPaymentsCount = monthlyUnitRows.filter((row) => row.status === "paid").length;
  const unpaidPaymentsCount = monthlyUnitRows.filter((row) => row.status === "unpaid").length;
  const overduePaymentsCount = monthlyUnitRows.filter((row) => row.status === "overdue").length;
  const ejarPaymentsCount = monthlyUnitRows.filter((row) => row.receiveMethod === "ejar_platform").length;
  const overduePropertyPayments = data.payments
    .filter((payment) => unitIds.has(payment.unitId) && isPaymentOverdue(normalizePaymentFinancials(payment)))
    .map((payment) => normalizePaymentFinancials(payment))
    .sort((a, b) => paymentDueDate(a).localeCompare(paymentDueDate(b)));

  const openPaymentWhatsapp = (payment: Payment) => {
    const unit = units.find((item) => item.id === payment.unitId);
    const tenant = data.tenants.find((item) => item.id === payment.tenantId || item.unitId === payment.unitId);
    const tenantPhone = payment.tenantPhone || tenant?.phone;
    const amount = getPaymentAmount(payment);
    if (!amount) {
      showError("مبلغ الدفعة غير صحيح");
      return;
    }
    if (!tenantPhone) {
      showError("رقم جوال المستأجر غير موجود");
      return;
    }
    const message = buildPaymentReminderMessage({
      tenantName: payment.tenantName || tenant?.name,
      buildingName: payment.buildingName || building.name,
      unitName: payment.unitName || unit?.name,
      amount: formatSarAmount(amount),
      dueDate: formatDate(paymentDueDate(payment)),
      isOverdue: true,
    });
    setWhatsappPreview({ phone: tenantPhone, message });
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

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted p-1">
            <TabsTrigger value="units" className="rounded-xl py-2 text-xs font-bold">
              الوحدات
            </TabsTrigger>
            <TabsTrigger value="financial" className="rounded-xl py-2 text-xs font-bold">
              التقارير المالية
            </TabsTrigger>
            <TabsTrigger value="overdue" className="rounded-xl py-2 text-xs font-bold">
              <span>الدفعات المتأخرة</span>
              {overduePropertyPayments.length > 0 && (
                <span className="mr-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
                  {overduePropertyPayments.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="mt-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-2 rounded-3xl border border-border bg-card p-4 text-sm">
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

        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">التقرير المالي الشهري للعقار</h2>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={prevMonth}>السابق</Button>
              <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={nextMonth}>التالي</Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value || monthKey(new Date()))}
              className="h-10 rounded-xl border border-input bg-background px-3 text-xs"
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PaymentStatus | "all")}>
              <SelectTrigger className="rounded-xl bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {(["paid", "unpaid", "overdue", "partial"] as PaymentStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>{PAYMENT_STATUS_LABELS[status]}</SelectItem>
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
          </div>
          <p className="text-[11px] text-muted-foreground">
            أي دفعة تستحق يوم 25 أو بعده تُحسب ضمن تقرير الشهر التالي حتى لا تتكرر بين شهرين.
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">إجمالي المستحق</p><p className="font-bold">{formatMoney(totalDueRent)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">إجمالي المحصل</p><p className="font-bold text-emerald-700">{formatMoney(totalCollectedRent)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">غير محصل</p><p className="font-bold text-red-700">{formatMoney(totalUncollectedRent)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">نسبة التحصيل</p><p className="font-bold">{monthlyCollectionRate}%</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">رسوم المكتب المستحقة</p><p className="font-bold">{formatMoney(officeFeesDue)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">رسوم المكتب المحصلة</p><p className="font-bold text-emerald-700">{formatMoney(officeFeesCollected)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">رسوم المكتب غير المحصلة</p><p className="font-bold text-orange-700">{formatMoney(officeFeesUncollected)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">مدفوع عبر إيجار</p><p className="font-bold">{formatMoney(ejarPaymentsTotal)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">تكاليف الصيانة</p><p className="font-bold text-amber-700">{formatMoney(maintenanceMonthlyCost)}</p></div>
            <div className="rounded-2xl bg-muted p-3"><p className="text-muted-foreground">صافي دخل المالك</p><p className="font-bold text-primary">{formatMoney(monthlyNetOwnerIncome)}</p></div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
            <div className="rounded-2xl border border-border p-2"><p className="font-bold text-emerald-700">{paidPaymentsCount}</p><p className="text-muted-foreground">مدفوعة</p></div>
            <div className="rounded-2xl border border-border p-2"><p className="font-bold text-red-700">{unpaidPaymentsCount}</p><p className="text-muted-foreground">غير مدفوعة</p></div>
            <div className="rounded-2xl border border-border p-2"><p className="font-bold text-orange-700">{overduePaymentsCount}</p><p className="text-muted-foreground">متأخرة</p></div>
            <div className="rounded-2xl border border-border p-2"><p className="font-bold text-primary">{ejarPaymentsCount}</p><p className="text-muted-foreground">إيجار</p></div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold">دفعات الشهر</h3>
            {filteredMonthlyPayments.length === 0 ? (
              <p className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">لا توجد دفعات مطابقة لهذا الشهر داخل هذا العقار.</p>
            ) : (
              filteredMonthlyPayments.map((payment) => {
                const paymentUnit = units.find((unit) => unit.id === payment.unitId);
                const status = effectiveStatus(payment) as PaymentStatus | "vacant";
                const hasCollectedRent = status === "paid" || status === "partial" || (payment.paidAmount ?? 0) > 0;
                const receiveMethod = hasCollectedRent && payment.receiveMethod ? getPaymentReceiveMethod(payment) : undefined;
                const statusLabel = status === "vacant" ? "شاغرة" : PAYMENT_STATUS_LABELS[status];
                return (
                  <Link key={payment.id} to={`/units/${payment.unitId}`} className="block rounded-2xl border border-border p-3 text-xs transition-transform active:scale-[0.98]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold">{paymentUnit?.name || payment.unitName || "وحدة محذوفة"}</p>
                        {status === "vacant" ? (
                          <p className="mt-1 text-muted-foreground">لا يوجد عقد نشط داخل هذا الشهر</p>
                        ) : (
                          <>
                            <p className="mt-1 text-muted-foreground">موعد السداد: {formatDate(paymentDueDate(payment))}</p>
                            {receiveMethod && (
                              <p className="mt-1 text-muted-foreground">طريقة الاستلام: {PAYMENT_RECEIVE_METHOD_LABELS[receiveMethod]}</p>
                            )}
                            {hasCollectedRent && (
                              <p className={payment.collectionFeeStatus === "uncollected" ? "mt-1 text-orange-700" : "mt-1 text-muted-foreground"}>
                                رسوم المكتب: {formatMoney(payment.collectionFeeAmount ?? 0)} - {COLLECTION_FEE_STATUS_LABELS[payment.collectionFeeStatus ?? "uncollected"]}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="shrink-0 text-left">
                        <StatusBadge status={status} label={statusLabel} />
                        <p className="mt-2 font-bold text-primary">{formatMoney(payment.grossAmount ?? payment.amount)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

          </TabsContent>

          <TabsContent value="overdue" className="mt-4 space-y-3">
            {overduePropertyPayments.length === 0 ? (
              <EmptyState icon={CalendarClock} title="لا توجد دفعات متأخرة" description="جميع دفعات هذا العقار محصلة أو لم يحن موعدها بعد" />
            ) : (
              overduePropertyPayments.map((payment) => {
                const unit = units.find((item) => item.id === payment.unitId);
                const tenant = data.tenants.find((item) => item.id === payment.tenantId || item.unitId === payment.unitId);
                const dueDate = paymentDueDate(payment);
                const dueAmount = payment.grossAmount ?? payment.amount;
                const paidAmount = payment.paidAmount ?? 0;
                const remainingAmount = getRemainingPaymentAmount(payment);
                const overdueDays = Math.abs(daysUntil(dueDate));
                const receiveMethod = paidAmount > 0 && payment.receiveMethod ? getPaymentReceiveMethod(payment) : undefined;
                return (
                  <div key={payment.id} className="rounded-3xl border border-border bg-card p-4 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold">{tenant?.name || payment.tenantName || "مستأجر غير محدد"}</p>
                        <p className="mt-1 text-muted-foreground">{unit?.name || payment.unitName || "وحدة غير محددة"}</p>
                        <p className="mt-1 text-muted-foreground">موعد السداد: {formatDate(dueDate)} - متأخرة {overdueDays} يوم</p>
                        {receiveMethod && (
                          <p className="mt-1 text-muted-foreground">طريقة الاستلام: {PAYMENT_RECEIVE_METHOD_LABELS[receiveMethod]}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-left">
                        <StatusBadge status="overdue" label={PAYMENT_STATUS_LABELS.overdue} />
                        <p className="mt-2 font-bold text-red-700">{formatMoney(remainingAmount)}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-muted p-2"><p className="text-muted-foreground">المستحق</p><p className="font-bold">{formatMoney(dueAmount)}</p></div>
                      <div className="rounded-2xl bg-muted p-2"><p className="text-muted-foreground">المدفوع</p><p className="font-bold text-emerald-700">{formatMoney(paidAmount)}</p></div>
                      <div className="rounded-2xl bg-muted p-2"><p className="text-muted-foreground">المتبقي</p><p className="font-bold text-red-700">{formatMoney(remainingAmount)}</p></div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 rounded-full text-xs" onClick={() => openPaymentWhatsapp(payment)}>
                        <MessageCircle className="ml-1 h-4 w-4" /> واتساب
                      </Button>
                      <Button size="sm" className="flex-1 rounded-full text-xs" onClick={() => navigate(`/units/${payment.unitId}`)}>
                        <CheckCircle2 className="ml-1 h-4 w-4" /> تسجيل استلام
                      </Button>
                    </div>
                  </div>
                );
              })
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
          units.map((u) => {
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
          })
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