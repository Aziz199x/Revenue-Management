import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import UnitForm from "@/components/forms/UnitForm";
import TenantForm from "@/components/forms/TenantForm";
import PaymentForm from "@/components/forms/PaymentForm";
import ContractForm from "@/components/forms/ContractForm";
import BillForm from "@/components/forms/BillForm";
import RepairForm from "@/components/forms/RepairForm";
import { useStore, genId } from "@/data/store";
import {
  formatMoney,
  formatDate,
  todayISO,
  daysUntil,
  effectiveStatus,
} from "@/data/helpers";
import {
  UNIT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  BILL_STATUS_LABELS,
  BILL_TYPE_LABELS,
  REPAIR_STATUS_LABELS,
} from "@/data/labels";
import { Payment, Contract, Bill, Repair, Tenant } from "@/data/types";
import { showSuccess } from "@/utils/toast";

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
  const tenant = data.tenants.find((t) => t.unitId === unit.id);
  const payments = data.payments
    .filter((p) => p.unitId === unit.id)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const contracts = data.contracts
    .filter((c) => c.unitId === unit.id)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  const bills = data.bills
    .filter((b) => b.unitId === unit.id)
    .sort((a, b) => b.billDate.localeCompare(a.billDate));
  const repairs = data.repairs
    .filter((r) => r.unitId === unit.id)
    .sort((a, b) => b.repairDate.localeCompare(a.repairDate));

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

  const removeItem = (key: "payments" | "contracts" | "bills" | "repairs" | "tenants", id: string) => {
    update((prev) => ({
      ...prev,
      [key]: (prev[key] as { id: string }[]).filter((x) => x.id !== id),
    }));
    showSuccess("تم الحذف");
  };

  return (
    <div>
      <PageHeader
        title={unit.name}
        subtitle={building ? `${building.name} · ${unit.type}` : unit.type}
        back
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
                    {unit.rentPeriod === "monthly" ? " / شهري" : " / سنوي"}
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

        <Tabs defaultValue="tenant" dir="rtl">
          <TabsList className="grid h-auto w-full grid-cols-5 rounded-2xl bg-muted p-1">
            <TabsTrigger value="tenant" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <User className="h-4 w-4" /> المستأجر
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <Wallet className="h-4 w-4" /> الدفعات
            </TabsTrigger>
            <TabsTrigger value="contract" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <FileText className="h-4 w-4" /> العقد
            </TabsTrigger>
            <TabsTrigger value="bills" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <Zap className="h-4 w-4" /> الفواتير
            </TabsTrigger>
            <TabsTrigger value="repairs" className="flex-col gap-1 rounded-xl py-2 text-[10px]">
              <Wrench className="h-4 w-4" /> الصيانة
            </TabsTrigger>
          </TabsList>

          {/* Tenant */}
          <TabsContent value="tenant" className="mt-4 space-y-3">
            {tenant ? (
              <div className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-secondary p-3">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-bold">{tenant.name}</p>
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
                  {tenant.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${tenant.phone}`} dir="ltr" className="text-primary underline-offset-2">
                        {tenant.phone}
                      </a>
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
          <TabsContent value="payments" className="mt-4 space-y-3">
            <Button className="w-full rounded-xl" onClick={() => setPaymentOpen(true)}>
              <Plus className="ml-1 h-4 w-4" /> تسجيل دفعة إيجار
            </Button>
            {payments.length === 0 ? (
              <EmptyState icon={Wallet} title="لا توجد دفعات مسجلة" />
            ) : (
              payments.map((p) => {
                const st = effectiveStatus(p);
                return (
                  <div key={p.id} className="rounded-3xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold">{formatMoney(p.amount)}</p>
                        {p.status === "partial" && (
                          <p className="text-xs text-amber-700">
                            مدفوع: {formatMoney(p.paidAmount || 0)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          تاريخ الدفعة: {formatDate(p.paymentDate)}
                        </p>
                        {p.nextDueDate && (
                          <p className="text-xs text-muted-foreground">
                            الاستحقاق القادم: {formatDate(p.nextDueDate)}
                            {daysUntil(p.nextDueDate) >= 0 && (
                              <span className="mr-1 text-primary">
                                (بعد {daysUntil(p.nextDueDate)} يوم)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={st} label={PAYMENT_STATUS_LABELS[st]} />
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditPayment(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeItem("payments", p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {p.notes && (
                      <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{p.notes}</p>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* Contract */}
          <TabsContent value="contract" className="mt-4 space-y-3">
            <Button className="w-full rounded-xl" onClick={() => setContractOpen(true)}>
              <Plus className="ml-1 h-4 w-4" /> إضافة عقد
            </Button>
            {contracts.length === 0 ? (
              <EmptyState icon={FileText} title="لا يوجد عقد مسجل" />
            ) : (
              contracts.map((c) => {
                const days = daysUntil(c.endDate);
                const expired = days < 0;
                const nearExpiry = !expired && days <= c.reminderDays;
                return (
                  <div key={c.id} className="rounded-3xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">من:</span>{" "}
                          <span className="font-semibold">{formatDate(c.startDate)}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">إلى:</span>{" "}
                          <span className="font-semibold">{formatDate(c.endDate)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          تذكير قبل {c.reminderDays} يوم من الانتهاء
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeItem("contracts", c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {c.notes && (
                      <p className="mt-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">{c.notes}</p>
                    )}
                  </div>
                );
              })
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
              repairs.map((r) => (
                <div key={r.id} className="rounded-3xl border border-border bg-card p-4">
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
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheets */}
      <FormSheet open={editUnitOpen} onOpenChange={setEditUnitOpen} title="تعديل الوحدة">
        <UnitForm
          initial={unit}
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              units: prev.units.map((u) => (u.id === unit.id ? { ...u, ...values } : u)),
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
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              payments: [...prev.payments, { id: genId(), unitId: unit.id, createdAt: todayISO(), ...values }],
            }));
            setPaymentOpen(false);
            showSuccess("تم تسجيل الدفعة");
          }}
        />
      </FormSheet>

      <FormSheet open={!!editPayment} onOpenChange={(o) => !o && setEditPayment(null)} title="تعديل الدفعة">
        {editPayment && (
          <PaymentForm
            initial={editPayment}
            onSubmit={(values) => {
              update((prev) => ({
                ...prev,
                payments: prev.payments.map((p) => (p.id === editPayment.id ? { ...p, ...values } : p)),
              }));
              setEditPayment(null);
              showSuccess("تم حفظ التعديلات");
            }}
          />
        )}
      </FormSheet>

      <FormSheet open={contractOpen} onOpenChange={setContractOpen} title="إضافة عقد">
        <ContractForm
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              contracts: [...prev.contracts, { id: genId(), unitId: unit.id, createdAt: todayISO(), ...values }],
            }));
            setContractOpen(false);
            showSuccess("تم حفظ العقد");
          }}
        />
      </FormSheet>

      <FormSheet open={!!editContract} onOpenChange={(o) => !o && setEditContract(null)} title="تعديل العقد">
        {editContract && (
          <ContractForm
            initial={editContract}
            onSubmit={(values) => {
              update((prev) => ({
                ...prev,
                contracts: prev.contracts.map((c) => (c.id === editContract.id ? { ...c, ...values } : c)),
              }));
              setEditContract(null);
              showSuccess("تم حفظ التعديلات");
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
    </div>
  );
}
