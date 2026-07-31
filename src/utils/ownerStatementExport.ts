import { Capacitor } from "@capacitor/core";
import { AppData } from "@/data/types";
import { OwnerStatement } from "@/reporting/ownerStatementService";
import { formatMoney } from "@/data/helpers";
import { buildXlsx, saveAndShareXlsx } from "@/utils/xlsxLite";
import { ownersForDate } from "@/data/buildingOwnership";

const kindLabels: Record<OwnerStatement["events"][number]["kind"], string> = {
  rent: "إيجار مستلم",
  office_fee: "رسوم المكتب",
  maintenance: "مصروف صيانة",
  settlement: "تسوية",
  owner_transfer: "تحويل للمالك",
  adjustment: "تعديل بعد الإقفال",
};

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim();
}

export async function exportOwnerStatementXlsx(
  data: AppData,
  statement: OwnerStatement,
): Promise<void> {
  const building = data.buildings.find((item) => item.id === statement.buildingId);
  const owners = ownersForDate(building, `${statement.yearMonth}-31`);
  const rows: (string | number)[][] = [
    ["كشف حساب المالك", building?.name || "", statement.yearMonth, "", "", "", "", ""],
    ["الملاك والنسب", owners.map((owner) => `${owner.name} ${owner.percentage}%`).join("، "), "", "", "", "", "", ""],
    ["التاريخ", "النوع", "الوحدة", "البيان", "الإثباتات", "دائن للمالك", "مدين على المالك", "الرصيد"],
    ["", "رصيد افتتاحي", "", "", "", statement.openingBalance > 0 ? statement.openingBalance : 0, statement.openingBalance < 0 ? -statement.openingBalance : 0, statement.openingBalance],
    ...statement.events.map((event) => [
      event.date,
      kindLabels[event.kind],
      event.unitName || "",
      event.description,
      event.evidenceFiles?.join("، ") || "",
      event.credit,
      event.debit,
      event.runningBalance,
    ]),
    ["", "الإجمالي", "", "", "", statement.totals.rentReceived, statement.totals.officeFees + statement.totals.maintenance + statement.totals.settlements + statement.totals.ownerTransfers, statement.closingBalance],
  ];
  const bytes = buildXlsx([{
    name: "كشف المالك",
    rows,
    headerRows: 3,
    merges: ["A1:B1", "A2:B2"],
    freezeRows: 3,
    colWidths: [14, 20, 22, 38, 28, 18, 18, 18],
  }]);
  await saveAndShareXlsx(
    `owner-statement-${safeFileName(building?.name || "building")}-${statement.yearMonth}.xlsx`,
    bytes,
    "كشف حساب المالك Excel",
  );
}

export async function shareOwnerStatementText(
  data: AppData,
  statement: OwnerStatement,
): Promise<void> {
  const building = data.buildings.find((item) => item.id === statement.buildingId);
  const owners = ownersForDate(building, `${statement.yearMonth}-31`);
  const lines = [
    `كشف حساب المالك - ${building?.name || ""}`,
    `الفترة: ${statement.yearMonth}`,
    `الملاك: ${owners.map((owner) => `${owner.name} ${owner.percentage}%`).join("، ")}`,
    `رصيد افتتاحي: ${formatMoney(statement.openingBalance)}`,
    `الإيجارات المستلمة: ${formatMoney(statement.totals.rentReceived)}`,
    `رسوم المكتب: ${formatMoney(statement.totals.officeFees + statement.totals.settlements)}`,
    `مصروفات الصيانة: ${formatMoney(statement.totals.maintenance)}`,
    `المحول للمالك: ${formatMoney(statement.totals.ownerTransfers)}`,
    `الرصيد الختامي: ${formatMoney(statement.closingBalance)}`,
    statement.closingBalance >= 0 ? "الرصيد المتبقي مستحق للمالك." : "الرصيد المتبقي مستحق للمكتب.",
  ];
  const text = lines.join("\n");
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title: "كشف حساب المالك", text, dialogTitle: "إرسال كشف المالك عبر واتساب" });
    return;
  }
  if (navigator.share) {
    await navigator.share({ title: "كشف حساب المالك", text });
    return;
  }
  await navigator.clipboard.writeText(text);
}
