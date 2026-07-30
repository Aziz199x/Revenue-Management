import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  History,
  Info,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { useStore, genId } from "@/data/store";
import { FinancialAuditEntry } from "@/data/types";
import { undoFinancialAuditEntry } from "@/data/financialAudit";
import {
  buildMonthCloseReview,
  createMonthCloseSnapshot,
  MonthCloseIssue,
  MonthCloseIssueSeverity,
} from "@/reporting/monthCloseService";
import { currentYearMonth, formatYearMonthLabel } from "@/reporting/dateUtils";
import { formatMoney } from "@/data/helpers";
import { showError, showSuccess } from "@/utils/toast";

const severityMeta: Record<MonthCloseIssueSeverity, {
  label: string;
  icon: typeof AlertTriangle;
  container: string;
  iconClass: string;
}> = {
  blocking: {
    label: "يتطلب معالجة قبل الإقفال",
    icon: AlertTriangle,
    container: "border-red-200 bg-red-50 text-red-900",
    iconClass: "text-red-600",
  },
  warning: {
    label: "يحتاج مراجعة",
    icon: AlertTriangle,
    container: "border-amber-200 bg-amber-50 text-amber-900",
    iconClass: "text-amber-600",
  },
  info: {
    label: "معلومة",
    icon: Info,
    container: "border-sky-200 bg-sky-50 text-sky-900",
    iconClass: "text-sky-600",
  },
};

const auditActionLabels: Record<FinancialAuditEntry["action"], string> = {
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
};

