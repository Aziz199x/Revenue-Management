import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
<<<<<<< HEAD
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
=======
  Pencil, Trash2, Plus, User, Wallet, FileText, Zap, Wrench,
  Phone, IdCard, DoorOpen, CheckCircle2, MessageCircle, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
<<<<<<< HEAD
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
=======
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormSheet from "@/components/shared/FormSheet";
import StatusBadge from "@/components/shared/StatusBadge";
import ReceivePaymentDialog from "@/components/shared/ReceivePaymentDialog";
import UnitForm from "@/components/forms/UnitForm";
import TenantForm from "@/components/forms/TenantForm";
<<<<<<< HEAD
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
  getPaymentsPerYear,
  normalizePaymentFinancials,
  getPaymentReceiveMethod,
  calculateNetAmountToTransferToOwner,
  getPaymentMaintenanceDeductionAmount,
  getPaymentMaintenanceDeductions,
} from "@/data/helpers";
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
function isCorruptedDisplayName(value: string | undefined): boolean {
  if (!value) return true;
  if (/[ØÙÃÂ�]|\uFFFD/.test(value)) return true;
  return false;
}
import WhatsappPreview from "@/components/shared/WhatsappPreview";
import EjarImportDialog from "@/components/shared/EjarImportDialog";
import { buildPaymentReminderMessage, fillTemplate } from "@/utils/whatsapp";
import { validatePhone } from "@/utils/whatsapp";
import { formatSarAmount, getContractEndDate, getDaysUntilDate, getPaymentAmount, hasContinuingContractForUnit, shouldShowContractExpiryReminder } from "@/data/helpers";
import { showSuccess, showError } from "@/utils/toast";

function MarkAsReceivedDialog({
  payment,
  onConfirm,
  onCancel,
}: {
  payment: Payment;
  onConfirm: (receivedDate: string, method: PaymentReceiveMethod, feePercent: number, notes?: string) => void;
  onCancel: () => void;
}) {
  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentReceiveMethod>("bank_transfer");
  const [notes, setNotes] = useState("");

  const grossAmount = payment.grossAmount ?? payment.amount;
  const feePercent = payment.collectionFeePercent ?? 0;
  const feeAmount = Math.round(grossAmount * feePercent) / 100;
  const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-[90vw] rounded-3xl dialog-safe">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right">تأكيد استلام الدفعة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
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
                  <span className="font-semibold">{formatMoney(netAmount)}</span>
                </div>
              </>
          </div>
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
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
              إلغاء
            </Button>
            <Button className="flex-1 rounded-xl" onClick={() => onConfirm(receivedDate, method, feePercent, notes.trim() || undefined)}>
              تأكيد الاستلام
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
=======
import ContractForm, { ContractFormValues } from "@/components/forms/ContractForm";
import PaymentForm, { PaymentFormValues } from "@/components/forms/PaymentForm";
import BillForm from "@/components/forms/BillForm";
import RepairForm from "@/components/forms/RepairForm";
import TenantRequestForm, { TenantRequestFormValues } from "@/components/forms/TenantRequestForm";
import { useStore, genId } from "@/data/store";
import {
  formatMoney, formatDate, todayISO, daysUntil,
  effectiveStatus, calculateUnitStatus, calculateContractStatus,
  regenerateContractPayments, calculateCollectionFee, calculateOwnerNet,
} from "@/data/helpers";
import {
  UNIT_STATUS_LABELS, PAYMENT_STATUS_LABELS,
  BILL_STATUS_LABELS, BILL_TYPE_LABELS,
  REPAIR_STATUS_LABELS, CONTRACT_STATUS_LABELS,
  REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, REQUEST_PRIORITY_LABELS,
  PAYMENT_METHOD_LABELS, STATUS_COLORS,
} from "@/data/labels";
import { Payment, Contract, Bill, Repair, Tenant, TenantRequest } from "@/data/types";
import { showSuccess } from "@/utils/toast";
import { buildWhatsappMessage, sendWhatsapp } from "@/utils/whatsapp";
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

export default function UnitDetails() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const { data, update } = useStore();

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
<<<<<<< HEAD
  const [markReceived, setMarkReceived] = useState<Payment | null>(null);
  const [showAllContractPayments, setShowAllContractPayments] = useState(false);
  const [ejarImportOpen, setEjarImportOpen] = useState(false);
  const [pendingContractUpdate, setPendingContractUpdate] = useState<{
    original: Contract;
    updated: ContractFormValues;
  } | null>(null);
  const [savingRegenerate, setSavingRegenerate] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [whatsappPreview, setWhatsappPreview] = useState<{ phone: string; message: string } | null>(null);
=======
  const [receivePayment, setReceivePayment] = useState<Payment | null>(null);
  const [whatsappPayment, setWhatsappPayment] = useState<Payment | null>(null);
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

  const unit = data.units.find((u) => u.id === unitId);
  if (!unit) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold">الوحدة غير موجودة</p>
        <Button className="mt-4 rounded-xl" onClick={() => navigate("/buildings")}>العودة للعقارات</Button>
      </div>
    );
  }

  const building = data.buildings.find((b) => b.id === unit.buildingId);
