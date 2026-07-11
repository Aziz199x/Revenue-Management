import { useMemo, useState } from "react";
<<<<<<< HEAD
import { useNavigate } from "react-router-dom";
import { Wallet, Search, CheckCircle2, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import WhatsappPreview from "@/components/shared/WhatsappPreview";
import { useStore } from "@/data/store";
import { isCorruptedArabic } from "@/utils/ejarParser";
import { formatMoney, formatDate, effectiveStatus, daysUntil, getPaymentAmount, formatSarAmount, getVisiblePaymentsByContract, getResolvedCollectionFeePercent, normalizePaymentFinancials, getPaymentReceiveMethod, calculateNetAmountToTransferToOwner, EJAR_COLLECTION_FEE_REASON, getPaymentMaintenanceDeductionAmount, getPaymentMaintenanceDeductions, getCollectionFeeRemainingAmount, getCollectionFeeSettledAmount, getPaymentReportMonth } from "@/data/helpers";
import { COLLECTION_FEE_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_RECEIVE_METHOD_LABELS } from "@/data/labels";
import { PaymentStatus, PaymentMethod, Payment, PaymentReceiveMethod } from "@/data/types";
import { buildPaymentReminderMessage } from "@/utils/whatsapp";
import { showSuccess, showError } from "@/utils/toast";

const PAYMENT_FILTERS_KEY = "payments_filters";

const defaultPaymentFilters = {
  buildingId: "all",
  status: "all",
  month: "all",
  search: "",
};

function loadPaymentFilters() {
  try {
    const saved = localStorage.getItem(PAYMENT_FILTERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log("[Payments Filters] loaded:", parsed);
      return { ...defaultPaymentFilters, ...parsed };
    }
  } catch {
    console.warn("[Payments Filters] failed to load, using defaults");
  }
  return { ...defaultPaymentFilters };
}

function savePaymentFilters(filters: typeof defaultPaymentFilters) {
  try {
    localStorage.setItem(PAYMENT_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    console.warn("[Payments Filters] failed to save");
  }
}

export default function Payments() {
  const { data, update } = useStore();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(loadPaymentFilters);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [markReceived, setMarkReceived] = useState<{
    id: string;
    amount: number;
    unitId: string;
  } | null>(null);

  const [mrDate, setMrDate] = useState(new Date().toISOString().slice(0, 10));
  const [mrMethod, setMrMethod] = useState<PaymentReceiveMethod>("bank_transfer");
  const [mrNotes, setMrNotes] = useState("");
  const [mrFeePercent, setMrFeePercent] = useState(0);
  const [selectedRepairIds, setSelectedRepairIds] = useState<string[]>([]);
  const [deductOfficeFees, setDeductOfficeFees] = useState(false);
  const [selectedFeeSettlementAmounts, setSelectedFeeSettlementAmounts] = useState<Record<string, number>>({});
  const [ownerTransfer, setOwnerTransfer] = useState<Payment | null>(null);
  const [feeSettlement, setFeeSettlement] = useState<Payment | null>(null);
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0, 10));
  const [settlementMethod, setSettlementMethod] = useState<PaymentMethod>("bank_transfer");
  const [settlementNote, setSettlementNote] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferMethod, setTransferMethod] = useState<PaymentMethod>("bank_transfer");
  const [transferNotes, setTransferNotes] = useState("");
  const [whatsappPreview, setWhatsappPreview] = useState<{ phone: string; message: string } | null>(null);

  function updateFilters(partial: Record<string, string>) {
    setFilters((prev) => {
      const next = { ...prev, ...partial };
      console.log("[Payments Filters] updated:", next);
      savePaymentFilters(next);
      return next;
    });
  }

  const months = useMemo(() => {
    const set = new Set(data.payments.map((p) => getPaymentReportMonth(p)));
=======
import { Link } from "react-router-dom";
import { Wallet, Search, CheckCircle2, MessageCircle, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import ReceivePaymentDialog from "@/components/shared/ReceivePaymentDialog";
import { useStore } from "@/data/store";
import { formatMoney, formatDate, effectiveStatus, daysUntil, calculateOwnerNet, todayISO } from "@/data/helpers";
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/data/labels";
import { Payment, PaymentStatus } from "@/data/types";
import { showSuccess } from "@/utils/toast";
import { buildWhatsappMessage, sendWhatsapp } from "@/utils/whatsapp";

export default function Payments() {
  const { data, update } = useStore();
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [transferFilter, setTransferFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [receivePayment, setReceivePayment] = useState<Payment | null>(null);
  const [editNotes, setEditNotes] = useState<Payment | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const months = useMemo(() => {
    const set = new Set(data.payments.map((p) => p.dueDate.slice(0, 7)));
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
    return [...set].sort().reverse();
  }, [data.payments]);

  const computedBuildings = useMemo(() => {
    return data.buildings.map((b) => ({ id: b.id, name: b.name }));
  }, [data.buildings]);

  const safeBuildingFilter = useMemo(() => {
    if (filters.buildingId !== "all" && !computedBuildings.some((b) => b.id === filters.buildingId)) {
      return "all";
    }
    return filters.buildingId;
  }, [filters.buildingId, computedBuildings]);

  const rows = useMemo(() => {
<<<<<<< HEAD
    const effectiveBuildingFilter = safeBuildingFilter;
    const sourcePayments = getVisiblePaymentsByContract(data.payments, {
      includePaidHistory: filters.status === "paid",
      forceShowAll: showAllPayments,
      statusFilter: filters.status,
    });
    const filteredRows = sourcePayments
      .map((p) => {
        const unit = data.units.find((u) => u.id === p.unitId);
        const building = unit
          ? data.buildings.find((b) => b.id === unit.buildingId)
          : undefined;
        const tenant = data.tenants.find((t) => t.unitId === p.unitId);
        return {
          payment: p,
          unit,
          building,
          tenant: p.tenantName && !isCorruptedArabic(p.tenantName)
            ? { name: p.tenantName }
            : tenant?.name && !isCorruptedArabic(tenant.name) ? tenant : undefined,
          status: effectiveStatus(p),
        };
      })
      .filter((r) => {
        if (effectiveBuildingFilter !== "all" && r.building?.id !== effectiveBuildingFilter) return false;
        if (filters.status !== "all" && r.status !== filters.status) return false;
        if (filters.month !== "all" && getPaymentReportMonth(r.payment) !== filters.month) return false;
        if (filters.search.trim()) {
          const q = filters.search.trim();
          const hay = `${r.unit?.name ?? ""} ${r.building?.name ?? ""} ${r.tenant?.name ?? ""}`;
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.payment.paymentDate.localeCompare(a.payment.paymentDate));
    console.log("[Payments] raw filtered payments:", data.payments.length);
    console.log("[Payments] visible payments:", filteredRows.length);
    console.log("[Payments] selected status filter:", filters.status);
    return filteredRows;
  }, [data, filters, safeBuildingFilter, showAllPayments]);
=======
    return data.payments.map((p) => {
      const unit = data.units.find((u) => u.id === p.unitId);
      const building = unit ? data.buildings.find((b) => b.id === unit.buildingId) : data.buildings.find((b) => b.id === p.buildingId);
      const tenantName = p.tenantName || (unit ? data.tenants.find((t) => t.unitId === unit.id)?.name : "");
      return { payment: p, unit, building, tenantName, status: effectiveStatus(p) };
    }).filter((r) => {
      if (buildingFilter !== "all" && r.building?.id !== buildingFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (monthFilter !== "all" && !r.payment.dueDate.startsWith(monthFilter)) return false;
      if (transferFilter === "transferred" && !r.payment.transferredToOwner) return false;
      if (transferFilter === "not_transferred" && r.payment.transferredToOwner) return false;
      if (query.trim()) {
        const q = query.trim();
        const hay = `${r.unit?.name ?? ""} ${r.building?.name ?? ""} ${r.tenantName ?? ""}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => a.payment.dueDate.localeCompare(b.payment.dueDate));
  }, [data, buildingFilter, statusFilter, monthFilter, transferFilter, query]);
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

  const overdue = rows.filter((r) => r.status === "overdue");
<<<<<<< HEAD
  const eligibleRepairs = useMemo(() => {
    if (!markReceived) return [];
    const targetUnit = data.units.find((unit) => unit.id === markReceived.unitId);
    const buildingUnitIds = new Set(data.units.filter((unit) => unit.buildingId === targetUnit?.buildingId).map((unit) => unit.id));
    return data.repairs.filter((repair) =>
      (repair.unitId === markReceived.unitId || (repair.unitId ? buildingUnitIds.has(repair.unitId) : false) || repair.buildingId === targetUnit?.buildingId)
      && !repair.isDeductedFromOwnerTransfer
      && repair.status !== "cancelled");
  }, [data.repairs, data.units, markReceived]);
  const eligibleOfficeFees = useMemo(() => {
    if (!markReceived || !deductOfficeFees) return [];
    const sourceUnit = data.units.find((unit) => unit.id === markReceived.unitId);
    if (!sourceUnit) return [];
    const propertyUnitIds = new Set(data.units.filter((unit) => unit.buildingId === sourceUnit.buildingId).map((unit) => unit.id));
    return data.payments
      .map((payment) => normalizePaymentFinancials(payment))
      .filter((payment) =>
        payment.id !== markReceived.id
        && !payment.deletedAt
        && propertyUnitIds.has(payment.unitId)
        && getCollectionFeeRemainingAmount(data, payment) > 0
      )
      .map((payment) => {
        const unit = data.units.find((item) => item.id === payment.unitId);
        const tenant = data.tenants.find((item) => item.id === payment.tenantId || item.unitId === payment.unitId);
        return {
          payment,
          unit,
          tenant,
          remaining: getCollectionFeeRemainingAmount(data, payment),
          settled: getCollectionFeeSettledAmount(data, payment),
        };
      });
  }, [data, markReceived, deductOfficeFees]);
  const selectedOfficeFeeSettlementTotal = Object.values(selectedFeeSettlementAmounts)
    .reduce((sum, amount) => sum + (Number(amount) || 0), 0);

  const handleMarkReceived = () => {
    if (!markReceived) return;
    const gross = markReceived.amount;
    const fee = Math.round(gross * mrFeePercent) / 100;
    const selectedRepairs = data.repairs.filter((repair) => selectedRepairIds.includes(repair.id) && !repair.isDeductedFromOwnerTransfer);
    const maintenance = selectedRepairs.reduce((sum, repair) => sum + repair.cost, 0);
    const sourceUnit = data.units.find((unit) => unit.id === markReceived.unitId);
    const allowedTargetIds = new Set(eligibleOfficeFees.map((item) => item.payment.id));
    const selectedFeeSettlements = Object.entries(selectedFeeSettlementAmounts)
      .filter(([paymentId, amount]) => allowedTargetIds.has(paymentId) && Number(amount) > 0)
      .map(([paymentId, amount]) => {
        const item = eligibleOfficeFees.find((feeItem) => feeItem.payment.id === paymentId);
        return item ? { ...item, amount: Math.min(Number(amount), item.remaining) } : null;
      })
      .filter(Boolean) as Array<(typeof eligibleOfficeFees)[number] & { amount: number }>;
    const settlementTotal = selectedFeeSettlements.reduce((sum, item) => sum + item.amount, 0);
    if (settlementTotal > gross) {
      showError("مستحقات التحصيل المختارة لا يمكن أن تتجاوز مبلغ الدفعة الحالية");
      return;
    }
    update((prev) => ({
      ...prev,
      payments: prev.payments.map((p) =>
        p.id === markReceived.id
          ? normalizePaymentFinancials({
              ...p,
              status: "paid" as PaymentStatus,
              receivedDate: mrDate,
              paymentMethod: mrMethod === "office_collection" ? undefined : mrMethod,
              receiveMethod: mrMethod,
              notes: [
                mrNotes.trim() || p.notes,
                settlementTotal > 0 ? `تم خصم مستحقات تحصيل سابقة من هذه الدفعة بمبلغ ${formatMoney(settlementTotal)} داخل نفس العقار.` : "",
              ].filter(Boolean).join("\n"),
              grossAmount: gross,
              receivedAmount: gross,
              collectionFeePercent: mrFeePercent,
              collectionFeePercentage: mrFeePercent,
              collectionFeeAmount: fee,
              maintenanceDeductionAmount: maintenance,
              ownerTransferred: false,
            })
          : selectedFeeSettlements.some((item) => item.payment.id === p.id)
            ? (() => {
                const selected = selectedFeeSettlements.find((item) => item.payment.id === p.id)!;
                const priorSettled = getCollectionFeeSettledAmount(prev, p);
                const newSettled = Math.min((p.collectionFeeAmount ?? 0), priorSettled + selected.amount);
                const remaining = Math.max(0, Math.round(((p.collectionFeeAmount ?? 0) - newSettled) * 100) / 100);
                return {
                  ...p,
                  collectionFeeStatus: remaining <= 0 ? "settled" : "partially_settled",
                  collectionFeeSettledAmount: newSettled,
                  collectionFeeRemainingAmount: remaining,
                  collectionFeeSettledAt: remaining <= 0 ? mrDate : p.collectionFeeSettledAt,
                  collectionFeeSettlementNote: [
                    p.collectionFeeSettlementNote,
                    `تمت تسوية ${formatMoney(selected.amount)} من دفعة ${sourceUnit?.name || ""} بتاريخ ${mrDate}.`,
                  ].filter(Boolean).join("\n"),
                };
              })()
          : p,
      ),
      repairs: prev.repairs.map((repair) => selectedRepairIds.includes(repair.id)
        ? { ...repair, isDeductedFromOwnerTransfer: true, deductedFromPaymentId: markReceived.id }
        : repair),
      collectionFeeSettlements: [
        ...prev.collectionFeeSettlements,
        ...selectedFeeSettlements.map((item) => ({
          settlementId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          propertyId: sourceUnit?.buildingId || "",
          paymentId: item.payment.id,
          sourcePaymentId: markReceived.id,
          sourceUnitId: markReceived.unitId,
          targetPaymentId: item.payment.id,
          targetUnitId: item.payment.unitId,
          amount: item.amount,
          date: mrDate,
          method: mrMethod === "office_collection" ? "cash" : mrMethod,
          note: `خصم مستحقات تحصيل من دفعة أخرى داخل نفس العقار${mrNotes.trim() ? ` - ${mrNotes.trim()}` : ""}`,
          createdAt: new Date().toISOString(),
        })),
      ],
    }));
    setMarkReceived(null);
    setMrDate(new Date().toISOString().slice(0, 10));
    setMrMethod("bank_transfer");
    setMrNotes("");
    setMrFeePercent(0);
    setSelectedRepairIds([]);
    setDeductOfficeFees(false);
    setSelectedFeeSettlementAmounts({});
    showSuccess("تم تسجيل استلام الدفعة");
  };

  const handleOwnerTransfer = () => {
    if (!ownerTransfer) return;
    const maintenanceDeductionAmount = getPaymentMaintenanceDeductionAmount(data, ownerTransfer);
    update((prev) => ({ ...prev, payments: prev.payments.map((payment) => payment.id === ownerTransfer.id ? {
      ...normalizePaymentFinancials({ ...payment, maintenanceDeductionAmount }),
      ownerTransferred: true, ownerTransferDate: transferDate,
      ownerTransferMethod: transferMethod, ownerTransferNotes: transferNotes.trim(),
    } : payment) }));
    setOwnerTransfer(null);
    setTransferNotes("");
    showSuccess("تم تسجيل التحويل للمالك");
  };

  const handleFeeSettlement = () => {
    if (!feeSettlement) return;
    const amount = feeSettlement.collectionFeeAmount ?? 0;
    update((prev) => ({
      ...prev,
      payments: prev.payments.map((payment) => payment.id === feeSettlement.id ? {
        ...payment,
        collectionFeeStatus: "settled",
        collectionFeeSettledAmount: payment.collectionFeeAmount ?? 0,
        collectionFeeRemainingAmount: 0,
        collectionFeeSettledAt: settlementDate,
        collectionFeeSettlementNote: settlementNote.trim(),
      } : payment),
      collectionFeeSettlements: [
        ...prev.collectionFeeSettlements,
        {
          settlementId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          propertyId: prev.units.find((unit) => unit.id === feeSettlement.unitId)?.buildingId || "",
          paymentId: feeSettlement.id,
          targetPaymentId: feeSettlement.id,
          targetUnitId: feeSettlement.unitId,
          amount,
          date: settlementDate,
          method: settlementMethod,
          note: settlementNote.trim() || undefined,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setFeeSettlement(null);
    setSettlementDate(new Date().toISOString().slice(0, 10));
    setSettlementMethod("bank_transfer");
    setSettlementNote("");
    showSuccess("تم تسجيل تسوية رسوم التحصيل");
  };

  const handleWhatsAppPaymentReminder = (payment: {
    id: string;
    grossAmount?: number;
    amount?: number;
    rentAmount?: number;
    tenantPhone?: string;
    tenantName?: string;
    unitName?: string;
    buildingName?: string;
    paymentDate: string;
    nextDueDate?: string;
    status?: string;
  }) => {
    console.log("[WhatsApp Payment] selected payment id:", payment.id);
    console.log("[WhatsApp Payment] raw amount fields:", {
      grossAmount: payment.grossAmount,
      amount: payment.amount,
      rentAmount: payment.rentAmount,
    });

    const paymentAmount = getPaymentAmount(payment);
    const formattedAmount = formatSarAmount(paymentAmount);

    console.log("[WhatsApp Payment] final formatted amount:", formattedAmount);

    if (!paymentAmount) {
      showError("مبلغ الدفعة غير صحيح");
      return;
    }

    const tenant = data.tenants.find((t) => t.unitId === payment.unitId);
    const tenantPhone = payment.tenantPhone || tenant?.phone;

    if (!tenantPhone) {
      showError("رقم جوال المستأجر غير موجود");
      return;
    }

    const message = buildPaymentReminderMessage({
      tenantName: payment.tenantName,
      buildingName: payment.buildingName,
      unitName: payment.unitName,
      amount: formattedAmount,
      dueDate: payment.dueDateGregorian || payment.paymentDate,
      isOverdue: payment.status === "overdue",
    });

    setWhatsappPreview({ phone: tenantPhone, message });
  };

  const paymentMaintenanceNote = (payment: Payment) => {
    const deductions = getPaymentMaintenanceDeductions(data, payment.id);
    const amount = getPaymentMaintenanceDeductionAmount(data, payment);
    if (amount <= 0) return null;
    const details = deductions.map((item) =>
      `${item.repair.description}${item.unit?.name ? ` - ${item.unit.name}` : ""}`,
    ).join("، ");
    return { amount, details };
=======
  const upcoming = rows.filter((r) => r.status === "unpaid" && daysUntil(r.payment.dueDate) >= 0 && daysUntil(r.payment.dueDate) <= 30);

  const handleReceive = (payment: Payment, values: { receivedDate: string; paymentMethod: string; notes?: string }) => {
    update((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === payment.id ? { ...p, status: "paid" as const, receivedDate: values.receivedDate, paymentMethod: values.paymentMethod as any, notes: values.notes || p.notes } : p) }));
    showSuccess("تم تأكيد الاستلام");
  };

  const markUnpaid = (payment: Payment) => {
    update((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === payment.id ? { ...p, status: "unpaid" as const, receivedDate: undefined, paymentMethod: "", transferredToOwner: false } : p) }));
    showSuccess("تم التحديث");
  };

  const toggleTransfer = (payment: Payment) => {
    update((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === payment.id ? { ...p, transferredToOwner: !p.transferredToOwner, transferredDate: !p.transferredToOwner ? todayISO() : undefined } : p) }));
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
  };

  return (
    <div>
      <PageHeader title="دفعات الإيجار" subtitle={`${data.payments.length} دفعة`} action={
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setShowFilters(true)}><Filter className="h-4 w-4" /></Button>
      } />
      <div className="space-y-3 p-4">
        {(overdue.length > 0 || upcoming.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-red-50 p-3 text-center"><p className="text-lg font-bold text-red-700">{overdue.length}</p><p className="text-[11px] font-semibold text-red-600">دفعات متأخرة</p></div>
            <div className="rounded-3xl bg-amber-50 p-3 text-center"><p className="text-lg font-bold text-amber-700">{upcoming.length}</p><p className="text-[11px] font-semibold text-amber-600">تستحق قريباً</p></div>
          </div>
        )}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
<<<<<<< HEAD
          <Input
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            placeholder="بحث بالوحدة أو المستأجر..."
            className="rounded-2xl bg-card pr-9"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Select value={safeBuildingFilter} onValueChange={(v) => updateFilters({ buildingId: v })}>
            <SelectTrigger className="rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العقارات</SelectItem>
              {data.buildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => updateFilters({ status: v })}>
            <SelectTrigger className="rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.month} onValueChange={(v) => updateFilters({ month: v })}>
            <SelectTrigger className="rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الشهور</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="w-full rounded-xl text-xs" onClick={() => setShowAllPayments((current) => !current)}>
          {showAllPayments ? "إخفاء الدفعات المستقبلية" : "عرض كل الدفعات"}
        </Button>

=======
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالوحدة أو المستأجر..." className="rounded-2xl bg-card pr-9" />
        </div>
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
        {rows.length === 0 ? (
          <EmptyState icon={Wallet} title="لا توجد دفعات" description="أضف عقود إيجار لتُنشأ الدفعات تلقائياً" />
        ) : (
<<<<<<< HEAD
          rows.map(({ payment: p, unit, building, tenant, status }) => {
            const maintenanceNote = paymentMaintenanceNote(p);
            return (
            <div
              key={p.id}
              className={`flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border px-3 py-3 transition-transform active:scale-[0.98] ${
                status === "overdue" ? "border-red-200 bg-red-50/50" : "border-border bg-card"
              }`}
            >
              <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="min-w-0 flex-1 whitespace-normal text-base font-bold text-primary [overflow-wrap:anywhere]">
                  {formatMoney(p.amount)}
                </p>
                <div className="shrink-0">
                  <StatusBadge status={status} label={PAYMENT_STATUS_LABELS[status]} />
                </div>
              </div>

              <div className="w-full min-w-0 space-y-1 text-right [overflow-wrap:anywhere]">
                  <p className="min-w-0 whitespace-normal font-bold [overflow-wrap:anywhere]">{unit?.name ?? "وحدة محذوفة"}</p>
                  <p className="min-w-0 whitespace-normal text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {building?.name}
                    {tenant ? ` · ${tenant.name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    موعد السداد: {formatDate(p.dueDateGregorian || p.paymentDate)}
                  </p>
                  {p.paymentDeadlineGregorian && (
                    <p className="text-xs text-muted-foreground">
                      نهاية مهلة السداد: {formatDate(p.paymentDeadlineGregorian)}
                    </p>
                  )}
                  {status === "overdue" && <p className="text-xs font-semibold text-red-600">متأخر {Math.abs(daysUntil(p.dueDateGregorian || p.nextDueDate || p.paymentDate))} يوم</p>}
                  {p.receivedDate && (status === "paid" || status === "partial") && (
                    <p className="text-xs text-emerald-700">
                      تم الاستلام: {formatDate(p.receivedDate)}
                      {` - ${PAYMENT_RECEIVE_METHOD_LABELS[getPaymentReceiveMethod(p)]}`}
                    </p>
=======
          rows.map(({ payment: p, unit, building, tenantName, status }) => (
            <div key={p.id} className={"rounded-3xl border p-4 " + (status === "overdue" ? "border-red-200 bg-red-50/30" : "border-border bg-card")}>
              <div className="flex items-start justify-between">
                <div>
                  <Link to={unit ? `/units/${unit.id}` : "#"} className="font-bold hover:text-primary">{p.unitName || unit?.name || "وحدة محذوفة"}</Link>
                  <p className="text-xs text-muted-foreground">{p.buildingName || building?.name}{tenantName ? ` · ${tenantName}` : ""}</p>
                  <p className="mt-1 text-sm font-semibold text-primary">{formatMoney(p.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">يستحق: {formatDate(p.dueDate)}{daysUntil(p.dueDate) > 0 ? ` (بعد ${daysUntil(p.dueDate)} يوم)` : daysUntil(p.dueDate) < 0 ? " (متأخر)" : ""}</p>
                  {p.status === "paid" && p.receivedDate && <p className="text-[11px] text-emerald-700">استلام: {formatDate(p.receivedDate)} · {PAYMENT_METHOD_LABELS[p.paymentMethod || ""] || ""}</p>}
                  {p.status === "paid" && <p className="text-[11px] text-muted-foreground">صافي المالك: {formatMoney(calculateOwnerNet(p, data))}</p>}
                </div>
                <div className="text-left">
                  <StatusBadge status={status} label={PAYMENT_STATUS_LABELS[status]} />
                  {p.status === "paid" && (
                    <label className="mt-2 flex items-center gap-1 text-[10px]">
                      <Switch checked={!!p.transferredToOwner} onCheckedChange={() => toggleTransfer(p)} className="scale-75" />
                      حُوّل للمالك
                    </label>
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
                  )}
              </div>
<<<<<<< HEAD
              {p.notes && (
                <p className="min-w-0 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {p.notes}
                </p>
              )}
              {status === "paid" && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="col-span-2">طريقة الاستلام: {PAYMENT_RECEIVE_METHOD_LABELS[getPaymentReceiveMethod(p)]}</span>
                  <span className="col-span-2">رسوم التحصيل: {formatMoney(p.collectionFeeAmount ?? 0)} - {COLLECTION_FEE_STATUS_LABELS[p.collectionFeeStatus ?? "uncollected"]}</span>
                  {p.collectionFeeStatus === "uncollected" && (
                    <span className="col-span-2 text-amber-700">السبب: {p.collectionFeeReason || EJAR_COLLECTION_FEE_REASON}</span>
                  )}
                  <span>خصم الصيانة: {formatMoney(maintenanceNote?.amount ?? 0)}</span>
                  {maintenanceNote && (
                    <span className="col-span-2 rounded-2xl bg-amber-50 p-2 text-amber-700">
                      تم خصم صيانة من هذه الدفعة: {formatMoney(maintenanceNote.amount)}
                      {maintenanceNote.details ? ` - ${maintenanceNote.details}` : ""}
                    </span>
                  )}
                  <span className="col-span-2 font-semibold text-primary">المبلغ المطلوب تحويله: {formatMoney(calculateNetAmountToTransferToOwner(normalizePaymentFinancials({ ...p, maintenanceDeductionAmount: maintenanceNote?.amount ?? p.maintenanceDeductionAmount ?? 0 })))}</span>
                  <span className={`col-span-2 ${p.ownerTransferred ? "text-emerald-700" : "text-amber-700"}`}>
                    {p.ownerTransferred ? `تم التحويل للمالك${p.ownerTransferDate ? ` · ${formatDate(p.ownerTransferDate)}` : ""}` : "لم يتم التحويل للمالك"}
                  </span>
                </div>
              )}

              {(status === "unpaid" || status === "overdue") && (
                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                  <Button
                    size="sm"
                    className="h-auto min-h-8 max-w-full shrink-0 whitespace-normal rounded-full bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                    onClick={() =>
                      {
                        setMrFeePercent(p.collectionFeePercent ?? getResolvedCollectionFeePercent(building, unit));
                        setMarkReceived({
                        id: p.id,
                        amount: p.amount,
                        unitId: p.unitId,
                        });
                      }
                    }
                  >
                    <CheckCircle2 className="ml-1 h-3.5 w-3.5 shrink-0" />
                    تم الاستلام
                  </Button>
                  {(
                    <button
                      type="button"
                      className="flex min-h-8 max-w-full shrink-0 items-center gap-1 whitespace-normal rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-transform active:scale-95"
                      onClick={() => {
                        handleWhatsAppPaymentReminder({
                          id: p.id,
                          grossAmount: p.grossAmount,
                          amount: p.amount,
                          rentAmount: p.rentAmount,
                          tenantPhone: p.tenantPhone,
                          tenantName: p.tenantName || tenant?.name,
                          unitName: unit?.name || "",
                          buildingName: building?.name || "",
                          paymentDate: p.paymentDate,
                          nextDueDate: p.dueDateGregorian || p.paymentDate,
                          status: status,
                          unitId: p.unitId,
                        });
                      }}
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                      واتساب
                    </button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="تعديل الدفعة" onClick={() => navigate(`/units/${p.unitId}`)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" aria-label="حذف الدفعة" onClick={() => update((prev) => ({ ...prev, payments: prev.payments.filter((payment) => payment.id !== p.id) }))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
              {status === "paid" && !p.ownerTransferred && (
                <div className="flex items-center gap-1.5 border-t border-border/70 pt-2">
                  <Button size="sm" className="h-8 rounded-full text-xs" onClick={() => setOwnerTransfer(p)}>تحويل للمالك</Button>
                  {p.collectionFeeStatus === "uncollected" && (
                    <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => setFeeSettlement(p)}>تسوية رسوم المكتب</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="تعديل الدفعة" onClick={() => navigate(`/units/${p.unitId}`)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" aria-label="حذف الدفعة" onClick={() => update((prev) => ({ ...prev, payments: prev.payments.filter((payment) => payment.id !== p.id) }))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
              {status === "paid" && p.ownerTransferred && (
                <div className="flex items-center gap-1 border-t border-border/70 pt-2">
                  <span className="ml-auto rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">تم التحويل للمالك</span>
                  {p.collectionFeeStatus === "uncollected" && (
                    <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => setFeeSettlement(p)}>تسوية رسوم المكتب</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="تعديل الدفعة" onClick={() => navigate(`/units/${p.unitId}`)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" aria-label="حذف الدفعة" onClick={() => update((prev) => ({ ...prev, payments: prev.payments.filter((payment) => payment.id !== p.id) }))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
          );
          })
        )}
      </div>

      {/* Mark as Received Dialog */}
      <Dialog open={!!markReceived} onOpenChange={(o) => !o && setMarkReceived(null)}>
        <DialogContent className="max-w-[90vw] rounded-3xl dialog-safe">
          <DialogHeader className="text-right">
            <DialogTitle className="text-right">تأكيد استلام الدفعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {markReceived && (
              <div className="rounded-2xl bg-muted p-3 text-xs space-y-1">
                <p>المبلغ الإجمالي: {formatMoney(markReceived.amount)}</p>
                <p>نسبة رسوم التحصيل: {mrFeePercent}%</p>
                <p>رسوم التحصيل: {formatMoney(Math.round(markReceived.amount * mrFeePercent) / 100)}</p>
                <p>مستحقات تحصيل سابقة: {formatMoney(selectedOfficeFeeSettlementTotal)}</p>
                <p>خصم الصيانة: {formatMoney(data.repairs.filter((r) => selectedRepairIds.includes(r.id)).reduce((s, r) => s + r.cost, 0))}</p>
                <p className="font-bold">الصافي للمالك: {formatMoney(markReceived.amount - Math.round(markReceived.amount * mrFeePercent) / 100 - selectedOfficeFeeSettlementTotal - data.repairs.filter((r) => selectedRepairIds.includes(r.id)).reduce((s, r) => s + r.cost, 0))}</p>
              </div>
            )}
            <label className="flex items-center gap-2 rounded-xl border p-2 text-xs">
              <input
                type="checkbox"
                checked={deductOfficeFees}
                onChange={(event) => {
                  setDeductOfficeFees(event.target.checked);
                  if (!event.target.checked) setSelectedFeeSettlementAmounts({});
                }}
              />
              <span className="font-semibold">خصم مستحقات التحصيل من هذه الدفعة</span>
            </label>
            {deductOfficeFees && (
              <div className="space-y-2">
                <Label>اختيار مستحقات التحصيل</Label>
                {eligibleOfficeFees.length === 0 ? (
                  <p className="rounded-xl bg-muted p-2 text-xs text-muted-foreground">لا توجد رسوم تحصيل غير محصلة داخل نفس العقار.</p>
                ) : (
                  eligibleOfficeFees.map((item) => {
                    const selectedAmount = selectedFeeSettlementAmounts[item.payment.id] || 0;
                    return (
                      <div key={item.payment.id} className="rounded-xl border p-2 text-xs">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedAmount > 0}
                            onChange={(event) => setSelectedFeeSettlementAmounts((prev) => {
                              const next = { ...prev };
                              if (event.target.checked) next[item.payment.id] = item.remaining;
                              else delete next[item.payment.id];
                              return next;
                            })}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{item.unit?.name || item.payment.unitName || "وحدة غير محددة"} - {item.tenant?.name || item.payment.tenantName || "مستأجر غير محدد"}</span>
                            <span className="block text-muted-foreground">شهر الدفعة: {getPaymentReportMonth(item.payment)}</span>
                            <span className="block text-muted-foreground">رسوم التحصيل: {formatMoney(item.payment.collectionFeeAmount ?? 0)} - المتبقي: {formatMoney(item.remaining)}</span>
                          </span>
                        </label>
                        {selectedAmount > 0 && (
                          <Input
                            type="number"
                            min={0}
                            max={Math.min(item.remaining, markReceived?.amount || item.remaining)}
                            step="0.01"
                            value={selectedAmount}
                            onChange={(event) => {
                              const value = Math.min(item.remaining, Math.max(0, Number(event.target.value) || 0));
                              setSelectedFeeSettlementAmounts((prev) => ({ ...prev, [item.payment.id]: value }));
                            }}
                            className="mt-2 h-9 rounded-xl"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {eligibleRepairs.length > 0 && (
              <div className="space-y-2"><Label>خصم الصيانة</Label>{eligibleRepairs.map((repair) => (
                <label key={repair.id} className="flex items-center gap-2 rounded-xl border p-2 text-xs"><input type="checkbox" checked={selectedRepairIds.includes(repair.id)} onChange={(e) => setSelectedRepairIds((ids) => e.target.checked ? [...ids, repair.id] : ids.filter((id) => id !== repair.id))} /><span className="min-w-0 flex-1">{repair.description}</span><span>{formatMoney(repair.cost)}</span></label>
              ))}</div>
            )}
            <div className="space-y-1.5">
              <Label>تاريخ الاستلام *</Label>
              <Input
                type="date"
                value={mrDate}
                onChange={(e) => setMrDate(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>طريقة الدفع *</Label>
              <Select value={mrMethod} onValueChange={(v) => setMrMethod(v as PaymentReceiveMethod)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["office_collection", "bank_transfer", "cash", "ejar_platform", "other"] as PaymentReceiveMethod[]).map((k) => (
                    <SelectItem key={k} value={k}>{PAYMENT_RECEIVE_METHOD_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={mrNotes} onChange={(e) => setMrNotes(e.target.value)} className="rounded-xl" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setMarkReceived(null)}>
                إلغاء
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleMarkReceived}>
                تأكيد الاستلام
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ownerTransfer} onOpenChange={(open) => !open && setOwnerTransfer(null)}>
        <DialogContent className="max-w-[90vw] rounded-3xl dialog-safe">
          <DialogHeader><DialogTitle className="text-right">تحويل للمالك</DialogTitle></DialogHeader>
          {ownerTransfer && <div className="space-y-3 text-sm">
            <div className="space-y-1 rounded-2xl bg-muted p-3 text-xs">
              <p>الإجمالي المحصل: {formatMoney(ownerTransfer.grossAmount ?? ownerTransfer.amount)}</p>
              <p>رسوم التحصيل: {formatMoney(ownerTransfer.collectionFeeAmount ?? 0)}</p>
              <p>خصم الصيانة: {formatMoney(getPaymentMaintenanceDeductionAmount(data, ownerTransfer))}</p>
              <p className="font-bold">الصافي: {formatMoney(calculateNetAmountToTransferToOwner(normalizePaymentFinancials({ ...ownerTransfer, maintenanceDeductionAmount: getPaymentMaintenanceDeductionAmount(data, ownerTransfer) })))}</p>
            </div>
            <div><Label>تاريخ التحويل</Label><Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} /></div>
            <div><Label>طريقة التحويل</Label><Select value={transferMethod} onValueChange={(value) => setTransferMethod(value as PaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => <SelectItem key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>ملاحظات</Label><Textarea value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} /></div>
            <Button className="w-full" onClick={handleOwnerTransfer}>تأكيد التحويل</Button>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!feeSettlement} onOpenChange={(open) => !open && setFeeSettlement(null)}>
        <DialogContent className="max-w-[90vw] rounded-3xl dialog-safe">
          <DialogHeader><DialogTitle className="text-right">تسوية رسوم تحصيل المكتب</DialogTitle></DialogHeader>
          {feeSettlement && <div className="space-y-3 text-sm">
            <p className="rounded-2xl bg-muted p-3 text-xs">هل تريد تسجيل تسوية رسوم التحصيل المستحقة للمكتب؟ لن يتم تغيير حالة سداد الإيجار للمستأجر.</p>
            <p className="text-xs font-semibold">المبلغ: {formatMoney(feeSettlement.collectionFeeAmount ?? 0)}</p>
            <div><Label>تاريخ التسوية</Label><Input type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} /></div>
            <div><Label>طريقة التسوية</Label><Select value={settlementMethod} onValueChange={(value) => setSettlementMethod(value as PaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => <SelectItem key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>ملاحظة / سجل تدقيق</Label><Textarea value={settlementNote} onChange={(e) => setSettlementNote(e.target.value)} /></div>
            <Button className="w-full" onClick={handleFeeSettlement}>تأكيد التسوية</Button>
          </div>}
        </DialogContent>
      </Dialog>

      {whatsappPreview && (
        <WhatsappPreview
          open={!!whatsappPreview}
          onOpenChange={(o) => !o && setWhatsappPreview(null)}
          phone={whatsappPreview.phone}
          message={whatsappPreview.message}
          title="مراسلة المستأجر عبر واتساب"
        />
      )}
=======
              <div className="mt-2 flex flex-wrap gap-2">
                {status !== "paid" && <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => setReceivePayment(p)}><CheckCircle2 className="ml-1 h-3.5 w-3.5" /> تم الاستلام</Button>}
                {p.status === "paid" && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => markUnpaid(p)}>إلغاء الاستلام</Button>}
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => {
                  const unit = data.units.find((u) => u.id === p.unitId);
                  const tenant = data.tenants.find((t) => t.name === p.tenantName || t.unitId === p.unitId);
                  const msg = buildWhatsappMessage({ tenantName: p.tenantName || tenant?.name, phone: tenant?.phone, unitName: p.unitName || unit?.name, buildingName: p.buildingName, amount: p.amount, dueDate: p.dueDate, status: PAYMENT_STATUS_LABELS[status] });
                  sendWhatsapp(tenant?.phone, msg, data.settings.whatsappPreference === "whatsapp_business");
                }}><MessageCircle className="ml-1 h-3.5 w-3.5" /> واتساب</Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setEditNotes(p); setNotesValue(p.notes || ""); }}>ملاحظات</Button>
              </div>
            </div>
          ))
        )}
      </div>
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="bottom" className="sheet-safe-bottom max-h-[80dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader className="text-right"><SheetTitle className="text-right">الفلاتر</SheetTitle></SheetHeader>
          <div className="space-y-3 pt-4">
            <Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="rounded-xl bg-card text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل العقارات</SelectItem>{data.buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="rounded-xl bg-card text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>)}</SelectContent></Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}><SelectTrigger className="rounded-xl bg-card text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الشهور</SelectItem>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            <Select value={transferFilter} onValueChange={setTransferFilter}><SelectTrigger className="rounded-xl bg-card text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">التحويل: الكل</SelectItem><SelectItem value="transferred">تم تحويله للمالك</SelectItem><SelectItem value="not_transferred">لم يُحوّل للمالك</SelectItem></SelectContent></Select>
            <Button className="w-full rounded-xl" onClick={() => { setBuildingFilter("all"); setStatusFilter("all"); setMonthFilter("all"); setTransferFilter("all"); }}>إعادة تعيين</Button>
          </div>
        </SheetContent>
      </Sheet>
      {receivePayment && <ReceivePaymentDialog open={!!receivePayment} amount={receivePayment.amount} onOpenChange={(o) => !o && setReceivePayment(null)} onSubmit={(v) => handleReceive(receivePayment, v)} />}
      <Sheet open={!!editNotes} onOpenChange={(o) => !o && setEditNotes(null)}>
        <SheetContent side="bottom" className="sheet-safe-bottom max-h-[70dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader className="text-right"><SheetTitle className="text-right">ملاحظات الدفعة</SheetTitle></SheetHeader>
          <div className="space-y-3 pt-4">
            <div className="space-y-1.5"><Label>ملاحظات</Label><Textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} className="rounded-xl" /></div>
            <Button className="w-full rounded-xl" onClick={() => { if (editNotes) { update((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === editNotes.id ? { ...p, notes: notesValue.trim() || undefined } : p) })); } setEditNotes(null); showSuccess("تم الحفظ"); }}>حفظ</Button>
          </div>
        </SheetContent>
      </Sheet>
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
    </div>
  );
}
