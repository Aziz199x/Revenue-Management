import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Search, CheckCircle2, Mail, MessageCircle, Pencil, Trash2 } from "lucide-react";
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
import EmailPreview from "@/components/shared/EmailPreview";
import MaintenanceExpenseItemsEditor from "@/components/shared/MaintenanceExpenseItemsEditor";
import {
  createMaintenanceExpenseItemDraft,
  hasInvalidMaintenanceExpenseItems,
  MaintenanceExpenseItemDraft,
  normalizeMaintenanceExpenseItems,
} from "@/data/maintenanceExpenseItems";
import { genId, useStore } from "@/data/store";
import { isCorruptedArabic } from "@/utils/ejarParser";
import { formatMoney, formatDate, effectiveStatus, daysUntil, getPaymentAmount, formatSarAmount, getVisiblePaymentsByContract, getResolvedCollectionFeePercent, getPaymentCollectionFeePercent, normalizePaymentFinancials, getPaymentReceiveMethod, calculateNetAmountToTransferToOwner, EJAR_COLLECTION_FEE_REASON, getPaymentMaintenanceDeductionAmount, getPaymentMaintenanceDeductions, getCollectionFeeRemainingAmount, getCollectionFeeSettledAmount, getPaymentReportMonth, shouldAutoTransferEjarPayment, getPaymentLessorCapacity, findPotentialDuplicateReceivedPayments, findEarlierUnreceivedPayments, getRemainingPaymentAmount } from "@/data/helpers";
import { COLLECTION_FEE_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_RECEIVE_METHOD_LABELS } from "@/data/labels";
import { PaymentStatus, PaymentMethod, Payment, PaymentReceiveMethod } from "@/data/types";
import { buildPaymentReminderMessage } from "@/utils/whatsapp";
import { showSuccess, showError } from "@/utils/toast";
import { getOwnerTransferAllocations } from "@/data/buildingOwnership";
import { buildPaymentEmailContent, getTenantEmailAddresses } from "@/utils/automaticCommunications";

const PAYMENT_FILTERS_KEY = "payments_filters";

const defaultPaymentFilters = {
  buildingId: "all",
  status: "all",
  month: "all",
  search: "",
};

function paymentSortDate(payment: Payment): string {
  return payment.dueDateGregorian || payment.nextDueDate || payment.paymentDate;
}

