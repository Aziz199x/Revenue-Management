import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Pencil,
  Trash2,
  Plus,
  User,
  Wallet,
  FileText,
  Zap,
  Wrench,
  Phone,
  Mail,
  IdCard,
  DoorOpen,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  Hash,
  Gauge,
  MessageCircle,
  MessageSquareText,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormSheet from "@/components/shared/FormSheet";
import StatusBadge from "@/components/shared/StatusBadge";
import EvidenceAttachments from "@/components/shared/EvidenceAttachments";
import UnitForm from "@/components/forms/UnitForm";
import TenantForm from "@/components/forms/TenantForm";
import PaymentForm from "@/components/forms/PaymentForm";
import ContractForm, { ContractFormValues } from "@/components/forms/ContractForm";
import BillForm from "@/components/forms/BillForm";
import RepairForm from "@/components/forms/RepairForm";
import TenantRequestForm from "@/components/forms/TenantRequestForm";
import { useStore, genId } from "@/data/store";
import {
  formatMoney,
  formatDate,
  todayISO,
  daysUntil,
  effectiveStatus,
  generatePaymentsFromContract,
  validateContractForPayments,
  regenerateUnpaidPayments,
  upsertTenant,
  getVisiblePaymentsByContract,
  getResolvedCollectionFeePercent,
  getPaymentCollectionFeePercent,
  getPaymentsPerYear,
  normalizePaymentFinancials,
  getPaymentReceiveMethod,
  calculateNetAmountToTransferToOwner,
  getPaymentMaintenanceDeductionAmount,
  getPaymentMaintenanceDeductions,
  getCollectionFeeRemainingAmount,
  getCollectionFeeSettledAmount,
  getPaymentReportMonth,
  isPaymentPaid,
  shouldAutoTransferEjarPayment,
  findPotentialDuplicateReceivedPayments,
  findEarlierUnreceivedPayments,
  getRemainingPaymentAmount,
  restoreMaintenanceDeductionsForPayment,
} from "@/data/helpers";
import { formatYearMonthLabel } from "@/reporting/dateUtils";
import {
  UNIT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  BILL_STATUS_LABELS,
  BILL_TYPE_LABELS,
  REPAIR_STATUS_LABELS,
  RENT_PERIOD_LABELS,
  PAYMENT_METHOD_LABELS,
  CONTRACT_DURATION_LABELS,
  AUTO_RENEWAL_LABEL,
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  PAYMENT_RECEIVE_METHOD_LABELS,
  COLLECTION_FEE_STATUS_LABELS,
} from "@/data/labels";
import { Payment, Contract, Bill, Repair, Tenant, PaymentMethod, PaymentReceiveMethod, PaymentStatus, ContractDurationType, TenantRequest, RequestType, RequestPriority, RequestStatus } from "@/data/types";
import { isActiveContract, normalizeId, isActiveContractForUnit } from "@/data/unitStatus";
import { getOwnerTransferAllocations } from "@/data/buildingOwnership";
function isCorruptedDisplayName(value: string | undefined): boolean {
  if (!value) return true;
  if (/[ØÙÃÂ�]|\uFFFD/.test(value)) return true;
  return false;
}
function paymentNotesWithoutGeneratedMaintenance(payment: Payment): string {
  return (payment.notes || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("تم خصم صيانة بقيمة"))
    .join("\n")
    .trim();
}
import WhatsappPreview from "@/components/shared/WhatsappPreview";
import EmailPreview from "@/components/shared/EmailPreview";
import SmsPreview from "@/components/shared/SmsPreview";
import EjarImportDialog from "@/components/shared/EjarImportDialog";
import MaintenanceExpenseItemsEditor from "@/components/shared/MaintenanceExpenseItemsEditor";
import CommunicationGraceDialog from "@/components/shared/CommunicationGraceDialog";
import {
  createMaintenanceExpenseItemDraft,
  hasInvalidMaintenanceExpenseItems,
  MaintenanceExpenseItem,
  MaintenanceExpenseItemDraft,
  normalizeMaintenanceExpenseItems,
} from "@/data/maintenanceExpenseItems";
import { validatePhone } from "@/utils/whatsapp";
import { getContractEndDate, getDaysUntilDate, hasContinuingContractForUnit, shouldShowContractExpiryReminder } from "@/data/helpers";
import { showSuccess, showError } from "@/utils/toast";
import {
  buildContractCommunicationContent,
  buildPaymentEmailContent,
  buildPaymentMessageContent,
  getTenantEmailAddresses,
  getTenantPhoneNumbers,
  getFormalTenantGreeting,
} from "@/utils/automaticCommunications";
import { useAppDialog } from "@/components/shared/AppDialogProvider";
import { getOutstandingRecurringBillRepairs, isRecurringBillRepair } from "@/data/recurringBuildingBills";

const UNIT_DETAIL_TABS = ["tenant", "payments", "contract", "requests", "bills", "repairs"];

