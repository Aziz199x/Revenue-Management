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
