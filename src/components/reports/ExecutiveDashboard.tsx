import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  ShieldAlert,
  Gauge,
  CalendarClock,
  ListChecks,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { formatMoney, formatDate } from "@/data/helpers";
import { MonthlyReportBundle } from "@/reporting/reportBundle";
import { HEALTH_LABEL_META } from "@/reporting/exceptionsEngine";
import { KpiItem } from "@/reporting/types";

const PRIORITY_LABELS: Record<string, string> = { urgent: "عاجل", high: "عالية", medium: "متوسطة", low: "منخفضة" };
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-600",
};
const RISK_META: Record<string, { text: string; color: string }> = {
  low: { text: "منخفض", color: "bg-emerald-100 text-emerald-800" },
  medium: { text: "متوسط", color: "bg-amber-100 text-amber-800" },
  high: { text: "مرتفع", color: "bg-orange-100 text-orange-700" },
  critical: { text: "حرج", color: "bg-red-100 text-red-700" },
};

function TrendIcon({ trend, trendIsGood }: { trend: KpiItem["trend"]; trendIsGood: boolean | null }) {
  const color = trendIsGood === null ? "text-muted-foreground" : trendIsGood ? "text-emerald-600" : "text-red-600";
  if (trend === "up") return <ArrowUp className={`h-3 w-3 ${color}`} />;
  if (trend === "down") return <ArrowDown className={`h-3 w-3 ${color}`} />;
  return <Minus className={`h-3 w-3 ${color}`} />;
}

function KpiCard({ kpi }: { kpi: KpiItem }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{kpi.displayValue}</p>
        <TrendIcon trend={kpi.trend} trendIsGood={kpi.trendIsGood} />
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{kpi.deltaLabel}</p>
    </div>
  );
}

function HealthGauge({ score, label }: { score: number; label: keyof typeof HEALTH_LABEL_META }) {
  const meta = HEALTH_LABEL_META[label];
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2">
      <Gauge className="h-5 w-5" />
      <div>
        <p className="text-lg font-bold leading-none">{score}<span className="text-xs font-normal opacity-80">/100</span></p>
        <p className="text-[11px] font-semibold text-white">مؤشر صحة العقار: {meta.text}</p>
      </div>
    </div>
  );
}

const TOP_KPI_KEYS = ["collectionRate", "occupancyRate", "outstandingRent", "averageDelay", "ownerNetIncome", "vacancyRate"];

export default function ExecutiveDashboard({ bundle }: { bundle: MonthlyReportBundle }) {
  const [detailed, setDetailed] = useState(false);
  const { report, kpis, health, risk, alerts, actions, summary, insights, topStats, comparisons } = bundle;

  const criticalAlerts = alerts.filter((a) => a.level === "critical");
  const warningAlerts = alerts.filter((a) => a.level === "warning");
  const topKpis = kpis.filter((k) => TOP_KPI_KEYS.includes(k.key));
  const visibleKpis = detailed ? kpis : topKpis;
  const visibleActions = detailed ? actions : actions.slice(0, 5);
  const visibleLatePayments = detailed ? report.latePayments : report.latePayments.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Executive summary + health/risk header */}
      <div className="rounded-3xl bg-primary p-4 text-primary-foreground">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 opacity-90" />
            <p className="text-xs font-semibold opacity-90">لوحة الإدارة التنفيذية</p>
          </div>
          <button
            type="button"
            onClick={() => setDetailed((v) => !v)}
            className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold"
          >
            {detailed ? "عرض مختصر" : "عرض كامل"}
            {detailed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed">{summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <HealthGauge score={health.score} label={health.label} />
          <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold ${RISK_META[risk.label].color}`}>
            <ShieldAlert className="h-3.5 w-3.5" /> المخاطر المالية: {RISK_META[risk.label].text}
          </span>
        </div>
      </div>

      {/* Critical + warning alerts */}
      {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
        <div className="space-y-2">
          {criticalAlerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-red-800">{alert.title}</p>
                <p className="mt-0.5 text-[11px] text-red-700">{alert.description}</p>
              </div>
            </div>
          ))}
          {detailed && warningAlerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-800">{alert.title}</p>
                <p className="mt-0.5 text-[11px] text-amber-700">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI grid */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Gauge className="h-4 w-4 text-primary" /> المؤشرات الشهرية</h3>
        <div className="grid grid-cols-2 gap-2">
          {visibleKpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} />)}
        </div>
      </div>

      {/* Executive actions */}
      {actions.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><ListChecks className="h-4 w-4 text-primary" /> إجراءات موصى بها ({actions.length})</h3>
          <div className="space-y-2">
            {visibleActions.map((action) => (
              <div key={action.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold">{action.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[action.priority]}`}>{PRIORITY_LABELS[action.priority]}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{action.reason}</p>
                <p className="mt-1 text-[11px] font-semibold text-primary">{action.action}</p>
                {(action.deadline || action.responsible) && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {action.deadline}{action.responsible ? ` - ${action.responsible}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Late payments */}
      {report.latePayments.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><CalendarClock className="h-4 w-4 text-red-600" /> الدفعات المتأخرة ({report.latePayments.length})</h3>
          <div className="space-y-2">
            {visibleLatePayments.map((payment) => (
              <Link key={payment.id} to={`/units/${payment.unitId}`} className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold">{payment.unitName}{payment.tenantName ? ` - ${payment.tenantName}` : ""}</p>
                  <p className="text-[11px] text-muted-foreground">متأخر {payment.delayDays} يوم منذ {formatDate(payment.dueDate)}</p>
                </div>
                <p className="shrink-0 font-bold text-red-600">{formatMoney(payment.outstandingAmount)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming renewals */}
      {report.expirationsWithin45Days > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">{report.expirationsWithin45Days} عقد سينتهي خلال 45 يوماً — يحتاج متابعة للتجديد.</p>
        </div>
      )}

      {detailed && (
        <>
          {insights.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold">رؤى مالية ذكية</h3>
              <div className="space-y-1.5">
                {insights.map((insight, index) => (
                  <p key={index} className="rounded-2xl bg-muted p-3 text-[11px]">{insight}</p>
                ))}
              </div>
            </div>
          )}

          {topStats.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold">أبرز الإحصائيات</h3>
              <div className="grid grid-cols-2 gap-2">
                {topStats.map((stat) => (
                  <div key={stat.key} className="rounded-2xl border border-border bg-card p-3">
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    <p className="mt-0.5 text-xs font-bold">{stat.unitName}{stat.tenantName ? ` - ${stat.tenantName}` : ""}</p>
                    <p className="text-[11px] text-primary">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-3 text-[11px] text-muted-foreground">
            <p>مقارنة بالشهر السابق: نسبة تحصيل {comparisons.previousMonth.collectionRate ?? "—"}%</p>
            <p>مقارنة بمتوسط 6 أشهر: مصاريف صيانة {comparisons.sixMonthAverage.maintenanceCost !== null ? formatMoney(comparisons.sixMonthAverage.maintenanceCost) : "—"}</p>
          </div>
        </>
      )}
    </div>
  );
}