<<<<<<< HEAD
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
  const collapsedPayments = getVisiblePaymentsByContract(payments, { includePaidHistory: true });
  const visiblePayments = showAllContractPayments
    ? payments.filter((payment) => !payment.deletedAt)
    : collapsedPayments;
  const contracts = data.contracts
    .filter((c) => c.unitId === unit.id && !c.deletedAt)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  const bills = data.bills
    .filter((b) => b.unitId === unit.id)
    .sort((a, b) => b.billDate.localeCompare(a.billDate));
  const repairs = data.repairs
    .filter((r) => r.unitId === unit.id)
    .sort((a, b) => b.repairDate.localeCompare(a.repairDate));
  const requests = data.tenantRequests
    .filter((r) => r.unitId === unit.id)
    .sort((a, b) => b.requestDate.localeCompare(a.requestDate));
=======
  const computedStatus = calculateUnitStatus(unit, data.contracts);
  const activeContract = data.contracts.find((c) => {
    const t = todayISO();
    return c.unitId === unit.id && c.startDate <= t && c.endDate >= t;
  });
  const tenantName = activeContract?.tenantName;
  const tenant = data.tenants.find((t) => t.unitId === unit.id) ||
    (tenantName ? data.tenants.find((t) => t.name === tenantName) : undefined);
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

  const payments = data.payments.filter((p) => p.unitId === unit.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const contracts = data.contracts.filter((c) => c.unitId === unit.id).sort((a, b) => b.endDate.localeCompare(a.endDate));
  const bills = data.bills.filter((b) => b.unitId === unit.id).sort((a, b) => b.billDate.localeCompare(a.billDate));
  const repairs = data.repairs.filter((r) => r.unitId === unit.id).sort((a, b) => b.repairDate.localeCompare(a.repairDate));
  const requests = data.tenantRequests.filter((r) => r.unitId === unit.id).sort((a, b) => b.requestDate.localeCompare(a.requestDate));

  const maintenanceTotal = repairs.filter((r) => r.status !== "cancelled").reduce((s, r) => s + r.cost, 0);

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
    navigate(building ? "/buildings/" + building.id : "/buildings");
  };

  const handleSaveContract = (values: ContractFormValues, existing?: Contract) => {
    const contractId = existing?.id ?? genId();
    const contract: Contract = { ...existing, id: contractId, unitId: unit.id, buildingId: unit.buildingId, createdAt: existing?.createdAt ?? todayISO(), ...values };
    update((prev) => {
      const newContracts = existing ? prev.contracts.map((c) => c.id === contractId ? contract : c) : [...prev.contracts, contract];
      const existingPayments = prev.payments.filter((p) => p.contractId === contractId);
      const newPayments = regenerateContractPayments(contract, existingPayments, prev);
      const otherPayments = prev.payments.filter((p) => p.contractId !== contractId);
      let tenants = prev.tenants;
      const hasTenant = prev.tenants.some((t) => t.name === values.tenantName && t.unitId === unit.id);
      if (!hasTenant && values.tenantName) {
        tenants = prev.tenants.filter((t) => t.unitId !== unit.id);
        tenants = [...tenants, { id: genId(), unitId: unit.id, name: values.tenantName, phone: values.tenantPhone, createdAt: todayISO() }];
      }
      return { ...prev, contracts: newContracts, payments: [...otherPayments, ...newPayments], tenants };
    });
  };

  const handleDeleteContract = (c: Contract) => {
    update((prev) => ({ ...prev, contracts: prev.contracts.filter((x) => x.id !== c.id), payments: prev.payments.filter((p) => p.contractId !== c.id) }));
    showSuccess("تم حذف العقد");
  };

  const handleReceive = (payment: Payment, values: { receivedDate: string; paymentMethod: string; notes?: string }) => {
    update((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === payment.id ? { ...p, status: "paid" as const, receivedDate: values.receivedDate, paymentMethod: values.paymentMethod as any, notes: values.notes || p.notes } : p) }));
    showSuccess("تم تأكيد الاستلام");
  };

  const markUnpaid = (payment: Payment) => {
    update((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === payment.id ? { ...p, status: "unpaid" as const, receivedDate: undefined, paymentMethod: "", transferredToOwner: false } : p) }));
    showSuccess("تم تحديث الحالة");
  };

  const toggleTransfer = (payment: Payment) => {
    update((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === payment.id ? { ...p, transferredToOwner: !p.transferredToOwner, transferredDate: !p.transferredToOwner ? todayISO() : undefined } : p) }));
  };

  const handleWhatsapp = (payment: Payment, useBusiness: boolean) => {
    const msg = buildWhatsappMessage({ tenantName: payment.tenantName || tenant?.name, phone: tenant?.phone, unitName: unit.name, buildingName: building?.name, amount: payment.amount, dueDate: payment.dueDate, status: PAYMENT_STATUS_LABELS[effectiveStatus(payment)] });
    sendWhatsapp(tenant?.phone, msg, useBusiness);
  };

  const removeItem = (key: string, id: string) => {
    update((prev) => ({ ...prev, [key]: (prev as any)[key].filter((x: any) => x.id !== id) }));
    showSuccess("تم الحذف");
  };

