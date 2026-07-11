import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Building2, Wallet, Wrench, TrendingUp, ArrowLeftRight, Percent, FileDown, CalendarClock, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { useStore } from "@/data/store";
import { globalStats, buildingStats, collectReminders, formatMoney, formatDate, calculateUnitStatus, calculateContractStatus, effectiveStatus } from "@/data/helpers";
import { exportCSV } from "@/utils/backup";
import { exportJSON } from "@/utils/backup";

export default function Reports() {
  const { data } = useStore();
  const [yearFilter, setYearFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const stats = globalStats(data);
  const reminders = collectReminders(data);

  const years = useMemo(() => {
    const set = new Set<string>();
    data.payments.forEach((p) => set.add(p.dueDate.slice(0, 4)));
    data.contracts.forEach((c) => set.add(c.startDate.slice(0, 4)));
    return [...set].sort().reverse();
  }, [data.payments, data.contracts]);

  const filteredPayments = useMemo(() => {
    return data.payments.filter((p) => {
      if (yearFilter !== "all" && !p.dueDate.startsWith(yearFilter)) return false;
      if (buildingFilter !== "all") {
        const unit = data.units.find((u) => u.id === p.unitId);
        if (unit?.buildingId !== buildingFilter && p.buildingId !== buildingFilter) return false;
      }
      return true;
    });
  }, [data, yearFilter, buildingFilter]);

  const paidTotal = filteredPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const unpaidTotal = filteredPayments.filter((p) => effectiveStatus(p) !== "paid").reduce((s, p) => s + p.amount, 0);
  const overdueTotal = filteredPayments.filter((p) => effectiveStatus(p) === "overdue").reduce((s, p) => s + p.amount, 0);
  const collectionFeeTotal = filteredPayments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.collectionFeeAmount || 0), 0);
  const netToOwner = filteredPayments.filter((p) => p.status === "paid").reduce((s, p) => {
    const gross = p.amount;
    const fee = p.collectionFeeAmount || 0;
    const ded = p.maintenanceDeduction || 0;
    return s + (gross - fee - ded);
  }, 0);
  const transferred = filteredPayments.filter((p) => p.status === "paid" && p.transferredToOwner).reduce((s, p) => s + (p.amount - (p.collectionFeeAmount || 0) - (p.maintenanceDeduction || 0)), 0);
  const notTransferred = filteredPayments.filter((p) => p.status === "paid" && !p.transferredToOwner).reduce((s, p) => s + (p.amount - (p.collectionFeeAmount || 0) - (p.maintenanceDeduction || 0)), 0);

  const upcomingRents = reminders.filter((r) => r.kind === "rent" && r.days >= 0).slice(0, 5);
  const upcomingContracts = reminders.filter((r) => r.kind === "contract" && r.days >= 0).slice(0, 5);

  const expiredContracts = data.contracts.filter((c) => calculateContractStatus(c) === "expired");
  const vacantUnits = data.units.filter((u) => calculateUnitStatus(u, data.contracts) === "vacant");
  const occupiedUnits = data.units.filter((u) => calculateUnitStatus(u, data.contracts) === "occupied");
  const maintenanceRepairs = data.repairs.filter((r) => r.status !== "cancelled");
  const maintenanceTotal = maintenanceRepairs.reduce((s, r) => s + r.cost, 0);

  const maxIncome = Math.max(1, ...data.buildings.map((b) => buildingStats(data, b.id).totalIncome));

  return (
    <div>
      <PageHeader title="التقارير" subtitle="ملخص شامل لجميع العقارات" action={
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => exportCSV(data)}><FileDown className="h-4 w-4" /></Button>
      } />
      <div className="space-y-4 p-4">
        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger className="rounded-xl bg-card text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل السنوات</SelectItem>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}><SelectTrigger className="rounded-xl bg-card text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل العقارات</SelectItem>{data.buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-primary p-4 text-primary-foreground"><TrendingUp className="mb-1 h-5 w-5 opacity-80" /><p className="text-xs opacity-80">إجمالي الدخل</p><p className="text-lg font-bold">{formatMoney(stats.totalIncome)}</p></div>
          <div className="rounded-3xl border border-border bg-card p-4"><Wallet className="mb-1 h-5 w-5 text-emerald-600" /><p className="text-xs text-muted-foreground">إيجارات مدفوعة</p><p className="text-lg font-bold text-emerald-700">{formatMoney(paidTotal)}</p></div>
          <div className="rounded-3xl border border-border bg-card p-4"><Wallet className="mb-1 h-5 w-5 text-red-500" /><p className="text-xs text-muted-foreground">غير مدفوع / متأخر</p><p className="text-lg font-bold text-red-600">{formatMoney(unpaidTotal + overdueTotal)}</p></div>
          <div className="rounded-3xl border border-border bg-card p-4"><Wrench className="mb-1 h-5 w-5 text-amber-600" /><p className="text-xs text-muted-foreground">تكاليف الصيانة</p><p className="text-lg font-bold">{formatMoney(maintenanceTotal)}</p></div>
          <div className="rounded-3xl border border-border bg-card p-4"><Percent className="mb-1 h-5 w-5 text-orange-500" /><p className="text-xs text-muted-foreground">تحصيل المكتب</p><p className="text-lg font-bold text-orange-600">{formatMoney(collectionFeeTotal)}</p></div>
          <div className="rounded-3xl border border-border bg-card p-4"><Wallet className="mb-1 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">صافي المستحق للمالك</p><p className="text-lg font-bold text-primary">{formatMoney(netToOwner)}</p></div>
        </div>

        {/* Transfer summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4"><ArrowLeftRight className="mb-1 h-5 w-5 text-emerald-600" /><p className="text-xs text-muted-foreground">تم تحويله للمالك</p><p className="text-lg font-bold text-emerald-700">{formatMoney(transferred)}</p></div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-4"><ArrowLeftRight className="mb-1 h-5 w-5 text-amber-600" /><p className="text-xs text-muted-foreground">لم يتم تحويله</p><p className="text-lg font-bold text-amber-700">{formatMoney(notTransferred)}</p></div>
        </div>

        {/* Income per building */}
        <div>
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Building2 className="h-4 w-4 text-primary" /> الدخل حسب العقار</h2>
          {data.buildings.length === 0 ? (
            <EmptyState icon={BarChart3} title="لا توجد بيانات" description="أضف عقارات ودفعات لعرض التقارير" />
          ) : (
            <div className="space-y-2">
              {data.buildings.map((b) => {
                const s = buildingStats(data, b.id);
                const pct = Math.round((s.totalIncome / maxIncome) * 100);
                return (
                  <Link key={b.id} to={"/buildings/" + b.id} className="block rounded-3xl border border-border bg-card p-4 transition-transform active:scale-[0.98]">
                    <div className="flex items-center justify-between"><p className="font-bold">{b.name}</p><p className="text-sm font-bold text-primary">{formatMoney(s.totalIncome)}</p></div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: pct + "%" }} /></div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>{s.unitsCount} وحدة</span><span className="text-emerald-700">{s.occupied} مؤجرة</span><span>{s.vacant} شاغرة</span><span className="text-amber-700">صيانة: {formatMoney(s.maintenanceCost)}</span><span className="text-orange-600">تحصيل: {formatMoney(s.collectionFeeTotal)}</span><span className="text-primary font-semibold">صافي: {formatMoney(s.netToOwner)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Contract summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-border bg-card p-4 text-center"><p className="text-2xl font-bold text-emerald-700">{occupiedUnits.length}</p><p className="text-xs text-muted-foreground">وحدات مؤجرة</p></div>
          <div className="rounded-3xl border border-border bg-card p-4 text-center"><p className="text-2xl font-bold text-slate-600">{vacantUnits.length}</p><p className="text-xs text-muted-foreground">وحدات شاغرة</p></div>
        </div>

        {/* Upcoming rents */}
        {upcomingRents.length > 0 && (
          <div>
            <h2 className="mb-2 font-bold">أقرب مواعيد تحصيل الإيجار</h2>
            <div className="space-y-2">
              {upcomingRents.map((r) => (
                <Link key={r.id} to={r.unitId ? "/units/" + r.unitId : "#"} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                  <span className="font-semibold">{r.subtitle}</span>
                  <span className="text-xs text-primary">{formatDate(r.date)}{r.amount ? " · " + formatMoney(r.amount) : ""}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Expiring contracts */}
        {upcomingContracts.length > 0 && (
          <div>
            <h2 className="mb-2 font-bold">أقرب انتهاءات العقود</h2>
            <div className="space-y-2">
              {upcomingContracts.map((r) => (
                <Link key={r.id} to={r.unitId ? "/units/" + r.unitId : "#"} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                  <span className="font-semibold">{r.subtitle}</span>
                  <span className={"text-xs " + (r.days <= 30 ? "text-amber-600 font-bold" : "text-muted-foreground")}>{formatDate(r.date)} ({r.days} يوم)</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Export buttons */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => exportCSV(data)}><FileDown className="ml-2 h-4 w-4" /> CSV</Button>
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => exportJSON(data)}><FileDown className="ml-2 h-4 w-4" /> JSON</Button>
        </div>
      </div>
    </div>
  );
}
