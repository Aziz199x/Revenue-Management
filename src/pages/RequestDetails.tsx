import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Pencil,
  Trash2,
  User,
  Phone,
  Building2,
  DoorOpen,
  ClipboardList,
  CalendarClock,
  DollarSign,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import FormSheet from "@/components/shared/FormSheet";
import TenantRequestForm from "@/components/forms/TenantRequestForm";
import { useStore, genId } from "@/data/store";
import { formatDate, formatMoney } from "@/data/helpers";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
} from "@/data/labels";
import { TenantRequest, Repair, RepairStatus } from "@/data/types";
import { showSuccess } from "@/utils/toast";

export default function RequestDetails() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { data, update } = useStore();
  const [editOpen, setEditOpen] = useState(false);

  const req = data.tenantRequests.find((r) => r.id === requestId);
  if (!req) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold">الطلب غير موجود</p>
        <Button className="mt-4 rounded-xl" onClick={() => navigate("/requests")}>
          العودة للطلبات
        </Button>
      </div>
    );
  }

  const unit = data.units.find((u) => u.id === req.unitId);
  const building = unit ? data.buildings.find((b) => b.id === unit.buildingId) : undefined;
  const tenant = req.tenantId
    ? data.tenants.find((t) => t.id === req.tenantId)
    : unit ? data.tenants.find((t) => t.unitId === unit.id) : undefined;

  const deleteRequest = () => {
    update((prev) => ({
      ...prev,
      tenantRequests: prev.tenantRequests.filter((r) => r.id !== req.id),
    }));
    showSuccess("تم حذف الطلب");
    navigate("/requests");
  };

  const addToRepairs = () => {
    if (!req.cost || req.cost <= 0) return;
    const repair: Repair = {
      id: genId(),
      unitId: req.unitId,
      description: `طلب مستأجر: ${req.title} (${REQUEST_TYPE_LABELS[req.type]})`,
      repairDate: req.actualCompletionDate || req.requestDate,
      cost: req.cost,
      contractor: req.technicianName,
      status: "completed" as RepairStatus,
      notes: req.notes,
      createdAt: new Date().toISOString(),
    };
    update((prev) => ({
      ...prev,
      repairs: [...prev.repairs, repair],
      tenantRequests: prev.tenantRequests.map((r) =>
        r.id === req.id ? { ...r, addedToRepairs: true } : r,
      ),
    }));
    showSuccess("تمت إضافة التكلفة إلى سجل الصيانة");
  };

  return (
    <div>
      <PageHeader
        title={req.title}
        subtitle={REQUEST_TYPE_LABELS[req.type]}
        back
        action={
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive" onClick={deleteRequest}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      <div className="space-y-4 p-4">
        {/* Status & Priority */}
        <div className="flex gap-2">
          <StatusBadge status={req.status} label={REQUEST_STATUS_LABELS[req.status]} />
          <StatusBadge status={req.priority} label={REQUEST_PRIORITY_LABELS[req.priority]} />
        </div>

        {/* Tenant info */}
        {tenant && (
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary p-2.5">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="text-sm">
                <p className="font-bold">{tenant.name}</p>
                {tenant.phone && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {tenant.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Building & Unit */}
        {building && unit && (
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {building.name}
              </p>
              <p className="flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-muted-foreground" />
                {unit.name}
              </p>
            </div>
          </div>
        )}

        {/* Description */}
        {req.description && (
          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-bold text-muted-foreground">وصف الطلب</p>
            <p className="text-sm">{req.description}</p>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <p className="text-[11px] text-muted-foreground">تاريخ الطلب</p>
            <p className="text-sm font-bold">{formatDate(req.requestDate)}</p>
          </div>
          {req.expectedCompletionDate && (
            <div className="rounded-2xl border border-border bg-card p-3 text-center">
              <p className="text-[11px] text-muted-foreground">متوقع الإنجاز</p>
              <p className="text-sm font-bold">{formatDate(req.expectedCompletionDate)}</p>
            </div>
          )}
          {req.actualCompletionDate && (
            <div className="rounded-2xl border border-border bg-card p-3 text-center">
              <p className="text-[11px] text-muted-foreground">تم الإنجاز</p>
              <p className="text-sm font-bold">{formatDate(req.actualCompletionDate)}</p>
            </div>
          )}
        </div>

        {/* Cost & Technician */}
        {req.cost !== undefined && req.cost > 0 && (
          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <DollarSign className="h-4 w-4 text-primary" />
              {formatMoney(req.cost)}
            </p>
            {req.technicianName && (
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
                {req.technicianName}
              </p>
            )}
            {req.status === "completed" && !req.addedToRepairs && (
              <Button size="sm" variant="outline" className="mt-2 w-full rounded-xl" onClick={addToRepairs}>
                إضافة التكلفة إلى سجل الصيانة
              </Button>
            )}
            {req.addedToRepairs && (
              <p className="mt-2 text-xs text-emerald-600">تمت إضافة التكلفة إلى سجل الصيانة</p>
            )}
          </div>
        )}

        {/* Notes */}
        {req.notes && (
          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-bold text-muted-foreground">ملاحظات</p>
            <p className="text-sm">{req.notes}</p>
          </div>
        )}

        {req.customType && (
          <p className="rounded-2xl bg-muted px-4 py-2 text-xs text-muted-foreground">
            نوع الطلب المخصص: {req.customType}
          </p>
        )}
      </div>

      <FormSheet open={editOpen} onOpenChange={setEditOpen} title="تعديل الطلب">
        <TenantRequestForm
          initial={req}
          unitId={req.unitId}
          buildingId={req.buildingId}
          tenantId={tenant?.id}
          tenantName={tenant?.name}
          buildingName={building?.name}
          unitName={unit?.name}
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              tenantRequests: prev.tenantRequests.map((r) =>
                r.id === req.id ? { ...r, ...values, updatedAt: new Date().toISOString() } : r,
              ),
            }));
            if (values.addedToRepairs && !req.addedToRepairs && values.cost && values.cost > 0) {
              const repair: Repair = {
                id: genId(),
                unitId: req.unitId,
                description: `طلب مستأجر: ${req.title} (${REQUEST_TYPE_LABELS[req.type]})`,
                repairDate: values.actualCompletionDate || req.requestDate,
                cost: values.cost,
                contractor: values.technicianName,
                status: "completed" as RepairStatus,
                notes: values.notes,
                createdAt: new Date().toISOString(),
              };
              update((prev) => ({
                ...prev,
                repairs: [...prev.repairs, repair],
              }));
            }
            setEditOpen(false);
            showSuccess("تم حفظ التعديلات");
          }}
        />
      </FormSheet>
    </div>
  );
}