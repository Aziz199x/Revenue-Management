import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server;
let reporting;
let finance;
let helpers;
let maintenanceItems;

test.before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  reporting = await server.ssrLoadModule("/src/reporting/unitMonthStatus.ts");
  finance = await server.ssrLoadModule("/src/reporting/financialReportEngine.ts");
  helpers = await server.ssrLoadModule("/src/data/helpers.ts");
  maintenanceItems = await server.ssrLoadModule("/src/data/maintenanceExpenseItems.ts");
});

test.after(async () => {
  await server?.close();
});

const unit = {
  id: "u1",
  buildingId: "b1",
  name: "شقة 1",
  type: "شقة",
  rentAmount: 12000,
  rentPeriod: "monthly",
  status: "occupied",
  createdAt: "2026-01-01",
};

const contract = {
  id: "c1",
  unitId: unit.id,
  tenantName: "المستأجر",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  paymentFrequency: "monthly",
  annualRent: 12000,
  expiryReminderDays: 60,
  autoRenewal: false,
  createdAt: "2026-01-01",
};

function payment(overrides = {}) {
  return {
    id: "p1",
    unitId: unit.id,
    contractId: contract.id,
    tenantName: contract.tenantName,
    amount: 1000,
    grossAmount: 1000,
    paymentDate: "2026-06-01",
    dueDateGregorian: "2026-06-01",
    status: "paid",
    receivedAmount: 1000,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

function data(payments, contracts = [contract]) {
  return {
    buildings: [{ id: "b1", name: "العقار", collectionFeePercent: 5, createdAt: "2026-01-01" }],
    units: [unit],
    contracts,
    payments,
    tenants: [],
    bills: [],
    repairs: [],
    requests: [],
    tenantRequests: [],
    collectionFeeSettlements: [],
    settings: { reportMonthCutoffDay: 25, contractReminderDays: 80 },
  };
}

test("the configurable cutoff moves late-month due dates into the following report month", () => {
  assert.equal(helpers.getPaymentReportYearMonth("2026-04-24", 25), "2026-04");
  assert.equal(helpers.getPaymentReportYearMonth("2026-04-25", 25), "2026-05");
  assert.equal(helpers.getPaymentReportYearMonth("2026-05-31", 25), "2026-06");
  assert.equal(helpers.getPaymentReportYearMonth("2026-05-31", null), "2026-05");
  assert.equal(helpers.getPaymentReportYearMonth("2026-05-31", 25, "due_month"), "2026-05");
  assert.equal(helpers.getPaymentReportYearMonth("2026-05-10", 25, "next_month"), "2026-06");
});

test("a per-payment override moves the scheduled obligation and does not duplicate it", () => {
  const endOfMonthContract = { ...contract, startDate: "2026-05-31", endDate: "2026-06-15" };
  const recorded = payment({
    contractId: endOfMonthContract.id,
    paymentDate: "2026-05-31",
    dueDateGregorian: "2026-05-31",
    reportingMonthMode: "due_month",
  });
  const snapshot = data([recorded], [endOfMonthContract]);
  const may = reporting.buildUnitMonthRows(snapshot, "b1", "2026-05")[0];
  const june = reporting.buildUnitMonthRows(snapshot, "b1", "2026-06")[0];

  assert.equal(may.collectedAmount, 1000);
  assert.equal(may.status, "occupied_paid");
  assert.equal(june.rentAmount, 0);
  assert.equal(june.status, "occupied_no_due");
});

test("money and dates use Western digits", () => {
  assert.equal(helpers.formatMoney(1234567.89), "1,234,567.89 ر.س");
  assert.doesNotMatch(helpers.formatMoney(1234567.89), /[٠-٩۰-۹]/);
  assert.doesNotMatch(helpers.formatDate("2026-07-13"), /[٠-٩۰-۹]/);
});

test("a received payment remains in reminders until it is transferred to the owner", () => {
  const pending = data([payment({ receivedDate: "2026-07-01", ownerTransferred: false })]);
  const completed = data([payment({ receivedDate: "2026-07-01", ownerTransferred: true })]);

  assert.equal(helpers.collectReminders(pending).filter((item) => item.kind === "owner_transfer").length, 1);
  assert.equal(helpers.collectReminders(completed).filter((item) => item.kind === "owner_transfer").length, 0);
});

test("Ejar auto-transfer follows the lessor capacity on the contract", () => {
  const ownerContract = { ...contract, lessorCapacity: "owner" };
  const representativeContract = { ...contract, lessorCapacity: "representative" };
  const record = payment({ receiveMethod: "ejar_platform" });

  assert.equal(helpers.shouldAutoTransferEjarPayment(data([record], [ownerContract]), record, "ejar_platform"), true);
  assert.equal(helpers.shouldAutoTransferEjarPayment(data([record], [representativeContract]), record, "ejar_platform"), false);
  assert.equal(helpers.shouldAutoTransferEjarPayment(data([record], [ownerContract]), record, "bank_transfer"), false);
});

test("early May collection for a June installment is counted in June", () => {
  const snapshot = data([payment({ receivedDate: "2026-05-25", contractId: "legacy-contract-id" })]);
  const may = reporting.buildUnitMonthRows(snapshot, "b1", "2026-05")[0];
  const june = reporting.buildUnitMonthRows(snapshot, "b1", "2026-06")[0];

  assert.equal(may.collectedAmount, 0);
  assert.equal(june.status, "occupied_paid");
  assert.equal(june.collectedAmount, 1000);
  assert.match(june.message, /الدفع مبكراً/);
  assert.match(june.message, /2026-06/);
});

test("late July collection closes June and is also reported as July cash", () => {
  const snapshot = data([payment({ receivedDate: "2026-07-05" })]);
  const june = reporting.buildUnitMonthRows(snapshot, "b1", "2026-06")[0];
  const julyCash = finance.generateLateCollectionsReport(snapshot, "b1", "2026-07");

  assert.equal(june.status, "occupied_paid_late");
  assert.equal(june.outstandingAmount, 0);
  assert.match(june.message, /2026-07/);
  assert.equal(julyCash.length, 1);
  assert.equal(julyCash[0].dueMonth, "2026-06");
  assert.equal(julyCash[0].collectionDate, "2026-07-05");
});

test("an orphan payment cannot make a genuinely vacant month overdue", () => {
  const futureContract = { ...contract, startDate: "2026-07-01", endDate: "2027-06-30" };
  const stalePayment = payment({ status: "overdue", receivedAmount: undefined, dueDateGregorian: "2026-04-01", paymentDate: "2026-04-01" });
  const april = reporting.buildUnitMonthRows(data([stalePayment], [futureContract]), "b1", "2026-04")[0];

  assert.equal(april.status, "vacant");
  assert.equal(april.rentAmount, 0);
  assert.equal(april.outstandingAmount, 0);
});

test("cancelled contracts and duplicate records do not create false revenue", () => {
  const cancelled = { ...contract, status: "cancelled" };
  const cancelledRow = reporting.buildUnitMonthRows(data([payment({ status: "overdue", receivedAmount: undefined })], [cancelled]), "b1", "2026-06")[0];
  assert.equal(cancelledRow.status, "vacant");

  const duplicate = payment({ id: "p2", receivedDate: "2026-06-01" });
  const valid = payment({ receivedDate: "2026-06-01" });
  const paidRow = reporting.buildUnitMonthRows(data([valid, duplicate]), "b1", "2026-06")[0];
  assert.equal(paidRow.collectedAmount, 1000);
  assert.deepEqual(paidRow.duplicatePaymentIds, ["p2"]);
});

test("duplicate receipt detection blocks the same unit, report month, contract, and amount", () => {
  const existing = payment({ id: "paid-june", receivedDate: "2026-06-04" });
  const duplicateCandidate = payment({
    id: "candidate",
    dueDateGregorian: "2026-05-31",
    paymentDate: "2026-05-31",
    receivedDate: "2026-06-12",
  });
  const differentContract = payment({
    id: "new-tenant",
    contractId: "c2",
    dueDateGregorian: "2026-05-31",
    paymentDate: "2026-05-31",
    receivedDate: "2026-06-12",
  });
  const snapshot = data([existing]);

  assert.deepEqual(
    helpers.findPotentialDuplicateReceivedPayments(snapshot, duplicateCandidate).map((item) => item.id),
    ["paid-june"],
  );
  assert.deepEqual(
    helpers.findPotentialDuplicateReceivedPayments(snapshot, differentContract),
    [],
  );
});

test("receiving a later installment detects older unreceived obligations in the same contract", () => {
  const olderUnpaid = payment({
    id: "may-unpaid",
    status: "unpaid",
    receivedAmount: undefined,
    paidAmount: undefined,
    dueDateGregorian: "2026-05-01",
    paymentDate: "2026-05-01",
  });
  const olderPartial = payment({
    id: "june-partial",
    status: "partial",
    receivedAmount: 250,
    paidAmount: 250,
    dueDateGregorian: "2026-06-01",
    paymentDate: "2026-06-01",
  });
  const laterCandidate = payment({
    id: "july-received",
    dueDateGregorian: "2026-07-01",
    paymentDate: "2026-07-01",
  });
  const otherContract = payment({
    id: "other-contract-old",
    contractId: "c2",
    status: "unpaid",
    receivedAmount: undefined,
    dueDateGregorian: "2026-04-01",
    paymentDate: "2026-04-01",
  });

  assert.deepEqual(
    helpers.findEarlierUnreceivedPayments(
      data([olderPartial, otherContract, olderUnpaid]),
      laterCandidate,
    ).map((item) => item.id),
    ["may-unpaid", "june-partial"],
  );
});

test("reminders carry a precise route to their payment or request", () => {
  assert.equal(
    helpers.buildReminderRoute("rent", "unit 1", "payment/1"),
    "/units/unit%201?tab=payments&item=payment%2F1",
  );
  assert.equal(
    helpers.buildReminderRoute("request", "unit 1", "request/1"),
    "/requests/request%2F1",
  );

  const unpaid = payment({
    id: "payment-route",
    status: "unpaid",
    receivedAmount: undefined,
  });
  const reminder = helpers.collectReminders(data([unpaid]))
    .find((item) => item.id === "pay-payment-route");
  assert.equal(reminder?.paymentId, "payment-route");
  assert.equal(reminder?.route, "/units/u1?tab=payments&item=payment-route");
});

test("manual building maintenance deducts only entered line-item costs", () => {
  const drafts = [
    { id: "i1", description: "إصلاح المضخة", cost: "250" },
    { id: "i2", description: "تنظيف الخزان", cost: "175.50" },
  ];
  const normalized = maintenanceItems.normalizeMaintenanceExpenseItems(drafts);

  assert.equal(normalized.reduce((sum, item) => sum + item.cost, 0), 425.5);
  assert.equal(maintenanceItems.hasInvalidMaintenanceExpenseItems(drafts), false);
  assert.equal(
    maintenanceItems.hasInvalidMaintenanceExpenseItems([{ id: "bad", description: "", cost: "100" }]),
    true,
  );
});

test("a building-wide maintenance reminder opens the building maintenance tab", () => {
  const snapshot = data([]);
  snapshot.repairs = [{
    id: "building-repair",
    buildingId: "b1",
    description: "صيانة المضخة الرئيسية",
    repairDate: "2026-07-30",
    cost: 300,
    status: "pending",
    createdAt: "2026-07-30",
  }];

  const reminder = helpers.collectReminders(snapshot)
    .find((item) => item.id === "rep-building-repair");
  assert.equal(reminder?.subtitle, "العقار");
  assert.equal(reminder?.route, "/buildings/b1?tab=maintenance&item=building-repair");
});

test("reverting a received payment restores linked maintenance for future receipt suggestions", () => {
  const repairs = [
    {
      id: "r1",
      unitId: unit.id,
      description: "صيانة سباكة",
      repairDate: "2026-06-01",
      cost: 390,
      status: "completed",
      createdAt: "2026-06-01",
      isDeductedFromOwnerTransfer: true,
      deductedFromPaymentId: "p1",
    },
    {
      id: "r2",
      unitId: unit.id,
      description: "صيانة أخرى",
      repairDate: "2026-06-02",
      cost: 100,
      status: "completed",
      createdAt: "2026-06-02",
    },
  ];

  const restored = helpers.restoreMaintenanceDeductionsForPayment(repairs, "p1");
  assert.equal(restored[0].isDeductedFromOwnerTransfer, false);
  assert.equal(restored[0].deductedFromPaymentId, null);
  assert.deepEqual(restored[1], repairs[1]);
});

test("a full building-maintenance settlement closes the owner balance without a fake transfer date", () => {
  const settled = helpers.normalizePaymentFinancials(payment({
    collectionFeePercent: 5,
    collectionFeeAmount: 50,
    collectionFeeStatus: "collected",
    maintenanceDeductionAmount: 950,
    ownerSettledByMaintenance: true,
    maintenanceSettlementNote: "مصروفات صيانة عامة",
    ownerTransferred: false,
    ownerTransferDate: "2026-06-10",
  }));

  assert.equal(helpers.calculateNetAmountToTransferToOwner(settled), 0);
  assert.equal(settled.ownerTransferred, true);
  assert.equal(settled.ownerTransferDate, null);
  assert.equal(settled.maintenanceSettlementNote, "مصروفات صيانة عامة");
});
