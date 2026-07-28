import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Building2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { useStore } from "@/data/store";
import {
  formatMoney,
  formatDate,
  getCollectedRentAmount,
  getPaymentAmount,
  getPaymentReportMonth,
} from "@/data/helpers";
import {
  currentYearMonth,
  shiftYearMonth,
  formatYearMonthLabel,
} from "@/reporting/dateUtils";
import { REPAIR_STATUS_LABELS } from "@/data/labels";
import { printCurrentPage } from "@/utils/print";
import { showError } from "@/utils/toast";

export default function OwnerReportPage() {
  const { buildingId } = useParams();
  const { data } = useStore();
  const building = data.buildings.find((b) => b.id === buildingId);
  const [month, setMonth] = useState(currentYearMonth());

  const monthOptions = useMemo(() => {
    const options: string[] = [];
    for (let offset = 2; offset >= -12; offset--) options.push(shiftYearMonth(currentYearMonth(), offset));
    return options;
  }, []);

  const report = useMemo(() => {
    if (!building) return null;
    const units = data.units.filter((u) => u.buildingId === building.id);
    const unitIds = new Set(units.map((u) => u.id));
    const tenantByUnit = new Map(
      data.tenants.filter((t) => t.unitId && unitIds.has(t.unitId)).map((t) => [t.unitId as string, t] as const),
    );
    const cutoff = data.settings.reportMonthCutoffDay;

    const monthPayments = data.payments.filter(
      (p) => unitIds.has(p.unitId) && !p.deletedAt && (p.status as string) !== "cancelled"
        && getPaymentReportMonth(p, cutoff) === month,
    );

    const rows = units.map((unit) => {
      const unitPayments = monthPayments.filter((p) => p.unitId === unit.id);
      const due = unitPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);
      const collected = unitPayments.reduce((sum, p) => sum + getCollectedRentAmount(p), 0);
      const fee = unitPayments.reduce(
        (sum, p) => sum + (getCollectedRentAmount(p) > 0 ? (p.collectionFeeAmount ?? 0) : 0),
        0,
      );
      const receivedDates = unitPayments
        .filter((p) => p.receivedDate)
        .map((p) => formatDate(p.receivedDate as string))
        .join("، ");
      return {
        unit,
        tenant: tenantByUnit.get(unit.id),
        due,
        collected,
        fee,
        net: collected - fee,
        receivedDates,
        hasActivity: unitPayments.length > 0,
      };
    });

    const maintenance = data.repairs.filter(
      (r) => r.status !== "cancelled"
        && (r.buildingId === building.id || (r.unitId && unitIds.has(r.unitId)))
        && (r.repairDate || "").slice(0, 7) === month,
    );

    const totals = {
      due: rows.reduce((sum, r) => sum + r.due, 0),
      collected: rows.reduce((sum, r) => sum + r.collected, 0),
      fee: rows.reduce((sum, r) => sum + r.fee, 0),
      maintenance: maintenance.reduce((sum, r) => sum + (Number(r.cost) || 0), 0),
    };

    return { units, rows, maintenance, totals, unitName: (id?: string) => units.find((u) => u.id === id)?.name ?? "" };
  }, [building, data, month]);

  if (!building || !report) {
    return (
      <div>
        <PageHeader title="تقرير المالك الشهري" back />
        <div className="p-4"><EmptyState icon={Building2} title="العقار غير موجود" /></div>
      </div>
    );
  }

  const ownerNet = report.totals.collected - report.totals.fee - report.totals.maintenance;
  const th = "border border-gray-300 bg-gray-100 p-2 text-right text-xs font-bold";
  const td = "border border-gray-300 p-2 text-right text-xs";

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #owner-report, #owner-report * { visibility: visible; }
          #owner-report { position: absolute; inset: 0; width: 100%; padding: 16px; }
        }
      `}</style>
      <PageHeader
        title="تقرير المالك الشهري"
        subtitle={building.name}
        back
        action={
          <Button
            size="sm"
            className="rounded-xl"
            onClick={async () => {
              try {
                await printCurrentPage(`تقرير-${building.name}-${month}`);
              } catch {
                showError("تعذر فتح نافذة الطباعة");
              }
            }}
          >
            <Printer className="ml-1 h-4 w-4" />
            حفظ PDF
          </Button>
        }
      />
      <div className="space-y-4 p-4">
        <div className="no-print space-y-1.5">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option} value={option}>{formatYearMonthLabel(option)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            اضغط «حفظ PDF» ثم اختر «حفظ كملف PDF» من نافذة الطباعة لمشاركته مع المالك.
          </p>
        </div>

        <div id="owner-report" className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="text-center">
            <p className="text-lg font-bold">تقرير المالك الشهري — {building.name}</p>
            <p className="text-sm text-muted-foreground">{formatYearMonthLabel(month)}</p>
            {building.address && <p className="text-xs text-muted-foreground">{building.address}</p>}
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>الوحدة</th>
                <th className={th}>المستأجر</th>
                <th className={th}>المستحق</th>
                <th className={th}>المحصل</th>
                <th className={th}>تاريخ التحصيل</th>
                <th className={th}>عمولة التحصيل</th>
                <th className={th}>الصافي</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.unit.id}>
                  <td className={td}>{row.unit.name}</td>
                  <td className={td}>{row.tenant?.name ?? "—"}</td>
                  <td className={td}>{row.hasActivity ? formatMoney(row.due) : "—"}</td>
                  <td className={td}>{row.hasActivity ? formatMoney(row.collected) : "—"}</td>
                  <td className={td}>{row.receivedDates || "—"}</td>
                  <td className={td}>{row.hasActivity ? formatMoney(row.fee) : "—"}</td>
                  <td className={td}>{row.hasActivity ? formatMoney(row.net) : "—"}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className={td} colSpan={2}>الإجمالي</td>
                <td className={td}>{formatMoney(report.totals.due)}</td>
                <td className={td}>{formatMoney(report.totals.collected)}</td>
                <td className={td}></td>
                <td className={td}>{formatMoney(report.totals.fee)}</td>
                <td className={td}>{formatMoney(report.totals.collected - report.totals.fee)}</td>
              </tr>
            </tbody>
          </table>

          <div>
            <p className="mb-2 text-sm font-bold">أعمال الصيانة خلال الشهر</p>
            {report.maintenance.length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد أعمال صيانة مسجلة لهذا الشهر.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>الوحدة</th>
                    <th className={th}>الوصف</th>
                    <th className={th}>التاريخ</th>
                    <th className={th}>الحالة</th>
                    <th className={th}>التكلفة</th>
                  </tr>
                </thead>
                <tbody>
                  {report.maintenance.map((repair) => (
                    <tr key={repair.id}>
                      <td className={td}>{repair.unitId ? report.unitName(repair.unitId) : "(عام)"}</td>
                      <td className={td}>{repair.description}</td>
                      <td className={td}>{repair.repairDate ? formatDate(repair.repairDate) : "—"}</td>
                      <td className={td}>{REPAIR_STATUS_LABELS[repair.status] ?? repair.status}</td>
                      <td className={td}>{formatMoney(Number(repair.cost) || 0)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className={td} colSpan={4}>إجمالي الصيانة</td>
                    <td className={td}>{formatMoney(report.totals.maintenance)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-2xl border border-gray-300 p-3">
            <p className="mb-1 text-sm font-bold">الملخص المالي</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <p>إجمالي المحصل:</p><p className="text-left font-semibold">{formatMoney(report.totals.collected)}</p>
              <p>خصم عمولة التحصيل:</p><p className="text-left font-semibold">- {formatMoney(report.totals.fee)}</p>
              <p>خصم تكاليف الصيانة:</p><p className="text-left font-semibold">- {formatMoney(report.totals.maintenance)}</p>
              <p className="font-bold">صافي المستحق للمالك:</p><p className="text-left font-bold">{formatMoney(ownerNet)}</p>
            </div>
          </div>

          <p className="text-center text-[10px] text-muted-foreground">
            أُنشئ في {formatDate(new Date().toISOString().slice(0, 10))}
          </p>
        </div>
      </div>
    </div>
  );
}
