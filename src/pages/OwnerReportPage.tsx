import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Building2, FileSpreadsheet, MessageCircle, Printer } from "lucide-react";
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
import { formatDate, formatMoney } from "@/data/helpers";
import { currentYearMonth, formatYearMonthLabel, shiftYearMonth } from "@/reporting/dateUtils";
import { buildOwnerStatement, OwnerStatementEventKind } from "@/reporting/ownerStatementService";
import { exportOwnerStatementXlsx, shareOwnerStatementText } from "@/utils/ownerStatementExport";
import { printCurrentPage } from "@/utils/print";
import { showError, showSuccess } from "@/utils/toast";

const eventLabels: Record<OwnerStatementEventKind, string> = {
  rent: "إيجار مستلم",
  office_fee: "رسوم المكتب",
  maintenance: "مصروف صيانة",
  settlement: "تسوية",
  owner_transfer: "تحويل للمالك",
  adjustment: "تعديل بعد الإقفال",
};

export default function OwnerReportPage() {
  const { buildingId = "" } = useParams();
  const { data } = useStore();
  const building = data.buildings.find((item) => item.id === buildingId);
  const [month, setMonth] = useState(currentYearMonth());
  const [exporting, setExporting] = useState<"pdf" | "excel" | "share" | null>(null);
  const statement = useMemo(() => buildOwnerStatement(data, buildingId, month), [buildingId, data, month]);
  const monthOptions = useMemo(() => {
    const options: string[] = [];
    for (let offset = 2; offset >= -18; offset--) options.push(shiftYearMonth(currentYearMonth(), offset));
    return options;
  }, []);

  if (!building) {
    return (
      <div>
        <PageHeader title="كشف حساب المالك" back />
        <div className="p-4"><EmptyState icon={Building2} title="العقار غير موجود" /></div>
      </div>
    );
  }

  const totalDebits = statement.totals.officeFees
    + statement.totals.maintenance
    + statement.totals.settlements
    + statement.totals.ownerTransfers;
  const th = "border border-gray-300 bg-gray-100 p-2 text-right text-[10px] font-bold";
  const td = "border border-gray-300 p-2 text-right text-[10px]";

  const run = async (kind: "pdf" | "excel" | "share", task: () => Promise<void>) => {
    setExporting(kind);
    try {
      await task();
      if (kind === "excel") showSuccess("تم إنشاء كشف Excel وإرساله للمشاركة");
      if (kind === "share") showSuccess("تم تجهيز كشف المالك للمشاركة");
    } catch (error) {
      console.error(`[Owner statement] ${kind} failed`, error);
      showError("تعذر إنشاء أو مشاركة كشف المالك");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #owner-statement, #owner-statement * { visibility: visible; }
          #owner-statement { position: absolute; inset: 0; width: 100%; padding: 16px; }
          #owner-statement table { page-break-inside: auto; }
          #owner-statement tr { page-break-inside: avoid; }
        }
      `}</style>
      <PageHeader title="كشف حساب المالك" subtitle={building.name} back />
      <div className="space-y-4 p-4">
        <div className="no-print space-y-3 rounded-3xl border border-border bg-card p-4">
          <div>
            <p className="mb-1.5 text-xs font-bold">الفترة المالية</p>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option} value={option}>{formatYearMonthLabel(option)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="rounded-xl px-2 text-xs"
              disabled={!!exporting}
              onClick={() => run("pdf", () => printCurrentPage(`كشف-${building.name}-${month}`))}
            >
              <Printer className="ml-1 h-4 w-4" /> PDF
            </Button>
            <Button
              variant="outline"
              className="rounded-xl px-2 text-xs"
              disabled={!!exporting}
              onClick={() => run("excel", () => exportOwnerStatementXlsx(data, statement))}
            >
              <FileSpreadsheet className="ml-1 h-4 w-4" /> Excel
            </Button>
            <Button
              className="rounded-xl px-2 text-xs"
              disabled={!!exporting}
              onClick={() => run("share", () => shareOwnerStatementText(data, statement))}
            >
              <MessageCircle className="ml-1 h-4 w-4" /> واتساب
            </Button>
          </div>
        </div>

        <div id="owner-statement" className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="text-center">
            <p className="text-lg font-bold">كشف حساب المالك - {building.name}</p>
            <p className="text-sm text-muted-foreground">{formatYearMonthLabel(month)}</p>
            {building.address && <p className="text-xs text-muted-foreground">{building.address}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 p-3">
              <p className="text-[10px] text-emerald-700">الإيجارات المستلمة</p>
              <p className="mt-1 font-bold text-emerald-800">{formatMoney(statement.totals.rentReceived)}</p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-3">
              <p className="text-[10px] text-orange-700">رسوم المكتب والتسويات</p>
              <p className="mt-1 font-bold text-orange-800">
                {formatMoney(statement.totals.officeFees + statement.totals.settlements)}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3">
              <p className="text-[10px] text-amber-700">مصروفات الصيانة</p>
              <p className="mt-1 font-bold text-amber-800">{formatMoney(statement.totals.maintenance)}</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3">
              <p className="text-[10px] text-sky-700">المحول للمالك</p>
              <p className="mt-1 font-bold text-sky-800">{formatMoney(statement.totals.ownerTransfers)}</p>
            </div>
            <div className="rounded-2xl bg-muted p-3">
              <p className="text-[10px] text-muted-foreground">الرصيد الافتتاحي</p>
              <p className="mt-1 font-bold">{formatMoney(statement.openingBalance)}</p>
            </div>
            <div className={`rounded-2xl p-3 ${statement.closingBalance >= 0 ? "bg-primary text-primary-foreground" : "bg-red-50 text-red-800"}`}>
              <p className="text-[10px] opacity-80">الرصيد الختامي</p>
              <p className="mt-1 font-bold">{formatMoney(statement.closingBalance)}</p>
              <p className="mt-1 text-[9px] opacity-80">
                {statement.closingBalance >= 0 ? "مستحق للمالك" : "مستحق للمكتب"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>التاريخ</th>
                  <th className={th}>العملية</th>
                  <th className={th}>الوحدة</th>
                  <th className={th}>البيان</th>
                  <th className={th}>الإثباتات</th>
                  <th className={th}>دائن للمالك</th>
                  <th className={th}>مدين على المالك</th>
                  <th className={th}>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                <tr className="font-bold">
                  <td className={td}></td>
                  <td className={td}>رصيد افتتاحي</td>
                  <td className={td}></td>
                  <td className={td}>الرصيد المرحل من الفترات السابقة</td>
                  <td className={td}>—</td>
                  <td className={td}>{statement.openingBalance > 0 ? formatMoney(statement.openingBalance) : "—"}</td>
                  <td className={td}>{statement.openingBalance < 0 ? formatMoney(-statement.openingBalance) : "—"}</td>
                  <td className={td}>{formatMoney(statement.openingBalance)}</td>
                </tr>
                {statement.events.map((event) => (
                  <tr key={event.id}>
                    <td className={td}>{formatDate(event.date)}</td>
                    <td className={td}>{eventLabels[event.kind]}</td>
                    <td className={td}>{event.unitName || "—"}</td>
                    <td className={td}>{event.description}</td>
                    <td className={td}>{event.evidenceFiles?.join("، ") || "—"}</td>
                    <td className={`${td} text-emerald-700`}>{event.credit ? formatMoney(event.credit) : "—"}</td>
                    <td className={`${td} text-red-700`}>{event.debit ? formatMoney(event.debit) : "—"}</td>
                    <td className={`${td} font-bold`}>{formatMoney(event.runningBalance)}</td>
                  </tr>
                ))}
                {statement.events.length === 0 && (
                  <tr><td className={`${td} text-center text-muted-foreground`} colSpan={8}>لا توجد عمليات خلال هذا الشهر</td></tr>
                )}
                <tr className="font-bold">
                  <td className={td} colSpan={5}>إجمالي حركة الشهر</td>
                  <td className={td}>{formatMoney(statement.totals.rentReceived)}</td>
                  <td className={td}>{formatMoney(totalDebits)}</td>
                  <td className={td}>{formatMoney(statement.closingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {statement.totals.adjustments > 0 && (
            <p className="rounded-xl bg-violet-50 p-2 text-[10px] font-bold text-violet-800">
              يتضمن الكشف {statement.totals.adjustments} تسوية مسجلة بعد إقفال شهر مالي.
            </p>
          )}
          <p className="text-center text-[10px] text-muted-foreground">
            أُنشئ في {new Date().toLocaleString("ar-SA-u-nu-latn")}
          </p>
        </div>
      </div>
    </div>
  );
}