function paymentNotesWithoutGeneratedMaintenance(payment: Payment): string {
  return (payment.notes || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("تم خصم صيانة بقيمة"))
    .join("\n")
    .trim();
}

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
  const [settleWithBuildingMaintenance, setSettleWithBuildingMaintenance] = useState(false);
  const [maintenanceExpenseItems, setMaintenanceExpenseItems] = useState<MaintenanceExpenseItemDraft[]>([]);
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
  const [emailPreview, setEmailPreview] = useState<{
    recipients: string[];
    subject: string;
    body: string;
    tenantId?: string;
    paymentId: string;
    contractId?: string;
    kind: "paymentReminder" | "overduePayment";
  } | null>(null);

  const deletePayment = (payment: Payment) => {
    const reportMonth = getPaymentReportMonth(payment, data.settings.reportMonthCutoffDay);
    if (data.financialMonthClosures.some((closure) => closure.yearMonth === reportMonth)) {
      showError("لا يمكن حذف دفعة من شهر مالي مقفل. افتح الدفعة وعدّلها مع كتابة سبب التسوية.");
      return;
    }
    const reason = window.prompt("اكتب سبب حذف الدفعة ليُحفظ في سجل التدقيق:");
    if (!reason?.trim()) {
      showError("لا يمكن حذف عملية مالية دون كتابة السبب");
      return;
    }
    update((prev) => ({
      ...prev,
      payments: prev.payments.filter((item) => item.id !== payment.id),
    }), { reason: reason.trim() });
    showSuccess("تم حذف الدفعة");
  };

  function updateFilters(partial: Record<string, string>) {
    setFilters((prev) => {
      const next = { ...prev, ...partial };
      console.log("[Payments Filters] updated:", next);
      savePaymentFilters(next);
      return next;
    });
  }

  const months = useMemo(() => {
    const set = new Set(data.payments.map((p) => getPaymentReportMonth(p, data.settings.reportMonthCutoffDay)));
    return [...set].sort().reverse();
  }, [data.payments, data.settings.reportMonthCutoffDay]);

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
        if (filters.month !== "all" && getPaymentReportMonth(r.payment, data.settings.reportMonthCutoffDay) !== filters.month) return false;
        if (filters.search.trim()) {
          const q = filters.search.trim();
          const hay = `${r.unit?.name ?? ""} ${r.building?.name ?? ""} ${r.tenant?.name ?? ""}`;
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateCompare = paymentSortDate(a.payment).localeCompare(paymentSortDate(b.payment));
        if (dateCompare !== 0) return dateCompare;
        return (a.unit?.name || "").localeCompare(b.unit?.name || "", "ar");
      });
    console.log("[Payments] raw filtered payments:", data.payments.length);
    console.log("[Payments] visible payments:", filteredRows.length);
    console.log("[Payments] selected status filter:", filters.status);
    return filteredRows;
  }, [data, filters, safeBuildingFilter, showAllPayments]);

  const upcoming = rows.filter(
    (r) =>
      r.payment.status !== "paid" &&
      r.payment.nextDueDate &&
      daysUntil(r.payment.nextDueDate) >= 0 &&
      daysUntil(r.payment.nextDueDate) <= 30,
  );
  const overdue = rows.filter((r) => r.status === "overdue");
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
    if (!markReceived) return [];
    const sourceUnit = data.units.find((unit) => unit.id === markReceived.unitId);
    if (!sourceUnit) return [];
    const propertyUnitIds = new Set(data.units.filter((unit) => unit.buildingId === sourceUnit.buildingId).map((unit) => unit.id));
    return data.payments
      .map((payment) => normalizePaymentFinancials(payment))
      .filter((payment) =>
        payment.id !== markReceived.id
        && !payment.deletedAt
        && propertyUnitIds.has(payment.unitId)
        && getPaymentReceiveMethod(payment) === "ejar_platform"
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
  }, [data, markReceived]);
  const selectedOfficeFeeSettlementTotal = Object.values(selectedFeeSettlementAmounts)
    .reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const selectedMaintenanceTotal = data.repairs
    .filter((repair) => selectedRepairIds.includes(repair.id))
    .reduce((sum, repair) => sum + repair.cost, 0);
  const markReceivedFeeAmount = markReceived ? Math.round(markReceived.amount * mrFeePercent) / 100 : 0;
  const ownerDeductibleFee = mrMethod === "ejar_platform" ? 0 : markReceivedFeeAmount;
  const normalizedMaintenanceExpenseItems = settleWithBuildingMaintenance
    ? normalizeMaintenanceExpenseItems(maintenanceExpenseItems)
    : [];
  const manualMaintenanceSettlement = normalizedMaintenanceExpenseItems
    .reduce((sum, item) => sum + item.cost, 0);
  const markReceivedSource = markReceived
    ? data.payments.find((payment) => payment.id === markReceived.id)
    : undefined;
  const earlierOutstandingPayments = markReceivedSource
    ? findEarlierUnreceivedPayments(data, markReceivedSource)
    : [];

  const handleMarkReceived = () => {
    if (!markReceived) return;
    const sourcePayment = data.payments.find((payment) => payment.id === markReceived.id);
    if (!sourcePayment) return;
    const duplicate = findPotentialDuplicateReceivedPayments(data, normalizePaymentFinancials({
      ...sourcePayment,
      status: "paid",
      receivedDate: mrDate,
      receivedAmount: markReceived.amount,
      receiveMethod: mrMethod,
    }))[0];
    if (duplicate) {
      showError(`تم تسجيل استلام مماثل لنفس الوحدة والشهر والمبلغ${duplicate.receivedDate ? ` بتاريخ ${formatDate(duplicate.receivedDate)}` : ""}. راجع الدفعة المكررة أولًا.`);
      return;
    }
    if (earlierOutstandingPayments.length > 0) {
      const oldest = earlierOutstandingPayments[0];
      const shouldContinue = window.confirm(
        `يوجد خطأ محتمل في تسلسل الدفعات: ${earlierOutstandingPayments.length} دفعة أقدم لم تُستلم.\n`
        + `أقدمها بتاريخ ${formatDate(oldest.dueDateGregorian || oldest.nextDueDate || oldest.paymentDate)}`
        + ` والمتبقي ${formatMoney(getRemainingPaymentAmount(oldest))}.\n\nهل تريد متابعة استلام الدفعة الحالية؟`,
      );
      if (!shouldContinue) return;
    }
    if (settleWithBuildingMaintenance && hasInvalidMaintenanceExpenseItems(maintenanceExpenseItems)) {
      showError("أدخل وصفًا وتكلفة صحيحة لكل بند صيانة");
      return;
    }
    const gross = markReceived.amount;
    const fee = Math.round(gross * mrFeePercent) / 100;
    const selectedRepairs = data.repairs.filter((repair) => selectedRepairIds.includes(repair.id) && !repair.isDeductedFromOwnerTransfer);
    const linkedMaintenance = selectedRepairs.reduce((sum, repair) => sum + repair.cost, 0);
    const deductibleFee = mrMethod === "ejar_platform" ? 0 : fee;
    const manualMaintenance = normalizedMaintenanceExpenseItems
      .reduce((sum, item) => sum + item.cost, 0);
    const maintenance = linkedMaintenance + manualMaintenance;
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
    if (deductibleFee + settlementTotal + maintenance > gross) {
      showError("مجموع رسوم التحصيل والصيانة المختارة لا يمكن أن يتجاوز مبلغ الدفعة الحالية");
      return;
    }
    const remainingForOwner = Math.max(0, Math.round((
      gross - deductibleFee - settlementTotal - maintenance
    ) * 100) / 100);
    const fullySettledByMaintenance = settleWithBuildingMaintenance
      && manualMaintenance > 0
      && remainingForOwner <= 0;
    const maintenanceExpenseSummary = normalizedMaintenanceExpenseItems
      .map((item) => `${item.description} (${formatMoney(item.cost)})`)
      .join("، ");
    update((prev) => ({
      ...prev,
      payments: prev.payments.map((p) =>
        p.id === markReceived.id
          ? (() => {
            const autoOwnerTransfer = !settleWithBuildingMaintenance
              && shouldAutoTransferEjarPayment(prev, p, mrMethod);
            return normalizePaymentFinancials({
              ...p,
              status: "paid" as PaymentStatus,
              receivedDate: mrDate,
              paymentMethod: mrMethod === "office_collection" ? undefined : mrMethod,
              receiveMethod: mrMethod,
              notes: [
                mrNotes.trim() || p.notes,
                settlementTotal > 0 ? `تم خصم مستحقات تحصيل سابقة من هذه الدفعة بمبلغ ${formatMoney(settlementTotal)} داخل نفس العقار.` : "",
                maintenance > 0 ? `تم خصم صيانة بقيمة ${formatMoney(maintenance)}: ${[
                  ...selectedRepairs.map((repair) => {
                    const repairUnit = data.units.find((item) => item.id === repair.unitId);
                    return `${repair.description} (${repairUnit?.name || "صيانة عامة للعقار"} - ${formatMoney(repair.cost)})`;
                  }),
                  maintenanceExpenseSummary,
                ].filter(Boolean).join("، ")}.` : "",
              ].filter(Boolean).join("\n"),
              grossAmount: gross,
              receivedAmount: gross,
              collectionFeePercent: mrFeePercent,
              collectionFeePercentage: mrFeePercent,
              collectionFeeAmount: fee,
              maintenanceDeductionAmount: maintenance,
              ownerTransferred: fullySettledByMaintenance || autoOwnerTransfer,
              ownerTransferDate: autoOwnerTransfer ? mrDate : null,
              ownerTransferMethod: autoOwnerTransfer ? "ejar_platform" : null,
              ownerTransferNotes: fullySettledByMaintenance
                ? `تمت تسوية صافي الدفعة بالكامل مقابل بنود صيانة المبنى بتاريخ ${mrDate}.`
                : settleWithBuildingMaintenance
                  ? `تم خصم بنود صيانة المبنى ويتبقى ${formatMoney(remainingForOwner)} للتحويل للمالك.`
                : autoOwnerTransfer ? "تحويل تلقائي عبر منصة إيجار" : "",
              ownerSettledByMaintenance: fullySettledByMaintenance,
              maintenanceSettlementNote: maintenanceExpenseSummary || undefined,
            });
          })()
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
      repairs: [
        ...prev.repairs.map((repair) => selectedRepairIds.includes(repair.id)
          ? { ...repair, isDeductedFromOwnerTransfer: true, deductedFromPaymentId: markReceived.id }
          : repair),
        ...normalizedMaintenanceExpenseItems.map((item) => ({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          buildingId: sourceUnit?.buildingId,
          description: item.description,
          repairDate: mrDate,
          cost: item.cost,
          status: "completed" as const,
          notes: `بند صيانة عام للعقار خُصم من دفعة ${sourceUnit?.name || ""}.`,
          createdAt: new Date().toISOString(),
          isDeductedFromOwnerTransfer: true,
          deductedFromPaymentId: markReceived.id,
        })),
      ],
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
    setSettleWithBuildingMaintenance(false);
    setMaintenanceExpenseItems([]);
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
    const linkedDetails = deductions.map((item) =>
      `${item.repair.description}${item.unit?.name ? ` - ${item.unit.name}` : ""}`,
    ).join("، ");
    const details = [linkedDetails, payment.maintenanceSettlementNote].filter(Boolean).join("، ");
    return {
      amount,
      details,
      items: deductions.map((item) => ({
        id: item.repair.id,
        description: item.repair.description,
        unitName: item.unit?.name || item.building?.name || "صيانة عامة للعقار",
        cost: item.repair.cost,
      })),
    };
  };

  return (
    <div>
      <PageHeader title="دفعات الإيجار" subtitle={`${data.payments.length} دفعة مسجلة`} />
      <div className="space-y-3 p-4">
        {(overdue.length > 0 || upcoming.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-red-50 p-3 text-center">
              <p className="text-lg font-bold text-red-700">{overdue.length}</p>
              <p className="text-[11px] font-semibold text-red-600">دفعات متأخرة</p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-3 text-center">
              <p className="text-lg font-bold text-amber-700">{upcoming.length}</p>
              <p className="text-[11px] font-semibold text-amber-600">تستحق خلال 30 يوم</p>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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

        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="لا توجد دفعات"
            description="سجّل الدفعات من صفحة تفاصيل الوحدة"
          />
        ) : (
          rows.map(({ payment: p, unit, building, tenant, status }) => {
            const maintenanceNote = paymentMaintenanceNote(p);
            const duplicateReceipts = findPotentialDuplicateReceivedPayments(data, p);
            const visibleNotes = paymentNotesWithoutGeneratedMaintenance(p);
            const tenantEmails = getTenantEmailAddresses(tenant);
            const paymentDetailsRoute = `/units/${encodeURIComponent(p.unitId)}?tab=payments&item=${encodeURIComponent(p.id)}`;
            const openPaymentDetails = () => navigate(paymentDetailsRoute);
            return (
            <div
              key={p.id}
              role="link"
              tabIndex={0}
              aria-label={`فتح تفاصيل دفعة ${unit?.name ?? ""}`}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("button, a, input, select, textarea, [role='button']")) return;
                openPaymentDetails();
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                event.preventDefault();
                openPaymentDetails();
              }}
              className={`flex min-w-0 cursor-pointer flex-col gap-2 overflow-hidden rounded-2xl border px-3 py-3 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] ${
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
                  )}
              </div>
              {visibleNotes && (
                <p className="min-w-0 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {visibleNotes}
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
                    <div className="col-span-2 rounded-2xl bg-amber-50 p-2 text-amber-800">
                      <p className="font-bold">تفاصيل الصيانة المخصومة: {formatMoney(maintenanceNote.amount)}</p>
                      {maintenanceNote.items.length > 0 ? (
                        <div className="mt-1 space-y-1">
                          {maintenanceNote.items.map((item) => (
                            <p key={item.id}>
                              {item.description} · الموقع: {item.unitName} · {formatMoney(item.cost)}
                            </p>
                          ))}
                        </div>
                      ) : maintenanceNote.details ? (
                        <p className="mt-1">{maintenanceNote.details}</p>
                      ) : null}
                    </div>
                  )}
                  <span className="col-span-2 font-semibold text-primary">المبلغ المطلوب تحويله: {formatMoney(calculateNetAmountToTransferToOwner(normalizePaymentFinancials({ ...p, maintenanceDeductionAmount: maintenanceNote?.amount ?? p.maintenanceDeductionAmount ?? 0 })))}</span>
                  <span className={`col-span-2 ${p.ownerTransferred ? "text-emerald-700" : "text-amber-700"}`}>
                    {p.ownerSettledByMaintenance
                      ? "تمت تسوية الصافي مقابل صيانة المبنى"
                      : p.ownerTransferred ? `تم التحويل للمالك${p.ownerTransferDate ? ` · ${formatDate(p.ownerTransferDate)}` : ""}` : "لم يتم التحويل للمالك"}
                  </span>
                  {p.ownerTransferred && !p.ownerSettledByMaintenance && getOwnerTransferAllocations(data, p).length > 1 && (
                    <div className="col-span-2 space-y-1 rounded-xl bg-emerald-50 p-2 text-[11px] text-emerald-800">
                      <p className="font-bold">توزيع التحويل على الملاك</p>
                      {getOwnerTransferAllocations(data, p).map((allocation) => (
                        <p key={allocation.ownerId}>
                          {allocation.ownerName} · {allocation.percentage}% · {formatMoney(allocation.amount)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {duplicateReceipts.length > 0 && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs font-bold text-red-700">
                  تحذير: يوجد استلام آخر بنفس الشهر والمبلغ لهذه الوحدة. راجع السجل المكرر.
                </p>
              )}

              {(status === "unpaid" || status === "overdue") && (
                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                  <Button
                    size="sm"
                    className="h-auto min-h-8 max-w-full shrink-0 whitespace-normal rounded-full bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                    onClick={() =>
                      {
                        setMrFeePercent(getPaymentCollectionFeePercent(p, building, unit));
                        setSelectedRepairIds([]);
                        setSelectedFeeSettlementAmounts({});
                        setSettleWithBuildingMaintenance(false);
                        setMaintenanceExpenseItems([]);
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
                  {tenantEmails.length > 0 && (
                    <button
                      type="button"
                      className="flex min-h-8 max-w-full shrink-0 items-center gap-1 whitespace-normal rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-transform active:scale-95"
                      onClick={() => {
                        const content = buildPaymentEmailContent(data, p, tenant);
                        setEmailPreview({
                          recipients: tenantEmails,
                          subject: content.subject,
                          body: content.body,
                          tenantId: tenant?.id,
                          paymentId: p.id,
                          contractId: p.contractId,
                          kind: content.kind,
                        });
                      }}
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      بريد
                    </button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="تعديل الدفعة" onClick={openPaymentDetails}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" aria-label="حذف الدفعة" onClick={() => deletePayment(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
              {status === "paid" && !p.ownerTransferred && (
                <div className="flex items-center gap-1.5 border-t border-border/70 pt-2">
                  <Button size="sm" className="h-8 rounded-full text-xs" onClick={() => setOwnerTransfer(p)}>تحويل للمالك</Button>
                  {p.collectionFeeStatus === "uncollected" && (
                    <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => setFeeSettlement(p)}>تسوية رسوم المكتب</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="تعديل الدفعة" onClick={openPaymentDetails}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" aria-label="حذف الدفعة" onClick={() => deletePayment(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
              {status === "paid" && p.ownerTransferred && (
                <div className="flex items-center gap-1 border-t border-border/70 pt-2">
                  <span className="ml-auto rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                    {p.ownerSettledByMaintenance ? "تمت التسوية بالصيانة" : "تم التحويل للمالك"}
                  </span>
                  {p.collectionFeeStatus === "uncollected" && (
                    <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => setFeeSettlement(p)}>تسوية رسوم المكتب</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="تعديل الدفعة" onClick={openPaymentDetails}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" aria-label="حذف الدفعة" onClick={() => deletePayment(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
          );
          })
        )}
      </div>

      {/* Mark as Received Dialog */}
      <Dialog open={!!markReceived} onOpenChange={(o) => !o && setMarkReceived(null)}>
        <DialogContent className="max-h-[88vh] max-w-[90vw] overflow-y-auto rounded-3xl dialog-safe">
          <DialogHeader className="text-right">
            <DialogTitle className="text-right">تأكيد استلام الدفعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {earlierOutstandingPayments.length > 0 && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-bold">تنبيه: يوجد خلل محتمل في تسلسل الدفعات</p>
                <p className="mt-1">
                  توجد {earlierOutstandingPayments.length} دفعة أقدم لم تُستلم. أقدمها بتاريخ{" "}
                  {formatDate(earlierOutstandingPayments[0].dueDateGregorian || earlierOutstandingPayments[0].nextDueDate || earlierOutstandingPayments[0].paymentDate)}
                  {" "}والمتبقي {formatMoney(getRemainingPaymentAmount(earlierOutstandingPayments[0]))}.
                </p>
                <p className="mt-1 font-semibold">راجع الدفعة الأقدم أو أكد المتابعة إذا كان التسجيل مقصودًا.</p>
              </div>
            )}
            {markReceived && (
              <div className="rounded-2xl bg-muted p-3 text-xs space-y-1">
                <p>المبلغ الإجمالي: {formatMoney(markReceived.amount)}</p>
                <p>نسبة رسوم التحصيل: {mrFeePercent}%</p>
                <p>رسوم التحصيل: {formatMoney(Math.round(markReceived.amount * mrFeePercent) / 100)}</p>
                <p>مستحقات تحصيل سابقة: {formatMoney(selectedOfficeFeeSettlementTotal)}</p>
                <p>خصم الصيانة: {formatMoney(selectedMaintenanceTotal + manualMaintenanceSettlement)}</p>
                <p className="font-bold">الصافي للمالك: {formatMoney(markReceived.amount - ownerDeductibleFee - selectedOfficeFeeSettlementTotal - selectedMaintenanceTotal - manualMaintenanceSettlement)}</p>
              </div>
            )}
            {eligibleOfficeFees.length > 0 && !deductOfficeFees && !settleWithBuildingMaintenance && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-bold">اقتراح ذكي لتسوية رسوم منصة إيجار</p>
                <p className="mt-1">توجد رسوم مكتب غير محصلة بقيمة {formatMoney(eligibleOfficeFees.reduce((sum, item) => sum + item.remaining, 0))} في وحدات أخرى من نفس العقار. فعّل الخيار أدناه لاختيار ما يُخصم من هذه الدفعة، وسيُوثّق الربط في الدفعتين.</p>
              </div>
            )}
            {!settleWithBuildingMaintenance && <label className="flex items-center gap-2 rounded-xl border p-2 text-xs">
              <input
                type="checkbox"
                checked={deductOfficeFees}
                onChange={(event) => {
                  setDeductOfficeFees(event.target.checked);
                  if (!event.target.checked) setSelectedFeeSettlementAmounts({});
                }}
              />
              <span className="font-semibold">خصم مستحقات التحصيل من هذه الدفعة</span>
            </label>}
            {deductOfficeFees && !settleWithBuildingMaintenance && (
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
                            <span className="block text-muted-foreground">شهر الدفعة: {getPaymentReportMonth(item.payment, data.settings.reportMonthCutoffDay)}</span>
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
              <div className="space-y-2 rounded-2xl border border-sky-300 bg-sky-50 p-3">
                <div>
                  <p className="text-xs font-bold text-sky-900">اقتراح خصم تكاليف الصيانة</p>
                  <p className="mt-1 text-[11px] text-sky-800">اختر مصروفات الصيانة غير المخصومة من نفس العقار. هذا الاقتراح مستقل عن تسوية رسوم التحصيل.</p>
                </div>
                {eligibleRepairs.map((repair) => {
                  const repairUnit = data.units.find((unit) => unit.id === repair.unitId);
                  return (
                    <label key={repair.id} className="flex items-start gap-2 rounded-xl bg-white/70 p-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedRepairIds.includes(repair.id)}
                        onChange={(event) => setSelectedRepairIds((ids) =>
                          event.target.checked ? [...ids, repair.id] : ids.filter((id) => id !== repair.id),
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{repair.description}</span>
                        <span className="text-muted-foreground">{repairUnit?.name || "صيانة العقار"} · {formatDate(repair.repairDate)}</span>
                      </span>
                      <span className="shrink-0 font-bold text-sky-800">{formatMoney(repair.cost)}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="space-y-2 rounded-2xl border border-violet-300 bg-violet-50 p-3 text-xs">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={settleWithBuildingMaintenance}
                  onChange={(event) => {
                    setSettleWithBuildingMaintenance(event.target.checked);
                    if (event.target.checked) {
                      setDeductOfficeFees(false);
                      setSelectedFeeSettlementAmounts({});
                    }
                    setMaintenanceExpenseItems(event.target.checked ? [createMaintenanceExpenseItemDraft()] : []);
                  }}
                />
                <span>
                  <span className="block font-bold text-violet-900">خصم بنود صيانة يدوية من الدفعة</span>
                  <span className="mt-1 block text-violet-800">أضف وصف وتكلفة كل بند؛ سيُخصم إجمالي البنود فقط ويبقى الباقي للتحويل للمالك.</span>
                </span>
              </label>
              {settleWithBuildingMaintenance && (
                <MaintenanceExpenseItemsEditor
                  items={maintenanceExpenseItems}
                  onChange={setMaintenanceExpenseItems}
                />
              )}
            </div>
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
            {markReceived && mrMethod === "ejar_platform" && (
              <div className={`rounded-2xl border p-3 text-xs ${
                getPaymentLessorCapacity(data, data.payments.find((payment) => payment.id === markReceived.id) || {
                  unitId: markReceived.unitId,
                  paymentDate: mrDate,
                }) === "owner"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                {getPaymentLessorCapacity(data, data.payments.find((payment) => payment.id === markReceived.id) || {
                  unitId: markReceived.unitId,
                  paymentDate: mrDate,
                }) === "owner"
                  ? "سيتم تسجيل التحويل للمالك تلقائيًا بتاريخ الاستلام لأن صفة المؤجر «مالك العقار»."
                  : "صفة المؤجر «ممثل المالك»، لذلك يلزم تسجيل التحويل للمالك يدويًا."}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={mrNotes} onChange={(e) => setMrNotes(e.target.value)} className="rounded-xl" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setMarkReceived(null)}>
                إلغاء
              </Button>
              <Button
                className="flex-1 rounded-xl"
                disabled={(settleWithBuildingMaintenance && hasInvalidMaintenanceExpenseItems(maintenanceExpenseItems))
                  || ownerDeductibleFee + selectedOfficeFeeSettlementTotal + selectedMaintenanceTotal + manualMaintenanceSettlement > (markReceived?.amount ?? 0)}
                onClick={handleMarkReceived}
              >
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
            {getOwnerTransferAllocations(data, {
              ...ownerTransfer,
              ownerTransferred: true,
              ownerTransferDate: transferDate,
              ownerTransferMethod: transferMethod,
              ownerTransferAllocations: undefined,
              maintenanceDeductionAmount: getPaymentMaintenanceDeductionAmount(data, ownerTransfer),
            }).length > 1 && (
              <div className="space-y-1 rounded-2xl border border-primary/20 bg-secondary/60 p-3 text-xs">
                <p className="font-bold">سيُوزع التحويل كالتالي:</p>
                {getOwnerTransferAllocations(data, {
                  ...ownerTransfer,
                  ownerTransferred: true,
                  ownerTransferDate: transferDate,
                  ownerTransferMethod: transferMethod,
                  ownerTransferAllocations: undefined,
                  maintenanceDeductionAmount: getPaymentMaintenanceDeductionAmount(data, ownerTransfer),
                }).map((allocation) => (
                  <div key={allocation.ownerId} className="flex items-center justify-between gap-2">
                    <span>{allocation.ownerName} ({allocation.percentage}%)</span>
                    <span className="font-bold">{formatMoney(allocation.amount)}</span>
                  </div>
                ))}
              </div>
            )}
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
      {emailPreview && (
        <EmailPreview
          open={!!emailPreview}
          onOpenChange={(open) => !open && setEmailPreview(null)}
          recipients={emailPreview.recipients}
          subject={emailPreview.subject}
          body={emailPreview.body}
          provider={data.settings.automaticCommunications.emailProvider}
          onSent={(recipients) => {
            const sentAt = new Date().toISOString();
            update((prev) => ({
              ...prev,
              communicationLogs: [
                ...prev.communicationLogs,
                ...recipients.map((recipient) => ({
                  id: genId(),
                  createdAt: sentAt,
                  sentAt,
                  channel: "email" as const,
                  status: "sent" as const,
                  recipient,
                  tenantId: emailPreview.tenantId,
                  paymentId: emailPreview.paymentId,
                  contractId: emailPreview.contractId,
                  templateKind: emailPreview.kind,
                  provider: data.settings.automaticCommunications.emailProvider || "gmail",
                  subject: emailPreview.subject,
                  dedupeKey: `manual:${emailPreview.paymentId}:${recipient}:${sentAt}`,
                })),
              ],
            }));
          }}
        />
      )}
    </div>
  );
}