<<<<<<< HEAD
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
=======
  const sheetOpen = (setter: (v: boolean) => void) => (o: boolean) => setter(o);
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

  return (
    <div>
      <PageHeader title={unit.name} subtitle={building ? building.name + " · " + unit.type : unit.type} back action={
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setEditUnitOpen(true)}><Pencil className="h-4 w-4" /></Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] rounded-3xl">
              <AlertDialogHeader className="text-right"><AlertDialogTitle>حذف الوحدة؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف الوحدة وجميع بياناتها.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2"><AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel><AlertDialogAction className="rounded-xl bg-destructive" onClick={deleteUnit}>حذف</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      } />

      <div className="space-y-4 p-4">
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-secondary p-2.5"><DoorOpen className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="font-bold">{formatMoney(unit.rentAmount)}<span className="text-xs font-normal text-muted-foreground"> / شهر</span></p>
                <p className="text-xs text-muted-foreground">{unit.floor ? "طابق " + unit.floor : ""}{unit.area ? " · " + unit.area + " م²" : ""}</p>
              </div>
            </div>
            <StatusBadge status={computedStatus} label={UNIT_STATUS_LABELS[computedStatus]} />
          </div>
        </div>

        <Tabs defaultValue="tenant" dir="rtl">
          <TabsList className="grid h-auto w-full grid-cols-6 rounded-2xl bg-muted p-1">
<<<<<<< HEAD
            <TabsTrigger value="tenant" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <User className="h-4 w-4" /> المستأجر
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <Wallet className="h-4 w-4" /> الدفعات
            </TabsTrigger>
            <TabsTrigger value="contract" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <FileText className="h-4 w-4" /> العقد
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <ClipboardList className="h-4 w-4" /> الطلبات
            </TabsTrigger>
            <TabsTrigger value="bills" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <Zap className="h-4 w-4" /> الفواتير
            </TabsTrigger>
            <TabsTrigger value="repairs" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <Wrench className="h-4 w-4" /> الصيانة
            </TabsTrigger>
