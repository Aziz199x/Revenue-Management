<<<<<<< HEAD
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormSheet from "@/components/shared/FormSheet";
import StatusBadge from "@/components/shared/StatusBadge";
import TenantRequestForm from "@/components/forms/TenantRequestForm";
import { useStore, genId } from "@/data/store";
import { formatDate } from "@/data/helpers";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
} from "@/data/labels";
import {
  TenantRequest,
  RequestType,
  RequestStatus,
  RequestPriority,
} from "@/data/types";
import { showSuccess } from "@/utils/toast";

const REQUEST_TYPES_FILTER = [
  { value: "all", label: "كل الأنواع" },
  ...Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => ({
    value: k,
    label: v,
  })),
];

const STATUS_FILTERS = [
  { value: "all", label: "كل الحالات" },
  ...Object.entries(REQUEST_STATUS_LABELS).map(([k, v]) => ({
    value: k,
    label: v,
  })),
];

const PRIORITY_FILTERS = [
  { value: "all", label: "كل الأولويات" },
  ...Object.entries(REQUEST_PRIORITY_LABELS).map(([k, v]) => ({
    value: k,
    label: v,
  })),
];

export default function TenantRequests() {
  const { data, update } = useStore();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [requestOpen, setRequestOpen] = useState(false);

  const rows = useMemo(() => {
    return data.tenantRequests
      .map((r) => {
        const unit = data.units.find((u) => u.id === r.unitId);
        const building = unit
          ? data.buildings.find((b) => b.id === unit.buildingId)
          : undefined;
        const tenant = r.tenantId
          ? data.tenants.find((t) => t.id === r.tenantId)
          : data.tenants.find((t) => t.unitId === r.unitId);
        return { request: r, unit, building, tenant };
      })
      .filter((r) => {
        if (typeFilter !== "all" && r.request.type !== typeFilter) return false;
        if (statusFilter !== "all" && r.request.status !== statusFilter) return false;
        if (priorityFilter !== "all" && r.request.priority !== priorityFilter) return false;
        if (query.trim()) {
          const q = query.trim();
          const hay = `${r.tenant?.name ?? ""} ${r.unit?.name ?? ""} ${r.building?.name ?? ""} ${r.request.title}`;
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.request.requestDate.localeCompare(a.request.requestDate));
  }, [data, query, typeFilter, statusFilter, priorityFilter]);

  const urgentCount = data.tenantRequests.filter((r) => r.priority === "urgent" && r.status !== "completed" && r.status !== "cancelled").length;
  const openCount = data.tenantRequests.filter((r) => r.status !== "completed" && r.status !== "cancelled").length;

  return (
    <div>
      <PageHeader title="طلبات المستأجر" subtitle={`${data.tenantRequests.length} طلب`} />
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <div className="flex-1 rounded-3xl bg-amber-50 p-3 text-center">
            <p className="text-lg font-bold text-amber-700">{openCount}</p>
            <p className="text-[11px] font-semibold text-amber-600">طلبات مفتوحة</p>
          </div>
          <div className="flex-1 rounded-3xl bg-red-50 p-3 text-center">
            <p className="text-lg font-bold text-red-700">{urgentCount}</p>
            <p className="text-[11px] font-semibold text-red-600">عاجلة</p>
          </div>
        </div>

        <Button className="w-full rounded-xl" onClick={() => setRequestOpen(true)}>
          <Plus className="ml-1 h-4 w-4" /> إضافة طلب مستأجر
        </Button>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالمستأجر أو الوحدة أو العنوان..."
            className="rounded-2xl bg-card pr-9"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES_FILTER.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_FILTERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="لا توجد طلبات"
            description="أضف طلبات المستأجر لتتبعها هنا"
          />
        ) : (
          rows.map(({ request: r, unit, building, tenant }) => (
            <Link
              key={r.id}
              to={`/requests/${r.id}`}
              className={`block rounded-3xl border p-4 transition-transform active:scale-[0.98] ${
                r.priority === "urgent" && r.status !== "completed" && r.status !== "cancelled"
                  ? "border-red-200 bg-red-50/50"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {tenant?.name ?? "—"} · {unit?.name ?? "—"} · {building?.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {REQUEST_TYPE_LABELS[r.type]}
                    {r.customType ? ` (${r.customType})` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDate(r.requestDate)}
                  </p>
                </div>
                <div className="mr-2 flex flex-col items-end gap-1">
                  <StatusBadge status={r.status} label={REQUEST_STATUS_LABELS[r.status]} />
                  <StatusBadge status={r.priority} label={REQUEST_PRIORITY_LABELS[r.priority]} />
                </div>
              </div>
              {r.description && (
                <p className="mt-2 line-clamp-2 rounded-2xl bg-muted p-2.5 text-xs text-muted-foreground">
                  {r.description}
                </p>
              )}
            </Link>
          ))
        )}
      </div>

      <FormSheet open={requestOpen} onOpenChange={setRequestOpen} title="إضافة طلب مستأجر">
        <TenantRequestForm
          unitId=""
          buildingId=""
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
    </div>
  );
}
=======
import { useState } from "react";
import { ClipboardList, Plus, Search, Pencil, Trash2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormSheet from "@/components/shared/FormSheet";
import TenantRequestForm, { TenantRequestFormValues } from "@/components/forms/TenantRequestForm";
import { useStore, genId } from "@/data/store";
import { formatDate, todayISO, daysUntil } from "@/data/helpers";
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, REQUEST_PRIORITY_LABELS, STATUS_COLORS } from "@/data/labels";
import { TenantRequest, RequestStatus, RequestPriority } from "@/data/types";
import { showSuccess } from "@/utils/toast";

export default function TenantRequests() {
  const { data, update } = useStore();
  const [open, setOpen] = useState(false);
  const [editRequest, setEditRequest] = useState<TenantRequest | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const openRequests = data.tenantRequests.filter((r) => r.status !== "completed" && r.status !== "cancelled");
  const urgentRequests = openRequests.filter((r) => r.priority === "urgent");
  const overdueRequests = openRequests.filter((r) => r.expectedCompletionDate && daysUntil(r.expectedCompletionDate) < 0);
  const completedThisMonth = data.tenantRequests.filter((r) => {
    if (r.status !== "completed") return false;
    const month = todayISO().slice(0, 7);
    return (r.actualCompletionDate || r.updatedAt || "").startsWith(month);
  });

  const filtered = data.tenantRequests
    .filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (query.trim()) {
        const q = query.trim();
        const unit = data.units.find((u) => u.id === r.unitId);
        const building = data.buildings.find((b) => b.id === r.buildingId);
        const hay = `${r.title} ${r.tenantName || ""} ${unit?.name || ""} ${building?.name || ""}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.requestDate.localeCompare(a.requestDate));

  const handleSave = (values: TenantRequestFormValues) => {
    const now = todayISO();
    if (editRequest) {
      update((prev) => ({ ...prev, tenantRequests: prev.tenantRequests.map((r) => r.id === editRequest.id ? { ...r, ...values, updatedAt: now } : r) }));
    } else {
      update((prev) => ({ ...prev, tenantRequests: [...prev.tenantRequests, { id: genId(), createdAt: now, updatedAt: now, ...values }] }));
    }
    setOpen(false); setEditRequest(null); showSuccess("تم الحفظ");
  };

  const remove = (id: string) => { update((prev) => ({ ...prev, tenantRequests: prev.tenantRequests.filter((r) => r.id !== id) })); showSuccess("تم الحذف"); };

  return (
    <div>
      <PageHeader title="طلبات المستأجر" subtitle={`${openRequests.length} طلب مفتوح`} action={
        <Button size="sm" className="rounded-full" onClick={() => { setEditRequest(null); setOpen(true); }}><Plus className="ml-1 h-4 w-4" /> طلب</Button>
      } />
      <div className="space-y-3 p-4">
        {(openRequests.length > 0 || urgentRequests.length > 0 || overdueRequests.length > 0) && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-sky-50 p-2 text-center"><p className="text-lg font-bold text-sky-700">{openRequests.length}</p><p className="text-[10px] text-sky-600">مفتوح</p></div>
            <div className="rounded-2xl bg-red-50 p-2 text-center"><p className="text-lg font-bold text-red-700">{urgentRequests.length}</p><p className="text-[10px] text-red-600">عاجلة</p></div>
            <div className="rounded-2xl bg-amber-50 p-2 text-center"><p className="text-lg font-bold text-amber-700">{overdueRequests.length}</p><p className="text-[10px] text-amber-600">متأخرة</p></div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث..." className="rounded-2xl bg-card pr-9" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="rounded-xl bg-card text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{(Object.keys(REQUEST_STATUS_LABELS) as RequestStatus[]).map((s) => <SelectItem key={s} value={s}>{REQUEST_STATUS_LABELS[s]}</SelectItem>)}</SelectContent></Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger className="rounded-xl bg-card text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الأولويات</SelectItem>{(Object.keys(REQUEST_PRIORITY_LABELS) as RequestPriority[]).map((p) => <SelectItem key={p} value={p}>{REQUEST_PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent></Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="لا توجد طلبات" description="أضف طلب صيانة أو شكوى أو أي طلب آخر" />
        ) : (
          filtered.map((rq) => {
            const unit = data.units.find((u) => u.id === rq.unitId);
            const building = data.buildings.find((b) => b.id === rq.buildingId);
            const isOverdue = rq.expectedCompletionDate && daysUntil(rq.expectedCompletionDate) < 0 && rq.status !== "completed" && rq.status !== "cancelled";
            return (
              <div key={rq.id} className={"rounded-3xl border p-4 " + (rq.priority === "urgent" ? "border-red-200 bg-red-50/30" : isOverdue ? "border-amber-200 bg-amber-50/30" : "border-border bg-card")}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{rq.title}</p>
                      {rq.priority === "urgent" && <AlertCircle className="h-4 w-4 text-red-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[rq.type] || rq.type} · {formatDate(rq.requestDate)}</p>
                    {(building || unit) && <p className="text-xs text-muted-foreground">{building?.name}{unit ? " · " + unit.name : ""}</p>}
                    {rq.tenantName && <p className="text-xs text-muted-foreground">{rq.tenantName}</p>}
                    {rq.description && <p className="mt-1 text-sm">{rq.description}</p>}
                    {rq.expectedCompletionDate && (
                      <p className={"mt-1 flex items-center gap-1 text-[11px] " + (isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                        <Clock className="h-3 w-3" />
                        {isOverdue ? "متأخر: " : "متوقع: "}{formatDate(rq.expectedCompletionDate)}
                      </p>
                    )}
                    {rq.cost != null && <p className="text-xs font-semibold text-primary">التكلفة: {rq.cost.toLocaleString("ar-SA")} ر.س</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (STATUS_COLORS["req_" + rq.status] || "bg-slate-200")}>{REQUEST_STATUS_LABELS[rq.status]}</span>
                    <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (STATUS_COLORS["pri_" + rq.priority] || "bg-slate-200")}>{REQUEST_PRIORITY_LABELS[rq.priority]}</span>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => { setEditRequest(rq); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" className="rounded-lg text-destructive" onClick={() => remove(rq.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <FormSheet open={open || !!editRequest} onOpenChange={(o) => { setOpen(o); if (!o) setEditRequest(null); }} title={editRequest ? "تعديل الطلب" : "طلب جديد"}>
        <TenantRequestForm initial={editRequest ?? undefined} onSubmit={handleSave} />
      </FormSheet>
    </div>
  );
}
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
