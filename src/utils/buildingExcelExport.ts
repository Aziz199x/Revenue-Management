import { AppData, Building, Contract, Payment, Unit } from "@/data/types";
import {
  formatDate,
  getCollectedRentAmount,
  getContractEndDate,
  getPaymentAmount,
  getPaymentReportMonth,
} from "@/data/helpers";
import {
  REPAIR_STATUS_LABELS,
  RENT_PERIOD_LABELS,
} from "@/data/labels";
import { buildXlsx, saveAndShareXlsx, SheetSpec } from "@/utils/xlsxLite";

export interface ExcelExportPeriod {
  /** yyyy-mm inclusive */
  fromMonth: string;
  /** yyyy-mm inclusive */
  toMonth: string;
}

function paymentDueDate(payment: Payment): string {
  return payment.dueDateGregorian || payment.nextDueDate || payment.paymentDate || "";
}

const monthLabel = (yearMonth: string): string => {
  const d = new Date(`${yearMonth}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d.toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { month: "long", year: "numeric" });
};

const monthsBetween = (fromMonth: string, toMonth: string): string[] => {
  const [fromYear, fromMonthNumber] = fromMonth.split("-").map(Number);
  const [toYear, toMonthNumber] = toMonth.split("-").map(Number);
  if (![fromYear, fromMonthNumber, toYear, toMonthNumber].every(Number.isFinite)) return [];

  const result: string[] = [];
  const cursor = new Date(fromYear, fromMonthNumber - 1, 1);
  const end = new Date(toYear, toMonthNumber - 1, 1);
  while (cursor <= end) {
    result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
};

const excelColumnRef = (zeroBasedIndex: number): string => {
  let result = "";
  let index = zeroBasedIndex;
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
};

/**
 * Exports one building for a chosen period (yyyy-mm → yyyy-mm) to a .xlsx
 * with organized sheets: report info, unit summary, payments with dates,
 * maintenance with deduction period, and contracts (rental start dates).
 */
export async function exportBuildingExcel(
  data: AppData,
  building: Building,
  period: ExcelExportPeriod,
): Promise<string> {
  const { fromMonth, toMonth } = period;
  const inPeriod = (yearMonth: string) => yearMonth >= fromMonth && yearMonth <= toMonth;

  const units = data.units.filter((u) => u.buildingId === building.id);
  const unitIds = new Set(units.map((u) => u.id));
  const cutoff = data.settings.reportMonthCutoffDay;

  const tenantByUnit = new Map(
    data.tenants.filter((t) => t.unitId && unitIds.has(t.unitId)).map((t) => [t.unitId as string, t] as const),
  );
  const unitById = new Map<string, Unit>(units.map((u) => [u.id, u]));
  const unitName = (unitId?: string) => (unitId ? unitById.get(unitId)?.name ?? "" : "");

  const contractsByUnit = new Map<string, Contract[]>();
  for (const contract of data.contracts.filter((c) => unitIds.has(c.unitId) && !c.deletedAt)) {
    const list = contractsByUnit.get(contract.unitId) ?? [];
    list.push(contract);
    contractsByUnit.set(contract.unitId, list);
  }
  const activeContract = (unitId: string): Contract | undefined => {
    const list = (contractsByUnit.get(unitId) ?? []).slice().sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    return list[0];
  };

  const payments = data.payments
    .filter((p) => unitIds.has(p.unitId) && !p.deletedAt && (p.status as string) !== "cancelled")
    .filter((p) => inPeriod(getPaymentReportMonth(p, cutoff)))
    .sort((a, b) => (unitName(a.unitId)).localeCompare(unitName(b.unitId), "ar")
      || paymentDueDate(a).localeCompare(paymentDueDate(b)));

  const paymentById = new Map(data.payments.map((p) => [p.id, p] as const));

  const repairs = data.repairs
    .filter((r) => r.status !== "cancelled" && (r.buildingId === building.id || (r.unitId && unitIds.has(r.unitId))))
    .filter((r) => inPeriod((r.repairDate || "").slice(0, 7)))
    .sort((a, b) => (a.repairDate || "").localeCompare(b.repairDate || ""));

  // ---- Sheet 1: report info ----------------------------------------------
  const infoRows: SheetSpec["rows"] = [
    ["تقرير عقار", building.name],
    ["العنوان", building.address ?? ""],
    ["الفترة من", monthLabel(fromMonth)],
    ["الفترة إلى", monthLabel(toMonth)],
    ["تاريخ الإصدار", formatDate(new Date().toISOString().slice(0, 10))],
    ["عدد الوحدات", units.length],
    ["عدد الدفعات في الفترة", payments.length],
    ["عدد أعمال الصيانة في الفترة", repairs.length],
  ];

  // ---- Sheet 2: unit summary ---------------------------------------------
  const summaryRows: SheetSpec["rows"] = [[
    "الوحدة", "المستأجر", "الجوال", "تاريخ التأجير", "نهاية العقد", "عدد الدفعات", "المستحق", "المحصل", "المتبقي", "الصيانة", "الصافي",
  ]];
  let totalDue = 0; let totalCollected = 0; let totalMaintenance = 0;
  for (const unit of units) {
    const tenant = tenantByUnit.get(unit.id);
    const contract = activeContract(unit.id);
    const unitPayments = payments.filter((p) => p.unitId === unit.id);
    const due = unitPayments.reduce((sum, p) => sum + getPaymentAmount(p), 0);
    const collected = unitPayments.reduce((sum, p) => sum + getCollectedRentAmount(p), 0);
    const maintenance = repairs.filter((r) => r.unitId === unit.id).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    totalDue += due; totalCollected += collected; totalMaintenance += maintenance;
    summaryRows.push([
      unit.name,
      tenant?.name ?? contract?.tenantName ?? "شاغرة",
      tenant?.phone ?? "",
      contract?.startDate ? formatDate(contract.startDate) : "",
      contract ? formatDate(getContractEndDate(contract) || contract.endDate) : "",
      unitPayments.length, due, collected, due - collected, maintenance, collected - maintenance,
    ]);
  }
  const generalMaintenance = repairs.filter((r) => !r.unitId).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  if (generalMaintenance > 0) {
    totalMaintenance += generalMaintenance;
    summaryRows.push(["صيانة عامة للعقار", "", "", "", "", "", "", "", "", generalMaintenance, -generalMaintenance]);
  }
  summaryRows.push([
    "الإجمالي", "", "", "", "", payments.length, totalDue, totalCollected, totalDue - totalCollected, totalMaintenance, totalCollected - totalMaintenance,
  ]);

  // ---- Sheet 3: payments matrix -------------------------------------------
  // In the RTL sheet, the unit and tenant share one compact column on the right. Each month owns
  // three columns: collected amount, receipt date, and owner-transfer date.
  const reportMonths = monthsBetween(fromMonth, toMonth);
  const paymentRows: SheetSpec["rows"] = [
    ["الوحدة / المستأجر", ...reportMonths.flatMap((month) => [monthLabel(month), "", ""])],
    ["", ...reportMonths.flatMap(() => ["مبلغ السداد", "تاريخ السداد", "تاريخ التحويل للمالك"])],
  ];

  const sortedUnits = units.slice().sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }));
  for (const unit of sortedUnits) {
    const unitPayments = payments.filter((payment) => payment.unitId === unit.id);
    const tenantNames = Array.from(new Set(
      unitPayments
        .map((payment) => payment.tenantName?.trim())
        .filter((name): name is string => Boolean(name)),
    ));
    const tenant = tenantByUnit.get(unit.id);
    const contract = activeContract(unit.id);
    const tenantLabel = tenantNames.join(" / ")
      || tenant?.name
      || contract?.tenantName
      || "شاغرة";

    const row: SheetSpec["rows"][number] = [`${unit.name} — ${tenantLabel}`];
    for (const month of reportMonths) {
      const monthPayments = unitPayments.filter((payment) => getPaymentReportMonth(payment, cutoff) === month);
      if (monthPayments.length === 0) {
        row.push("", "", "");
        continue;
      }

      const collected = monthPayments.reduce((sum, payment) => sum + getCollectedRentAmount(payment), 0);
      const receivedDates = Array.from(new Set(
        monthPayments
          .map((payment) => payment.receivedDate)
          .filter((date): date is string => Boolean(date))
          .map(formatDate),
      ));
      const receivedPayments = monthPayments.filter((payment) => getCollectedRentAmount(payment) > 0);
      const transferDates = Array.from(new Set(
        receivedPayments
          .filter((payment) => payment.ownerTransferred && !payment.ownerSettledByMaintenance)
          .map((payment) => payment.ownerTransferDate)
          .filter((date): date is string => Boolean(date))
          .map(formatDate),
      ));
      const transferredWithoutDate = receivedPayments.some(
        (payment) => payment.ownerTransferred && !payment.ownerSettledByMaintenance && !payment.ownerTransferDate,
      );
      const pendingTransferCount = receivedPayments.filter((payment) => !payment.ownerTransferred).length;
      const maintenanceSettledCount = receivedPayments.filter((payment) => payment.ownerSettledByMaintenance).length;
      const transferParts = [
        ...transferDates,
        ...(transferredWithoutDate ? ["تم التحويل - التاريخ غير مسجل"] : []),
        ...(maintenanceSettledCount > 0 ? [
          maintenanceSettledCount === 1 ? "تسوية مقابل صيانة المبنى" : `${maintenanceSettledCount} دفعات سويت مقابل الصيانة`,
        ] : []),
        ...(pendingTransferCount > 0 ? [
          pendingTransferCount === 1 ? "لم يتم التحويل" : `${pendingTransferCount} دفعات لم تحول`,
        ] : []),
      ];
      row.push(
        collected,
        receivedDates.length > 0 ? receivedDates.join("، ") : "غير مسدد",
        transferParts.join("، "),
      );
    }
    paymentRows.push(row);
  }

  const totalsRow: SheetSpec["rows"][number] = ["الإجمالي"];
  for (const month of reportMonths) {
    const collected = payments
      .filter((payment) => getPaymentReportMonth(payment, cutoff) === month)
      .reduce((sum, payment) => sum + getCollectedRentAmount(payment), 0);
    totalsRow.push(collected, "", "");
  }
  paymentRows.push(totalsRow);

  const paymentMerges = ["A1:A2"];
  reportMonths.forEach((_, index) => {
    const firstColumnIndex = 1 + (index * 3);
    paymentMerges.push(
      `${excelColumnRef(firstColumnIndex)}1:${excelColumnRef(firstColumnIndex + 2)}1`,
    );
  });

  // ---- Sheet 4: maintenance ----------------------------------------------
  const maintenanceRows: SheetSpec["rows"] = [[
    "م", "الشهر", "التاريخ", "الوحدة", "الوصف", "التكلفة", "الحالة", "خصمت من دفعة شهر", "المقاول", "ملاحظات",
  ]];
  repairs.forEach((repair, index) => {
    const linkedPayment = repair.deductedFromPaymentId ? paymentById.get(repair.deductedFromPaymentId) : undefined;
    maintenanceRows.push([
      index + 1,
      monthLabel((repair.repairDate || "").slice(0, 7)),
      repair.repairDate ? formatDate(repair.repairDate) : "",
      repair.unitId ? unitName(repair.unitId) : "عام للعقار",
      repair.description,
      Number(repair.cost) || 0,
      REPAIR_STATUS_LABELS[repair.status] ?? repair.status,
      linkedPayment ? monthLabel(getPaymentReportMonth(linkedPayment, cutoff)) : "لم تخصم",
      repair.contractor ?? "",
      repair.notes ?? "",
    ]);
  });

  // ---- Sheet 5: contracts (rental history) --------------------------------
  const contractRows: SheetSpec["rows"] = [[
    "الوحدة", "المستأجر", "رقم العقد", "تاريخ التأجير", "نهاية العقد", "الإيجار السنوي", "دورية السداد", "تجديد تلقائي",
  ]];
  for (const unit of units) {
    const list = (contractsByUnit.get(unit.id) ?? []).slice().sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    if (list.length === 0) {
      contractRows.push([unit.name, "شاغرة - لا يوجد عقد", "", "", "", "", "", ""]);
      continue;
    }
    for (const contract of list) {
      contractRows.push([
        unit.name,
        contract.tenantName ?? "",
        contract.contractNumber ?? "",
        contract.startDate ? formatDate(contract.startDate) : "",
        formatDate(getContractEndDate(contract) || contract.endDate),
        contract.annualRent ?? contract.totalContractValue ?? contract.rentAmount ?? "",
        contract.paymentFrequency ? (RENT_PERIOD_LABELS[contract.paymentFrequency] ?? "") : "",
        contract.autoRenewal ? "نعم" : "لا",
      ]);
    }
  }

  const bytes = buildXlsx([
    { name: "معلومات التقرير", rows: infoRows, colWidths: [24, 30] },
    { name: "ملخص الوحدات", rows: summaryRows, colWidths: [14, 20, 14, 14, 14, 10, 12, 12, 12, 12, 14] },
    {
      name: "الدفعات",
      rows: paymentRows,
      colWidths: [32, ...reportMonths.flatMap(() => [15, 18, 20])],
      headerRows: 2,
      merges: paymentMerges,
      freezeRows: 2,
      freezeColumns: 1,
    },
    { name: "الصيانة", rows: maintenanceRows, colWidths: [5, 14, 14, 14, 30, 12, 12, 16, 16, 24] },
    { name: "العقود", rows: contractRows, colWidths: [14, 20, 16, 14, 14, 14, 12, 12] },
  ]);

  const fileName = `تقرير-${building.name.replace(/[\\/:*?"<>|]/g, "-")}-${fromMonth}-الى-${toMonth}.xlsx`;
  await saveAndShareXlsx(fileName, bytes, `تقرير عقار ${building.name} (${monthLabel(fromMonth)} - ${monthLabel(toMonth)})`);
  return fileName;
}
