import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  DoorOpen,
  Pencil,
  Trash2,
  Wrench,
  CalendarClock,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useStore, genId } from "@/data/store";
import { buildingStats, formatMoney, formatDate, todayISO, calculateUnitStatus } from "@/data/helpers";
import { UNIT_STATUS_LABELS, RENT_PERIOD_LABELS } from "@/data/labels";
import { showSuccess } from "@/utils/toast";

export default function BuildingDetails() {
  const { buildingId } = useParams();
  const navigate = useNavigate();
  const { data, update } = useStore();
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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
        repairs: prev.repairs.filter((r) => !unitIds.has(r.unitId)),
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

      <div className="space-y-4 p-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-primary p-4 text-primary-foreground">
            <Wallet className="mb-1 h-5 w-5 opacity-80" />
            <p className="text-xs opacity-80">إجمالي الدخل</p>
            <p className="text-lg font-bold">{formatMoney(stats.totalIncome)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <Wrench className="mb-1 h-5 w-5 text-amber-600" />
            <p className="text-xs text-muted-foreground">تكاليف الصيانة</p>
            <p className="text-lg font-bold">{formatMoney(stats.maintenanceCost)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">مجموع الإيجارات السنوية</p>
            <p className="text-sm font-bold">{formatMoney(stats.totalAnnualRent)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">غير مدفوع / متأخر</p>
            <p className="text-sm font-bold text-red-600">{formatMoney(stats.unpaidTotal)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">تحصيل المكتب</p>
            <p className="text-sm font-bold text-orange-600">{formatMoney(stats.collectionFeeTotal)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">صافي المستحق للمالك</p>
            <p className="text-sm font-bold text-primary">{formatMoney(stats.netToOwner)}</p>
          </div>
        </div>
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
        <div className="space-y-2 rounded-3xl border border-border bg-card p-4 text-sm">
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
            const computedStatus = calculateUnitStatus(u, data.contracts);
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
                  <StatusBadge status={computedStatus} label={UNIT_STATUS_LABELS[computedStatus]} />
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {formatMoney(u.rentAmount)}
                    <span className="text-muted-foreground"> / {RENT_PERIOD_LABELS[u.rentPeriod]}</span>
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <FormSheet open={addUnitOpen} onOpenChange={setAddUnitOpen} title="إضافة وحدة جديدة">
        <UnitForm
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              units: [
                ...prev.units,
                { id: genId(), buildingId: building.id, createdAt: todayISO(), ...values },
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
            update((prev) => ({
              ...prev,
              buildings: prev.buildings.map((b) =>
                b.id === building.id ? { ...b, ...values } : b,
              ),
            }));
            setEditOpen(false);
            showSuccess("تم حفظ التعديلات");
          }}
        />
      </FormSheet>
    </div>
  );
}