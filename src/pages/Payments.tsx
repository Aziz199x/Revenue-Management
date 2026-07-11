import { useMemo, useState } from "react";
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
    return [...set].sort().reverse();
  }, [data.payments]);

  const rows = useMemo(() => {
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

  const overdue = rows.filter((r) => r.status === "overdue");
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
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالوحدة أو المستأجر..." className="rounded-2xl bg-card pr-9" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Wallet} title="لا توجد دفعات" description="أضف عقود إيجار لتُنشأ الدفعات تلقائياً" />
        ) : (
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
                  )}
                </div>
              </div>
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
    </div>
  );
}