=======
            <TabsTrigger value="tenant" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><User className="h-4 w-4" /> المستأجر</TabsTrigger>
            <TabsTrigger value="payments" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><Wallet className="h-4 w-4" /> الدفعات</TabsTrigger>
            <TabsTrigger value="contract" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><FileText className="h-4 w-4" /> العقد</TabsTrigger>
            <TabsTrigger value="requests" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><ClipboardList className="h-4 w-4" /> الطلبات</TabsTrigger>
            <TabsTrigger value="bills" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><Zap className="h-4 w-4" /> الفواتير</TabsTrigger>
            <TabsTrigger value="repairs" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><Wrench className="h-4 w-4" /> الصيانة</TabsTrigger>
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
          </TabsList>

          <TabsContent value="tenant" className="mt-4 space-y-3">
            {tenant ? (
              <div className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3"><div className="rounded-full bg-secondary p-3"><User className="h-5 w-5 text-primary" /></div><p className="font-bold">{tenant.name}</p></div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditTenant(tenant)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeItem("tenants", tenant.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-sm">
<<<<<<< HEAD
                  {tenant.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${tenant.phone}`} dir="ltr" className="text-primary underline-offset-2">
                        {tenant.phone}
                      </a>
                      <button
                        type="button"
                        className="mr-auto flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700 active:scale-95 transition-transform"
                        onClick={() => {
                          console.log('[WhatsApp] Button clicked');
                          const msg = fillTemplate(
                            data.settings.whatsappTemplates.paymentReminder,
                            {
                              tenantName: tenant.name,
                              buildingName: building?.name || "",
                              unitName: unit.name,
                              amount: unit.rentAmount.toLocaleString("ar-SA"),
                              dueDate: "",
                              contractEndDate: "",
                              ownerName: "",
                            },
                          );
                          setWhatsappPreview({ phone: tenant.phone!, message: msg });
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        تواصل واتساب
                      </button>
                    </p>
                  )}
                  {tenant.nationalId && (
                    <p className="flex items-center gap-2">
                      <IdCard className="h-4 w-4 text-muted-foreground" />
                      <span dir="ltr">{tenant.nationalId}</span>
                    </p>
                  )}
                  {tenant.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span dir="ltr">{tenant.email}</span>
                    </p>
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
=======
                  {tenant.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><a href={"tel:" + tenant.phone} dir="ltr" className="text-primary">{tenant.phone}</a></p>}
                  {tenant.nationalId && <p className="flex items-center gap-2"><IdCard className="h-4 w-4 text-muted-foreground" /><span dir="ltr">{tenant.nationalId}</span></p>}
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
                </div>
                {(unit.electricityAccountName || unit.electricityAccountNumber || unit.electricityMeterNumber || tenant.electricityAccountName || tenant.electricityAccountNumber) && (
                  <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm space-y-1">
                    <p className="flex items-center gap-1.5 font-bold text-amber-800"><Zap className="h-4 w-4" /> بيانات حساب الكهرباء</p>
                    {(unit.electricityAccountName || tenant.electricityAccountName) && <p className="text-xs">الاسم: {unit.electricityAccountName || tenant.electricityAccountName}</p>}
                    {(unit.electricityAccountNumber || tenant.electricityAccountNumber) && <p className="text-xs">رقم الحساب: {unit.electricityAccountNumber || tenant.electricityAccountNumber}</p>}
                    {(unit.electricityMeterNumber || tenant.electricityMeterNumber) && <p className="text-xs">رقم العداد: {unit.electricityMeterNumber || tenant.electricityMeterNumber}</p>}
                  </div>
                )}
                {tenant.notes && <p className="rounded-2xl bg-muted p-3 text-muted-foreground">{tenant.notes}</p>}
              </div>
            ) : (<><EmptyState icon={User} title="لا يوجد مستأجر" description="أضف عقد إيجار ليُنشأ المستأجر تلقائياً" /><Button className="w-full rounded-xl" onClick={() => setContractOpen(true)}><Plus className="ml-1 h-4 w-4" /> إضافة عقد</Button></>)}
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-3">
<<<<<<< HEAD
            <Button className="w-full rounded-xl" onClick={() => setPaymentOpen(true)}>
              <Plus className="ml-1 h-4 w-4" /> تسجيل دفعة إيجار
            </Button>
            {payments.length > collapsedPayments.length && (
              <Button variant="outline" size="sm" className="w-full rounded-xl text-xs" onClick={() => setShowAllContractPayments((current) => !current)}>
                {showAllContractPayments ? "إخفاء الدفعات المستقبلية" : "عرض كل دفعات العقد"}
              </Button>
            )}
            {visiblePayments.length === 0 ? (
              <EmptyState icon={Wallet} title="لا توجد دفعات مسجلة" description="أضف عقداً لإنشاء الدفعات تلقائياً" />
            ) : (
              visiblePayments.map((p) => {
                const st = effectiveStatus(p);
                const maintenanceDeductions = getPaymentMaintenanceDeductions(data, p.id);
                const maintenanceDeductionAmount = getPaymentMaintenanceDeductionAmount(data, p);
                return (
                  <div
                    key={p.id}
                    className={`flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border px-3 py-2.5 ${
                      st === "overdue" ? "border-red-200 bg-red-50/50" : "border-border bg-card"
                    }`}
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
                          <span className="rounded-2xl bg-amber-50 px-2 py-1 text-amber-700">
                            تم خصم صيانة: {formatMoney(maintenanceDeductionAmount)}
                            {maintenanceDeductions.length > 0
                              ? ` - ${maintenanceDeductions.map((item) => `${item.repair.description}${item.unit?.name ? ` (${item.unit.name})` : ""}`).join("، ")}`
                              : ""}
                          </span>
                        )}
                        <span className="text-muted-foreground">الصافي للمالك: {formatMoney(calculateNetAmountToTransferToOwner(normalizePaymentFinancials({ ...p, maintenanceDeductionAmount })))}</span>
                        <span className={p.ownerTransferred ? "text-emerald-700" : "text-amber-700"}>
                          {p.ownerTransferred ? `تم التحويل للمالك${p.ownerTransferDate ? ` · ${formatDate(p.ownerTransferDate)}` : ""}` : "هل تم التحويل للمالك؟"}
                        </span>
                      </div>
                    )}

                    {p.notes && (
                      <p className="min-w-0 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {p.notes}
                      </p>
                    )}

                    <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 border-t border-border/70 pt-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {(st === "unpaid" || st === "overdue") && (
                        <Button
                          size="sm"
                          className="h-auto min-h-8 max-w-full shrink-0 whitespace-normal rounded-full bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                          onClick={() => setMarkReceived(p)}
                        >
                          <CheckCircle2 className="ml-1 h-3.5 w-3.5 shrink-0" />
                          تم الاستلام
                        </Button>
                        )}
                      {(st === "unpaid" || st === "overdue") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-auto min-h-8 max-w-full shrink-0 whitespace-normal rounded-full px-3 py-1.5 text-xs"
                          onClick={() => {
                            const paymentTenant = data.tenants.find((t) => t.id === p.tenantId) || tenant;
                            const phone = p.tenantPhone || paymentTenant?.phone;
                            if (!phone) { showError("رقم جوال المستأجر غير موجود"); return; }
                            console.log("[WhatsApp Payment] selected payment id:", p.id);
                            console.log("[WhatsApp Payment] raw amount fields:", {
                              grossAmount: p.grossAmount,
                              amount: p.amount,
                            });
                            const paymentAmount = getPaymentAmount(p);
                            const formattedAmount = formatSarAmount(paymentAmount);
                            console.log("[WhatsApp Payment] final formatted amount:", formattedAmount);
                            if (!paymentAmount) { showError("مبلغ الدفعة غير صحيح"); return; }
                            const msg = buildPaymentReminderMessage({
                              tenantName: p.tenantName || paymentTenant?.name,
                              buildingName: building?.name || "",
                              unitName: unit.name,
                              amount: formattedAmount,
                              dueDate: p.dueDateGregorian || p.paymentDate,
                              isOverdue: st === "overdue",
                            });
                            setWhatsappPreview({ phone, message: msg });
                          }}
                        >
                          <MessageCircle className="ml-1 h-3.5 w-3.5 shrink-0" />
                          واتساب
                        </Button>
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
          <TabsContent value="contract" className="mt-4 space-y-3">
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
                return (
                  <div key={c.id} className="rounded-3xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          {c.importedFromEjar && (
                            <span className="inline-block rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">مستورد من إيجار</span>
                          )}
                          {c.autoRenewal && (
                            <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">{AUTO_RENEWAL_LABEL}</span>
                          )}
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
          <TabsContent value="requests" className="mt-4 space-y-3">
            <Button className="w-full rounded-xl" onClick={() => setRequestOpen(true)}>
              <Plus className="ml-1 h-4 w-4" /> إضافة طلب مستأجر
            </Button>
            {requests.length === 0 ? (
              <EmptyState icon={ClipboardList} title="لا توجد طلبات" description="أضف طلبات المستأجر من هنا" />
            ) : (
              requests.map((r) => (
                <div key={r.id} className="rounded-3xl border border-border bg-card p-4">
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
          <TabsContent value="bills" className="mt-4 space-y-3">
            <Button className="w-full rounded-xl" onClick={() => setBillOpen(true)}>
              <Plus className="ml-1 h-4 w-4" /> إضافة فاتورة
            </Button>
            {bills.length === 0 ? (
              <EmptyState icon={Zap} title="لا توجد فواتير مسجلة" />
            ) : (
              bills.map((b) => (
                <div key={b.id} className="rounded-3xl border border-border bg-card p-4">
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
          <TabsContent value="repairs" className="mt-4 space-y-3">
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
                <div key={r.id} className="rounded-3xl border border-border bg-card p-4">
=======
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl" onClick={() => setContractOpen(true)}><Plus className="ml-1 h-4 w-4" /> عقد جديد</Button>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setPaymentOpen(true)}><Plus className="ml-1 h-4 w-4" /> دفعة يدوية</Button>
            </div>
            {payments.length === 0 ? <EmptyState icon={Wallet} title="لا توجد دفعات" description="أضف عقد إيجار لتُنشأ الدفعات تلقائياً" /> : payments.map((p) => {
              const st = effectiveStatus(p);
              const fee = calculateCollectionFee(p, data);
              return (
                <div key={p.id} className={"rounded-3xl border p-4 " + (st === "overdue" ? "border-red-200 bg-red-50/30" : "border-border bg-card")}>
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold">{formatMoney(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">الاستحقاق: {formatDate(p.dueDate)}{daysUntil(p.dueDate) > 0 ? " (بعد " + daysUntil(p.dueDate) + " يوم)" : daysUntil(p.dueDate) < 0 ? " (متأخر)" : ""}</p>
                      {p.status === "paid" && p.receivedDate && <p className="text-xs text-emerald-700">تم الاستلام: {formatDate(p.receivedDate)}</p>}
                      {p.status === "paid" && p.paymentMethod && <p className="text-xs text-muted-foreground">طريقة الدفع: {PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</p>}
                      {p.status === "paid" && fee > 0 && <p className="text-xs text-muted-foreground">تحصيل المكتب: {formatMoney(fee)} · صافي المالك: {formatMoney(calculateOwnerNet(p, data))}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={st} label={PAYMENT_STATUS_LABELS[st]} />
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setEditPayment(p)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-destructive" onClick={() => removeItem("payments", p.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>
<<<<<<< HEAD
                  {r.notes && (
                    <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{r.notes}</p>
                  )}
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
=======
                  {p.notes && <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{p.notes}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {st !== "paid" && <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => setReceivePayment(p)}><CheckCircle2 className="ml-1 h-3.5 w-3.5" /> تم الاستلام</Button>}
                    {p.status === "paid" && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => markUnpaid(p)}>إلغاء الاستلام</Button>}
                    {p.status === "paid" && <label className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs"><Switch checked={!!p.transferredToOwner} onCheckedChange={() => toggleTransfer(p)} className="scale-75" /> تم التحويل للمالك</label>}
                    {tenant?.phone && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setWhatsappPayment(p)}><MessageCircle className="ml-1 h-3.5 w-3.5" /> واتساب</Button>}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="contract" className="mt-4 space-y-3">
            <Button className="w-full rounded-xl" onClick={() => setContractOpen(true)}><Plus className="ml-1 h-4 w-4" /> إضافة عقد</Button>
            {contracts.length === 0 ? <EmptyState icon={FileText} title="لا يوجد عقد مسجل" /> : contracts.map((c) => {
              const status = calculateContractStatus(c);
              const days = daysUntil(c.endDate);
              return (
                <div key={c.id} className="rounded-3xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 text-sm">
                      <p className="font-bold">{c.tenantName}</p>
                      {c.contractNumber && <p className="text-xs text-muted-foreground">رقم العقد: {c.contractNumber}</p>}
                      <p><span className="text-muted-foreground">من:</span> <span className="font-semibold">{formatDate(c.startDate)}</span></p>
                      <p><span className="text-muted-foreground">إلى:</span> <span className="font-semibold">{formatDate(c.endDate)}</span></p>
                      <p className="text-xs text-muted-foreground">الإيجار السنوي: {formatMoney(c.annualRent)}</p>
                      <p className="text-xs text-muted-foreground">التجديد التلقائي: {c.autoRenewal ? "نعم" : "لا"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold " + (STATUS_COLORS[status] || "bg-slate-200")}>{CONTRACT_STATUS_LABELS[status]}{status === "ending_soon" ? " (" + days + " يوم)" : ""}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditContract(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[90vw] rounded-3xl"><AlertDialogHeader className="text-right"><AlertDialogTitle>حذف العقد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف العقد والمدفوعات غير المدفوعة.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="flex-row gap-2"><AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel><AlertDialogAction className="rounded-xl bg-destructive" onClick={() => handleDeleteContract(c)}>حذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                  {c.notes && <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{c.notes}</p>}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-3">
            <Button className="w-full rounded-xl" onClick={() => setRequestOpen(true)}><Plus className="ml-1 h-4 w-4" /> طلب جديد</Button>
            {requests.length === 0 ? <EmptyState icon={ClipboardList} title="لا توجد طلبات" /> : requests.map((rq) => (
              <div key={rq.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div><p className="font-bold">{rq.title}</p><p className="text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[rq.type] || rq.type} · {formatDate(rq.requestDate)}</p>{rq.description && <p className="mt-1 text-sm">{rq.description}</p>}</div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (STATUS_COLORS["req_" + rq.status] || "bg-slate-200")}>{REQUEST_STATUS_LABELS[rq.status]}</span>
                    <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (STATUS_COLORS["pri_" + rq.priority] || "bg-slate-200")}>{REQUEST_PRIORITY_LABELS[rq.priority]}</span>
                  </div>
                </div>
                <div className="mt-2 flex gap-1"><Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setEditRequest(rq)}><Pencil className="h-3 w-3" /></Button><Button variant="ghost" size="sm" className="rounded-lg text-destructive" onClick={() => removeItem("tenantRequests", rq.id)}><Trash2 className="h-3 w-3" /></Button></div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="bills" className="mt-4 space-y-3">
            <Button className="w-full rounded-xl" onClick={() => setBillOpen(true)}><Plus className="ml-1 h-4 w-4" /> إضافة فاتورة</Button>
            {bills.length === 0 ? <EmptyState icon={Zap} title="لا توجد فواتير" /> : bills.map((b) => (
              <div key={b.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div><p className="font-bold">{b.type === "other" && b.typeLabel ? b.typeLabel : BILL_TYPE_LABELS[b.type]} <span className="mr-2 text-primary">{formatMoney(b.amount)}</span></p><p className="text-xs text-muted-foreground">{formatDate(b.billDate)}{b.dueDate ? " · يستحق: " + formatDate(b.dueDate) : ""}</p></div>
                  <div className="flex flex-col items-end gap-2"><StatusBadge status={b.status} label={BILL_STATUS_LABELS[b.status]} /><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditBill(b)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeItem("bills", b.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>
                </div>
                {b.notes && <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{b.notes}</p>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="repairs" className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3"><span className="text-sm font-semibold text-secondary-foreground">إجمالي تكاليف الصيانة</span><span className="font-bold text-primary">{formatMoney(maintenanceTotal)}</span></div>
            <Button className="w-full rounded-xl" onClick={() => setRepairOpen(true)}><Plus className="ml-1 h-4 w-4" /> إضافة صيانة</Button>
            {repairs.length === 0 ? <EmptyState icon={Wrench} title="لا توجد أعمال صيانة" /> : repairs.map((r) => (
              <div key={r.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div><p className="font-bold">{r.description}</p><p className="text-xs text-muted-foreground">{formatDate(r.repairDate)}{r.contractor ? " · " + r.contractor : ""}</p><p className="text-sm font-semibold text-primary">{formatMoney(r.cost)}</p></div>
                  <div className="flex flex-col items-end gap-2"><StatusBadge status={r.status} label={REPAIR_STATUS_LABELS[r.status]} /><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditRepair(r)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeItem("repairs", r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>
                </div>
                {r.notes && <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{r.notes}</p>}
              </div>
            ))}
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
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
<<<<<<< HEAD
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
            const updatePayments = overrideChanged && window.confirm("هل تريد تطبيق نسبة التحصيل على الدفعات غير المدفوعة لهذه الوحدة؟\n\nموافق: سيتم تحديث الدفعات غير المدفوعة فقط.\nإلغاء: سيتم حفظ النسبة دون تطبيقها على الدفعات الحالية.");
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
=======
      <FormSheet open={editUnitOpen} onOpenChange={setEditUnitOpen} title="تعديل الوحدة"><UnitForm initial={unit} onSubmit={(values) => { update((prev) => ({ ...prev, units: prev.units.map((u) => u.id === unit.id ? { ...u, ...values } : u) })); setEditUnitOpen(false); showSuccess("تم الحفظ"); }} /></FormSheet>
      <FormSheet open={tenantOpen} onOpenChange={setTenantOpen} title="إضافة مستأجر"><TenantForm onSubmit={(values) => { update((prev) => ({ ...prev, tenants: [...prev.tenants, { id: genId(), unitId: unit.id, createdAt: todayISO(), ...values }] })); setTenantOpen(false); showSuccess("تمت الإضافة"); }} /></FormSheet>
      <FormSheet open={!!editTenant} onOpenChange={(o) => !o && setEditTenant(null)} title="تعديل المستأجر">{editTenant && <TenantForm initial={editTenant} onSubmit={(values) => { update((prev) => ({ ...prev, tenants: prev.tenants.map((t) => t.id === editTenant.id ? { ...t, ...values } : t) })); setEditTenant(null); showSuccess("تم الحفظ"); }} />}</FormSheet>
      <FormSheet open={paymentOpen} onOpenChange={setPaymentOpen} title="دفعة يدوية"><PaymentForm defaultAmount={unit.rentAmount} onSubmit={(values: PaymentFormValues) => { update((prev) => ({ ...prev, payments: [...prev.payments, { id: genId(), unitId: unit.id, createdAt: todayISO(), ...values }] })); setPaymentOpen(false); showSuccess("تم التسجيل"); }} /></FormSheet>
      <FormSheet open={!!editPayment} onOpenChange={(o) => !o && setEditPayment(null)} title="تعديل الدفعة">{editPayment && <PaymentForm initial={editPayment} onSubmit={(values: PaymentFormValues) => { update((prev) => ({ ...prev, payments: prev.payments.map((p) => p.id === editPayment.id ? { ...p, ...values } : p) })); setEditPayment(null); showSuccess("تم الحفظ"); }} />}</FormSheet>
      <FormSheet open={contractOpen || !!editContract} onOpenChange={(o) => { setContractOpen(o); if (!o) setEditContract(null); }} title={editContract ? "تعديل العقد" : "إضافة عقد"}><ContractForm initial={editContract ?? undefined} defaultBuildingCollectionPct={building?.collectionPercentage} onSubmit={(values) => { handleSaveContract(values, editContract ?? undefined); setContractOpen(false); setEditContract(null); showSuccess(editContract ? "تم تحديث العقد" : "تم حفظ العقد"); }} /></FormSheet>
      <FormSheet open={billOpen} onOpenChange={setBillOpen} title="إضافة فاتورة"><BillForm onSubmit={(values) => { update((prev) => ({ ...prev, bills: [...prev.bills, { id: genId(), unitId: unit.id, createdAt: todayISO(), ...values }] })); setBillOpen(false); showSuccess("تمت الإضافة"); }} /></FormSheet>
      <FormSheet open={!!editBill} onOpenChange={(o) => !o && setEditBill(null)} title="تعديل الفاتورة">{editBill && <BillForm initial={editBill} onSubmit={(values) => { update((prev) => ({ ...prev, bills: prev.bills.map((b) => b.id === editBill.id ? { ...b, ...values } : b) })); setEditBill(null); showSuccess("تم الحفظ"); }} />}</FormSheet>
      <FormSheet open={repairOpen} onOpenChange={setRepairOpen} title="إضافة صيانة"><RepairForm onSubmit={(values) => { update((prev) => ({ ...prev, repairs: [...prev.repairs, { id: genId(), unitId: unit.id, createdAt: todayISO(), ...values }] })); setRepairOpen(false); showSuccess("تمت الإضافة"); }} /></FormSheet>
      <FormSheet open={!!editRepair} onOpenChange={(o) => !o && setEditRepair(null)} title="تعديل الصيانة">{editRepair && <RepairForm initial={editRepair} onSubmit={(values) => { update((prev) => ({ ...prev, repairs: prev.repairs.map((r) => r.id === editRepair.id ? { ...r, ...values } : r) })); setEditRepair(null); showSuccess("تم الحفظ"); }} />}</FormSheet>
      <FormSheet open={requestOpen || !!editRequest} onOpenChange={(o) => { setRequestOpen(o); if (!o) setEditRequest(null); }} title={editRequest ? "تعديل الطلب" : "طلب جديد"}><TenantRequestForm initial={editRequest ?? undefined} onSubmit={(values: TenantRequestFormValues) => { const now = todayISO(); update((prev) => editRequest ? { ...prev, tenantRequests: prev.tenantRequests.map((r) => r.id === editRequest.id ? { ...r, ...values, updatedAt: now } : r) } : { ...prev, tenantRequests: [...prev.tenantRequests, { id: genId(), unitId: unit.id, buildingId: unit.buildingId, createdAt: now, updatedAt: now, ...values }] }); setRequestOpen(false); setEditRequest(null); showSuccess("تم الحفظ"); }} /></FormSheet>
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

      {receivePayment && <ReceivePaymentDialog open={!!receivePayment} amount={receivePayment.amount} onOpenChange={(o) => !o && setReceivePayment(null)} onSubmit={(v) => handleReceive(receivePayment, v)} />}

<<<<<<< HEAD
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
                ownerTransferred: false,
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
            onSubmit={async (values) => {
              try {
                console.log("[Edit Payment] formData:", values);
                await update((prev) => ({
                  ...prev,
                  payments: prev.payments.map((payment) => {
                    if (payment.id !== editPayment.id) return payment;
                    const grossAmount = values.amount;
                    const collectionFeePercent = payment.collectionFeePercent ?? 0;
                    const collectionFeeAmount = Math.round(grossAmount * collectionFeePercent) / 100;
                    const netAmountAfterCollectionFee = Math.round((grossAmount - collectionFeeAmount) * 100) / 100;
                    const paid = values.status === "paid";
                    return normalizePaymentFinancials({
                      ...payment,
                      ...values,
                      grossAmount,
                      collectionFeeAmount,
                      netAmountAfterCollectionFee,
                      maintenanceDeductionAmount: getPaymentMaintenanceDeductionAmount(prev, payment),
                      receivedDate: paid ? values.receivedDate : undefined,
                      receivedAmount: paid ? values.amount : values.status === "partial" ? values.paidAmount : undefined,
                      paidAmount: values.status === "partial" ? values.paidAmount : undefined,
                      paymentMethod: paid ? values.paymentMethod : undefined,
                      receiveMethod: paid ? values.receiveMethod : undefined,
                      collectionFeeStatus: paid ? payment.collectionFeeStatus : undefined,
                      collectionFeeReason: paid ? payment.collectionFeeReason : undefined,
                      collectionFeeSettledAt: paid ? payment.collectionFeeSettledAt : undefined,
                      collectionFeeSettlementNote: paid ? payment.collectionFeeSettlementNote : undefined,
                      collectionFeeSettledAmount: paid ? payment.collectionFeeSettledAmount : undefined,
                      collectionFeeRemainingAmount: paid ? payment.collectionFeeRemainingAmount : undefined,
                      ownerTransferred: paid ? (payment.ownerTransferred ?? false) : false,
                      ownerTransferDate: paid ? payment.ownerTransferDate : null,
                      ownerTransferMethod: paid ? payment.ownerTransferMethod : null,
                      ownerTransferNotes: paid ? (payment.ownerTransferNotes ?? "") : "",
                    });
                  }),
                }));
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
            onSubmit={(values) => {
              update((prev) => ({
                ...prev,
                repairs: prev.repairs.map((r) => (r.id === editRepair.id ? { ...r, ...values } : r)),
              }));
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
          onConfirm={(receivedDate, method, feePercent, notes) => {
            const grossAmount = markReceived.grossAmount ?? markReceived.amount;
            const collectionFeeAmount = Math.round(grossAmount * feePercent) / 100;
            const netAmountAfterCollectionFee = Math.round((grossAmount - collectionFeeAmount) * 100) / 100;
            update((prev) => ({
              ...prev,
              payments: prev.payments.map((p) =>
                p.id === markReceived.id
                  ? normalizePaymentFinancials({ ...p, status: "paid" as PaymentStatus, receivedDate, paymentMethod: method === "office_collection" ? undefined : method, receiveMethod: method, notes: notes || p.notes, grossAmount, collectionFeePercent: feePercent, collectionFeePercentage: feePercent, collectionFeeAmount, netAmountAfterCollectionFee })
                  : p,
              ),
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

      {/* WhatsApp Preview */}
      {whatsappPreview && (
        <WhatsappPreview
          open={!!whatsappPreview}
          onOpenChange={(o) => !o && setWhatsappPreview(null)}
          phone={whatsappPreview.phone}
          message={whatsappPreview.message}
          title="مراسلة المستأجر عبر واتساب"
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
=======
      {whatsappPayment && (
        <AlertDialog open={!!whatsappPayment} onOpenChange={(o) => !o && setWhatsappPayment(null)}>
          <AlertDialogContent className="max-w-[90vw] rounded-3xl">
            <AlertDialogHeader className="text-right"><AlertDialogTitle>إرسال تذكير عبر واتساب</AlertDialogTitle><AlertDialogDescription>اختر التطبيق</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2">
              <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
              <AlertDialogAction className="rounded-xl" onClick={() => { handleWhatsapp(whatsappPayment, false); setWhatsappPayment(null); }}>واتساب</AlertDialogAction>
              <AlertDialogAction className="rounded-xl bg-emerald-600" onClick={() => { handleWhatsapp(whatsappPayment, true); setWhatsappPayment(null); }}>واتساب بزنس</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
    </div>
  );
}
