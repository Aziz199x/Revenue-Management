import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Pencil, Trash2, Plus, User, Wallet, FileText, Zap, Wrench,
  Phone, IdCard, DoorOpen, CheckCircle2, MessageCircle, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormSheet from "@/components/shared/FormSheet";
import StatusBadge from "@/components/shared/StatusBadge";
import ReceivePaymentDialog from "@/components/shared/ReceivePaymentDialog";
import UnitForm from "@/components/forms/UnitForm";
import TenantForm from "@/components/forms/TenantForm";
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
  const [billOpen, setBillOpen] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [repairOpen, setRepairOpen] = useState(false);
  const [editRepair, setEditRepair] = useState<Repair | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [editRequest, setEditRequest] = useState<TenantRequest | null>(null);
  const [receivePayment, setReceivePayment] = useState<Payment | null>(null);
  const [whatsappPayment, setWhatsappPayment] = useState<Payment | null>(null);

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
  const computedStatus = calculateUnitStatus(unit, data.contracts);
  const activeContract = data.contracts.find((c) => {
    const t = todayISO();
    return c.unitId === unit.id && c.startDate <= t && c.endDate >= t;
  });
  const tenantName = activeContract?.tenantName;
  const tenant = data.tenants.find((t) => t.unitId === unit.id) ||
    (tenantName ? data.tenants.find((t) => t.name === tenantName) : undefined);

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

  const sheetOpen = (setter: (v: boolean) => void) => (o: boolean) => setter(o);

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
            <TabsTrigger value="tenant" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><User className="h-4 w-4" /> المستأجر</TabsTrigger>
            <TabsTrigger value="payments" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><Wallet className="h-4 w-4" /> الدفعات</TabsTrigger>
            <TabsTrigger value="contract" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><FileText className="h-4 w-4" /> العقد</TabsTrigger>
            <TabsTrigger value="requests" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><ClipboardList className="h-4 w-4" /> الطلبات</TabsTrigger>
            <TabsTrigger value="bills" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><Zap className="h-4 w-4" /> الفواتير</TabsTrigger>
            <TabsTrigger value="repairs" className="flex-col gap-0.5 rounded-xl py-1.5 text-[9px]"><Wrench className="h-4 w-4" /> الصيانة</TabsTrigger>
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
                  {tenant.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><a href={"tel:" + tenant.phone} dir="ltr" className="text-primary">{tenant.phone}</a></p>}
                  {tenant.nationalId && <p className="flex items-center gap-2"><IdCard className="h-4 w-4 text-muted-foreground" /><span dir="ltr">{tenant.nationalId}</span></p>}
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
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl" onClick={() => setContractOpen(true)}><Plus className="ml-1 h-4 w-4" /> عقد جديد</Button>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setPaymentOpen(true)}><Plus className="ml-1 h-4 w-4" /> دفعة يدوية</Button>
            </div>
            {payments.length === 0 ? <EmptyState icon={Wallet} title="لا توجد دفعات" description="أضف عقد إيجار لتُنشأ الدفعات تلقائياً" /> : payments.map((p) => {
              const st = effectiveStatus(p);
              const fee = calculateCollectionFee(p, data);
              return (
                <div key={p.id} className={"rounded-3xl border p-4 " + (st === "overdue" ? "border-red-200 bg-red-50/30" : "border-border bg-card")}>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheets */}
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

      {receivePayment && <ReceivePaymentDialog open={!!receivePayment} amount={receivePayment.amount} onOpenChange={(o) => !o && setReceivePayment(null)} onSubmit={(v) => handleReceive(receivePayment, v)} />}

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
    </div>
  );
}