function MarkAsReceivedDialog({
  payment,
  fallbackFeePercent,
  feeSuggestions,
  repairSuggestions,
  earlierOutstandingPayments,
  lessorCapacity,
  buildingUnits,
  onConfirm,
  onCancel,
}: {
  payment: Payment;
  fallbackFeePercent: number;
  lessorCapacity: "owner" | "representative";
  feeSuggestions: Array<{ payment: Payment; unitName: string; tenantName: string; remaining: number; monthLabel: string; dueDateLabel: string }>;
  repairSuggestions: Array<{ repair: Repair; unitName: string }>;
  earlierOutstandingPayments: Payment[];
  buildingUnits: Array<{ id: string; name: string }>;
  onConfirm: (
    receivedDate: string,
    method: PaymentReceiveMethod,
    feePercent: number,
    notes: string | undefined,
    settlements: Array<{ paymentId: string; amount: number }>,
    repairIds: string[],
    settleWithBuildingMaintenance: boolean,
    maintenanceExpenseItems: MaintenanceExpenseItem[],
  ) => void;
  onCancel: () => void;
}) {
  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentReceiveMethod>("bank_transfer");
  const [notes, setNotes] = useState("");
  const [selectedSettlements, setSelectedSettlements] = useState<Record<string, number>>({});
  const [selectedRepairIds, setSelectedRepairIds] = useState<string[]>([]);
  const [settleWithBuildingMaintenance, setSettleWithBuildingMaintenance] = useState(false);
  const [maintenanceExpenseItems, setMaintenanceExpenseItems] = useState<MaintenanceExpenseItemDraft[]>([]);

  const grossAmount = payment.grossAmount ?? payment.amount;
  // Legacy payments may not have stored a fee percentage. Reverting one of
  // those payments to unpaid must not turn the configured fee into 0%.
  const storedFeePercent = payment.collectionFeePercent ?? payment.collectionFeePercentage;
  const feePercent = storedFeePercent === undefined || (storedFeePercent === 0 && fallbackFeePercent > 0)
    ? fallbackFeePercent
    : storedFeePercent;
  const feeAmount = Math.round(grossAmount * feePercent) / 100;
  const ownerDeductibleFee = method === "ejar_platform" ? 0 : feeAmount;
  const settlementTotal = Object.values(selectedSettlements).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const maintenanceTotal = repairSuggestions
    .filter(({ repair }) => selectedRepairIds.includes(repair.id))
    .reduce((sum, { repair }) => sum + repair.cost, 0);
  const normalizedMaintenanceExpenseItems = settleWithBuildingMaintenance
    ? normalizeMaintenanceExpenseItems(maintenanceExpenseItems)
    : [];
  const manualMaintenanceSettlement = normalizedMaintenanceExpenseItems
    .reduce((sum, item) => sum + item.cost, 0);
  const totalDeductions = ownerDeductibleFee + settlementTotal + maintenanceTotal + manualMaintenanceSettlement;
  const requiresMaintenanceItems = settleWithBuildingMaintenance
    && hasInvalidMaintenanceExpenseItems(maintenanceExpenseItems);
  const recurringBillSuggestions = repairSuggestions.filter(({ repair }) => isRecurringBillRepair(repair));
  const maintenanceRepairSuggestions = repairSuggestions.filter(({ repair }) => !isRecurringBillRepair(repair));
  const selectedRecurringBillTotal = recurringBillSuggestions
    .filter(({ repair }) => selectedRepairIds.includes(repair.id))
    .reduce((sum, { repair }) => sum + repair.cost, 0);
  const selectedMaintenanceRepairTotal = maintenanceRepairSuggestions
    .filter(({ repair }) => selectedRepairIds.includes(repair.id))
    .reduce((sum, { repair }) => sum + repair.cost, 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
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
          <div className="rounded-2xl bg-muted p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">المبلغ المستلم</span>
              <span className="text-sm font-bold">{formatMoney(grossAmount)}</span>
            </div>
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">نسبة رسوم التحصيل</span>
                  <span>{feePercent}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">رسوم التحصيل</span>
                  <span className="text-red-500">-{formatMoney(feeAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">الصافي بعد رسوم التحصيل</span>
                  <span className="font-semibold">{formatMoney(grossAmount - totalDeductions)}</span>
                </div>
              </>
          </div>
          {feeSuggestions.length > 0 && !settleWithBuildingMaintenance && (
            <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs">
              <div>
                <p className="font-bold text-amber-900">اقتراح ذكي لتسوية رسوم منصة إيجار</p>
                <p className="mt-1 text-amber-800">اختر رسوم مكتب لم تُحصّل من وحدات أخرى في نفس العقار. سيُحفظ مرجع التسوية في الدفعتين.</p>
              </div>
              <div className="max-h-44 space-y-2 overflow-y-auto pl-1">
                {feeSuggestions.map((suggestion) => {
                  const selected = selectedSettlements[suggestion.payment.id] || 0;
                  return (
                    <label key={suggestion.payment.id} className="flex items-start gap-2 rounded-xl bg-white/70 p-2">
                      <input
                        type="checkbox"
                        checked={selected > 0}
                        onChange={(event) => setSelectedSettlements((current) => {
                          const next = { ...current };
                          if (event.target.checked) next[suggestion.payment.id] = Math.min(suggestion.remaining, Math.max(0, grossAmount - settlementTotal));
                          else delete next[suggestion.payment.id];
                          return next;
                        })}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{suggestion.unitName} - {suggestion.tenantName}</span>
                        <span className="block text-muted-foreground">دفعة {suggestion.monthLabel} · استحقاق {suggestion.dueDateLabel}</span>
                        <span className="text-muted-foreground">المتبقي للمكتب: {formatMoney(suggestion.remaining)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {settlementTotal > 0 && <p className="font-bold text-amber-900">إجمالي التسوية: {formatMoney(settlementTotal)}</p>}
            </div>
          )}
          {recurringBillSuggestions.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs">
              <div>
                <p className="font-bold text-amber-950">مقترحات خصم الفواتير الشهرية</p>
                <p className="mt-1 text-amber-800">اختر استحقاقات العقار المتكررة التي تريد خصمها من هذه الدفعة.</p>
              </div>
              <div className="max-h-44 space-y-2 overflow-y-auto pl-1">
                {recurringBillSuggestions.map(({ repair }) => (
                  <label key={repair.id} className="flex items-start gap-2 rounded-xl bg-white/70 p-2">
                    <input
                      type="checkbox"
                      checked={selectedRepairIds.includes(repair.id)}
                      onChange={(event) => setSelectedRepairIds((current) =>
                        event.target.checked
                          ? [...current, repair.id]
                          : current.filter((id) => id !== repair.id),
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{repair.description}</span>
                      <span className="block text-muted-foreground">الاستحقاق {formatDate(repair.repairDate)}</span>
                    </span>
                    <span className="shrink-0 font-bold text-amber-900">{formatMoney(repair.cost)}</span>
                  </label>
                ))}
              </div>
              {selectedRecurringBillTotal > 0 && (
                <p className="font-bold text-amber-950">إجمالي خصم الفواتير: {formatMoney(selectedRecurringBillTotal)}</p>
              )}
            </div>
          )}
          {maintenanceRepairSuggestions.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-sky-300 bg-sky-50 p-3 text-xs">
              <div>
                <p className="font-bold text-sky-900">اقتراح خصم تكاليف الصيانة</p>
                <p className="mt-1 text-sky-800">توجد تكاليف صيانة لم تُخصم بعد داخل العقار. اختر ما تريد خصمه من هذه الدفعة.</p>
              </div>
              <div className="max-h-44 space-y-2 overflow-y-auto pl-1">
                {maintenanceRepairSuggestions.map(({ repair, unitName }) => (
                  <label key={repair.id} className="flex items-start gap-2 rounded-xl bg-white/70 p-2">
                    <input
                      type="checkbox"
                      checked={selectedRepairIds.includes(repair.id)}
                      onChange={(event) => setSelectedRepairIds((current) =>
                        event.target.checked
                          ? [...current, repair.id]
                          : current.filter((id) => id !== repair.id),
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{repair.description}</span>
                      <span className="block text-muted-foreground">{unitName} · {formatDate(repair.repairDate)}</span>
                    </span>
                    <span className="shrink-0 font-bold text-sky-800">{formatMoney(repair.cost)}</span>
                  </label>
                ))}
              </div>
              {selectedMaintenanceRepairTotal > 0 && <p className="font-bold text-sky-900">إجمالي خصم الصيانة: {formatMoney(selectedMaintenanceRepairTotal)}</p>}
            </div>
          )}
          <div className="space-y-2 rounded-2xl border border-violet-300 bg-violet-50 p-3 text-xs">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={settleWithBuildingMaintenance}
                onChange={(event) => {
                  setSettleWithBuildingMaintenance(event.target.checked);
                  if (event.target.checked) setSelectedSettlements({});
                  setMaintenanceExpenseItems(event.target.checked ? [createMaintenanceExpenseItemDraft(payment.unitId)] : []);
                }}
              />
              <span>
                <span className="block font-bold text-violet-900">خصم بنود صيانة يدوية من الدفعة</span>
                <span className="mt-1 block text-violet-800">أضف وصف وتكلفة كل بند؛ سيُخصم إجمالي البنود فقط، ويبقى الباقي مستحقًا للتحويل للمالك. حدد الوحدة التي يخصها كل بند أو اتركه صيانة عامة للعقار.</span>
              </span>
            </label>
            {settleWithBuildingMaintenance && (
              <MaintenanceExpenseItemsEditor
                items={maintenanceExpenseItems}
                onChange={setMaintenanceExpenseItems}
                units={buildingUnits}
              />
            )}
          </div>
          {totalDeductions > grossAmount && (
            <p className="rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-700">
              مجموع الخصومات يتجاوز مبلغ الدفعة. ألغِ بعض الخيارات للمتابعة.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>تاريخ الاستلام</Label>
            <Input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>طريقة الاستلام</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentReceiveMethod)}>
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
          {method === "ejar_platform" && (
            <div className={`rounded-2xl border p-3 text-xs ${lessorCapacity === "owner" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {lessorCapacity === "owner"
                ? "سيتم تسجيل التحويل للمالك تلقائيًا بتاريخ الاستلام لأن صفة المؤجر في العقد «مالك العقار»."
                : "صفة المؤجر في العقد «ممثل المالك»، لذلك ستبقى الدفعة بانتظار تسجيل التحويل للمالك يدويًا."}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
              إلغاء
            </Button>
            <Button
              className="flex-1 rounded-xl"
              disabled={totalDeductions > grossAmount || requiresMaintenanceItems}
              onClick={() => onConfirm(
                receivedDate,
                method,
                feePercent,
                notes.trim() || undefined,
                Object.entries(selectedSettlements).map(([paymentId, amount]) => ({ paymentId, amount })),
                selectedRepairIds,
                settleWithBuildingMaintenance,
                normalizedMaintenanceExpenseItems,
              )}
            >
              تأكيد الاستلام
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UnitDetails() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, update } = useStore();
  const appDialog = useAppDialog();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    requestedTab && UNIT_DETAIL_TABS.includes(requestedTab) ? requestedTab : "tenant",
  );
  const focusedItemId = searchParams.get("item");

  const [editUnitOpen, setEditUnitOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [contractOpen, setContractOpen] = useState(false);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [evictionContract, setEvictionContract] = useState<Contract | null>(null);
  const [completeEvictionContract, setCompleteEvictionContract] = useState<Contract | null>(null);
  const [evictionCaseNumber, setEvictionCaseNumber] = useState("");
  const [evictionCaseDate, setEvictionCaseDate] = useState(todayISO());
  const [evictionCourtName, setEvictionCourtName] = useState("");
  const [evictionPlatform, setEvictionPlatform] = useState("");
  const [evictionNotes, setEvictionNotes] = useState("");
  const [billOpen, setBillOpen] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [repairOpen, setRepairOpen] = useState(false);
  const [editRepair, setEditRepair] = useState<Repair | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [editRequest, setEditRequest] = useState<TenantRequest | null>(null);
  const [markReceived, setMarkReceived] = useState<Payment | null>(null);
  const [showAllContractPayments, setShowAllContractPayments] = useState(false);
  const [showReceivedPayments, setShowReceivedPayments] = useState(false);
  const [ejarImportOpen, setEjarImportOpen] = useState(false);
  const [pendingContractUpdate, setPendingContractUpdate] = useState<{
    original: Contract;
    updated: ContractFormValues;
  } | null>(null);
  const [savingRegenerate, setSavingRegenerate] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [whatsappPreview, setWhatsappPreview] = useState<{ phones: string[]; message: string } | null>(null);
  const [smsPreview, setSmsPreview] = useState<{ phones: string[]; message: string } | null>(null);
  const [emailPreview, setEmailPreview] = useState<{
    recipients: string[];
    subject: string;
    body: string;
    tenantId?: string;
    paymentId?: string;
    contractId?: string;
    kind: "paymentReminder" | "overduePayment" | "contractExpiry";
  } | null>(null);
  const [communicationGraceTarget, setCommunicationGraceTarget] = useState<
    { kind: "payment"; value: Payment } | { kind: "contract"; value: Contract } | null
  >(null);

  useEffect(() => {
    if (requestedTab && UNIT_DETAIL_TABS.includes(requestedTab)) setActiveTab(requestedTab);
  }, [requestedTab]);

  useEffect(() => {
    if (!focusedItemId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`reminder-target-${focusedItemId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeTab, focusedItemId]);

  const unit = data.units.find((u) => u.id === unitId);
  if (!unit) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold">الوحدة غير موجودة</p>
        <Button className="mt-4 rounded-xl" onClick={() => navigate("/buildings")}>
          العودة للعقارات
        </Button>
      </div>
    );
  }

  const building = data.buildings.find((b) => b.id === unit.buildingId);
  const buildingUnitIds = new Set(data.units.filter((item) => item.buildingId === unit.buildingId).map((item) => item.id));
  const buildingUnits = data.units
    .filter((item) => item.buildingId === unit.buildingId)
    .map((item) => ({ id: item.id, name: item.name }));
  const officeFeeSuggestions = markReceived ? data.payments
    .map((payment) => normalizePaymentFinancials(payment))
    .filter((payment) => payment.id !== markReceived.id
      && !payment.deletedAt
      && buildingUnitIds.has(payment.unitId)
      && getPaymentReceiveMethod(payment) === "ejar_platform"
      && getCollectionFeeRemainingAmount(data, payment) > 0)
    .map((payment) => ({
      payment,
      unitName: data.units.find((item) => item.id === payment.unitId)?.name || payment.unitName || "وحدة غير محددة",
      tenantName: data.tenants.find((item) => item.id === payment.tenantId || item.unitId === payment.unitId)?.name || payment.tenantName || "مستأجر غير محدد",
      remaining: getCollectionFeeRemainingAmount(data, payment),
      monthLabel: formatYearMonthLabel(getPaymentReportMonth(payment, data.settings.reportMonthCutoffDay)),
      dueDateLabel: formatDate(payment.dueDateGregorian || payment.nextDueDate || payment.paymentDate),
    })) : [];
  const maintenanceSuggestions = markReceived ? [
    ...data.repairs,
    ...getOutstandingRecurringBillRepairs(data, unit.buildingId),
  ]
    .filter((repair) =>
      !repair.isDeductedFromOwnerTransfer
      && repair.status !== "cancelled"
      && (repair.buildingId === unit.buildingId || (repair.unitId ? buildingUnitIds.has(repair.unitId) : false)),
    )
    .map((repair) => ({
      repair,
      unitName: data.units.find((item) => item.id === repair.unitId)?.name || building?.name || "صيانة العقار",
    })) : [];
  const visibleTenants = data.tenants.filter((t) => {
    if (t.unitId !== unit.id) return false;
    const unitContractsForTenant = data.contracts.filter(
      (c) =>
        normalizeId(c.unitId) === normalizeId(unit.id) &&
        normalizeId(c.tenantId) === normalizeId(t.id),
    );
    if (unitContractsForTenant.length === 0) return true;
    const hasActiveContract = unitContractsForTenant.some(
      (c) =>
        !c.deletedAt &&
        c.status !== "cancelled" &&
        c.status !== "terminated" &&
        c.status !== "eviction_completed",
    );
    return hasActiveContract;
  });
  const tenant = visibleTenants[0];
  const payments = data.payments
    .filter((p) => p.unitId === unit.id)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const cleanPayments = payments.filter((payment) => !payment.deletedAt);
  const collapsedUnreceivedPayments = getVisiblePaymentsByContract(cleanPayments);
  const allUnreceivedPayments = cleanPayments.filter((payment) => !isPaymentPaid(payment));
  const receivedPayments = cleanPayments.filter((payment) => isPaymentPaid(payment));
  const pendingOwnerTransferPayments = receivedPayments.filter((payment) => !payment.ownerTransferred);
  const visiblePayments = [
    ...(showAllContractPayments ? allUnreceivedPayments : collapsedUnreceivedPayments),
    ...(showReceivedPayments ? receivedPayments : pendingOwnerTransferPayments),
  ]
    .filter((payment, index, list) => list.findIndex((item) => item.id === payment.id) === index)
    .sort((a, b) => (b.dueDateGregorian || b.nextDueDate || b.paymentDate)
      .localeCompare(a.dueDateGregorian || a.nextDueDate || a.paymentDate));
  const contracts = data.contracts
    .filter((c) => c.unitId === unit.id && !c.deletedAt)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  const currentLessorCapacity = contracts.find((contract) => isActiveContract(contract))?.lessorCapacity ?? "owner";
  const bills = data.bills
    .filter((b) => b.unitId === unit.id)
    .sort((a, b) => b.billDate.localeCompare(a.billDate));
  const repairs = data.repairs
    .filter((r) => r.unitId === unit.id)
    .sort((a, b) => b.repairDate.localeCompare(a.repairDate));
  const requests = data.tenantRequests
    .filter((r) => r.unitId === unit.id)
    .sort((a, b) => b.requestDate.localeCompare(a.requestDate));
  const earlierOutstandingPayments = markReceived
    ? findEarlierUnreceivedPayments(data, markReceived)
    : [];

  const maintenanceTotal = repairs
    .filter((r) => r.status !== "cancelled")
    .reduce((s, r) => s + r.cost, 0);

  const deleteUnit = () => {
    update((prev) => ({
      ...prev,
      units: prev.units.filter((u) => u.id !== unit.id),
      tenants: prev.tenants.filter((t) => t.unitId !== unit.id),
      payments: prev.payments.filter((p) => p.unitId !== unit.id),
      contracts: prev.contracts.filter((c) => c.unitId !== unit.id),
      bills: prev.bills.filter((b) => b.unitId !== unit.id),
      repairs: prev.repairs.filter((r) => r.unitId !== unit.id),
    }));
    showSuccess("تم حذف الوحدة");
    navigate(building ? `/buildings/${building.id}` : "/buildings");
  };

  const removeItem = async (key: "payments" | "contracts" | "bills" | "repairs" | "tenants", id: string) => {
    let auditReason: string | undefined;
    if (key === "payments") {
      const payment = data.payments.find((item) => item.id === id);
      const closedMonth = payment
        ? data.financialMonthClosures.find(
            (closure) => closure.yearMonth === getPaymentReportMonth(payment, data.settings.reportMonthCutoffDay),
          )
        : undefined;
      if (closedMonth) {
        showError("لا يمكن حذف دفعة من شهر مالي مقفل. افتح تعديل الدفعة وسجّل سبب التسوية بدل الحذف.");
        return;
      }
    }
    if (key === "payments" || key === "repairs") {
      const label = key === "payments" ? "الدفعة" : "الصيانة";
      const reason = await appDialog.prompt({
        title: `حذف ${label}`,
        description: "اكتب سبب الحذف ليُحفظ في سجل التدقيق المالي.",
        inputLabel: "سبب الحذف",
        confirmLabel: "تأكيد الحذف",
        tone: "destructive",
        required: true,
      });
      if (!reason?.trim()) {
        return;
      }
      auditReason = reason.trim();
    }
    update((prev) => ({
      ...prev,
      [key]: (prev[key] as { id: string }[]).filter((x) => x.id !== id),
    }), { reason: auditReason });
    showSuccess("تم الحذف");
  };

  const deleteContractAndCleanup = (contractId: string) => {
    console.log("[Delete Contract] clicked:", contractId);
    const contract = data.contracts.find((c) => c.id === contractId);
    if (!contract) {
      showError("العقد غير موجود");
      setContractToDelete(null);
      return;
    }
    console.log("[Delete Contract] contract before delete:", contract);

    const unitId = contract.unitId;
    const tenantId = contract.tenantId;
    const now = new Date().toISOString();

    update((prev) => {
      const tenantCleanedUp = tenantId
        ? (() => {
            const otherContractsForTenant = prev.contracts.filter(
              (c) =>
                c.id !== contractId &&
                c.tenantId === tenantId &&
                !c.deletedAt &&
                c.status !== "cancelled" &&
                c.status !== "terminated" &&
                c.status !== "eviction_completed",
            );
            const shouldDeleteTenant = otherContractsForTenant.length === 0;
            if (shouldDeleteTenant) {
              console.log("[Delete Contract] tenant deleted:", tenantId);
              return prev.tenants.filter((t) => t.id !== tenantId);
            } else {
              console.log("[Delete Contract] tenant kept because other contracts exist:", tenantId);
              return prev.tenants.map((t) =>
                t.id === tenantId
                  ? { ...t, activeContractId: otherContractsForTenant[0]?.id || undefined, updatedAt: now }
                  : t,
              );
            }
          })()
        : prev.tenants;

      return {
        ...prev,
        tenants: tenantCleanedUp,
        contracts: prev.contracts.map((c) =>
          c.id === contractId ? { ...c, deletedAt: now } : c,
        ),
        payments: prev.payments.filter((p) => p.contractId !== contractId),
        contractAttachments: prev.contractAttachments.filter(
          (a) => a.contractId !== contractId,
        ),
      };
    });

    setContractToDelete(null);
    console.log("[Delete Contract] payments deleted for contract:", contractId);
    console.log("[Delete Contract] tenant cleanup:", tenantId);
    showSuccess("تم حذف العقد والدفعات وتحديث حالة الوحدة");
  };

  return (
    <div>
      <PageHeader
        title={unit.name}
        subtitle={building ? `${building.name} · ${unit.type}` : unit.type}
        back
        backTo={building ? `/buildings/${encodeURIComponent(building.id)}` : "/buildings"}
        action={
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setEditUnitOpen(true)}>
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
                  <AlertDialogTitle>حذف الوحدة؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم حذف الوحدة وجميع بياناتها (مستأجر، دفعات، عقود، فواتير، صيانة).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row gap-2">
                  <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                  <AlertDialogAction className="rounded-xl bg-destructive" onClick={deleteUnit}>
                    حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        {/* Unit summary */}
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-secondary p-2.5">
                <DoorOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold">
                  {formatMoney(unit.rentAmount)}
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    / {RENT_PERIOD_LABELS[unit.rentPeriod]}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {unit.floor ? `طابق ${unit.floor}` : "بدون طابق"}
                </p>
              </div>
            </div>
            <StatusBadge status={unit.status} label={UNIT_STATUS_LABELS[unit.status]} />
          </div>
          {unit.notes && (
            <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">{unit.notes}</p>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          dir="rtl"
          className="min-[500px]:grid min-[500px]:grid-cols-[13rem_minmax(0,1fr)] min-[500px]:items-start min-[500px]:gap-5 min-[500px]:[direction:ltr]"
        >
          <TabsList className="grid h-auto w-full grid-cols-6 gap-0.5 overflow-hidden rounded-2xl bg-muted p-1 min-[500px]:sticky min-[500px]:top-[calc(50vh-12rem)] min-[500px]:col-start-1 min-[500px]:row-start-1 min-[500px]:flex min-[500px]:self-start min-[500px]:translate-y-0 min-[500px]:flex-col min-[500px]:gap-2 min-[500px]:overflow-visible min-[500px]:rounded-3xl min-[500px]:border min-[500px]:border-border min-[500px]:bg-card min-[500px]:p-3 min-[500px]:shadow-sm min-[500px]:[direction:rtl]">
            <TabsTrigger value="tenant" title="المستأجر" className="min-w-0 flex-col gap-1 rounded-xl px-0.5 py-2 text-[9px] min-[500px]:w-full min-[500px]:flex-row min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              <User className="h-4 w-4" /> المستأجر
            </TabsTrigger>
            <TabsTrigger value="payments" title="الدفعات" className="min-w-0 flex-col gap-1 rounded-xl px-0.5 py-2 text-[9px] min-[500px]:w-full min-[500px]:flex-row min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              <Wallet className="h-4 w-4" /> الدفعات
            </TabsTrigger>
            <TabsTrigger value="contract" title="العقد" className="min-w-0 flex-col gap-1 rounded-xl px-0.5 py-2 text-[9px] min-[500px]:w-full min-[500px]:flex-row min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              <FileText className="h-4 w-4" /> العقد
            </TabsTrigger>
            <TabsTrigger value="requests" title="الطلبات" className="min-w-0 flex-col gap-1 rounded-xl px-0.5 py-2 text-[9px] min-[500px]:w-full min-[500px]:flex-row min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              <ClipboardList className="h-4 w-4" /> الطلبات
            </TabsTrigger>
            <TabsTrigger value="bills" title="الفواتير" className="min-w-0 flex-col gap-1 rounded-xl px-0.5 py-2 text-[9px] min-[500px]:w-full min-[500px]:flex-row min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              <Zap className="h-4 w-4" /> الفواتير
            </TabsTrigger>
            <TabsTrigger value="repairs" title="الصيانة" className="min-w-0 flex-col gap-1 rounded-xl px-0.5 py-2 text-[9px] min-[500px]:w-full min-[500px]:flex-row min-[500px]:justify-start min-[500px]:px-3 min-[500px]:text-xs">
              <Wrench className="h-4 w-4" /> الصيانة
            </TabsTrigger>
          </TabsList>

          {/* Tenant */}
          <TabsContent value="tenant" className="mt-4 space-y-3 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
            {tenant ? (
              <div className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-secondary p-3">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">{tenant.name}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {tenant.tenantType === "company" ? "شركة / مؤسسة" : "فرد"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditTenant(tenant)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeItem("tenants", tenant.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  {getTenantPhoneNumbers(tenant).length > 0 && (
                    <div className="space-y-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {getTenantPhoneNumbers(tenant).map((number) => (
                        <a key={number} href={`tel:${number}`} dir="ltr" className="mr-2 inline-block text-primary underline-offset-2">
                          {number}
                        </a>
                      ))}
                    </div>
                  )}
                  {(getTenantPhoneNumbers(tenant).length > 0 || getTenantEmailAddresses(tenant).length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {getTenantPhoneNumbers(tenant).length > 0 && <button
                        type="button"
                        className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700 transition-transform active:scale-95"
                        onClick={() => {
                          const pendingPayment = [...payments]
                            .filter((payment) => ["unpaid", "overdue", "partial"].includes(effectiveStatus(payment)))
                            .sort((a, b) => (a.dueDateGregorian || a.paymentDate).localeCompare(b.dueDateGregorian || b.paymentDate))[0];
                          const msg = pendingPayment
                            ? buildPaymentMessageContent(data, pendingPayment, tenant).message
                            : `السلام عليكم، نود التواصل معكم بخصوص الوحدة ${unit.name} في عقار ${building?.name || ""}.`;
                          setWhatsappPreview({ phones: getTenantPhoneNumbers(tenant), message: msg });
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        تواصل واتساب
                      </button>}
                      {getTenantPhoneNumbers(tenant).length > 0 && (
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-semibold text-violet-700 transition-transform active:scale-95"
                          onClick={() => {
                            const pendingPayment = [...payments]
                              .filter((payment) => ["unpaid", "overdue", "partial"].includes(effectiveStatus(payment)))
                              .sort((a, b) => (a.dueDateGregorian || a.paymentDate).localeCompare(b.dueDateGregorian || b.paymentDate))[0];
                            const msg = pendingPayment
                              ? buildPaymentMessageContent(data, pendingPayment, tenant).message
                              : `السلام عليكم، نود التواصل معكم بخصوص الوحدة ${unit.name} في عقار ${building?.name || ""}.`;
                            setSmsPreview({ phones: getTenantPhoneNumbers(tenant), message: msg });
                          }}
                        >
                          <MessageSquareText className="h-3.5 w-3.5" />
                          إرسال SMS
                        </button>
                      )}
                      {getTenantEmailAddresses(tenant).length > 0 && (
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-700 transition-transform active:scale-95"
                          onClick={() => {
                            const pendingPayment = [...payments]
                              .filter((payment) => ["unpaid", "overdue", "partial"].includes(effectiveStatus(payment)))
                              .sort((a, b) => (a.dueDateGregorian || a.paymentDate).localeCompare(b.dueDateGregorian || b.paymentDate))[0];
                            const content = pendingPayment
                              ? buildPaymentEmailContent(data, pendingPayment, tenant)
                              : {
                                  kind: "paymentReminder" as const,
                                  subject: `تواصل بخصوص الوحدة ${unit.name}`,
                                  body: `${getFormalTenantGreeting(tenant)}،\n\nنود التواصل معكم بخصوص الوحدة ${unit.name} في عقار ${building?.name || ""}.\n\nوتفضلوا بقبول فائق الاحترام.`,
                                };
                            setEmailPreview({
                              recipients: getTenantEmailAddresses(tenant),
                              subject: content.subject,
                              body: content.body,
                              tenantId: tenant.id,
                              paymentId: pendingPayment?.id,
                              kind: content.kind,
                            });
                          }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          إرسال بريد
                        </button>
                      )}
                    </div>
                  )}
                  {getTenantEmailAddresses(tenant).length === 0 && (
                    <button
                      type="button"
                      className="w-full rounded-xl border border-amber-200 bg-amber-50 p-2 text-right text-xs font-semibold text-amber-800"
                      onClick={() => setEditTenant(tenant)}
                    >
                      أضف بريد المستأجر لتتمكن من إرسال الرسائل عبر البريد الإلكتروني.
                    </button>
                  )}
                  {tenant.nationalId && (
                    <p className="flex items-center gap-2">
                      <IdCard className="h-4 w-4 text-muted-foreground" />
                      <span dir="ltr">{tenant.nationalId}</span>
                    </p>
                  )}
                  {getTenantEmailAddresses(tenant).length > 0 && (
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div className="space-y-1">
                        {(tenant.emailAddresses?.length
                          ? tenant.emailAddresses
                          : [{ id: "legacy", email: tenant.email || "", enabled: true }]
                        ).filter((item) => item.enabled !== false).map((item) => (
                          <p key={item.id} dir="ltr" className="text-left">
                            {item.email}
                            {"label" in item && item.label ? <span className="mr-1 text-[10px] text-muted-foreground">({item.label})</span> : null}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {tenant.notes && (
                    <p className="rounded-2xl bg-muted p-3 text-muted-foreground">{tenant.notes}</p>
                  )}
                  {tenant.extraInfo && (
                    <p className="rounded-2xl bg-muted p-3 text-muted-foreground">{tenant.extraInfo}</p>
                  )}
                  {/* Electricity Account */}
                  {(tenant.electricityAccountName || tenant.electricityAccountNumber || tenant.electricityMeterNumber || tenant.electricityNotes) && (
                    <div className="mt-3 rounded-2xl border border-border bg-card p-3">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <Lightbulb className="h-3.5 w-3.5" /> بيانات حساب الكهرباء
                      </p>
                      {tenant.electricityAccountName && (
                        <p className="flex items-center gap-2 text-xs">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {tenant.electricityAccountName}
                        </p>
                      )}
                      {tenant.electricityAccountNumber && (
                        <p className="flex items-center gap-2 text-xs">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          {tenant.electricityAccountNumber}
                        </p>
                      )}
                      {tenant.electricityMeterNumber && (
                        <p className="flex items-center gap-2 text-xs">
                          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                          {tenant.electricityMeterNumber}
                        </p>
                      )}
                      {tenant.electricityNotes && (
                        <p className="mt-1 rounded-xl bg-muted p-2 text-xs text-muted-foreground">{tenant.electricityNotes}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <EmptyState icon={User} title="لا يوجد مستأجر" description="أضف بيانات المستأجر لهذه الوحدة" />
                <Button className="w-full rounded-xl" onClick={() => setTenantOpen(true)}>
                  <Plus className="ml-1 h-4 w-4" /> إضافة مستأجر
                </Button>
              </>
            )}
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments" className="mt-4 space-y-3 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
            <Button className="w-full rounded-xl" onClick={() => setPaymentOpen(true)}>
              <Plus className="ml-1 h-4 w-4" /> تسجيل دفعة إيجار
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={showAllContractPayments ? "secondary" : "outline"}
                size="sm"
                className="h-9 min-w-0 rounded-xl px-2 text-[11px]"
                onClick={() => setShowAllContractPayments((current) => !current)}
              >
                {showAllContractPayments ? "إخفاء المستقبلية" : "كل دفعات العقد"}
              </Button>
              <Button
                variant={showReceivedPayments ? "secondary" : "outline"}
                size="sm"
                className="h-9 min-w-0 rounded-xl px-2 text-[11px]"
                onClick={() => setShowReceivedPayments((current) => !current)}
              >
                {showReceivedPayments ? "إخفاء المستلمة" : `الدفعات المستلمة (${receivedPayments.length})`}
              </Button>
            </div>
            {visiblePayments.length === 0 ? (
              <EmptyState icon={Wallet} title="لا توجد دفعات تحتاج إجراء" description="استخدم الزرين أعلاه لعرض الدفعات المستقبلية أو المستلمة" />
            ) : (
              visiblePayments.map((p) => {
                const st = effectiveStatus(p);
                const maintenanceDeductions = getPaymentMaintenanceDeductions(data, p.id);
                const maintenanceDeductionAmount = getPaymentMaintenanceDeductionAmount(data, p);
                const duplicateReceipts = findPotentialDuplicateReceivedPayments(data, p);
                const visibleNotes = paymentNotesWithoutGeneratedMaintenance(p);
                const paymentTenant = data.tenants.find((item) => item.id === p.tenantId) || tenant;
                const paymentEmails = getTenantEmailAddresses(paymentTenant);
                const paymentPhones = Array.from(new Set([
                  ...(p.tenantPhone ? [p.tenantPhone] : []),
                  ...getTenantPhoneNumbers(paymentTenant),
                ]));
                return (
                  <div
                    key={p.id}
                    id={`reminder-target-${p.id}`}
                    className={`flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border px-3 py-2.5 ${
                      st === "overdue" ? "border-red-200 bg-red-50/50" : "border-border bg-card"
                    } ${focusedItemId === p.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  >
                    <div className="flex w-full min-w-0 items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 whitespace-normal text-base font-bold text-primary [overflow-wrap:anywhere]">
                        {formatMoney(p.amount)}
                      </p>
                      <div className="shrink-0">
                        <StatusBadge status={st} label={PAYMENT_STATUS_LABELS[st]} />
                      </div>
                    </div>

                    <div className="w-full min-w-0 space-y-0.5 text-right [overflow-wrap:anywhere]">
                      <p className="min-w-0 whitespace-normal font-semibold [overflow-wrap:anywhere]">{unit.name}</p>
                      {building?.name && (
                        <p className="min-w-0 whitespace-normal text-xs text-muted-foreground [overflow-wrap:anywhere]">{building.name}</p>
                      )}
                      {p.tenantName && !isCorruptedDisplayName(p.tenantName) && (
                        <p className="min-w-0 whitespace-normal text-xs text-muted-foreground [overflow-wrap:anywhere]">{p.tenantName}</p>
                      )}
                        {p.status === "partial" && (
                          <p className="text-xs text-amber-700">
                            مدفوع: {formatMoney(p.paidAmount || 0)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          موعد السداد: {formatDate(p.dueDateGregorian || p.paymentDate)}
                        </p>
                        {p.paymentDeadlineGregorian && (
                          <p className="min-w-0 whitespace-normal text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            نهاية مهلة السداد: {formatDate(p.paymentDeadlineGregorian)}
                          </p>
                        )}
                        {p.communicationGraceUntil && (
                          <div className={`mt-2 rounded-xl border p-2 text-xs ${
                            p.communicationGraceUntil >= todayISO()
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}>
                            <p className="font-bold">
                              {p.communicationGraceUntil >= todayISO() ? "مهلة تواصل فعالة" : "انتهت مهلة التواصل"}
                              {" · حتى "}
                              {formatDate(p.communicationGraceUntil)}
                            </p>
                            {p.communicationGraceReason && <p className="mt-1">{p.communicationGraceReason}</p>}
                            {p.communicationGraceUntil >= todayISO() && <p className="mt-1">تذكيرات السداد التلقائية متوقفة لهذه الدفعة.</p>}
                          </div>
                        )}
                        {st === "overdue" && <p className="text-xs font-semibold text-red-600">متأخر {Math.abs(daysUntil(p.dueDateGregorian || p.nextDueDate || p.paymentDate))} يوم</p>}
                        {p.receivedDate && (st === "paid" || st === "partial") && (
                          <p className="text-xs text-emerald-700">
                            تم الاستلام: {formatDate(p.receivedDate)}
                            {` - ${PAYMENT_RECEIVE_METHOD_LABELS[getPaymentReceiveMethod(p)]}`}
                          </p>
                        )}
                    </div>

                    {st === "paid" && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                        <span className="text-muted-foreground">طريقة الاستلام: {PAYMENT_RECEIVE_METHOD_LABELS[getPaymentReceiveMethod(p)]}</span>
                        <span className="text-muted-foreground">رسوم التحصيل: {formatMoney(p.collectionFeeAmount ?? 0)} - {COLLECTION_FEE_STATUS_LABELS[p.collectionFeeStatus ?? "uncollected"]}</span>
                        {maintenanceDeductionAmount > 0 && (
                          <div className="w-full rounded-2xl bg-amber-50 px-3 py-2 text-amber-800">
                            <p className="font-bold">تفاصيل الصيانة المخصومة: {formatMoney(maintenanceDeductionAmount)}</p>
                            {maintenanceDeductions.length > 0 ? (
                              <div className="mt-1 space-y-1">
                                {maintenanceDeductions.map((item) => (
                                  <p key={item.repair.id}>
                                    {item.repair.description} · الموقع: {item.unit?.name || item.building?.name || "صيانة عامة للعقار"} · {formatMoney(item.repair.cost)}
                                  </p>
                                ))}
                              </div>
                            ) : p.maintenanceSettlementNote ? (
                              <p className="mt-1">{p.maintenanceSettlementNote}</p>
                            ) : null}
                          </div>
                        )}
                        <span className="text-muted-foreground">الصافي للمالك: {formatMoney(calculateNetAmountToTransferToOwner(normalizePaymentFinancials({ ...p, maintenanceDeductionAmount })))}</span>
                        <span className={p.ownerTransferred ? "text-emerald-700" : "text-amber-700"}>
                          {p.ownerSettledByMaintenance
                            ? "تمت تسوية الصافي مقابل صيانة المبنى"
                            : p.ownerTransferred ? `تم التحويل للمالك${p.ownerTransferDate ? ` · ${formatDate(p.ownerTransferDate)}` : ""}` : "هل تم التحويل للمالك؟"}
                        </span>
                        {p.ownerTransferred && !p.ownerSettledByMaintenance && getOwnerTransferAllocations(data, p).length > 1 && (
                          <div className="space-y-1 rounded-xl bg-emerald-50 p-2 text-[11px] text-emerald-800">
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
                        تحذير: يوجد استلام آخر بنفس الشهر والمبلغ لهذه الوحدة. راجع السجل المكرر قبل متابعة التحويل.
                      </p>
                    )}

                    {visibleNotes && (
                      <p className="min-w-0 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {visibleNotes}
                      </p>
                    )}

                    {(st === "paid" || st === "partial") && (
                      <div className="flex flex-wrap gap-2 rounded-2xl bg-muted/40 p-2">
                        <EvidenceAttachments
                          entityType="payment"
                          entityId={p.id}
                          kind="payment_receipt"
                          buildingId={building?.id}
                          unitId={unit.id}
                          compact
                        />
                        {p.ownerTransferred && (
                          <EvidenceAttachments
                            entityType="payment"
                            entityId={p.id}
                            kind="owner_transfer"
                            buildingId={building?.id}
                            unitId={unit.id}
                            compact
                          />
                        )}
                      </div>
                    )}

                    <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 border-t border-border/70 pt-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {(st === "unpaid" || st === "overdue" || st === "partial") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-auto min-h-8 rounded-full border-amber-300 px-3 py-1.5 text-xs text-amber-800"
                            onClick={() => setCommunicationGraceTarget({ kind: "payment", value: p })}
                          >
                            <CalendarClock className="ml-1 h-3.5 w-3.5" />
                            {p.communicationGraceUntil ? "تعديل المهلة" : "منح مهلة"}
                          </Button>
                        )}
                        {(st === "unpaid" || st === "overdue" || st === "partial") && (
                        <Button
                          size="sm"
                          className="h-auto min-h-8 max-w-full shrink-0 whitespace-normal rounded-full bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                          onClick={() => setMarkReceived(p)}
                        >
                          <CheckCircle2 className="ml-1 h-3.5 w-3.5 shrink-0" />
                          تم الاستلام
                        </Button>
                        )}
                      {(st === "unpaid" || st === "overdue" || st === "partial") && paymentPhones.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-auto min-h-8 max-w-full shrink-0 whitespace-normal rounded-full px-3 py-1.5 text-xs"
                          onClick={() => {
                            const msg = buildPaymentMessageContent(data, p, paymentTenant).message;
                            setWhatsappPreview({ phones: paymentPhones, message: msg });
                          }}
                        >
                          <MessageCircle className="ml-1 h-3.5 w-3.5 shrink-0" />
                          واتساب
                        </Button>
                        )}
                      {(st === "unpaid" || st === "overdue" || st === "partial") && paymentPhones.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-auto min-h-8 max-w-full shrink-0 whitespace-normal rounded-full border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700"
                          onClick={() => {
                            const msg = buildPaymentMessageContent(data, p, paymentTenant).message;
                            setSmsPreview({ phones: paymentPhones, message: msg });
                          }}
                        >
                          <MessageSquareText className="ml-1 h-3.5 w-3.5 shrink-0" />
                          SMS
                        </Button>
                      )}
                      {(st === "unpaid" || st === "overdue" || st === "partial") && paymentEmails.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-auto min-h-8 max-w-full shrink-0 whitespace-normal rounded-full border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-700"
                          onClick={() => {
                            const content = buildPaymentEmailContent(data, p, paymentTenant);
                            setEmailPreview({
                              recipients: paymentEmails,
                              subject: content.subject,
                              body: content.body,
                              tenantId: paymentTenant?.id,
                              paymentId: p.id,
                              contractId: p.contractId,
                              kind: content.kind,
                            });
                          }}
                        >
                          <Mail className="ml-1 h-3.5 w-3.5 shrink-0" />
                          بريد
                        </Button>
                      )}
                      {(st === "unpaid" || st === "overdue" || st === "partial") && paymentEmails.length === 0 && (
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-amber-700 underline underline-offset-2"
                          onClick={() => paymentTenant && setEditTenant(paymentTenant)}
                        >
                          أضف البريد لتفعيل الإرسال
                        </button>
                      )}
                      </div>
                      {st === "paid" && !p.ownerTransferred && (
                        <Button
                          size="sm"
                          className="h-8 shrink-0 rounded-full text-xs"
                          onClick={() => {
                            const paymentMaintenanceAmount = getPaymentMaintenanceDeductionAmount(data, p);
                            update((prev) => ({
                              ...prev,
                              payments: prev.payments.map((payment) => payment.id === p.id ? {
                                ...normalizePaymentFinancials({ ...payment, maintenanceDeductionAmount: paymentMaintenanceAmount }),
                                ownerTransferred: true,
                                ownerTransferDate: todayISO(),
                                ownerTransferMethod: "bank_transfer",
                                ownerTransferNotes: payment.ownerTransferNotes ?? "",
                              } : payment),
                            }));
                            showSuccess("تم تسجيل التحويل للمالك");
                          }}
                        >
                          تحويل للمالك
                        </Button>
                      )}
                      <div className="flex shrink-0 items-center gap-1 sm:mr-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-full"
                          onClick={() => setEditPayment(p)}
                          aria-label="تعديل الدفعة"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-full text-destructive"
                          onClick={() => removeItem("payments", p.id)}
                          aria-label="حذف الدفعة"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* Contract */}
          <TabsContent value="contract" className="mt-4 space-y-3 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl" onClick={() => setContractOpen(true)}>
                <Plus className="ml-1 h-4 w-4" /> إضافة عقد
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEjarImportOpen(true)}>
                <FileText className="ml-1 h-4 w-4" /> استيراد عقد إيجار
              </Button>
            </div>
            {contracts.length === 0 ? (
              <EmptyState icon={FileText} title="لا يوجد عقد مسجل" description="أضف عقداً أو استورد عقد إيجار إلكتروني" />
            ) : (
              contracts.map((c) => {
                const days = getDaysUntilDate(getContractEndDate(c)) ?? Number.POSITIVE_INFINITY;
                const expired = days < 0;
                const reminderDays = c.expiryReminderDays ?? 80;
                const nearExpiry = shouldShowContractExpiryReminder(c, reminderDays)
                  && !hasContinuingContractForUnit(c, contracts);
                const displayTenantName = c.tenantName && !isCorruptedDisplayName(c.tenantName)
                  ? c.tenantName
                  : "مستأجر غير محدد";
                const contractTenant = data.tenants.find((item) => item.id === c.tenantId) || tenant;
                const contractPhones = getTenantPhoneNumbers(contractTenant);
                const contractEmails = getTenantEmailAddresses(contractTenant);
                return (
                  <div
                    key={c.id}
                    id={`reminder-target-${c.id}`}
                    className={`rounded-3xl border border-border bg-card p-4 ${focusedItemId === c.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          {c.importedFromEjar && (
                            <span className="inline-block rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">مستورد من إيجار</span>
                          )}
                          {c.autoRenewal && (
                            <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">{AUTO_RENEWAL_LABEL}</span>
                          )}
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            (c.lessorCapacity ?? "owner") === "owner"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            صفة المؤجر: {(c.lessorCapacity ?? "owner") === "owner" ? "مالك" : "ممثل"}
                          </span>
                          {(c.status === "eviction_needed" || c.status === "eviction_filed" || c.tenantDidNotLeave) && (
                            <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">يحتاج إخلاء</span>
                          )}
                        </div>
                        {c.contractNumber && (
                          <p><span className="text-muted-foreground">رقم العقد:</span> <span className="font-semibold" dir="ltr">{c.contractNumber}</span></p>
                        )}
                        <p><span className="text-muted-foreground">المستأجر:</span> <span className="font-semibold">{displayTenantName}</span></p>
                        {c.rentAmount && (
                          <p><span className="text-muted-foreground">الإيجار:</span> <span className="font-semibold">{formatMoney(c.rentAmount)}</span></p>
                        )}
                        {c.securityDeposit ? (
                          <p><span className="text-muted-foreground">الضمان:</span> <span className="font-semibold">{formatMoney(c.securityDeposit)}</span></p>
                        ) : null}
                        {c.paymentFrequency && (
                          <p><span className="text-muted-foreground">دورة الدفع:</span> <span className="font-semibold">{RENT_PERIOD_LABELS[c.paymentFrequency] || RENT_PERIOD_LABELS.monthly}</span></p>
                        )}
                        {c.contractDurationType && (
                          <p><span className="text-muted-foreground">مدة العقد:</span> <span className="font-semibold">{CONTRACT_DURATION_LABELS[c.contractDurationType]}</span></p>
                        )}
                        <p>
                          <span className="text-muted-foreground">من:</span>{" "}
                          <span className="font-semibold">{formatDate(c.startDate)}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">إلى:</span>{" "}
                          <span className="font-semibold">{formatDate(c.endDate)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          تذكير قبل {reminderDays} يوم من الانتهاء
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            expired
                              ? "bg-red-100 text-red-700"
                              : nearExpiry
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {expired ? "منتهي" : nearExpiry ? `ينتهي خلال ${days} يوم` : "ساري"}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditContract(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => setContractToDelete(c)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {c.notes && (
                      <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{c.notes}</p>
                    )}
                    {c.responseGraceUntil && (
                      <div className={`mt-2 rounded-2xl border p-3 text-xs ${
                        c.responseGraceUntil >= todayISO()
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}>
                        <p className="font-bold">طلب المستأجر مهلة للرد بشأن التجديد أو المغادرة</p>
                        <p className="mt-1">
                          {c.responseGraceUntil >= todayISO() ? "المهلة فعالة حتى" : "انتهت المهلة في"}{" "}
                          {formatDate(c.responseGraceUntil)}
                        </p>
                        {c.responseGraceReason && <p className="mt-1">{c.responseGraceReason}</p>}
                        {c.responseGraceUntil >= todayISO() && <p className="mt-1">تذكيرات انتهاء العقد التلقائية متوقفة خلال المهلة.</p>}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full rounded-xl border-amber-300 text-xs text-amber-800"
                      onClick={() => setCommunicationGraceTarget({ kind: "contract", value: c })}
                    >
                      <CalendarClock className="ml-1 h-4 w-4" />
                      {c.responseGraceUntil ? "تعديل مهلة الرد" : "تسجيل طلب مهلة للرد"}
                    </Button>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <EvidenceAttachments
                        entityType="contract"
                        entityId={c.id}
                        kind="contract"
                        buildingId={building?.id}
                        unitId={unit.id}
                        compact
                      />
                      <EvidenceAttachments
                        entityType="contract"
                        entityId={c.id}
                        kind="clearance"
                        buildingId={building?.id}
                        unitId={unit.id}
                        compact
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {contractPhones.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-emerald-200 bg-emerald-50 text-xs text-emerald-700"
                          onClick={() => {
                            const content = buildContractCommunicationContent(data, c, contractTenant);
                            setWhatsappPreview({ phones: contractPhones, message: content.whatsappBody });
                          }}
                        >
                          <MessageCircle className="ml-1 h-4 w-4" />
                          واتساب
                        </Button>
                      )}
                      {contractPhones.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-violet-200 bg-violet-50 text-xs text-violet-700"
                          onClick={() => {
                            const content = buildContractCommunicationContent(data, c, contractTenant);
                            setSmsPreview({ phones: contractPhones, message: content.whatsappBody });
                          }}
                        >
                          <MessageSquareText className="ml-1 h-4 w-4" />
                          SMS
                        </Button>
                      )}
                      {contractEmails.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-sky-200 bg-sky-50 text-xs text-sky-700"
                          onClick={() => {
                            const content = buildContractCommunicationContent(data, c, contractTenant);
                            setEmailPreview({
                              recipients: contractEmails,
                              subject: content.emailSubject,
                              body: content.emailBody,
                              tenantId: contractTenant?.id,
                              contractId: c.id,
                              kind: "contractExpiry",
                            });
                          }}
                        >
                          <Mail className="ml-1 h-4 w-4" />
                          بريد
                        </Button>
                      )}
                    </div>
                    {contractEmails.length === 0 && (
                      <button
                        type="button"
                        className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 p-2 text-right text-xs font-semibold text-amber-800"
                        onClick={() => contractTenant && setEditTenant(contractTenant)}
                      >
                        أضف بريد المستأجر لتتمكن من إرسال تنبيه انتهاء العقد عبر البريد.
                      </button>
                    )}
                    {(expired || c.tenantDidNotLeave || c.status?.startsWith("eviction_")) && c.status !== "eviction_completed" && (
                      <div className="mt-3 space-y-2 rounded-2xl border border-red-200 bg-red-50 p-3">
                        <p className="text-sm font-bold text-red-700">حالة الإخلاء</p>
                        {!c.tenantDidNotLeave && (
                          <Button size="sm" variant="outline" className="w-full rounded-xl border-red-300 text-xs text-red-700" onClick={() => update((prev) => ({ ...prev, contracts: prev.contracts.map((contract) => contract.id === c.id ? { ...contract, tenantDidNotLeave: true, evictionCaseNeeded: true, status: "eviction_needed" } : contract) }))}>
                            المستأجر لم يخرج بعد انتهاء العقد
                          </Button>
                        )}
                        {c.status === "eviction_needed" && <Button size="sm" className="w-full rounded-xl" onClick={() => { setEvictionContract(c); setEvictionCaseNumber(c.evictionCaseNumber || ""); setEvictionCaseDate(c.evictionCaseDate || todayISO()); setEvictionCourtName(c.evictionCourtName || ""); setEvictionPlatform(c.evictionPlatform || ""); setEvictionNotes(c.evictionNotes || ""); }}>تسجيل معاملة إخلاء</Button>}
                        {c.status === "eviction_filed" && <Button size="sm" className="w-full rounded-xl" onClick={() => { setCompleteEvictionContract(c); setEvictionCaseDate(todayISO()); setEvictionNotes(c.evictionNotes || ""); }}>تسجيل تنفيذ الإخلاء</Button>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* Requests */}
          <TabsContent value="requests" className="mt-4 space-y-3 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
            <Button className="w-full rounded-xl" onClick={() => setRequestOpen(true)}>
              <Plus className="ml-1 h-4 w-4" /> إضافة طلب مستأجر
            </Button>
            {requests.length === 0 ? (
              <EmptyState icon={ClipboardList} title="لا توجد طلبات" description="أضف طلبات المستأجر من هنا" />
            ) : (
              requests.map((r) => (
                <div
                  key={r.id}
                  id={`reminder-target-${r.id}`}
                  className={`rounded-3xl border border-border bg-card p-4 ${focusedItemId === r.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[r.type]}{r.customType ? ` (${r.customType})` : ""}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.requestDate)}</p>
                      {r.cost !== undefined && r.cost > 0 && (
                        <p className="text-xs font-semibold text-primary">{formatMoney(r.cost)}</p>
                      )}
                    </div>
                    <div className="mr-2 flex flex-col items-end gap-1.5">
                      <StatusBadge status={r.status} label={REQUEST_STATUS_LABELS[r.status]} />
                      <StatusBadge status={r.priority} label={REQUEST_PRIORITY_LABELS[r.priority]} />
                      <div className="flex gap-1 mt-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditRequest(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => {
                          update((prev) => ({
                            ...prev,
                            tenantRequests: prev.tenantRequests.filter((x) => x.id !== r.id),
                          }));
                          showSuccess("تم الحذف");
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {r.description && (
                    <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{r.description}</p>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* Bills */}
          <TabsContent value="bills" className="mt-4 space-y-3 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
            <Button className="w-full rounded-xl" onClick={() => setBillOpen(true)}>
              <Plus className="ml-1 h-4 w-4" /> إضافة فاتورة
            </Button>
            {bills.length === 0 ? (
              <EmptyState icon={Zap} title="لا توجد فواتير مسجلة" />
            ) : (
              bills.map((b) => (
                <div
                  key={b.id}
                  id={`reminder-target-${b.id}`}
                  className={`rounded-3xl border border-border bg-card p-4 ${focusedItemId === b.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold">
                        {b.type === "other" && b.typeLabel ? b.typeLabel : BILL_TYPE_LABELS[b.type]}
                        <span className="mr-2 text-primary">{formatMoney(b.amount)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        تاريخ الفاتورة: {formatDate(b.billDate)}
                      </p>
                      {b.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          الاستحقاق: {formatDate(b.dueDate)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={b.status} label={BILL_STATUS_LABELS[b.status]} />
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditBill(b)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeItem("bills", b.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {b.notes && (
                    <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{b.notes}</p>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          {/* Repairs */}
          <TabsContent value="repairs" className="mt-4 space-y-3 min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:mt-0 min-[500px]:[direction:rtl]">
            <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
              <span className="text-sm font-semibold text-secondary-foreground">إجمالي تكاليف الصيانة</span>
              <span className="font-bold text-primary">{formatMoney(maintenanceTotal)}</span>
            </div>
            <Button className="w-full rounded-xl" onClick={() => setRepairOpen(true)}>
              <Plus className="ml-1 h-4 w-4" /> إضافة صيانة
            </Button>
            {repairs.length === 0 ? (
              <EmptyState icon={Wrench} title="لا توجد أعمال صيانة" />
            ) : (
              repairs.map((r) => {
                const deductedPayment = r.deductedFromPaymentId
                  ? data.payments.find((payment) => payment.id === r.deductedFromPaymentId)
                  : undefined;
                const deductedPaymentUnit = deductedPayment
                  ? data.units.find((item) => item.id === deductedPayment.unitId)
                  : undefined;
                return (
                <div
                  key={r.id}
                  id={`reminder-target-${r.id}`}
                  className={`rounded-3xl border border-border bg-card p-4 ${focusedItemId === r.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold">{r.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.repairDate)}
                        {r.contractor ? ` · ${r.contractor}` : ""}
                      </p>
                      <p className="text-sm font-semibold text-primary">{formatMoney(r.cost)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={r.status} label={REPAIR_STATUS_LABELS[r.status]} />
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditRepair(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeItem("repairs", r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {r.notes && (
                    <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{r.notes}</p>
                  )}
                  <div className="mt-2">
                    <EvidenceAttachments
                      entityType="repair"
                      entityId={r.id}
                      kind="maintenance_invoice"
                      buildingId={building?.id}
                      unitId={unit.id}
                      compact
                    />
                  </div>
                  {r.isDeductedFromOwnerTransfer && (
                    <p className="mt-2 rounded-2xl bg-amber-50 p-2.5 text-xs font-semibold text-amber-700">
                      تم خصم هذه الصيانة من دفعة للمالك
                      {deductedPaymentUnit ? ` - مصدر الخصم: ${deductedPaymentUnit.name}` : ""}
                      {deductedPayment ? ` - تاريخ الدفعة: ${formatDate(deductedPayment.dueDateGregorian || deductedPayment.paymentDate)}` : ""}
                    </p>
                  )}
                </div>
              );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!contractToDelete} onOpenChange={(open) => !open && setContractToDelete(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-3xl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>حذف العقد</AlertDialogTitle>
            <AlertDialogDescription>
              {contractToDelete && (contractToDelete.tenantDidNotLeave || contractToDelete.evictionCaseNeeded || contractToDelete.evictionCaseFiled)
                ? "هذا العقد يحتوي على بيانات إخلاء. سيتم حذف العقد والدفعات ومعاملة الإخلاء المرتبطة به. هل تريد المتابعة؟"
                : "سيتم حذف العقد والدفعات والتنبيهات المرتبطة به، وسيتم تحديث حالة الوحدة وحذف المستأجر إذا لم يكن لديه عقد آخر. هل تريد المتابعة؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive"
              onClick={() => contractToDelete && deleteContractAndCleanup(contractToDelete.id)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!evictionContract} onOpenChange={(open) => !open && setEvictionContract(null)}>
        <DialogContent className="max-w-[92vw] rounded-3xl dialog-safe">
          <DialogHeader><DialogTitle className="text-right">تسجيل معاملة إخلاء</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>رقم معاملة الإخلاء</Label><Input value={evictionCaseNumber} onChange={(event) => setEvictionCaseNumber(event.target.value)} /></div>
            <div><Label>تاريخ معاملة الإخلاء</Label><Input type="date" value={evictionCaseDate} onChange={(event) => setEvictionCaseDate(event.target.value)} /></div>
            <div><Label>المحكمة / الجهة</Label><Input value={evictionCourtName} onChange={(event) => setEvictionCourtName(event.target.value)} /></div>
            <div><Label>منصة المعاملة</Label><Input value={evictionPlatform} onChange={(event) => setEvictionPlatform(event.target.value)} /></div>
            <div><Label>ملاحظات الإخلاء</Label><Textarea value={evictionNotes} onChange={(event) => setEvictionNotes(event.target.value)} /></div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setEvictionContract(null)}>إلغاء</Button><Button className="flex-1" onClick={() => {
              if (!evictionContract) return;
              update((prev) => ({ ...prev, contracts: prev.contracts.map((contract) => contract.id === evictionContract.id ? { ...contract, tenantDidNotLeave: true, evictionCaseNeeded: true, evictionCaseFiled: true, status: "eviction_filed", evictionCaseNumber: evictionCaseNumber.trim() || null, evictionCaseDate, evictionCourtName: evictionCourtName.trim() || null, evictionPlatform: evictionPlatform.trim() || null, evictionNotes: evictionNotes.trim() || null } : contract) }));
              setEvictionContract(null); showSuccess("تم تسجيل معاملة الإخلاء");
            }}>حفظ المعاملة</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeEvictionContract} onOpenChange={(open) => !open && setCompleteEvictionContract(null)}>
        <DialogContent className="max-w-[92vw] rounded-3xl dialog-safe">
          <DialogHeader><DialogTitle className="text-right">تسجيل تنفيذ الإخلاء</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">سيتم تسجيل إخلاء الوحدة وتغيير حالة الوحدة إلى شاغرة. هل تريد المتابعة؟</p>
          <div><Label>تاريخ تنفيذ الإخلاء</Label><Input type="date" value={evictionCaseDate} onChange={(event) => setEvictionCaseDate(event.target.value)} /></div>
          <div><Label>ملاحظات الإخلاء</Label><Textarea value={evictionNotes} onChange={(event) => setEvictionNotes(event.target.value)} /></div>
          <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setCompleteEvictionContract(null)}>إلغاء</Button><Button className="flex-1" onClick={() => {
            if (!completeEvictionContract) return;
            update((prev) => ({ ...prev, contracts: prev.contracts.map((contract) => contract.id === completeEvictionContract.id ? { ...contract, status: "eviction_completed", tenantDidNotLeave: false, evictionCaseNeeded: false, evictionCompletedDate: evictionCaseDate, evictionNotes: evictionNotes.trim() || contract.evictionNotes || null } : contract) }));
            setCompleteEvictionContract(null); showSuccess("تم تسجيل تنفيذ الإخلاء");
          }}>تأكيد</Button></div>
        </DialogContent>
      </Dialog>

      {/* Sheets */}
      <FormSheet open={editUnitOpen} onOpenChange={setEditUnitOpen} title="تعديل الوحدة">
        <UnitForm
          initial={unit}
          hasActiveContract={contracts.some((c) => isActiveContract(c))}
          onSubmit={async (values) => {
            if (values.status === "vacant" && contracts.some((c) => isActiveContract(c))) {
              showError("لا يمكن جعل الشقة شاغرة لوجود عقد ساري");
              return;
            }
            const overrideChanged = values.collectionFeeOverrideEnabled !== (unit.collectionFeeOverrideEnabled ?? false)
              || values.collectionFeePercent !== (unit.collectionFeePercent ?? null);
            const updatePayments = overrideChanged
              ? await appDialog.confirm({
                  title: "تطبيق نسبة التحصيل؟",
                  description: "هل تريد تطبيق النسبة الجديدة على الدفعات غير المدفوعة لهذه الوحدة؟\n\nسيتم تحديث الدفعات غير المدفوعة فقط، ويمكن الإلغاء لحفظ النسبة دون تعديل الدفعات الحالية.",
                  confirmLabel: "تطبيق على الدفعات",
                })
              : false;
            const resolvedFee = values.collectionFeeOverrideEnabled ? (values.collectionFeePercent ?? 0) : (building?.collectionFeePercent ?? 0);
            update((prev) => ({
              ...prev,
              units: prev.units.map((u) => (u.id === unit.id ? { ...u, ...values, manualStatus: values.status } : u)),
              payments: updatePayments ? prev.payments.map((payment) => {
                if (payment.unitId !== unit.id || payment.status === "paid") return payment;
                const gross = payment.grossAmount ?? payment.amount;
                const fee = Math.round(gross * resolvedFee) / 100;
                return normalizePaymentFinancials({ ...payment, grossAmount: gross, collectionFeePercent: resolvedFee, collectionFeePercentage: resolvedFee, collectionFeeAmount: fee, netAmountAfterCollectionFee: gross - fee });
              }) : prev.payments,
            }));
            setEditUnitOpen(false);
            showSuccess("تم حفظ التعديلات");
          }}
        />
      </FormSheet>

      <FormSheet open={tenantOpen} onOpenChange={setTenantOpen} title="إضافة مستأجر">
        <TenantForm
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              tenants: [...prev.tenants, { id: genId(), unitId: unit.id, createdAt: todayISO(), ...values }],
            }));
            setTenantOpen(false);
            showSuccess("تمت إضافة المستأجر");
          }}
        />
      </FormSheet>

      <FormSheet open={!!editTenant} onOpenChange={(o) => !o && setEditTenant(null)} title="تعديل المستأجر">
        {editTenant && (
          <TenantForm
            initial={editTenant}
            onSubmit={(values) => {
              update((prev) => ({
                ...prev,
                tenants: prev.tenants.map((t) => (t.id === editTenant.id ? { ...t, ...values } : t)),
              }));
              setEditTenant(null);
              showSuccess("تم حفظ التعديلات");
            }}
          />
        )}
      </FormSheet>

      <FormSheet open={paymentOpen} onOpenChange={setPaymentOpen} title="تسجيل دفعة إيجار">
        <PaymentForm
          defaultAmount={unit.rentAmount}
          unitId={unit.id}
          lessorCapacity={currentLessorCapacity}
          onSubmit={(values) => {
            const grossAmount = values.amount;
            const collectionFeePercent = getResolvedCollectionFeePercent(building, unit);
            const collectionFeeAmount = Math.round(grossAmount * collectionFeePercent) / 100;
            update((prev) => ({
              ...prev,
              payments: [...prev.payments, normalizePaymentFinancials({
                id: genId(), unitId: unit.id, createdAt: todayISO(), ...values,
                grossAmount, collectionFeePercent, collectionFeeAmount,
                netAmountAfterCollectionFee: grossAmount - collectionFeeAmount,
                maintenanceDeductionAmount: 0,
                ownerTransferred: values.ownerTransferred ?? false,
                ownerTransferDate: values.ownerTransferDate ?? null,
                ownerTransferMethod: values.ownerTransferMethod ?? null,
              })],
            }));
            setPaymentOpen(false);
            showSuccess("تم تسجيل الدفعة");
          }}
        />
      </FormSheet>

      <FormSheet open={!!editPayment} onOpenChange={(o) => !o && setEditPayment(null)} title="تعديل الدفعة">
        {editPayment && (
          <div className="space-y-3">
            {getPaymentMaintenanceDeductionAmount(data, editPayment) > 0 && (
              <div className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-700">
                <p className="font-bold">يوجد خصم صيانة مرتبط بهذه الدفعة: {formatMoney(getPaymentMaintenanceDeductionAmount(data, editPayment))}</p>
                {getPaymentMaintenanceDeductions(data, editPayment.id).map((item) => (
                  <p key={item.repair.id} className="mt-1">
                    {item.repair.description}
                    {item.unit?.name ? ` - ${item.unit.name}` : ""}
                  </p>
                ))}
              </div>
            )}
            <PaymentForm
            initial={editPayment}
            lessorCapacity={data.contracts.find((contract) => contract.id === editPayment.contractId)?.lessorCapacity ?? currentLessorCapacity}
            requiresAuditReason
            onSubmit={async (values) => {
              try {
                console.log("[Edit Payment] formData:", values);
                const { auditReason, ...paymentValues } = values;
                await update((prev) => {
                  const paid = paymentValues.status === "paid";
                  return {
                  ...prev,
                  payments: prev.payments.map((payment) => {
                    if (payment.id !== editPayment.id) return payment;
                    const grossAmount = paymentValues.amount;
                    const collectionFeePercent = getPaymentCollectionFeePercent(payment, building, unit);
                    const collectionFeeAmount = Math.round(grossAmount * collectionFeePercent) / 100;
                    const netAmountAfterCollectionFee = Math.round((grossAmount - collectionFeeAmount) * 100) / 100;
                    return normalizePaymentFinancials({
                      ...payment,
                      ...paymentValues,
                      grossAmount,
                      collectionFeePercent,
                      collectionFeePercentage: collectionFeePercent,
                      collectionFeeAmount,
                      netAmountAfterCollectionFee,
                      maintenanceDeductionAmount: paid ? getPaymentMaintenanceDeductionAmount(prev, payment) : 0,
                      receivedDate: paid ? paymentValues.receivedDate : undefined,
                      receivedAmount: paid ? paymentValues.amount : paymentValues.status === "partial" ? paymentValues.paidAmount : undefined,
                      paidAmount: paymentValues.status === "partial" ? paymentValues.paidAmount : undefined,
                      paymentMethod: paid ? paymentValues.paymentMethod : undefined,
                      receiveMethod: paid ? paymentValues.receiveMethod : undefined,
                      collectionFeeStatus: paid ? payment.collectionFeeStatus : undefined,
                      collectionFeeReason: paid ? payment.collectionFeeReason : undefined,
                      collectionFeeSettledAt: paid ? payment.collectionFeeSettledAt : undefined,
                      collectionFeeSettlementNote: paid ? payment.collectionFeeSettlementNote : undefined,
                      collectionFeeSettledAmount: paid ? payment.collectionFeeSettledAmount : undefined,
                      collectionFeeRemainingAmount: paid ? payment.collectionFeeRemainingAmount : undefined,
                      ownerTransferred: paid ? (paymentValues.ownerTransferred ?? false) : false,
                      ownerTransferDate: paid ? (paymentValues.ownerTransferDate ?? null) : null,
                      ownerTransferMethod: paid ? (paymentValues.ownerTransferMethod ?? null) : null,
                      ownerTransferNotes: paid ? (payment.ownerTransferNotes ?? "") : "",
                      ownerSettledByMaintenance: paid ? (paymentValues.ownerSettledByMaintenance ?? false) : false,
                      maintenanceSettlementNote: paid ? paymentValues.maintenanceSettlementNote : undefined,
                    });
                  }),
                  repairs: paid
                    ? prev.repairs
                    : restoreMaintenanceDeductionsForPayment(prev.repairs, editPayment.id),
                  };
                }, { reason: auditReason });
                setEditPayment(null);
                showSuccess("تم تعديل الدفعة بنجاح");
              } catch (error) {
                console.error("[Edit Payment] failed:", error);
                showError("تعذر تعديل الدفعة، حاول مرة أخرى");
              }
            }}
            />
          </div>
        )}
      </FormSheet>

      <FormSheet open={contractOpen} onOpenChange={setContractOpen} title="إضافة عقد">
        <ContractForm
          defaultTenantName={tenant?.name}
          defaultRentAmount={(() => {
            const ppy = getPaymentsPerYear(unit.rentPeriod);
            return ppy > 1 ? Number((unit.rentAmount * ppy).toFixed(2)) : unit.rentAmount;
          })()}
          defaultPaymentFrequency={unit.rentPeriod}
          defaultExpiryReminderDays={data.settings.defaultContractExpiryReminderDays}
          onSubmit={async (values) => {
            console.log("[Contract Save] tenant input:", { name: values.tenantName, phone: values.tenantPhone });
            try {
              const tenantResult = upsertTenant(data.tenants, {
                name: values.tenantName || "",
                phone: values.tenantPhone || (tenant?.phone),
                nationalId: values.tenantIdNumber,
                email: values.tenantEmail,
                unitId: unit.id,
                buildingId: building?.id,
                contractId: undefined,
              });
              console.log("[Tenant] created or updated:", tenantResult.tenant.id, tenantResult.isNew ? "new" : "existing");
              const finalTenant = tenantResult.isNew ? tenantResult.tenant : data.tenants.find((t) => t.id === tenantResult.tenant.id) || tenantResult.tenant;

              const contract: Contract = {
                id: genId(),
                unitId: unit.id,
                tenantId: finalTenant.id,
                createdAt: todayISO(),
                ...values,
                collectionFeePercent: getResolvedCollectionFeePercent(building, unit),
              };
              const validationError = validateContractForPayments(contract);
              if (validationError) {
                showError(validationError);
                return;
              }
              const generatedPayments = generatePaymentsFromContract(
                contract,
                building?.name || "",
                unit.name,
                values.tenantName || tenant?.name || "",
                finalTenant.id,
                finalTenant.phone,
              );
              contract.numberOfPayments = generatedPayments.length;
              contract.totalContractValue = generatedPayments.reduce((sum, payment) => sum + payment.amount, 0);

              const updatedTenant = { ...finalTenant, activeContractId: contract.id, updatedAt: new Date().toISOString() };

              await update((prev) => ({
                ...prev,
                tenants: tenantResult.isNew
                  ? [...prev.tenants, updatedTenant]
                  : prev.tenants.map((t) => t.id === updatedTenant.id ? updatedTenant : t),
                contracts: [...prev.contracts, contract],
                payments: [...prev.payments, ...generatedPayments],
              }));
              console.log("[Contract Save] linked tenantId:", finalTenant.id);
              console.log("[Payments] generated with tenant:", generatedPayments.length);
              setContractOpen(false);
              showSuccess("تم حفظ العقد بنجاح");
            } catch (err) {
              console.error("[Contract] Manual save — error:", err);
              showError("تعذر حفظ العقد، يرجى المحاولة مرة أخرى");
            }
          }}
        />
      </FormSheet>

      <FormSheet open={!!editContract} onOpenChange={(o) => !o && setEditContract(null)} title="تعديل العقد">
        {editContract && (
          <ContractForm
            initial={editContract}
            onSubmit={(values) => {
              console.log("[Contract] Edit save started", values);
              try {
                const tenantResult = upsertTenant(data.tenants, {
                  name: values.tenantName || tenant?.name || "",
                  phone: values.tenantPhone || (editContract.tenantPhone || tenant?.phone),
                  unitId: unit.id,
                  buildingId: building?.id,
                  contractId: editContract.id,
                });
                const updatedTenant = { ...tenantResult.tenant, activeContractId: editContract.id, updatedAt: new Date().toISOString() };
                const paymentFieldsChanged = editContract.rentAmount !== values.rentAmount || editContract.paymentFrequency !== values.paymentFrequency || editContract.startDate !== values.startDate || editContract.endDate !== values.endDate;
                const contract: Contract = { ...editContract, ...values, collectionFeePercent: getResolvedCollectionFeePercent(building, unit), tenantId: updatedTenant.id };
                const expected = paymentFieldsChanged ? generatePaymentsFromContract(contract, building?.name || "", unit.name, values.tenantName || tenant?.name || "", updatedTenant.id, updatedTenant.phone) : [];
                const dueKey = (payment: Payment) => payment.dueDateGregorian || payment.paymentDate || payment.nextDueDate || "";
                update((prev) => {
                  const existing = prev.payments.filter((payment) => payment.contractId === editContract.id);
                  let merged = existing;
                  if (paymentFieldsChanged) {
                    const byDue = new Map(existing.map((payment) => [dueKey(payment), payment]));
                    const expectedKeys = new Set(expected.map(dueKey));
                    merged = expected.map((generated) => byDue.get(dueKey(generated)) ?? generated);
                    merged.push(...existing.filter((payment) => (payment.status === "paid" || !!payment.receivedDate) && !expectedKeys.has(dueKey(payment))));
                  }
                  if (editContract.lessorCapacity !== values.lessorCapacity) {
                    merged = merged.map((payment) => {
                      if (!isPaymentPaid(payment) || getPaymentReceiveMethod(payment) !== "ejar_platform") return payment;
                      if (values.lessorCapacity === "owner") {
                        return {
                          ...payment,
                          ownerTransferred: true,
                          ownerTransferDate: payment.ownerTransferDate || payment.receivedDate || todayISO(),
                          ownerTransferMethod: "ejar_platform",
                          ownerTransferNotes: "تحويل تلقائي عبر منصة إيجار",
                        };
                      }
                      if (payment.ownerTransferNotes === "تحويل تلقائي عبر منصة إيجار") {
                        return {
                          ...payment,
                          ownerTransferred: false,
                          ownerTransferDate: null,
                          ownerTransferMethod: null,
                          ownerTransferNotes: "",
                        };
                      }
                      return payment;
                    });
                  }
                  contract.numberOfPayments = paymentFieldsChanged ? expected.length : editContract.numberOfPayments;
                  contract.totalContractValue = paymentFieldsChanged ? expected.reduce((sum, payment) => sum + payment.amount, 0) : editContract.totalContractValue;
                  return { ...prev, tenants: tenantResult.isNew ? [...prev.tenants, updatedTenant] : prev.tenants.map((item) => item.id === updatedTenant.id ? updatedTenant : item), contracts: prev.contracts.map((item) => item.id === editContract.id ? contract : item), payments: [...prev.payments.filter((payment) => payment.contractId !== editContract.id), ...merged] };
                });
                setEditContract(null);
                showSuccess("تم حفظ التعديلات");
              } catch (err) {
                console.error("[Contract] Edit save error:", err);
                showError("حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى");
              }
            }}
          />
        )}
      </FormSheet>

      <FormSheet open={billOpen} onOpenChange={setBillOpen} title="إضافة فاتورة">
        <BillForm
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              bills: [...prev.bills, { id: genId(), unitId: unit.id, createdAt: todayISO(), ...values }],
            }));
            setBillOpen(false);
            showSuccess("تمت إضافة الفاتورة");
          }}
        />
      </FormSheet>

      <FormSheet open={!!editBill} onOpenChange={(o) => !o && setEditBill(null)} title="تعديل الفاتورة">
        {editBill && (
          <BillForm
            initial={editBill}
            onSubmit={(values) => {
              update((prev) => ({
                ...prev,
                bills: prev.bills.map((b) => (b.id === editBill.id ? { ...b, ...values } : b)),
              }));
              setEditBill(null);
              showSuccess("تم حفظ التعديلات");
            }}
          />
        )}
      </FormSheet>

      <FormSheet open={repairOpen} onOpenChange={setRepairOpen} title="إضافة صيانة">
        <RepairForm
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              repairs: [...prev.repairs, { id: genId(), unitId: unit.id, createdAt: todayISO(), ...values }],
            }));
            setRepairOpen(false);
            showSuccess("تمت إضافة الصيانة");
          }}
        />
      </FormSheet>

      <FormSheet open={requestOpen} onOpenChange={setRequestOpen} title="إضافة طلب مستأجر">
        <TenantRequestForm
          unitId={unit.id}
          buildingId={building?.id || ""}
          tenantId={tenant?.id}
          tenantName={tenant?.name}
          buildingName={building?.name}
          unitName={unit.name}
          onSubmit={(values) => {
            const now = new Date().toISOString();
            const req: TenantRequest = {
              id: genId(),
              createdAt: now,
              updatedAt: now,
              ...values,
            };
            update((prev) => ({
              ...prev,
              tenantRequests: [...prev.tenantRequests, req],
            }));
            setRequestOpen(false);
            showSuccess("تمت إضافة الطلب");
          }}
        />
      </FormSheet>

      <FormSheet open={!!editRequest} onOpenChange={(o) => !o && setEditRequest(null)} title="تعديل الطلب">
        {editRequest && (
          <TenantRequestForm
            initial={editRequest}
            unitId={unit.id}
            buildingId={building?.id || ""}
            tenantId={tenant?.id}
            tenantName={tenant?.name}
            buildingName={building?.name}
            unitName={unit.name}
            onSubmit={(values) => {
              update((prev) => ({
                ...prev,
                tenantRequests: prev.tenantRequests.map((r) =>
                  r.id === editRequest.id ? { ...r, ...values, updatedAt: new Date().toISOString() } : r,
                ),
              }));
              setEditRequest(null);
              showSuccess("تم حفظ التعديلات");
            }}
          />
        )}
      </FormSheet>

      <FormSheet open={!!editRepair} onOpenChange={(o) => !o && setEditRepair(null)} title="تعديل الصيانة">
        {editRepair && (
          <RepairForm
            initial={editRepair}
            onSubmit={async (values) => {
              const reason = await appDialog.prompt({
                title: "تعديل الصيانة",
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
                repairs: prev.repairs.map((r) => (r.id === editRepair.id ? { ...r, ...values } : r)),
              }), { reason: reason.trim() });
              setEditRepair(null);
              showSuccess("تم حفظ التعديلات");
            }}
          />
        )}
      </FormSheet>

      {/* Mark as Received Dialog */}
      {markReceived && (
        <MarkAsReceivedDialog
          payment={markReceived}
          fallbackFeePercent={getResolvedCollectionFeePercent(building, unit)}
          lessorCapacity={data.contracts.find((contract) => contract.id === markReceived.contractId)?.lessorCapacity ?? currentLessorCapacity}
          feeSuggestions={officeFeeSuggestions}
          repairSuggestions={maintenanceSuggestions}
          earlierOutstandingPayments={earlierOutstandingPayments}
          buildingUnits={buildingUnits}
          onConfirm={async (receivedDate, method, feePercent, notes, settlements, repairIds, settleWithBuildingMaintenance, maintenanceExpenseItems) => {
            const duplicate = findPotentialDuplicateReceivedPayments(data, normalizePaymentFinancials({
              ...markReceived,
              status: "paid",
              receivedDate,
              receivedAmount: markReceived.grossAmount ?? markReceived.amount,
              receiveMethod: method,
            }))[0];
            if (duplicate) {
              showError(`تم تسجيل استلام مماثل لنفس الوحدة والشهر والمبلغ${duplicate.receivedDate ? ` بتاريخ ${formatDate(duplicate.receivedDate)}` : ""}. راجع الدفعة المكررة أولًا.`);
              return;
            }
            if (earlierOutstandingPayments.length > 0) {
              const oldest = earlierOutstandingPayments[0];
              const shouldContinue = await appDialog.confirm({
                title: "خطأ محتمل في تسلسل الدفعات",
                description: `توجد ${earlierOutstandingPayments.length} دفعة أقدم لم تُستلم.\n`
                  + `أقدمها بتاريخ ${formatDate(oldest.dueDateGregorian || oldest.nextDueDate || oldest.paymentDate)}`
                  + ` والمتبقي ${formatMoney(getRemainingPaymentAmount(oldest))}.\n\nهل تريد متابعة استلام الدفعة الحالية؟`,
                confirmLabel: "متابعة الاستلام",
                tone: "warning",
              });
              if (!shouldContinue) return;
            }
            const grossAmount = markReceived.grossAmount ?? markReceived.amount;
            const collectionFeeAmount = Math.round(grossAmount * feePercent) / 100;
            const netAmountAfterCollectionFee = Math.round((grossAmount - collectionFeeAmount) * 100) / 100;
            const settlementTotal = settlements.reduce((sum, item) => sum + item.amount, 0);
            const selectedRepairs = maintenanceSuggestions
              .map((item) => item.repair)
              .filter((repair) => repairIds.includes(repair.id) && !repair.isDeductedFromOwnerTransfer);
            const linkedMaintenanceAmount = selectedRepairs.reduce((sum, repair) => sum + repair.cost, 0);
            const ownerDeductibleFee = method === "ejar_platform" ? 0 : collectionFeeAmount;
            const manualMaintenanceAmount = maintenanceExpenseItems
              .reduce((sum, item) => sum + item.cost, 0);
            const maintenanceDeductionAmount = linkedMaintenanceAmount + manualMaintenanceAmount;
            const maintenanceExpenseSummary = maintenanceExpenseItems
              .map((item) => `${item.description} (${formatMoney(item.cost)})`)
              .join("، ");
            const maintenanceNote = maintenanceDeductionAmount > 0
              ? `تم خصم صيانة بقيمة ${formatMoney(maintenanceDeductionAmount)}: ${[
                  ...selectedRepairs.map((repair) => {
                    const repairUnit = data.units.find((item) => item.id === repair.unitId);
                    return `${repair.description} (${repairUnit?.name || (isRecurringBillRepair(repair) ? "فاتورة شهرية للعقار" : "صيانة عامة للعقار")} - ${formatMoney(repair.cost)})`;
                  }),
                  maintenanceExpenseSummary,
                ].filter(Boolean).join("، ")}.`
              : "";
            const remainingForOwner = Math.max(0, Math.round((
              grossAmount - ownerDeductibleFee - settlementTotal - maintenanceDeductionAmount
            ) * 100) / 100);
            const fullySettledByMaintenance = maintenanceDeductionAmount > 0 && remainingForOwner <= 0;
            const autoOwnerTransfer = maintenanceDeductionAmount <= 0
              && shouldAutoTransferEjarPayment(data, markReceived, method);
            update((prev) => ({
              ...prev,
              payments: prev.payments.map((p) =>
                p.id === markReceived.id
                  ? normalizePaymentFinancials({
                      ...p,
                      status: "paid" as PaymentStatus,
                      receivedDate,
                      paymentMethod: method === "office_collection" ? undefined : method,
                      receiveMethod: method,
                      notes: [
                        notes || p.notes,
                        settlementTotal > 0 ? `تم خصم ${formatMoney(settlementTotal)} لتسوية رسوم منصة إيجار لوحدات أخرى في نفس العقار بتاريخ ${receivedDate}.` : "",
                        maintenanceNote,
                      ].filter(Boolean).join("\n"),
                      grossAmount,
                      collectionFeePercent: feePercent,
                      collectionFeePercentage: feePercent,
                      collectionFeeAmount,
                      netAmountAfterCollectionFee,
                      maintenanceDeductionAmount,
                      ownerTransferred: fullySettledByMaintenance || autoOwnerTransfer,
                      ownerTransferDate: autoOwnerTransfer ? receivedDate : null,
                      ownerTransferMethod: autoOwnerTransfer ? "ejar_platform" : null,
                      ownerTransferNotes: fullySettledByMaintenance
                        ? `تمت تسوية صافي الدفعة بالكامل مقابل مصروفات العقار بتاريخ ${receivedDate}.`
                        : maintenanceDeductionAmount > 0
                          ? `تم خصم مصروفات العقار والصيانة ويتبقى ${formatMoney(remainingForOwner)} للتحويل للمالك.`
                        : autoOwnerTransfer ? "تحويل تلقائي عبر منصة إيجار" : "",
                      ownerSettledByMaintenance: fullySettledByMaintenance,
                      maintenanceSettlementNote: maintenanceExpenseSummary || undefined,
                    })
                  : settlements.some((item) => item.paymentId === p.id)
                    ? (() => {
                        const settlement = settlements.find((item) => item.paymentId === p.id)!;
                        const priorSettled = getCollectionFeeSettledAmount(prev, p);
                        const newSettled = Math.min(p.collectionFeeAmount ?? 0, priorSettled + settlement.amount);
                        const remaining = Math.max(0, Math.round(((p.collectionFeeAmount ?? 0) - newSettled) * 100) / 100);
                        return {
                          ...p,
                          collectionFeeStatus: remaining <= 0 ? "settled" as const : "partially_settled" as const,
                          collectionFeeSettledAmount: newSettled,
                          collectionFeeRemainingAmount: remaining,
                          collectionFeeSettledAt: remaining <= 0 ? receivedDate : p.collectionFeeSettledAt,
                          collectionFeeSettlementNote: [p.collectionFeeSettlementNote, `تمت تسوية ${formatMoney(settlement.amount)} من دفعة ${unit.name} بتاريخ ${receivedDate}.`].filter(Boolean).join("\n"),
                        };
                      })()
                    : p,
              ),
              repairs: [
                ...prev.repairs.map((repair) => repairIds.includes(repair.id)
                  ? { ...repair, isDeductedFromOwnerTransfer: true, deductedFromPaymentId: markReceived.id }
                  : repair),
                ...selectedRepairs
                  .filter((repair) => !prev.repairs.some((item) => item.id === repair.id))
                  .map((repair) => ({
                    ...repair,
                    status: "completed" as const,
                    isDeductedFromOwnerTransfer: true,
                    deductedFromPaymentId: markReceived.id,
                    notes: `${repair.notes || ""}\nتم خصم الفاتورة من دفعة ${unit.name} بتاريخ ${receivedDate}.`.trim(),
                  })),
                ...maintenanceExpenseItems.map((item) => {
                  const itemUnit = item.unitId ? data.units.find((u) => u.id === item.unitId) : undefined;
                  return {
                    id: genId(),
                    buildingId: unit.buildingId,
                    unitId: itemUnit?.id,
                    description: item.description,
                    repairDate: receivedDate,
                    cost: item.cost,
                    status: "completed" as const,
                    notes: itemUnit
                      ? `بند صيانة لوحدة ${itemUnit.name} خُصم من دفعة ${unit.name}.`
                      : `بند صيانة عام للعقار خُصم من دفعة ${unit.name}.`,
                    createdAt: new Date().toISOString(),
                    isDeductedFromOwnerTransfer: true,
                    deductedFromPaymentId: markReceived.id,
                  };
                }),
              ],
              collectionFeeSettlements: [
                ...prev.collectionFeeSettlements,
                ...settlements.map((settlement) => ({
                  settlementId: genId(),
                  propertyId: unit.buildingId,
                  paymentId: settlement.paymentId,
                  sourcePaymentId: markReceived.id,
                  sourceUnitId: unit.id,
                  targetPaymentId: settlement.paymentId,
                  targetUnitId: prev.payments.find((item) => item.id === settlement.paymentId)?.unitId,
                  amount: settlement.amount,
                  date: receivedDate,
                  method: method === "office_collection" ? "cash" as const : method,
                  note: `تسوية رسوم تحصيل منصة إيجار من دفعة ${unit.name}`,
                  createdAt: new Date().toISOString(),
                })),
              ],
            }));
            setMarkReceived(null);
            showSuccess("تم تسجيل استلام الدفعة");
          }}
          onCancel={() => setMarkReceived(null)}
        />
      )}

      {/* Regenerate Payments Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={(open) => { if (!open && !savingRegenerate) { setRegenerateDialogOpen(false); setPendingContractUpdate(null); } }}>
        <DialogContent dir="rtl" className="w-[calc(100vw-32px)] max-w-sm rounded-3xl p-5 max-h-[calc(100vh-80px)] overflow-y-auto">
          <DialogHeader className="text-right">
            <DialogTitle className="text-right">تحديث الدفعات المستقبلية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-normal overflow-wrap-break-word">
              تم تعديل العقد. توجد دفعات مدفوعة مرتبطة بهذا العقد. هل تريد إعادة إنشاء الدفعات غير المدفوعة فقط؟
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground whitespace-normal overflow-wrap-break-word">
              لن يتم تعديل الدفعات التي تم استلامها مسبقاً.
            </p>
            <div className="flex flex-col gap-2 w-full mt-4 sm:flex-row sm:flex-row-reverse">
              <Button
                className="w-full sm:flex-1 rounded-xl h-11"
                disabled={savingRegenerate}
                onClick={async () => {
                  if (!pendingContractUpdate || savingRegenerate) return;
                  setSavingRegenerate(true);
                  try {
                    const contract: Contract = { ...pendingContractUpdate.original, ...pendingContractUpdate.updated };
                    const tenantResult = upsertTenant(data.tenants, {
                      name: contract.tenantName || "",
                      phone: contract.tenantPhone || tenant?.phone,
                      unitId: unit.id,
                      buildingId: building?.id,
                      contractId: contract.id,
                    });
                    const updatedTenant = { ...tenantResult.tenant, activeContractId: contract.id, updatedAt: new Date().toISOString() };
                    const existingUnitPayments = payments.filter(
                      (p) => p.contractId === contract.id,
                    );
                    const regenerated = regenerateUnpaidPayments(
                      contract,
                      existingUnitPayments,
                      building?.name || "",
                      unit.name,
                      contract.tenantName || tenant?.name || "",
                      updatedTenant.id,
                      updatedTenant.phone,
                    );
                    update((prev) => ({
                      ...prev,
                      tenants: tenantResult.isNew
                        ? [...prev.tenants, updatedTenant]
                        : prev.tenants.map((t) => t.id === updatedTenant.id ? updatedTenant : t),
                      contracts: prev.contracts.map((c) => (c.id === contract.id ? contract : c)),
                      payments: [
                        ...prev.payments.filter((p) => p.contractId !== contract.id),
                        ...regenerated,
                      ],
                    }));
                    setRegenerateDialogOpen(false);
                    setPendingContractUpdate(null);
                    setEditContract(null);
                    showSuccess("تم حفظ التعديلات وإعادة إنشاء الدفعات غير المدفوعة");
                  } finally {
                    setSavingRegenerate(false);
                  }
                }}
              >
                {savingRegenerate ? "جاري..." : "إعادة إنشاء الدفعات"}
              </Button>
              <Button
                variant="outline"
                className="w-full sm:flex-1 rounded-xl h-11"
                disabled={savingRegenerate}
                onClick={() => {
                  if (!pendingContractUpdate || savingRegenerate) return;
                  const contract: Contract = { ...pendingContractUpdate.original, ...pendingContractUpdate.updated };
                  const tenantResult = upsertTenant(data.tenants, {
                    name: contract.tenantName || "",
                    phone: contract.tenantPhone || tenant?.phone,
                    unitId: unit.id,
                    buildingId: building?.id,
                    contractId: contract.id,
                  });
                  const updatedTenant = { ...tenantResult.tenant, activeContractId: contract.id, updatedAt: new Date().toISOString() };
                  update((prev) => ({
                    ...prev,
                    tenants: tenantResult.isNew
                      ? [...prev.tenants, updatedTenant]
                      : prev.tenants.map((t) => t.id === updatedTenant.id ? updatedTenant : t),
                    contracts: prev.contracts.map((c) => (c.id === contract.id ? contract : c)),
                  }));
                  setRegenerateDialogOpen(false);
                  setPendingContractUpdate(null);
                  setEditContract(null);
                  showSuccess("تم حفظ تعديلات العقد بدون تغيير الدفعات");
                }}
              >
                حفظ العقد فقط
              </Button>
              <Button
                variant="ghost"
                className="w-full sm:flex-1 rounded-xl h-11"
                disabled={savingRegenerate}
                onClick={() => {
                  if (savingRegenerate) return;
                  setRegenerateDialogOpen(false);
                  setPendingContractUpdate(null);
                  setEditContract(null);
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {communicationGraceTarget && (
        <CommunicationGraceDialog
          open={!!communicationGraceTarget}
          onOpenChange={(open) => !open && setCommunicationGraceTarget(null)}
          title={communicationGraceTarget.kind === "payment" ? "مهلة تواصل لدفعة الإيجار" : "مهلة الرد على التجديد أو المغادرة"}
          description={communicationGraceTarget.kind === "payment"
            ? "حدد مهلة المستأجر للسداد. ستتوقف التذكيرات التلقائية لهذه الدفعة حتى نهايتها."
            : "حدد المهلة التي طلبها المستأجر لاتخاذ قرار التجديد أو مغادرة الوحدة."}
          currentUntil={communicationGraceTarget.kind === "payment"
            ? communicationGraceTarget.value.communicationGraceUntil
            : communicationGraceTarget.value.responseGraceUntil}
          currentReason={communicationGraceTarget.kind === "payment"
            ? communicationGraceTarget.value.communicationGraceReason
            : communicationGraceTarget.value.responseGraceReason}
          onSave={({ until, reason }) => {
            if (communicationGraceTarget.kind === "payment") {
              const id = communicationGraceTarget.value.id;
              update((previous) => ({
                ...previous,
                payments: previous.payments.map((payment) => payment.id === id ? {
                  ...payment,
                  communicationGraceUntil: until,
                  communicationGraceReason: reason,
                  communicationGraceCreatedAt: new Date().toISOString(),
                } : payment),
              }));
            } else {
              const id = communicationGraceTarget.value.id;
              update((previous) => ({
                ...previous,
                contracts: previous.contracts.map((contract) => contract.id === id ? {
                  ...contract,
                  responseGraceUntil: until,
                  responseGraceReason: reason,
                  responseGraceCreatedAt: new Date().toISOString(),
                } : contract),
              }));
            }
            showSuccess(`تم حفظ المهلة حتى ${formatDate(until)}`);
          }}
          onClear={() => {
            if (communicationGraceTarget.kind === "payment") {
              const id = communicationGraceTarget.value.id;
              update((previous) => ({
                ...previous,
                payments: previous.payments.map((payment) => payment.id === id ? {
                  ...payment,
                  communicationGraceUntil: undefined,
                  communicationGraceReason: undefined,
                  communicationGraceCreatedAt: undefined,
                } : payment),
              }));
            } else {
              const id = communicationGraceTarget.value.id;
              update((previous) => ({
                ...previous,
                contracts: previous.contracts.map((contract) => contract.id === id ? {
                  ...contract,
                  responseGraceUntil: undefined,
                  responseGraceReason: undefined,
                  responseGraceCreatedAt: undefined,
                } : contract),
              }));
            }
            showSuccess("تم إلغاء المهلة واستئناف التذكيرات التلقائية");
          }}
        />
      )}

      {/* WhatsApp Preview */}
      {whatsappPreview && (
        <WhatsappPreview
          open={!!whatsappPreview}
          onOpenChange={(o) => !o && setWhatsappPreview(null)}
          phones={whatsappPreview.phones}
          message={whatsappPreview.message}
          title="مراسلة المستأجر عبر واتساب"
        />
      )}
      {smsPreview && (
        <SmsPreview
          open={!!smsPreview}
          onOpenChange={(open) => !open && setSmsPreview(null)}
          phones={smsPreview.phones}
          message={smsPreview.message}
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
                  dedupeKey: `manual:${emailPreview.paymentId || emailPreview.contractId || emailPreview.tenantId}:${recipient}:${sentAt}`,
                })),
              ],
            }));
          }}
        />
      )}

      {/* Ejar Import Dialog */}
      <EjarImportDialog
        open={ejarImportOpen}
        onOpenChange={setEjarImportOpen}
        unitId={unit.id}
        buildingId={building?.id || ""}
        buildingName={building?.name || ""}
        unitName={unit.name}
        collectionFeePercent={getResolvedCollectionFeePercent(building, unit)}
        onSave={async (contract, payments) => {
          console.log("[Contract Save] Ejar import — tenant input:", { name: contract.tenantName, phone: contract.tenantPhone });
          const tenantResult = upsertTenant(data.tenants, {
            name: contract.tenantName || "",
            phone: contract.tenantPhone,
            unitId: unit.id,
            buildingId: building?.id,
            contractId: contract.id,
          });
          console.log("[Tenant] created or updated:", tenantResult.tenant.id, tenantResult.isNew ? "new" : "existing");
          const updatedTenant = { ...tenantResult.tenant, activeContractId: contract.id, updatedAt: new Date().toISOString() };
          contract.tenantId = updatedTenant.id;
          const updatedPayments = payments.map((p) => ({ ...p, tenantId: updatedTenant.id, tenantPhone: updatedTenant.phone }));
          await update((prev) => ({
            ...prev,
            tenants: tenantResult.isNew
              ? [...prev.tenants, updatedTenant]
              : prev.tenants.map((t) => t.id === updatedTenant.id ? updatedTenant : t),
            contracts: [...prev.contracts, contract],
            payments: [...prev.payments, ...updatedPayments],
          }));
        }}
      />
    </div>
  );
}
