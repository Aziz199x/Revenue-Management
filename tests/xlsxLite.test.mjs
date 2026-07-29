import assert from "node:assert/strict";
import test from "node:test";

import { buildXlsx } from "../src/utils/xlsxLite.ts";

test("supports monthly payment groups with receipt and owner-transfer dates", () => {
  const bytes = buildXlsx([{
    name: "الدفعات",
    headerRows: 2,
    freezeRows: 2,
    freezeColumns: 1,
    merges: ["A1:A2", "B1:D1", "E1:G1"],
    colWidths: [32, 15, 18, 20, 15, 18, 20],
    rows: [
      ["الوحدة / المستأجر", "مايو 2026", "", "", "يونيو 2026", "", ""],
      ["", "مبلغ السداد", "تاريخ السداد", "تاريخ التحويل للمالك", "مبلغ السداد", "تاريخ السداد", "تاريخ التحويل للمالك"],
      ["شقة 1 — محمد", 1500, "2026-05-01", "2026-05-02", 1500, "2026-06-01", "لم يتم التحويل"],
    ],
  }]);

  const xlsxText = new TextDecoder().decode(bytes);
  assert.match(xlsxText, /<mergeCells count="3">/);
  assert.match(xlsxText, /<mergeCell ref="B1:D1"\/>/);
  assert.match(xlsxText, /xSplit="1" ySplit="2" topLeftCell="B3"/);
  assert.match(xlsxText, /<c r="B2" s="1" t="inlineStr">/);
  assert.match(xlsxText, /<c r="B3"><v>1500<\/v><\/c>/);
  assert.match(xlsxText, /<c r="D3" t="inlineStr">/);
});
