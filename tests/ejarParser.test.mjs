import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseEjarContractText, isCorruptedArabic } from "../src/utils/ejarParser.ts";

const fixtureUrl = new URL("./fixtures/ejar-sample-extracted.txt", import.meta.url);

test("parses reliable Ejar numeric, date, and payment fields", async () => {
  const text = await readFile(fixtureUrl, "utf8");
  const result = parseEjarContractText(text, () => {});

  assert.equal(result.contract.contractNumber, "1-0 / 10538984484");
  assert.equal(result.contract.startDate, "2024-05-08");
  assert.equal(result.contract.endDate, "2025-05-07");
  assert.deepEqual(result.tenant, {});
  assert.deepEqual(result.lessor, {});
  assert.equal(result.financial.paymentCycle, "quarterly");
  assert.equal(result.financial.numberOfPayments, "4");
  assert.equal(result.payments.length, 4);
  assert.equal(Number(result.payments[0].amount), 6000);
  assert.equal(result.payments[0].dueDateGregorian, "2024-05-08");
  assert.equal(result.payments[0].paymentDeadlineGregorian, "2024-05-23");
});

test("does not import unreliable identity or Arabic long-text fields", async () => {
  const text = await readFile(fixtureUrl, "utf8");
  const result = parseEjarContractText(text, () => {});

  assert.equal(result.tenant.name, undefined);
  assert.equal(result.lessor.name, undefined);
  assert.equal(result.property.address, undefined);
  assert.equal(result.broker.officeName, undefined);
  assert.ok(isCorruptedArabic("NimbusSans-Regular Font obj endobj"));
});
