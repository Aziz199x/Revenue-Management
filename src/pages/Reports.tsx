import { Link } from "react-router-dom";
import { BarChart3, Building2, Wallet, Wrench, TrendingUp } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { useStore } from "@/data/store";
import {
  globalStats,
  buildingStats,
  collectReminders,
  formatMoney,
  formatDate,
} from "@/data/helpers";

export default function Reports() {
  const { data } = useStore();
  const stats = globalStats(data);
  const reminders = collectReminders(data);
  const upcomingRents = reminders.filter((r) => r.kind === "rent" && r.days >= 0).slice(0, 5);
  const upcomingContracts = reminders.filter((r) => r.kind === "contract" && r.days >= 0).slice(0, 5);

  const maxIncome = Math.max(
    1,
    ...data.buildings.map((b) => buildingStats(data, b.id).totalIncome),
  );

  return (
    <div>
      <PageHeader title="التقارير" subtitle="ملخص شامل لجميع العقارات" />
      <div className="space-y-4 p-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-primary p-4 text-primary-foreground">
            <TrendingUp className="mb-1 h-5 w-5 opacity-80" />
            <p className="text-xs opacity-80">إجمالي الدخل</p>
            <p className="text-lg font-bold">{formatMoney(stats.totalIncome)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <Wallet className="mb-1 h-5 w-5 text-emerald-600" />
            <p className="text-xs text-muted-foreground">إيجارات مدفوعة</p>
            <p className="text-lg font-bold text-emerald-700">{formatMoney(stats.paidTotal)}</p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <Wallet className="mb-1 h-5 w-5 text-red-500" />
            <p className="text-xs text-muted-foreground">غير مدفوع / متأخر</p>
            <p className="text-lg font-bold text-red-600">
              {formatMoney(stats.unpaidTotal + stats.overdueTotal)}
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-4">
            <Wrench className="mb-1 h-5 w-5 text-amber-600" />
            <p className="text-xs text-muted-foreground">تكاليف الصيانة</p>
            <p className="text-lg font-bold">{formatMoney(stats.maintenanceTotal)}</p>
          </div>
        </div>

        {/* Income per building */}
        <div>
          <h2 className="mb-2 flex items-center gap-2 font-bold">
            <Building2 className="h-4 w-4 text-primary" /> الدخل حسب العقار
          </h2>
          {data.buildings.length === 0 ? (
            <EmptyState icon={BarChart3} title="لا توجد بيانات" description="أضف عقارات ودفعات لعرض التقارير" />
          ) : (
            <div className="space-y-2">
              {data.buildings.map((b) => {
                const s = buildingStats(data, b.id);
                const pct = Math.round((s.totalIncome / maxIncome) * 100);
                return (
                  <Link
                    key={b.id}
                    to={`/buildings/${b.id}`}
                    className="block rounded-3xl border border-border bg-card p-4 transition-transform active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{b.name}</p>
                      <p className="text-sm font-bold text-primary">{formatMoney(s.totalIncome)}</p>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
                      <span>{s.unitsCount} وحدة</span>
                      <span className="text-emerald-700">{s.occupied} مؤجرة</span>
                      <span>{s.vacant} شاغرة</span>
                      <span className="text-amber-700">صيانة: {formatMoney(s.maintenanceCost)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming rents */}
        {upcomingRents.length > 0 && (
          <div>
            <h2 className="mb-2 font-bold">أقرب مواعيد تحصيل الإيجار</h2>
            <div className="space-y-2">
              {upcomingRents.map((r) => (
                <Link
                  key={r.id}
                  to={`/units/${r.unitId}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{r.subtitle}</span>
                  <span className="text-xs text-primary">{formatDate(r.date)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming contract expirations */}
        {upcomingContracts.length > 0 && (
          <div>
            <h2 className="mb-2 font-bold">أقرب انتهاءات العقود</h2>
            <div className="space-y-2">
              {upcomingContracts.map((r) => (
                <Link
                  key={r.id}
                  to={`/units/${r.unitId}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{r.subtitle}</span>
                  <span className={`text-xs ${r.days <= 30 ? "text-amber-600 font-bold" : "text-muted-foreground"}`}>
                    {formatDate(r.date)} ({r.days} يوم)
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
