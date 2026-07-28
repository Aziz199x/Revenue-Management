import { useState } from "react";
import { AlertOctagon, AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { formatMoney } from "@/data/helpers";
import { EXCEPTION_CATEGORY_META } from "@/reporting/exceptionsEngine";
import { ExceptionCategory, ManagementException } from "@/reporting/types";

const CATEGORY_ICON: Record<ExceptionCategory, typeof AlertOctagon> = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const CATEGORY_ORDER: ExceptionCategory[] = ["critical", "warning", "info", "success"];

function ExceptionRow({ exception }: { exception: ManagementException }) {
  const Icon = CATEGORY_ICON[exception.category];
  const meta = EXCEPTION_CATEGORY_META[exception.category];
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold">{exception.title}</p>
            {exception.amount !== undefined && (
              <p className="shrink-0 text-xs font-bold">{formatMoney(exception.amount)}</p>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{exception.description}</p>
          {exception.recommendation && (
            <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-muted p-2">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-[11px]">
                <span className="font-semibold">التوصية: </span>
                {exception.recommendation.action}
                {exception.recommendation.deadline ? ` — ${exception.recommendation.deadline}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Monthly Exceptions & Management Insights — auto-detected, cached, no manual scanning required. */
export default function MonthlyExceptionsCard({ exceptions }: { exceptions: ManagementException[] }) {
  const [expanded, setExpanded] = useState<Record<ExceptionCategory, boolean>>({ critical: true, warning: true, info: false, success: false });

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: exceptions.filter((exc) => exc.category === category),
  })).filter((group) => group.items.length > 0);

  const badgeColor = exceptions.some((e) => e.category === "critical")
    ? "bg-red-100 text-red-700"
    : exceptions.some((e) => e.category === "warning")
      ? "bg-amber-100 text-amber-800"
      : "bg-blue-100 text-blue-700";

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">الاستثناءات الشهرية</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeColor}`}>
          Monthly Exceptions ({exceptions.length})
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        رصد تلقائي لكل ما يحتاج انتباه الإدارة هذا الشهر — بدون مراجعة يدوية لكل دفعة.
      </p>

      {grouped.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">لا توجد أحداث استثنائية هذا الشهر.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {grouped.map(({ category, items }) => {
            const meta = EXCEPTION_CATEGORY_META[category];
            const Icon = CATEGORY_ICON[category];
            const isOpen = expanded[category];
            return (
              <div key={category}>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [category]: !prev[category] }))}
                  className="flex w-full items-center justify-between rounded-xl px-1 py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>{meta.label}</span>
                    <span className="text-[11px] text-muted-foreground">({items.length})</span>
                  </span>
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {isOpen && (
                  <div className="mt-2 space-y-2">
                    {items.map((exception) => <ExceptionRow key={exception.id} exception={exception} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
