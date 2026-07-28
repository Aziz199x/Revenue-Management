import { AppData, Building, Payment } from "@/data/types";
import {
  formatDate,
  getCollectedRentAmount,
  getPaymentAmount,
  getPaymentReportMonth,
  getPaymentReceiveMethod,
} from "@/data/helpers";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_RECEIVE_METHOD_LABELS,
  REPAIR_STATUS_LABELS,
} from "@/data/labels";
import { buildXlsx, saveAndShareXlsx, SheetSpec } from "@/utils/xlsxLite";

function paymentDueDate(payment: Payment): string {
  return payment.dueDateGregorian || payment.nextDueDate || payment.paymentDate || "";
}

/**
 * Exports one building to a real .xlsx file with three sheets:
 * unit summary, revenues (all payments with dates), and maintenance.
 */
export async function exportBuildingExcel(data: AppData, building: Building): Promise<string> {
  const units = data.units.filter((u) => u.buildingId === building.id);
  const unitIds = new Set(units.map((u) => u.id));
  const cutoff = data.settings.reportMonthCutoffDay;

  const tenantByUnit = new Map(
    data.tenants.filter((t) => t.unitId && unitIds.has(t.unitId)).map((t) => [t.unitId as string, t] as const),
  );
  const unitById = new Map(units.map((u) => [u.id, u] as const));

  const payments = data.payments
    .filter((p) => unitIds.has(p.unitId) && !p.deletedAt && (p.status as string) !== "cancelled")
    .sort((a, b) => (unitById.get(a.unitId)?.name || "").localeCompare(unitById.get(b.unitId)?.name || "", "ar")
      || paymentDueDate(a).localeCompare(paymentDueDate(b)));

  const repairs = data.repairs
    .filter((r) => r.status !== "cancelled" && (r.buildingId === building.id || (r.unitId && unitIds.has(r.unitId))))
    .sort((a, b) => (a.repairDate || "").localeCompare(b.repairDate || ""));

  // ---- Sheet 1: per-unit summary -----------------------------------------
  const summaryRows: SheetSpec["rows"] = [[
    "الوحدة", "المستأجر", "الجوال", "الإيجار", "عدد الدفعات", "إجمالي المستحق", "إجمالي المحصل", "المتبقي", "تكاليف الصيانة", "الصافي (محصل - صيانة)",
  ]];
  let totalDue = 0; let totalCollected = 0; let totalMaintenance = 0;
  for (const unit of units) {
    const tenant = tenantByUnit.get(unit.id);
    const unitPayments = payments.filter((p) => p.unitId === unit.id);
    const due = unitPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);
    const collected = unitPayments.reduce((sum, p) => sum + getCollectedRentAmount(p), 0);
    const maintenance = repairs.filter((r) => r.unitId === unit.id).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    totalDue += due; totalCollected += collected; totalMaintenance += maintenance;
    summaryRows.push([
      unit.name, tenant?.name ?? "", tenant?.phone ?? "", unit.rentAmount ?? "",
      unitPayments.length, due, collected, due - collected, maintenance, collected - maintenance,
    ]);
  }
  const buildingMaintenance = repairs.filter((r) => !r.unitId).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  if (buildingMaintenance > 0) {
    totalMaintenance += buildingMaintenance;
    summaryRows.push(["(صيانة عامة للعقار)", "", "", "", "", "", "", "", buildingMaintenance, -buildingMaintenance]);
  }
  summaryRows.push(["الإجمالي", "", "", "", payments.length, totalDue, totalCollected, totalDue - totalCollected, totalMaintenance, totalCollected - totalMaintenance]);

  // ---- Sheet 2: revenues --------------------------------------------------
  const revenueRows: SheetSpec["rows"] = [[
    "الوحدة", "المستأجر", "المبلغ", "المحصل", "الحالة", "موعد السداد", "تاريخ الاستلام", "شهر التقرير", "طريقة الاستلام", "عمولة التحصيل", "ملاحظات",
  ]];
  for (const payment of payments) {
    const unit = unitById.get(payment.unitId);
    const tenant = tenantByUnit.get(payment.unitId);
    const method = getPaymentReceiveMethod(payment);
    revenueRows.push([
      unit?.name ?? "", payment.tenantName || tenant?.name || "",
      getPaymentAmount(payment), getCollectedRentAmount(payment),
      PAYMENT_STATUS_LABELS[payment.status] ?? payment.status,
      formatDate(paymentDueDate(payment)),
      payment.receivedDate ? formatDate(payment.receivedDate) : "",
      getPaymentReportMonth(payment, cutoff),
      method ? (PAYMENT_RECEIVE_METHOD_LABELS[method] ?? "") : "",
      payment.collectionFeeAmount ?? "",
      payment.notes ?? "",
    ]);
  }

  // ---- Sheet 3: maintenance ----------------------------------------------
  const maintenanceRows: SheetSpec["rows"] = [[
    "الوحدة", "الوصف", "التكلفة", "الحالة", "التاريخ", "المقاول", "مخصومة من دفعة", "ملاحظات",
  ]];
  for (const repair of repairs) {
    maintenanceRows.push([
      repair.unitId ? (unitById.get(repair.unitId)?.name ?? "") : "(عام للعقار)",
      repair.description,
      Number(repair.cost) || 0,
      REPAIR_STATUS_LABELS[repair.status] ?? repair.status,
      repair.repairDate ? formatDate(repair.repairDate) : "",
      repair.contractor ?? "",
      repair.deductedFromPaymentId ? "نعم" : "لا",
      repair.notes ?? "",
    ]);
  }

  const bytes = buildXlsx([
    { name: "ملخص الوحدات", rows: summaryRows, colWidths: [16, 20, 14, 12, 10, 14, 14, 12, 14, 18] },
    { name: "الإيرادات", rows: revenueRows, colWidths: [14, 20, 12, 12, 12, 14, 14, 12, 16, 12, 24] },
    { name: "الصيانة", rows: maintenanceRows, colWidths: [16, 30, 12, 12, 14, 16, 14, 24] },
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `تقرير-${building.name.replace(/[\\/:*?"<>|]/g, "-")}-${stamp}.xlsx`;
  await saveAndShareXlsx(fileName, bytes, `تقرير عقار ${building.name}`);
  return fileName;
}
