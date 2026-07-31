import { useMemo, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/data/store";
import { FinancialAuditAction, FinancialAuditEntry } from "@/data/types";
import { undoFinancialAuditEntry } from "@/data/financialAudit";
import { formatMoney } from "@/data/helpers";
import { showSuccess } from "@/utils/toast";

const actionLabels: Record<FinancialAuditAction, string> = {
  payment_created: "إنشاء دفعة",
  payment_received: "استلام دفعة",
  payment_updated: "تعديل دفعة",
  payment_deleted: "حذف دفعة",
  owner_transferred: "تحويل للمالك",
  maintenance_deducted: "خصم صيانة",
  maintenance_updated: "تعديل صيانة",
  maintenance_deleted: "حذف صيانة",
  settlement_created: "إنشاء تسوية",
  settlement_updated: "تعديل تسوية",
  settlement_deleted: "حذف تسوية",
  building_ownership_updated: "تغيير ملاك العقار",
};

function snapshotLines(entry: FinancialAuditEntry, value?: Record<string, unknown> | null): string[] {
  if (!value) return ["لا يوجد سجل"];
  if (entry.entityType === "building") {
    const owners = Array.isArray(value.owners)
      ? value.owners as Array<{ name?: string; percentage?: number }>
      : [];
    return [
      `ملكية متعددة: ${value.multipleOwnersEnabled ? "نعم" : "لا"}`,
      `الملاك: ${owners.length ? owners.map((owner) => `${owner.name || "غير محدد"} ${owner.percentage || 0}%`).join("، ") : "مالك واحد غير مسمى 100%"}`,
    ];
  }
  if (entry.entityType === "payment") {
    const allocations = Array.isArray(value.ownerTransferAllocations)
      ? value.ownerTransferAllocations as Array<{ ownerName?: string; percentage?: number; amount?: number }>
      : [];
    return [
      `الحالة: ${String(value.status || "غير محدد")}`,
      `المبلغ المستحق: ${formatMoney(Number(value.grossAmount ?? value.amount ?? 0))}`,
      `المبلغ المستلم: ${formatMoney(Number(value.receivedAmount ?? value.paidAmount ?? 0))}`,
      `تاريخ الاستلام: ${String(value.receivedDate || "غير مسجل")}`,
      `رسوم المكتب: ${formatMoney(Number(value.collectionFeeAmount || 0))}`,
      `خصم الصيانة: ${formatMoney(Number(value.maintenanceDeductionAmount || 0))}`,
      `التحويل للمالك: ${value.ownerTransferred ? "تم" : "لم يتم"}`,
      `تاريخ التحويل: ${String(value.ownerTransferDate || "غير مسجل")}`,
      ...(allocations.length
        ? [`توزيع الملاك: ${allocations.map((allocation) => `${allocation.ownerName || "مالك"} ${allocation.percentage || 0}% = ${formatMoney(Number(allocation.amount || 0))}`).join("، ")}`]
        : []),
    ];
  }
  if (entry.entityType === "repair") {
    return [
      `البيان: ${String(value.description || "غير محدد")}`,
      `التكلفة: ${formatMoney(Number(value.cost || 0))}`,
      `الحالة: ${String(value.status || "غير محدد")}`,
      `التاريخ: ${String(value.repairDate || "غير مسجل")}`,
      `مرتبطة بدفعة: ${value.deductedFromPaymentId ? "نعم" : "لا"}`,
    ];
  }
  return [
    `المبلغ: ${formatMoney(Number(value.amount || 0))}`,
    `التاريخ: ${String(value.date || "غير مسجل")}`,
    `الطريقة: ${String(value.method || "غير محدد")}`,
    `الملاحظة: ${String(value.note || "لا توجد")}`,
  ];
}

export default function AuditLogPage() {
  const { data, update } = useStore();
  const [buildingId, setBuildingId] = useState("all");
  const [action, setAction] = useState<FinancialAuditAction | "all">("all");
  const [month, setMonth] = useState("all");

  const months = useMemo(
    () => Array.from(new Set(data.financialAuditLog.map((entry) => entry.yearMonth).filter(Boolean) as string[]))
      .sort((a, b) => b.localeCompare(a)),
    [data.financialAuditLog],
  );
  const entries = useMemo(
    () => data.financialAuditLog
      .filter((entry) => buildingId === "all" || entry.buildingId === buildingId)
      .filter((entry) => action === "all" || entry.action === action)
      .filter((entry) => month === "all" || entry.yearMonth === month)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [action, buildingId, data.financialAuditLog, month],
  );
  const latestUndoable = data.financialAuditLog
    .filter((entry) => !entry.undoneAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const undo = async (entry: FinancialAuditEntry) => {
    await update(
      (previous) => undoFinancialAuditEntry(previous, entry),
      { reason: `التراجع عن: ${entry.reason}` },
    );
    showSuccess("تم التراجع عن آخر إجراء وتسجيله في سجل التدقيق");
  };

  return (
    <div>
      <PageHeader title="سجل التدقيق المالي" subtitle="كل تغيير مالي بالقيم قبل وبعد وسبب العملية" back />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-2 rounded-3xl border border-border bg-card p-3 sm:grid-cols-3">
          <Select value={buildingId} onValueChange={setBuildingId}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="كل العقارات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العقارات</SelectItem>
              {data.buildings.map((building) => (
                <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={(value) => setAction(value as FinancialAuditAction | "all")}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="كل العمليات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العمليات</SelectItem>
              {Object.entries(actionLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="كل الشهور" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الشهور</SelectItem>
              {months.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <History className="h-4 w-4 text-primary" />
              العمليات المسجلة
            </h2>
            <p className="mt-1 text-[10px] text-muted-foreground">التراجع متاح لآخر إجراء فقط حفاظًا على تسلسل البيانات</p>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-primary">{entries.length} إجراء</span>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-3xl bg-muted p-6 text-center text-xs text-muted-foreground">لا توجد عمليات مطابقة للفلاتر</p>
        ) : entries.map((entry) => (
          <div
            key={entry.id}
            className={`rounded-2xl border p-3 text-xs ${
              entry.isPostCloseAdjustment ? "border-violet-200 bg-violet-50" : "border-border bg-card"
            } ${entry.undoneAt ? "opacity-55" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{actionLabels[entry.action]} · {entry.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">السبب: {entry.reason}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString("ar-SA-u-nu-latn")}
                  {entry.yearMonth ? ` · شهر ${entry.yearMonth}` : ""}
                  {entry.isPostCloseAdjustment ? " · تسوية بعد الإقفال" : ""}
                  {entry.undoneAt ? " · تم التراجع" : ""}
                </p>
                <details className="mt-2 rounded-xl border border-border/70 bg-background/70 p-2">
                  <summary className="cursor-pointer text-[10px] font-bold text-primary">عرض القيمة قبل وبعد</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-red-50 p-2 text-[10px] text-red-900">
                      <p className="mb-1 font-bold">قبل</p>
                      {snapshotLines(entry, entry.before).map((line) => <p key={`b-${entry.id}-${line}`}>{line}</p>)}
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-2 text-[10px] text-emerald-900">
                      <p className="mb-1 font-bold">بعد</p>
                      {snapshotLines(entry, entry.after).map((line) => <p key={`a-${entry.id}-${line}`}>{line}</p>)}
                    </div>
                  </div>
                </details>
              </div>
              {latestUndoable?.transactionId === entry.transactionId && !entry.undoneAt && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-full text-[10px]">
                      <RotateCcw className="ml-1 h-3 w-3" /> تراجع
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-right">التراجع عن آخر إجراء مالي؟</AlertDialogTitle>
                      <AlertDialogDescription className="text-right">
                        ستُستعاد جميع القيم السابقة المرتبطة بهذه العملية ويُحفظ التراجع في السجل.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={() => undo(entry)}>تأكيد التراجع</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