function auditSnapshotLines(
  entry: FinancialAuditEntry,
  value?: Record<string, unknown> | null,
): string[] {
  if (!value) return ["لا يوجد سجل"];
  if (entry.entityType === "payment") {
    const amount = Number(value.grossAmount ?? value.amount ?? 0);
    const received = Number(value.receivedAmount ?? value.paidAmount ?? 0);
    const maintenance = Number(value.maintenanceDeductionAmount ?? 0);
    const lines = [
      `الحالة: ${String(value.status || "غير محدد")}`,
      `المبلغ المستحق: ${formatMoney(amount)}`,
      `المبلغ المستلم: ${formatMoney(received)}`,
      `تاريخ الاستلام: ${String(value.receivedDate || "غير مسجل")}`,
      `رسوم التحصيل: ${formatMoney(Number(value.collectionFeeAmount || 0))}`,
      `حالة الرسوم: ${String(value.collectionFeeStatus || "غير محدد")}`,
      `خصم الصيانة: ${formatMoney(maintenance)}`,
      `التحويل للمالك: ${value.ownerTransferred ? "تم" : "لم يتم"}`,
    ];
    if (value.ownerTransferDate) lines.push(`تاريخ التحويل: ${String(value.ownerTransferDate)}`);
    return lines;
  }
  if (entry.entityType === "repair") {
    return [
      `البيان: ${String(value.description || "غير محدد")}`,
      `التكلفة: ${formatMoney(Number(value.cost || 0))}`,
      `الحالة: ${String(value.status || "غير محدد")}`,
      `تاريخ الصيانة: ${String(value.repairDate || "غير مسجل")}`,
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

function IssueCard({ issue }: { issue: MonthCloseIssue }) {
  const meta = severityMeta[issue.severity];
  const Icon = meta.icon;
  const body = (
    <div className={`rounded-2xl border p-3 ${meta.container}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.iconClass}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs font-bold">{issue.title}</p>
            {issue.amount !== undefined && issue.amount > 0 && (
              <span className="text-xs font-bold">{formatMoney(issue.amount)}</span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-5 opacity-90">{issue.description}</p>
          {(issue.buildingName || issue.unitName) && (
            <p className="mt-1 text-[10px] opacity-75">
              {[issue.buildingName, issue.unitName].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
  return issue.route ? <Link to={issue.route}>{body}</Link> : body;
}

export default function MonthClosePage() {
  const { data, update } = useStore();
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth());
  const [notes, setNotes] = useState("");
  const review = useMemo(() => buildMonthCloseReview(data, selectedMonth), [data, selectedMonth]);
  const closure = data.financialMonthClosures.find((item) => item.yearMonth === selectedMonth);
  const monthAudit = data.financialAuditLog
    .filter((entry) => entry.yearMonth === selectedMonth)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestUndoable = monthAudit.find((entry) => !entry.undoneAt);
  const postCloseAdjustments = monthAudit.filter((entry) => entry.isPostCloseAdjustment && !entry.undoneAt);
  const snapshot = closure?.snapshot || review;

  const closeMonth = async () => {
    if (closure) {
      showError("هذا الشهر مقفل بالفعل");
      return;
    }
    if (review.blockingIssues > 0) {
      showError(`لا يمكن إقفال الشهر قبل معالجة ${review.blockingIssues} ملاحظة مالية`);
      return;
    }
    await update((prev) => ({
      ...prev,
      financialMonthClosures: [
        ...prev.financialMonthClosures,
        {
          id: genId(),
          yearMonth: selectedMonth,
          closedAt: new Date().toISOString(),
          notes: notes.trim() || undefined,
          snapshot: createMonthCloseSnapshot(review),
        },
      ],
    }), { suppressAudit: true });
    showSuccess(`تم إقفال ${formatYearMonthLabel(selectedMonth)} وحفظ لقطة التقرير`);
  };

  const undoLastAction = async (entry: FinancialAuditEntry) => {
    await update(
      (prev) => undoFinancialAuditEntry(prev, entry),
      { reason: `التراجع عن: ${entry.reason}` },
    );
    showSuccess("تم التراجع عن آخر إجراء مالي وتسجيل العملية في سجل التدقيق");
  };

  const issueGroups: MonthCloseIssueSeverity[] = ["blocking", "warning", "info"];

  return (
    <div>
      <PageHeader title="مراجعة وإقفال الشهر" subtitle="فحص مالي شامل قبل اعتماد التقرير" />
      <div className="space-y-4 p-4">
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">الشهر المالي</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                اختر الشهر ثم عالج الملاحظات الحمراء قبل الإقفال
              </p>
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                setSelectedMonth(event.target.value || currentYearMonth());
                setNotes("");
              }}
              className="h-10 w-36 rounded-xl border border-input bg-background px-2 text-xs"
            />
          </div>
        </div>

        <div className={`rounded-3xl border p-4 ${
          closure ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
        }`}>
          <div className="flex items-start gap-3">
            {closure ? (
              <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-700" />
            ) : (
              <LockKeyhole className="h-6 w-6 shrink-0 text-amber-700" />
            )}
            <div className="min-w-0">
              <p className={`font-bold ${closure ? "text-emerald-900" : "text-amber-900"}`}>
                {closure
                  ? `${formatYearMonthLabel(selectedMonth)} مقفل ماليًا`
                  : `${formatYearMonthLabel(selectedMonth)} غير مقفل`}
              </p>
              <p className={`mt-1 text-xs ${closure ? "text-emerald-800" : "text-amber-800"}`}>
                {closure
                  ? `حُفظت لقطة التقرير بتاريخ ${new Date(closure.closedAt).toLocaleString("ar-SA-u-nu-latn")}. أي تغيير لاحق يظهر كتسوية بعد الإقفال.`
                  : review.blockingIssues > 0
                  ? `متبقي ${review.blockingIssues} إجراء مالي يمنع الإقفال.`
                  : "اجتاز الشهر الفحص المالي ويمكن إقفاله بعد المراجعة."}
              </p>
              {closure?.notes && <p className="mt-2 text-xs font-semibold">ملاحظات الإقفال: {closure.notes}</p>}
              {postCloseAdjustments.length > 0 && (
                <p className="mt-2 rounded-xl bg-violet-100 px-3 py-2 text-xs font-bold text-violet-800">
                  يوجد {postCloseAdjustments.length} تسوية مسجلة بعد إقفال هذا الشهر
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">الإيجار المستحق</p>
            <p className="mt-1 text-sm font-bold">{formatMoney(snapshot.expectedRent)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">المحصل</p>
            <p className="mt-1 text-sm font-bold text-emerald-700">{formatMoney(snapshot.collectedRent)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">المتبقي</p>
            <p className="mt-1 text-sm font-bold text-red-700">{formatMoney(snapshot.outstanding)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">رسوم مكتب غير محصلة</p>
            <p className="mt-1 text-sm font-bold text-orange-700">{formatMoney(snapshot.officeFeesOutstanding)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">تكاليف الصيانة</p>
            <p className="mt-1 text-sm font-bold text-amber-700">{formatMoney(snapshot.maintenanceCost)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">بانتظار تحويل المالك</p>
            <p className="mt-1 text-sm font-bold text-red-700">{formatMoney(snapshot.pendingOwnerTransfers)}</p>
          </div>
        </div>

        {!closure && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                نتيجة الفحص
              </h2>
              <div className="flex gap-1 text-[10px]">
                <span className="rounded-full bg-red-100 px-2 py-1 font-bold text-red-700">{review.blockingIssues} مانع</span>
                <span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-700">{review.warningIssues} تنبيه</span>
                <span className="rounded-full bg-sky-100 px-2 py-1 font-bold text-sky-700">{review.informationalIssues} معلومة</span>
              </div>
            </div>
            {review.issues.length === 0 ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-900">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="mt-2 text-sm font-bold">لا توجد ملاحظات مالية</p>
                <p className="mt-1 text-xs">الشهر جاهز للإقفال</p>
              </div>
            ) : issueGroups.map((severity) => {
              const group = review.issues.filter((issue) => issue.severity === severity);
              if (group.length === 0) return null;
              return (
                <details key={severity} open={severity === "blocking"} className="rounded-2xl border border-border bg-card p-3">
                  <summary className="cursor-pointer text-xs font-bold">
                    {severityMeta[severity].label} ({group.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {group.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {!closure && (
          <div className="rounded-3xl border border-border bg-card p-4">
            <label className="text-xs font-bold">ملاحظات الإقفال (اختياري)</label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-2 min-h-20 rounded-2xl"
              placeholder="مثال: تم اعتماد المتأخرات كذمم قائمة ومراجعة جميع التحويلات"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="mt-3 w-full rounded-2xl" disabled={review.blockingIssues > 0}>
                  <LockKeyhole className="ml-2 h-4 w-4" />
                  إقفال {formatYearMonthLabel(selectedMonth)}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-right">تأكيد إقفال الشهر</AlertDialogTitle>
                  <AlertDialogDescription className="text-right">
                    سيتم حفظ لقطة مالية ثابتة لشهر {formatYearMonthLabel(selectedMonth)}، وستظهر أي تغييرات لاحقة كتسويات في سجل التدقيق.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={closeMonth}>تأكيد الإقفال</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <History className="h-4 w-4 text-primary" />
                سجل التدقيق المالي
              </h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                يحفظ القيمة قبل وبعد كل إجراء مالي وسبب التغيير
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-primary">
              {monthAudit.length} إجراء
            </span>
          </div>
          {monthAudit.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-muted p-4 text-center text-xs text-muted-foreground">
              لا توجد إجراءات مالية مسجلة لهذا الشهر حتى الآن
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {monthAudit.slice(0, 30).map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-2xl border p-3 text-xs ${
                    entry.isPostCloseAdjustment
                      ? "border-violet-200 bg-violet-50"
                      : "border-border bg-background"
                  } ${entry.undoneAt ? "opacity-55" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">
                        {auditActionLabels[entry.action]} · {entry.label}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{entry.reason}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString("ar-SA-u-nu-latn")}
                        {entry.isPostCloseAdjustment ? " · تسوية بعد الإقفال" : ""}
                        {entry.undoneAt ? " · تم التراجع عنها" : ""}
                      </p>
                      <details className="mt-2 rounded-xl border border-border/70 bg-card/70 p-2">
                        <summary className="cursor-pointer text-[10px] font-bold text-primary">
                          عرض القيم قبل وبعد
                        </summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl bg-red-50 p-2 text-[10px] text-red-900">
                            <p className="mb-1 font-bold">قبل</p>
                            {auditSnapshotLines(entry, entry.before).map((line) => (
                              <p key={`before-${entry.id}-${line}`} className="mt-0.5">{line}</p>
                            ))}
                          </div>
                          <div className="rounded-xl bg-emerald-50 p-2 text-[10px] text-emerald-900">
                            <p className="mb-1 font-bold">بعد</p>
                            {auditSnapshotLines(entry, entry.after).map((line) => (
                              <p key={`after-${entry.id}-${line}`} className="mt-0.5">{line}</p>
                            ))}
                          </div>
                        </div>
                      </details>
                    </div>
                    {latestUndoable?.id === entry.id && !entry.undoneAt && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-full text-[10px]">
                            <RotateCcw className="ml-1 h-3 w-3" />
                            تراجع
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-right">التراجع عن آخر إجراء مالي؟</AlertDialogTitle>
                            <AlertDialogDescription className="text-right">
                              سيتم استعادة البيانات السابقة للعملية «{auditActionLabels[entry.action]}» وتسجيل التراجع كإجراء جديد.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => undoLastAction(entry)}>تأكيد التراجع</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
