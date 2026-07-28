import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { formatMoney, formatDate } from "@/data/helpers";
import { PAYMENT_RECEIVE_METHOD_LABELS } from "@/data/labels";
import EmptyState from "@/components/shared/EmptyState";
import { LateCollectionRow } from "@/reporting/types";

/**
 * Cash received this month for rent due earlier. The original obligation is marked
 * settled in its due month, while the cash is counted here in the receipt month.
 */
export default function LateCollectionsList({ rows, yearMonth }: { rows: LateCollectionRow[]; yearMonth: string }) {
  if (rows.length === 0) {
    return <EmptyState icon={CalendarClock} title="لا توجد تحصيلات متأخرة" description="لم يتم تحصيل أي دفعات من أشهر سابقة خلال هذا الشهر" />;
  }
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-muted p-3 text-xs">
        <p className="text-muted-foreground">إجمالي التحصيلات المتأخرة خلال {yearMonth}</p>
        <p className="text-lg font-bold text-emerald-700">{formatMoney(total)}</p>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <Link key={row.id} to={`/units/${row.unitId}`} className="block rounded-2xl border border-border bg-card p-3 text-xs transition-transform active:scale-[0.98]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{row.unitName}{row.tenantName ? ` - ${row.tenantName}` : ""}</p>
                <p className="mt-1 text-muted-foreground">شهر الاستحقاق: {row.dueMonth} ({formatDate(row.dueDate)})</p>
                <p className="mt-1 text-muted-foreground">تاريخ التحصيل: {formatDate(row.collectionDate)}</p>
                <p className="mt-1 font-semibold text-emerald-700">تم حصر التحصيل النقدي ضمن شهر {yearMonth}</p>
                {row.collectionMethod && <p className="mt-1 text-muted-foreground">طريقة الاستلام: {PAYMENT_RECEIVE_METHOD_LABELS[row.collectionMethod]}</p>}
              </div>
              <div className="shrink-0 text-left">
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">متأخر {row.delayDays} يوم</span>
                <p className="mt-2 font-bold text-emerald-700">{formatMoney(row.amount)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
