import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, Search } from "lucide-react";
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
import StatusBadge from "@/components/shared/StatusBadge";
import { useStore } from "@/data/store";
import { formatMoney, formatDate, effectiveStatus, daysUntil } from "@/data/helpers";
import { PAYMENT_STATUS_LABELS } from "@/data/labels";
import { PaymentStatus } from "@/data/types";

export default function Payments() {
  const { data } = useStore();
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [query, setQuery] = useState("");

  const months = useMemo(() => {
    const set = new Set(data.payments.map((p) => p.paymentDate.slice(0, 7)));
    return [...set].sort().reverse();
  }, [data.payments]);

  const rows = useMemo(() => {
    return data.payments
      .map((p) => {
        const unit = data.units.find((u) => u.id === p.unitId);
        const building = unit
          ? data.buildings.find((b) => b.id === unit.buildingId)
          : undefined;
        const tenant = data.tenants.find((t) => t.unitId === p.unitId);
        return { payment: p, unit, building, tenant, status: effectiveStatus(p) };
      })
      .filter((r) => {
        if (buildingFilter !== "all" && r.building?.id !== buildingFilter) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (monthFilter !== "all" && !r.payment.paymentDate.startsWith(monthFilter)) return false;
        if (query.trim()) {
          const q = query.trim();
          const hay = `${r.unit?.name ?? ""} ${r.building?.name ?? ""} ${r.tenant?.name ?? ""}`;
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.payment.paymentDate.localeCompare(a.payment.paymentDate));
  }, [data, buildingFilter, statusFilter, monthFilter, query]);

  const upcoming = rows.filter(
    (r) =>
      r.payment.status !== "paid" &&
      r.payment.nextDueDate &&
      daysUntil(r.payment.nextDueDate) >= 0 &&
      daysUntil(r.payment.nextDueDate) <= 30,
  );
  const overdue = rows.filter((r) => r.status === "overdue");

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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالوحدة أو المستأجر..."
            className="rounded-2xl bg-card pr-9"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
          <Select value={monthFilter} onValueChange={setMonthFilter}>
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

        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="لا توجد دفعات"
            description="سجّل الدفعات من صفحة تفاصيل الوحدة"
          />
        ) : (
          rows.map(({ payment: p, unit, building, tenant, status }) => (
            <Link
              key={p.id}
              to={unit ? `/units/${unit.id}` : "#"}
              className="block rounded-3xl border border-border bg-card p-4 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{unit?.name ?? "وحدة محذوفة"}</p>
                  <p className="text-xs text-muted-foreground">
                    {building?.name}
                    {tenant ? ` · ${tenant.name}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {formatMoney(p.amount)}
                  </p>
                </div>
                <div className="text-left">
                  <StatusBadge status={status} label={PAYMENT_STATUS_LABELS[status]} />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(p.paymentDate)}
                  </p>
                  {p.nextDueDate && (
                    <p className="text-[11px] text-muted-foreground">
                      يستحق: {formatDate(p.nextDueDate)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
