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
      [esc("دفعة إيجار"), esc(building), esc(unit), esc(""), esc(p.amount), esc(p.paymentDate), esc(p.status), esc(p.notes)].join(","),
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
