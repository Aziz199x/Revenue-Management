import assert from "node:assert/strict";
import test from "node:test";

import { buildXlsx } from "../src/utils/xlsxLite.ts";

test("supports monthly payment groups with receipt and owner-transfer dates", () => {
  const bytes = buildXlsx([{
    name: "الدفعات",
    headerRows: 2,
    freezeRows: 2,
    freezeColumns: 2,
    merges: ["A1:A2", "B1:B2", "C1:E1", "F1:H1"],
    colWidths: [18, 24, 15, 18, 20, 15, 18, 20],
    rows: [
      ["الوحدة", "المستأجر", "مايو 2026", "", "", "يونيو 2026", "", ""],
      ["", "", "مبلغ السداد", "تاريخ السداد", "تاريخ التحويل للمالك", "مبلغ السداد", "تاريخ السداد", "تاريخ التحويل للمالك"],
      ["شقة 1", "محمد", 1500, "2026-05-01", "2026-05-02", 1500, "2026-06-01", "لم يتم التحويل"],
    ],
  }]);

  const xlsxText = new TextDecoder().decode(bytes);
  assert.match(xlsxText, /<mergeCells count="4">/);
  assert.match(xlsxText, /<mergeCell ref="C1:E1"\/>/);
  assert.match(xlsxText, /xSplit="2" ySplit="2" topLeftCell="C3"/);
  assert.match(xlsxText, /<c r="C2" s="1" t="inlineStr">/);
  assert.match(xlsxText, /<c r="C3"><v>1500<\/v><\/c>/);
  assert.match(xlsxText, /<c r="E3" t="inlineStr">/);
});
