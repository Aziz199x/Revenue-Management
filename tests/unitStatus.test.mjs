import assert from "node:assert/strict";
import test from "node:test";
import { getComputedUnitStatus } from "../src/data/unitStatus.ts";

const unit = { id: "1", buildingId: "b", name: "1", type: "شقة", rentAmount: 0, rentPeriod: "monthly", status: "vacant", createdAt: "2026-01-01" };
const contract = (id, startDate, endDate, autoRenewal = true) => ({ id, unitId: "1", startDate, endDate, autoRenewal, expiryReminderDays: 80, createdAt: "2026-01-01" });

test("future-only contract leaves unit vacant", () => {
  assert.equal(getComputedUnitStatus(unit, [contract("f", "2099-01-01", "2099-12-31")]), "vacant");
});

test("active contract makes unit occupied", () => {
  assert.equal(getComputedUnitStatus(unit, [contract("a", "2020-01-01", "2099-12-31")]), "occupied");
});

test("ending contract with continuation remains occupied", () => {
  const today = new Date();
  const iso = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  assert.equal(getComputedUnitStatus(unit, [contract("a", iso(-10), iso(20), false), contract("n", iso(21), iso(400))]), "occupied");
});

test("ending contract without continuation and auto renewal off shows warning", () => {
  const today = new Date(); const end = new Date(today); end.setDate(end.getDate() + 20);
  const value = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  assert.equal(getComputedUnitStatus(unit, [contract("a", "2020-01-01", value, false)]), "rented_not_renewing");
});

test("ending contract with auto renewal on remains occupied", () => {
  const today = new Date(); const end = new Date(today); end.setDate(end.getDate() + 20);
  const value = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  assert.equal(getComputedUnitStatus(unit, [contract("a", "2020-01-01", value, true)]), "occupied");
});
