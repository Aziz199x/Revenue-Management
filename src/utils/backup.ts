<<<<<<< HEAD
import { Capacitor } from "@capacitor/core";
import { AppData, EMPTY_DATA } from "@/data/types";
import {
  BILL_STATUS_LABELS,
  BILL_TYPE_LABELS,
  COLLECTION_FEE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_RECEIVE_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  REPAIR_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from "@/data/labels";

function dateStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function escapeCsv(v: unknown) {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}

function escapeHtml(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paymentReceiveMethod(payment: AppData["payments"][number]) {
  return payment.receiveMethod ?? payment.paymentMethod ?? "other";
}

function unitInfo(data: AppData, unitId?: string) {
  const unit = data.units.find((item) => item.id === unitId);
  const building = unit ? data.buildings.find((item) => item.id === unit.buildingId) : undefined;
  const tenant = unit ? data.tenants.find((item) => item.unitId === unit.id) : undefined;
  return {
    building: building?.name ?? "",
    unit: unit?.name ?? "",
    tenant: tenant?.name ?? "",
    phone: tenant?.phone ?? "",
  };
}

async function saveTextReport(fileName: string, content: string, mimeType: string, shareTitle: string, shareText: string) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const result = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: shareTitle,
      text: shareText,
      url: result.uri,
      dialogTitle: shareTitle,
    });
  } else {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export async function exportJSON(data: AppData) {
  const fileName = `rental-backup-${dateStamp()}.json`;
  const jsonContent = JSON.stringify(data, null, 2);

  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const result = await Filesystem.writeFile({
        path: fileName,
        data: jsonContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: "نسخة احتياطية",
        text: "تصدير نسخة احتياطية من بيانات العقارات",
        url: result.uri,
        dialogTitle: "مشاركة النسخة الاحتياطية",
      });
    } catch (err) {
      console.error("JSON export failed:", err);
      throw err;
    }
  } else {
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export async function exportCSV(data: AppData) {
  const rows: Record<string, string>[] = [];

  const unitInfo = (unitId: string) => {
    const u = data.units.find((x) => x.id === unitId);
    const b = u ? data.buildings.find((x) => x.id === u.buildingId) : undefined;
    const t = u ? data.tenants.find((x) => x.unitId === u.id) : undefined;
    return { building: b?.name ?? "", unit: u?.name ?? "", tenant: t?.name ?? "", phone: t?.phone ?? "" };
  };

  for (const p of data.payments) {
    const info = unitInfo(p.unitId);
    rows.push({
      type: "دفعة إيجار",
      building: info.building,
      unit: info.unit,
      tenant: info.tenant,
      phone: info.phone,
      description: "",
      amount: String(p.amount),
      date: p.paymentDate,
      status: p.status,
      receivedDate: p.receivedDate || "",
      paymentMethod: p.paymentMethod || "",
    });
  }

  for (const b of data.bills) {
    const info = unitInfo(b.unitId);
    rows.push({
      type: "فاتورة",
      building: info.building,
      unit: info.unit,
      tenant: info.tenant,
      phone: info.phone,
      description: b.typeLabel || b.type,
      amount: String(b.amount),
      date: b.billDate,
      status: b.status,
      receivedDate: "",
      paymentMethod: "",
    });
  }

  for (const r of data.repairs) {
    const info = unitInfo(r.unitId);
    rows.push({
      type: "صيانة",
      building: info.building,
      unit: info.unit,
      tenant: info.tenant,
      phone: info.phone,
      description: r.description,
      amount: String(r.cost),
      date: r.repairDate,
      status: r.status,
      receivedDate: "",
      paymentMethod: "",
    });
  }

  const headers = [
    "النوع", "العقار", "الوحدة", "المستأجر", "الجوال",
    "الوصف", "المبلغ", "التاريخ", "الحالة", "تاريخ الاستلام", "طريقة الدفع",
  ];

  const csvRows = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) =>
      [
        r.type, r.building, r.unit, r.tenant, r.phone,
        r.description, r.amount, r.date, r.status,
        r.receivedDate, r.paymentMethod,
      ].map(escapeCsv).join(","),
    ),
  ];

  const csvContent = "\uFEFF" + csvRows.join("\n");
  const fileName = `rental-report-${dateStamp()}.csv`;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const result = await Filesystem.writeFile({
        path: fileName,
        data: csvContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: "تقرير العقارات",
        text: "تصدير تقرير CSV",
        url: result.uri,
        dialogTitle: "مشاركة التقرير",
      });
    } catch (err) {
      console.error("CSV export failed:", err);
      throw err;
    }
  } else {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export async function exportEventsExcel(data: AppData) {
  const rows: Record<string, string | number>[] = [];

  for (const payment of data.payments.filter((item) => !item.deletedAt)) {
    const info = unitInfo(data, payment.unitId);
    const receiveMethod = paymentReceiveMethod(payment);
    rows.push({
      type: "دفعة إيجار",
      date: payment.dueDateGregorian || payment.nextDueDate || payment.paymentDate,
      building: info.building || payment.buildingName || "",
      unit: info.unit || payment.unitName || "",
      tenant: info.tenant || payment.tenantName || "",
      phone: info.phone || payment.tenantPhone || "",
      description: payment.notes || payment.rentalPeriod || "",
      amount: payment.grossAmount ?? payment.amount,
      status: PAYMENT_STATUS_LABELS[payment.status] ?? payment.status,
      receiveMethod: PAYMENT_RECEIVE_METHOD_LABELS[receiveMethod] ?? receiveMethod,
      receivedDate: payment.receivedDate || "",
      collectionFeeAmount: payment.collectionFeeAmount ?? "",
      collectionFeeStatus: payment.collectionFeeStatus ? COLLECTION_FEE_STATUS_LABELS[payment.collectionFeeStatus] : "",
      notes: payment.collectionFeeReason || payment.collectionFeeSettlementNote || "",
    });
  }

  for (const bill of data.bills) {
    const info = unitInfo(data, bill.unitId);
    rows.push({
      type: "فاتورة",
      date: bill.billDate,
      building: info.building,
      unit: info.unit,
      tenant: info.tenant,
      phone: info.phone,
      description: bill.typeLabel || BILL_TYPE_LABELS[bill.type] || bill.type,
      amount: bill.amount,
      status: BILL_STATUS_LABELS[bill.status] ?? bill.status,
      receiveMethod: "",
      receivedDate: "",
      collectionFeeAmount: "",
      collectionFeeStatus: "",
      notes: bill.notes || "",
    });
  }

  for (const repair of data.repairs) {
    const info = unitInfo(data, repair.unitId);
    const building = info.building || data.buildings.find((item) => item.id === repair.buildingId)?.name || "";
    rows.push({
      type: "صيانة",
      date: repair.repairDate,
      building,
      unit: info.unit,
      tenant: info.tenant,
      phone: info.phone,
      description: repair.description,
      amount: repair.cost,
      status: REPAIR_STATUS_LABELS[repair.status] ?? repair.status,
      receiveMethod: "",
      receivedDate: "",
      collectionFeeAmount: "",
      collectionFeeStatus: "",
      notes: repair.notes || repair.contractor || "",
    });
  }

  for (const request of data.tenantRequests) {
    const info = unitInfo(data, request.unitId);
    rows.push({
      type: "طلب مستأجر",
      date: request.requestDate,
      building: info.building,
      unit: info.unit,
      tenant: info.tenant,
      phone: info.phone,
      description: `${REQUEST_TYPE_LABELS[request.type] ?? request.customType ?? request.type} - ${request.title}`,
      amount: request.cost ?? "",
      status: REQUEST_STATUS_LABELS[request.status] ?? request.status,
      receiveMethod: "",
      receivedDate: request.actualCompletionDate || "",
      collectionFeeAmount: "",
      collectionFeeStatus: "",
      notes: `${REQUEST_PRIORITY_LABELS[request.priority] ?? request.priority}${request.notes ? ` - ${request.notes}` : ""}`,
    });
  }

  for (const contract of data.contracts.filter((item) => !item.deletedAt)) {
    const info = unitInfo(data, contract.unitId);
    rows.push({
      type: "عقد",
      date: contract.startDate,
      building: info.building || contract.propertyAddress || "",
      unit: info.unit || contract.unitNumber || "",
      tenant: info.tenant || contract.tenantName || "",
      phone: info.phone || contract.tenantPhone || "",
      description: `من ${contract.startDate} إلى ${contract.endDate}`,
      amount: contract.rentAmount ?? contract.totalContractValue ?? "",
      status: contract.status || "active",
      receiveMethod: "",
      receivedDate: "",
      collectionFeeAmount: "",
      collectionFeeStatus: "",
      notes: contract.notes || contract.contractNumber || "",
    });
  }

  for (const settlement of data.collectionFeeSettlements) {
    const payment = data.payments.find((item) => item.id === settlement.paymentId);
    const info = unitInfo(data, payment?.unitId);
    rows.push({
      type: "تسوية رسوم مكتب",
      date: settlement.date,
      building: data.buildings.find((item) => item.id === settlement.propertyId)?.name || info.building,
      unit: info.unit,
      tenant: info.tenant,
      phone: info.phone,
      description: "تسوية رسوم تحصيل المكتب",
      amount: settlement.amount,
      status: "تمت التسوية",
      receiveMethod: PAYMENT_METHOD_LABELS[settlement.method] ?? settlement.method,
      receivedDate: settlement.date,
      collectionFeeAmount: settlement.amount,
      collectionFeeStatus: COLLECTION_FEE_STATUS_LABELS.settled,
      notes: settlement.note || "",
    });
  }

  rows.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  const headers = [
    "النوع",
    "التاريخ",
    "العقار",
    "الوحدة",
    "المستأجر",
    "الجوال",
    "الوصف",
    "المبلغ",
    "الحالة",
    "طريقة الاستلام",
    "تاريخ الاستلام/الإكمال",
    "رسوم المكتب",
    "حالة رسوم المكتب",
    "ملاحظات",
  ];

  const htmlRows = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.type)}</td>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.building)}</td>
      <td>${escapeHtml(row.unit)}</td>
      <td>${escapeHtml(row.tenant)}</td>
      <td>${escapeHtml(row.phone)}</td>
      <td>${escapeHtml(row.description)}</td>
      <td>${escapeHtml(row.amount)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.receiveMethod)}</td>
      <td>${escapeHtml(row.receivedDate)}</td>
      <td>${escapeHtml(row.collectionFeeAmount)}</td>
      <td>${escapeHtml(row.collectionFeeStatus)}</td>
      <td>${escapeHtml(row.notes)}</td>
    </tr>
  `).join("");

  const html = `\uFEFF<html dir="rtl">
    <head>
      <meta charset="utf-8" />
      <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; }
        th, td { border: 1px solid #999; padding: 6px; white-space: nowrap; }
        th { background: #dfeee9; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${htmlRows}</tbody>
      </table>
    </body>
  </html>`;

  await saveTextReport(
    `rental-events-report-${dateStamp()}.xls`,
    html,
    "application/vnd.ms-excel;charset=utf-8",
    "تقرير الأحداث",
    "تصدير تقرير Excel لكل الأحداث",
  );
}

export function parseBackup(text: string): AppData | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.buildings) || !Array.isArray(parsed.units)) return null;
    return { ...EMPTY_DATA, ...parsed };
  } catch {
    return null;
  }
}
=======
import { AppData, EMPTY_DATA } from "@/data/types";

export function exportJSON(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `rental-backup-${dateStamp()}.json`);
}

export function exportCSV(data: AppData) {
  const lines: string[] = [];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  lines.push("نوع السجل,العقار,الوحدة,الوصف,المبلغ,التاريخ,الحالة,ملاحظات");

  const unitInfo = (unitId: string) => {
    const u = data.units.find((x) => x.id === unitId);
    const b = u ? data.buildings.find((x) => x.id === u.buildingId) : undefined;
    return { building: b?.name ?? "", unit: u?.name ?? "" };
  };

  for (const p of data.payments) {
    const { building, unit } = unitInfo(p.unitId);
    lines.push(
      [esc("دفعة إيجار"), esc(building), esc(unit), esc(""), esc(p.amount), esc(p.dueDate), esc(p.status), esc(p.notes)].join(","),
    );
  }
  for (const b of data.bills) {
    const { building, unit } = unitInfo(b.unitId);
    lines.push(
      [esc("فاتورة"), esc(building), esc(unit), esc(b.typeLabel || b.type), esc(b.amount), esc(b.billDate), esc(b.status), esc(b.notes)].join(","),
    );
  }
  for (const r of data.repairs) {
    const { building, unit } = unitInfo(r.unitId);
    lines.push(
      [esc("صيانة"), esc(building), esc(unit), esc(r.description), esc(r.cost), esc(r.repairDate), esc(r.status), esc(r.notes)].join(","),
    );
  }

  // BOM for correct Arabic display in Excel
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, `rental-report-${dateStamp()}.csv`);
}

export function parseBackup(text: string): AppData | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.buildings) || !Array.isArray(parsed.units)) return null;
    return { ...EMPTY_DATA, ...parsed };
  } catch {
    return null;
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
