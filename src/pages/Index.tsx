import { Link } from "react-router-dom";
import {
  Building2,
  Wallet,
  AlertTriangle,
  Wrench,
  Bell,
  FileText,
  Zap,
  ChevronLeft,
  Home,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { useStore } from "@/data/store";
import { globalStats, collectReminders, formatMoney, formatDate } from "@/data/helpers";

const kindIcons = {
  rent: Wallet,
  contract: FileText,
  maintenance: Wrench,
  bill: Zap,
};

const kindColors = {
  rent: "bg-secondary text-primary",
  contract: "bg-amber-100 text-amber-700",
  maintenance: "bg-orange-100 text-orange-700",
  bill: "bg-sky-100 text-sky-700",
};

export default function Index() {
  const { data } = useStore();
  const stats = globalStats(data);
  const reminders = collectReminders(data).slice(0, 6);

  return (
    <div>
      <PageHeader title="مدير العقارات" subtitle="لوحة التحكم الرئيسية" />
      <div className="space-y-4 p-4">
        {/* Hero income card */}
        <div className="animate-fade-up rounded-3xl bg-primary p-5 text-primary-foreground">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Wallet className="h-4 w-4" />
            إجمالي الدخل المحصّل
          </div>
          <p className="mt-1 text-3xl font-extrabold">{formatMoney(stats.totalIncome)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-xs opacity-80">غير مدفوع</p>
              <p className="font-bold">{formatMoney(stats.unpaidTotal)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-xs opacity-80">متأخرات</p>
              <p className="font-bold">{formatMoney(stats.overdueTotal)}</p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <Link to="/buildings" className="rounded-2xl border border-border bg-card p-3 text-center active:scale-95 transition-transform">
            <Building2 className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-lg font-bold">{data.buildings.length}</p>
            <p className="text-[11px] text-muted-foreground">عقار</p>
          </Link>
          <Link to="/buildings" className="rounded-2xl border border-border bg-card p-3 text-center active:scale-95 transition-transform">
            <Home className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-lg font-bold">{data.units.length}</p>
            <p className="text-[11px] text-muted-foreground">وحدة</p>
          </Link>
          <Link to="/reports" className="rounded-2xl border border-border bg-card p-3 text-center active:scale-95 transition-transform">
            <Wrench className="mx-auto h-5 w-5 text-amber-600" />
            <p className="mt-1 text-lg font-bold">{formatMoney(stats.maintenanceTotal)}</p>
            <p className="text-[11px] text-muted-foreground">صيانة</p>
          </Link>
        </div>

        {stats.overdueTotal > 0 && (
          <Link
            to="/payments"
            className="flex items-center gap-3 rounded-3xl border border-red-200 bg-red-50 p-4 animate-fade-up"
            style={{ animationDelay: "120ms" }}
          >
            <div className="rounded-full bg-red-100 p-2.5">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-700">لديك متأخرات إيجار</p>
              <p className="text-xs text-red-600">{formatMoney(stats.overdueTotal)} بحاجة للتحصيل</p>
            </div>
            <ChevronLeft className="h-5 w-5 text-red-400" />
          </Link>
        )}

        {/* Reminders */}
        <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <Bell className="h-4 w-4 text-primary" /> التذكيرات القادمة
            </h2>
          </div>
          {reminders.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="لا توجد تذكيرات"
              description="ستظهر هنا مواعيد الإيجار والعقود والصيانة والفواتير"
            />
          ) : (
            <div className="space-y-2">
              {reminders.map((r) => {
                const Icon = kindIcons[r.kind];
                return (
                  <Link
                    key={r.id}
                    to={`/units/${r.unitId}`}
                    className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3.5 transition-transform active:scale-[0.98]"
                  >
                    <div className={`rounded-2xl p-2.5 ${kindColors[r.kind]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-bold ${r.days < 0 ? "text-red-600" : r.days <= 7 ? "text-amber-600" : "text-primary"}`}>
                        {r.days < 0 ? `متأخر ${-r.days} يوم` : r.days === 0 ? "اليوم" : `بعد ${r.days} يوم`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(r.date)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
