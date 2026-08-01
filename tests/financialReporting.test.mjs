import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server;
let reporting;
let finance;
let helpers;
let maintenanceItems;
let monthClose;
let financialAudit;
let ownerStatement;
let buildingOwnership;
let storeData;
let automaticCommunications;
let recurringBuildingBills;

test.before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  reporting = await server.ssrLoadModule("/src/reporting/unitMonthStatus.ts");
  finance = await server.ssrLoadModule("/src/reporting/financialReportEngine.ts");
  helpers = await server.ssrLoadModule("/src/data/helpers.ts");
  maintenanceItems = await server.ssrLoadModule("/src/data/maintenanceExpenseItems.ts");
  monthClose = await server.ssrLoadModule("/src/reporting/monthCloseService.ts");
  financialAudit = await server.ssrLoadModule("/src/data/financialAudit.ts");
  ownerStatement = await server.ssrLoadModule("/src/reporting/ownerStatementService.ts");
  buildingOwnership = await server.ssrLoadModule("/src/data/buildingOwnership.ts");
  storeData = await server.ssrLoadModule("/src/data/store.tsx");
  automaticCommunications = await server.ssrLoadModule("/src/utils/automaticCommunications.ts");
  recurringBuildingBills = await server.ssrLoadModule("/src/data/recurringBuildingBills.ts");
});

test.after(async () => {
  await server?.close();
});

test("recurring property bills generate one outstanding charge per month without duplicates", () => {
  const bill = {
    id: "water-1",
    buildingId: "b1",
    name: "فاتورة المياه",
    amount: 240,
    dueDay: 31,
    startYearMonth: "2026-06",
    active: true,
    createdAt: "2026-06-01T00:00:00.000Z",
  };
  const appData = {
    recurringBuildingBills: [bill],
    repairs: [{
      id: "paid-june",
      buildingId: "b1",
      description: "فاتورة المياه - 2026-06",
      repairDate: "2026-06-30",
      cost: 240,
      status: "completed",
      createdAt: "2026-06-01T00:00:00.000Z",
      expenseKind: "recurring_bill",
      recurringBillId: "water-1",
      recurringYearMonth: "2026-06",
      isDeductedFromOwnerTransfer: true,
      deductedFromPaymentId: "payment-1",
    }],
  };
  const outstanding = recurringBuildingBills.getOutstandingRecurringBillRepairs(appData, "b1", "2026-08-01");
  assert.deepEqual(outstanding.map((item) => item.recurringYearMonth), ["2026-07", "2026-08"]);
  assert.equal(outstanding[0].cost, 240);
  assert.equal(outstanding[1].repairDate, "2026-08-31");
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

test("month close review blocks duplicate receipts and unfinished owner actions", () => {
  const first = payment({
    id: "p1",
    receivedDate: "2026-06-01",
    ownerTransferred: false,
    collectionFeeAmount: 50,
    collectionFeeStatus: "uncollected",
  });
  const duplicate = payment({
    id: "p2",
    receivedDate: "2026-06-02",
    ownerTransferred: false,
    collectionFeeAmount: 50,
    collectionFeeStatus: "uncollected",
  });
  const review = monthClose.buildMonthCloseReview(data([first, duplicate]), "2026-06");
  const kinds = new Set(review.issues.map((issue) => issue.kind));

  assert.equal(kinds.has("duplicate_payment"), true);
  assert.equal(kinds.has("owner_transfer"), true);
  assert.equal(kinds.has("collection_fee"), true);
  assert.ok(review.blockingIssues >= 3);
});

test("a reconciled month can be closed with a stable financial snapshot", () => {
  const complete = payment({
    receivedDate: "2026-06-01",
    ownerTransferred: true,
    ownerTransferDate: "2026-06-02",
    collectionFeeAmount: 50,
    collectionFeeStatus: "collected",
  });
  const review = monthClose.buildMonthCloseReview(data([complete]), "2026-06");
  const snapshot = monthClose.createMonthCloseSnapshot(review);

  assert.equal(review.blockingIssues, 0);
  assert.equal(snapshot.expectedRent, 1000);
  assert.equal(snapshot.collectedRent, 1000);
  assert.equal(snapshot.pendingOwnerTransfers, 0);
});

test("financial audit stores before and after values and marks post-close adjustments", () => {
  const unpaid = payment({
    status: "unpaid",
    receivedAmount: undefined,
    receivedDate: undefined,
  });
  const base = {
    ...data([unpaid]),
    financialAuditLog: [],
    financialMonthClosures: [{
      id: "close-1",
      yearMonth: "2026-06",
      closedAt: "2026-07-01T00:00:00.000Z",
      snapshot: {
        expectedRent: 1000,
        collectedRent: 0,
        outstanding: 1000,
        officeFeesOutstanding: 0,
        maintenanceCost: 0,
        pendingOwnerTransfers: 0,
        blockingIssues: 0,
        warningIssues: 0,
        informationalIssues: 0,
        buildings: [],
      },
    }],
  };
  const received = {
    ...base,
    payments: [{
      ...unpaid,
      status: "paid",
      receivedAmount: 1000,
      receivedDate: "2026-06-05",
    }],
  };
  const entries = financialAudit.buildFinancialAuditEntries(base, received, { reason: "تصحيح استلام قديم" });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].action, "payment_received");
  assert.equal(entries[0].reason, "تصحيح استلام قديم");
  assert.equal(entries[0].isPostCloseAdjustment, true);
  assert.equal(entries[0].before.status, "unpaid");
  assert.equal(entries[0].after.status, "paid");

  const restored = financialAudit.undoFinancialAuditEntry(
    { ...received, financialAuditLog: entries },
    entries[0],
  );
  assert.equal(restored.payments[0].status, "unpaid");
  assert.ok(restored.financialAuditLog[0].undoneAt);
});

test("undo restores every payment and maintenance change from the same transaction", () => {
  const unpaid = payment({
    status: "unpaid",
    receivedAmount: undefined,
    receivedDate: undefined,
    maintenanceDeductionAmount: 0,
  });
  const repair = {
    id: "r-atomic",
    buildingId: "b1",
    description: "صيانة المصعد",
    repairDate: "2026-06-02",
    cost: 200,
    status: "completed",
    createdAt: "2026-06-02",
    isDeductedFromOwnerTransfer: false,
    deductedFromPaymentId: null,
  };
  const base = {
    ...data([unpaid]),
    repairs: [repair],
    financialAuditLog: [],
    financialMonthClosures: [],
  };
  const changed = {
    ...base,
    payments: [{
      ...unpaid,
      status: "paid",
      receivedAmount: 1000,
      receivedDate: "2026-06-05",
      maintenanceDeductionAmount: 200,
    }],
    repairs: [{
      ...repair,
      isDeductedFromOwnerTransfer: true,
      deductedFromPaymentId: unpaid.id,
    }],
  };
  const entries = financialAudit.buildFinancialAuditEntries(base, changed);
  const restored = financialAudit.undoFinancialAuditEntry(
    { ...changed, financialAuditLog: entries },
    entries[0],
  );

  assert.equal(entries.length, 2);
  assert.equal(entries[0].transactionId, entries[1].transactionId);
  assert.equal(restored.payments[0].status, "unpaid");
  assert.equal(restored.payments[0].maintenanceDeductionAmount, 0);
  assert.equal(restored.repairs[0].isDeductedFromOwnerTransfer, false);
  assert.equal(restored.repairs[0].deductedFromPaymentId, null);
  assert.equal(restored.financialAuditLog.every((entry) => entry.undoneAt), true);
});

test("owner statement reconciles rent, fees, maintenance, transfers, and opening balance", () => {
  const junePayment = payment({
    receivedDate: "2026-06-05",
    collectionFeeAmount: 50,
    collectionFeeStatus: "collected",
    ownerTransferred: true,
    ownerTransferDate: "2026-06-08",
    netAmountToTransferToOwner: 750,
    maintenanceDeductionAmount: 200,
  });
  const snapshot = {
    ...data([junePayment]),
    repairs: [{
      id: "r-owner",
      buildingId: "b1",
      description: "صيانة عامة",
      repairDate: "2026-06-07",
      cost: 200,
      status: "completed",
      createdAt: "2026-06-07",
    }],
    financialAuditLog: [],
    financialMonthClosures: [],
  };
  const statement = ownerStatement.buildOwnerStatement(snapshot, "b1", "2026-06");

  assert.equal(statement.totals.rentReceived, 1000);
  assert.equal(statement.totals.officeFees, 50);
  assert.equal(statement.totals.maintenance, 200);
  assert.equal(statement.totals.ownerTransfers, 750);
  assert.equal(statement.openingBalance, 0);
  assert.equal(statement.closingBalance, 0);
  assert.deepEqual(statement.events.map((event) => event.kind), [
    "rent",
    "maintenance",
    "owner_transfer",
    "office_fee",
  ].sort((a, b) => {
    const dates = { rent: "2026-06-05", office_fee: "2026-06-05", maintenance: "2026-06-07", owner_transfer: "2026-06-08" };
    return dates[a].localeCompare(dates[b]) || a.localeCompare(b);
  }));
});

test("owner transfer is split by the ownership version effective on the transfer date", () => {
  const snapshot = {
    ...data([]),
    buildings: [{
      id: "b1",
      name: "العقار",
      collectionFeePercent: 5,
      createdAt: "2026-01-01",
      multipleOwnersEnabled: true,
      owners: [
        { id: "o1", name: "أحمد", percentage: 60 },
        { id: "o2", name: "سارة", percentage: 40 },
      ],
      ownershipHistory: [{
        id: "v1",
        effectiveFrom: "2026-07-01",
        reason: "إضافة مالك",
        createdAt: "2026-07-01T00:00:00.000Z",
        owners: [
          { id: "o1", name: "أحمد", percentage: 60 },
          { id: "o2", name: "سارة", percentage: 40 },
        ],
      }],
    }],
  };
  const record = payment({
    amount: 1000,
    grossAmount: 1000,
    collectionFeeAmount: 50,
    collectionFeeStatus: "collected",
    maintenanceDeductionAmount: 50,
    netAmountToTransferToOwner: 900,
    ownerTransferMethod: "bank_transfer",
  });
  const allocations = buildingOwnership.createOwnerTransferAllocations(snapshot, record, "2026-07-10", true);

  assert.deepEqual(allocations.map(({ ownerName, percentage, amount }) => ({ ownerName, percentage, amount })), [
    { ownerName: "أحمد", percentage: 60, amount: 540 },
    { ownerName: "سارة", percentage: 40, amount: 360 },
  ]);
  assert.equal(allocations.reduce((sum, item) => sum + item.amount, 0), 900);
});

test("changing ownership later does not change a captured owner transfer split", () => {
  const transferred = payment({
    ownerTransferred: true,
    ownerTransferDate: "2026-07-10",
    ownerTransferAllocations: [
      { ownerId: "o1", ownerName: "أحمد", percentage: 60, amount: 600, transferred: true, transferDate: "2026-07-10" },
      { ownerId: "o2", ownerName: "سارة", percentage: 40, amount: 400, transferred: true, transferDate: "2026-07-10" },
    ],
  });
  const snapshot = {
    ...data([transferred]),
    buildings: [{
      id: "b1",
      name: "العقار",
      collectionFeePercent: 5,
      createdAt: "2026-01-01",
      multipleOwnersEnabled: true,
      owners: [
        { id: "o1", name: "أحمد", percentage: 50 },
        { id: "o3", name: "محمد", percentage: 50 },
      ],
    }],
  };

  assert.deepEqual(
    buildingOwnership.getOwnerTransferAllocations(snapshot, transferred).map((item) => item.ownerName),
    ["أحمد", "سارة"],
  );
});

test("restoring an older backup safely fills missing contracts and optional collections", () => {
  const legacyBackup = {
    buildings: [{ id: "b1", name: "العقار", collectionFeePercent: 5, createdAt: "2026-01-01" }],
    units: [unit],
    payments: [payment({ contractId: undefined })],
    settings: { reportMonthCutoffDay: 25 },
  };

  const restored = storeData.normalizeData(legacyBackup);

  assert.equal(restored.buildings.length, 1);
  assert.equal(restored.payments.length, 1);
  assert.deepEqual(restored.contracts, []);
  assert.deepEqual(restored.financialAuditLog, []);
  assert.deepEqual(restored.evidenceAttachments, []);
  assert.equal(restored.settings.backupRetentionCount, 14);
  const legacyTenant = storeData.normalizeData({
    tenants: [{ id: "t1", unitId: "u1", name: "مستأجر", phone: "0500000000", createdAt: "2026-01-01" }],
  }).tenants[0];
  assert.deepEqual(legacyTenant.phoneNumbers.map((item) => item.phone), ["0500000000"]);
  assert.equal(legacyTenant.tenantType, "individual");
});

test("automatic communication schedule sends formal email to every company address without duplicates", () => {
  const record = payment({
    status: "unpaid",
    receivedAmount: 0,
    paymentDate: "2026-08-02",
    dueDateGregorian: "2026-08-02",
  });
  const snapshot = {
    ...data([record]),
    tenants: [{
      id: "t-company",
      unitId: "u1",
      name: "شركة المثال",
      tenantType: "company",
      emailAddresses: [
        { id: "e1", email: "accounts@example.com", label: "الحسابات", enabled: true },
        { id: "e2", email: "manager@example.com", label: "المدير", enabled: true },
      ],
      createdAt: "2026-01-01",
    }],
    communicationLogs: [],
    settings: {
      ...data([]).settings,
      emailTemplates: {
        paymentReminder: { subject: "تذكير {tenantName}", body: "السيد/السيدة {tenantName} المحترم/ة، من {periodStart} إلى {periodEnd} بمبلغ {amount}" },
        overduePayment: { subject: "متأخر {tenantName}", body: "{dueDate}" },
        contractExpiry: { subject: "عقد {tenantName}", body: "{contractEndDate}" },
      },
      automaticCommunications: {
        enabled: true,
        emailEnabled: true,
        whatsappEnabled: false,
        frequencyDays: 2,
        sendTime: "09:00",
        daysBeforeDue: 3,
        overdueTailDays: 30,
        emailProvider: "gmail",
      },
    },
  };
  record.tenantId = "t-company";
  const now = new Date("2026-08-01T10:00:00");
  const jobs = automaticCommunications.buildAutomaticCommunicationJobs(snapshot, now);

  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((job) => job.recipient).sort(), ["accounts@example.com", "manager@example.com"]);
  assert.equal(jobs.every((job) => job.subject === "تذكير شركة المثال"), true);
  assert.equal(jobs.every((job) => job.body.includes("1,000")), true);
  assert.equal(jobs.every((job) => job.body.includes("السادة/ شركة المثال المحترمون")), true);
  assert.equal(jobs.every((job) => job.tenantName === "شركة المثال"), true);
  assert.equal(jobs.every((job) => job.unitName === "شقة 1"), true);
  assert.equal(jobs.every((job) => job.periodStart === "2026-08-02"), true);
  assert.equal(jobs.every((job) => job.periodEnd === "2026-08-31"), true);
  assert.equal(jobs.every((job) => job.dueDate === "2026-08-02"), true);

  snapshot.communicationLogs = [{
    id: "sent-1",
    createdAt: "2026-08-01T09:30:00.000Z",
    sentAt: "2026-08-01T09:30:00.000Z",
    channel: "email",
    status: "sent",
    recipient: "accounts@example.com",
    tenantId: "t-company",
    paymentId: record.id,
    templateKind: "paymentReminder",
    provider: "gmail",
    dedupeKey: `${record.id}:email:accounts@example.com:paymentReminder`,
  }];
  const afterOneSent = automaticCommunications.buildAutomaticCommunicationJobs(snapshot, now);
  assert.deepEqual(afterOneSent.map((job) => job.recipient), ["manager@example.com"]);
  const forcedAfterOneSent = automaticCommunications.buildAutomaticCommunicationJobs(snapshot, now, true);
  assert.deepEqual(forcedAfterOneSent.map((job) => job.recipient), ["manager@example.com"]);

  snapshot.communicationLogs = [{
    ...snapshot.communicationLogs[0],
    id: "failed-1",
    status: "failed",
    sentAt: undefined,
    error: "انتهت صلاحية الجلسة",
  }];
  const afterFailure = automaticCommunications.buildAutomaticCommunicationJobs(snapshot, now);
  assert.deepEqual(afterFailure.map((job) => job.recipient), ["manager@example.com"]);
  const manualRetryAfterFailure = automaticCommunications.buildAutomaticCommunicationJobs(snapshot, now, true);
  assert.deepEqual(
    manualRetryAfterFailure.map((job) => job.recipient).sort(),
    ["accounts@example.com", "manager@example.com"],
  );
});

test("payment tenant lookup keeps registered email when payment also stores tenant name", () => {
  const registeredTenant = {
    id: "tenant-with-email",
    unitId: "u1",
    name: "فارس المطيري",
    email: "tenant@example.com",
    createdAt: "2026-01-01",
  };
  const record = payment({
    tenantId: "tenant-with-email",
    tenantName: "فارس المطيري",
  });
  const resolved = automaticCommunications.findTenantForPayment({
    tenants: [registeredTenant],
    contracts: [],
  }, record);

  assert.equal(resolved?.id, registeredTenant.id);
  assert.deepEqual(automaticCommunications.getTenantEmailAddresses(resolved), ["tenant@example.com"]);
});

test("automatic communication schedule never reminds a fully paid installment", () => {
  const paid = payment({ receivedDate: "2026-08-01", status: "paid" });
  const snapshot = storeData.normalizeData({
    ...data([paid]),
    settings: {
      automaticCommunications: {
        enabled: true,
        emailEnabled: true,
        whatsappEnabled: true,
        frequencyDays: 1,
        sendTime: "00:00",
        daysBeforeDue: 10,
        overdueTailDays: 30,
        emailProvider: "gmail",
      },
    },
  });
  assert.deepEqual(
    automaticCommunications.buildAutomaticCommunicationJobs(snapshot, new Date("2026-08-01T12:00:00"), true),
    [],
  );
});

test("automatic WhatsApp schedule supports every enabled tenant phone without duplicates", () => {
  const record = payment({
    tenantId: "t-multi-phone",
    status: "unpaid",
    receivedAmount: 0,
    paymentDate: "2026-08-02",
    dueDateGregorian: "2026-08-02",
  });
  const snapshot = storeData.normalizeData({
    ...data([record]),
    tenants: [{
      id: "t-multi-phone",
      unitId: "u1",
      name: "شركة متعددة الأرقام",
      phoneNumbers: [
        { id: "p1", phone: "0500000000", label: "الإدارة", enabled: true },
        { id: "p2", phone: "0511111111", label: "الحسابات", enabled: true },
        { id: "p3", phone: "0522222222", label: "غير مفعل", enabled: false },
      ],
      createdAt: "2026-01-01",
    }],
    settings: {
      automaticCommunications: {
        enabled: true,
        emailEnabled: false,
        whatsappEnabled: true,
        frequencyDays: 1,
        sendTime: "00:00",
        daysBeforeDue: 3,
        overdueTailDays: 30,
        emailProvider: null,
      },
    },
  });
  const jobs = automaticCommunications.buildAutomaticCommunicationJobs(
    snapshot,
    new Date("2026-08-01T10:00:00"),
    true,
  );
  assert.deepEqual(jobs.map((job) => job.recipient).sort(), ["966500000000", "966511111111"]);
});

test("automatic SMS schedule creates native SMS jobs for enabled tenant phones", () => {
  const record = payment({
    tenantId: "t-sms",
    status: "unpaid",
    receivedAmount: 0,
    paymentDate: "2026-08-02",
    dueDateGregorian: "2026-08-02",
  });
  const snapshot = storeData.normalizeData({
    ...data([record]),
    tenants: [{
      id: "t-sms",
      unitId: "u1",
      name: "مستأجر الرسائل",
      phone: "0500000000",
      createdAt: "2026-01-01",
    }],
    settings: {
      automaticCommunications: {
        enabled: true,
        emailEnabled: false,
        whatsappEnabled: false,
        smsEnabled: true,
        sendMissedAsSoonAsPossible: true,
        frequencyDays: 1,
        sendTime: "09:00",
        daysBeforeDue: 3,
        overdueTailDays: 30,
        emailProvider: null,
      },
    },
  });
  const jobs = automaticCommunications.buildAutomaticCommunicationJobs(
    snapshot,
    new Date("2026-08-01T08:00:00"),
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].channel, "sms");
  assert.equal(jobs[0].provider, "device_sms");
  assert.equal(jobs[0].recipient, "966500000000");
});

test("automatic SMS schedule deduplicates the same phone stored in local and international formats", () => {
  const record = payment({
    tenantId: "t-sms-duplicate",
    status: "unpaid",
    receivedAmount: 0,
    paymentDate: "2026-08-02",
    dueDateGregorian: "2026-08-02",
  });
  const snapshot = storeData.normalizeData({
    ...data([record]),
    tenants: [{
      id: "t-sms-duplicate",
      unitId: "u1",
      name: "مستأجر الرسائل",
      phone: "0500000000",
      phoneNumbers: [
        { id: "local", phone: "050 000 0000", enabled: true },
        { id: "country", phone: "966500000000", enabled: true },
        { id: "plus", phone: "+966 50 000 0000", enabled: true },
      ],
      createdAt: "2026-01-01",
    }],
    settings: {
      automaticCommunications: {
        enabled: true,
        emailEnabled: false,
        whatsappEnabled: false,
        smsEnabled: true,
        sendMissedAsSoonAsPossible: true,
        frequencyDays: 1,
        sendTime: "09:00",
        daysBeforeDue: 3,
        overdueTailDays: 30,
        emailProvider: null,
      },
    },
  });
  const jobs = automaticCommunications.buildAutomaticCommunicationJobs(
    snapshot,
    new Date("2026-08-01T08:00:00"),
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].dedupeKey, `${record.id}:sms:966500000000:paymentReminder`);
});

test("reverted received payment waits for the 40-second safety window before messaging", () => {
  const record = payment({
    id: "p-reverted-with-hold",
    tenantId: "t-hold",
    status: "unpaid",
    receivedAmount: 0,
    paymentDate: "2026-08-01",
    dueDateGregorian: "2026-08-01",
    automaticReminderHoldUntil: "2026-08-01T08:00:40.000Z",
  });
  const snapshot = storeData.normalizeData({
    ...data([record]),
    tenants: [{
      id: "t-hold",
      unitId: "u1",
      name: "مستأجر المهلة",
      phone: "0500000000",
      createdAt: "2026-01-01",
    }],
    settings: {
      automaticCommunications: {
        enabled: true,
        emailEnabled: false,
        whatsappEnabled: false,
        smsEnabled: true,
        sendMissedAsSoonAsPossible: true,
        frequencyDays: 1,
        sendTime: "00:00",
        daysBeforeDue: 3,
        overdueTailDays: 30,
        emailProvider: null,
      },
    },
  });
  const duringHold = automaticCommunications.buildAutomaticCommunicationJobs(
    snapshot,
    new Date("2026-08-01T08:00:20.000Z"),
    true,
  );
  const afterHold = automaticCommunications.buildAutomaticCommunicationJobs(
    snapshot,
    new Date("2026-08-01T08:00:41.000Z"),
    true,
  );
  assert.equal(duringHold.length, 0);
  assert.equal(afterHold.length, 1);
  assert.equal(afterHold[0].paymentId, record.id);
});

test("normalization gives every contract payment a stable chronological number", () => {
  const later = payment({
    id: "p-later",
    paymentNumber: undefined,
    paymentDate: "2026-08-01",
    dueDateGregorian: "2026-08-01",
    createdAt: "2026-01-02",
  });
  const earlier = payment({
    id: "p-earlier",
    paymentNumber: undefined,
    paymentDate: "2026-07-01",
    dueDateGregorian: "2026-07-01",
    createdAt: "2026-01-01",
  });
  const normalized = storeData.normalizeData(data([later, earlier]));
  assert.equal(normalized.payments.find((item) => item.id === "p-earlier").paymentNumber, 1);
  assert.equal(normalized.payments.find((item) => item.id === "p-later").paymentNumber, 2);
});

test("default WhatsApp and SMS payment text includes number and period without duplicate currency", () => {
  const record = payment({
    id: "p-message",
    status: "unpaid",
    receivedAmount: 0,
    paymentNumber: 3,
    paymentDate: "2026-08-01",
    dueDateGregorian: "2026-08-01",
  });
  const snapshot = storeData.normalizeData({
    ...data([record]),
    tenants: [{
      id: "t1",
      unitId: "u1",
      name: "أحمد",
      phone: "0500000000",
      createdAt: "2026-01-01",
    }],
    settings: {
      ...data([]).settings,
      automaticCommunications: {
        enabled: true,
        emailEnabled: false,
        whatsappEnabled: false,
        smsEnabled: true,
        frequencyDays: 1,
        sendTime: "09:00",
        daysBeforeDue: 3,
        overdueTailDays: 30,
        sendMissedAsSoonAsPossible: true,
      },
    },
  });
  snapshot.payments[0].tenantId = "t1";
  const jobs = automaticCommunications.buildAutomaticCommunicationJobs(snapshot, new Date("2026-08-01T10:00:00"));
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].body, /الدفعة رقم 1/);
  assert.match(jobs[0].body, /عن الفترة من/);
  assert.match(jobs[0].body, /إلى/);
  assert.equal(jobs[0].body.includes("ر.س ر.س"), false);
});

test("contract expiry is suppressed when another valid contract covers the same unit expiry", () => {
  const overlapping = {
    ...contract,
    id: "c2",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
  };
  const original = {
    ...contract,
    id: "c1",
    startDate: "2026-06-01",
    endDate: "2026-09-30",
  };
  const contracts = [original, overlapping];
  assert.equal(helpers.hasContinuingContractForUnit(original, contracts), true);
  assert.equal(helpers.hasContinuingContractForUnit(overlapping, contracts), true);
  assert.equal(
    helpers.buildContractExpiryReminders(contracts, [unit], data([]).buildings, 80).length,
    0,
  );

  const snapshot = storeData.normalizeData({
    ...data([], contracts),
    tenants: [{
      id: "t1",
      unitId: "u1",
      name: "أحمد",
      phone: "0500000000",
      createdAt: "2026-01-01",
    }],
    settings: {
      ...data([]).settings,
      contractReminderDays: 80,
      automaticCommunications: {
        enabled: true,
        emailEnabled: false,
        whatsappEnabled: false,
        smsEnabled: true,
        frequencyDays: 1,
        sendTime: "09:00",
        daysBeforeDue: 3,
        overdueTailDays: 30,
        sendMissedAsSoonAsPossible: true,
      },
    },
  });
  const jobs = automaticCommunications.buildAutomaticCommunicationJobs(snapshot, new Date("2026-08-01T10:00:00"));
  assert.equal(jobs.filter((job) => job.templateKind === "contractExpiry").length, 0);
});

test("automatic communication respects payment and contract grace periods", () => {
  const gracePayment = payment({
    id: "p-grace",
    contractId: "c-grace",
    tenantId: "t1",
    status: "unpaid",
    receivedAmount: 0,
    paymentDate: "2026-08-08",
    dueDateGregorian: "2026-08-08",
    communicationGraceUntil: "2026-08-05",
    communicationGraceReason: "Tenant requested time",
  });
  const graceContract = {
    ...contract,
    id: "c-grace",
    tenantId: "t1",
    endDate: "2026-08-20",
    responseGraceUntil: "2026-08-05",
    responseGraceReason: "Waiting for renewal decision",
  };
  const snapshot = storeData.normalizeData({
    ...data([gracePayment], [graceContract]),
    tenants: [{
      id: "t1",
      unitId: "u1",
      name: "Tenant",
      phone: "0500000000",
      createdAt: "2026-01-01",
    }],
    settings: {
      ...data([]).settings,
      contractReminderDays: 80,
      automaticCommunications: {
        enabled: true,
        emailEnabled: false,
        whatsappEnabled: false,
        smsEnabled: true,
        frequencyDays: 1,
        sendTime: "09:00",
        daysBeforeDue: 3,
        overdueTailDays: 30,
        sendMissedAsSoonAsPossible: true,
      },
    },
  });

  assert.deepEqual(
    automaticCommunications.buildAutomaticCommunicationJobs(snapshot, new Date("2026-08-03T10:00:00")),
    [],
  );
  const resumed = automaticCommunications.buildAutomaticCommunicationJobs(snapshot, new Date("2026-08-06T10:00:00"));
  assert.equal(resumed.some((job) => job.paymentId === "p-grace"), true, JSON.stringify(resumed));
  assert.equal(resumed.some((job) => job.contractId === "c-grace"), true);
});

test("custom automatic communication rules can disable overdue reminders without changing shared defaults", () => {
  const overdue = payment({
    id: "p-overdue-disabled",
    tenantId: "t1",
    status: "overdue",
    receivedAmount: 0,
    paymentDate: "2026-07-31",
    dueDateGregorian: "2026-07-31",
  });
  const upcoming = payment({
    id: "p-upcoming-shared",
    tenantId: "t1",
    status: "unpaid",
    receivedAmount: 0,
    paymentDate: "2026-08-02",
    dueDateGregorian: "2026-08-02",
  });
  const snapshot = storeData.normalizeData({
    ...data([overdue, upcoming]),
    tenants: [{
      id: "t1",
      unitId: "u1",
      name: "Tenant",
      phone: "0500000000",
      createdAt: "2026-01-01",
    }],
    settings: {
      ...data([]).settings,
      automaticCommunications: {
        enabled: true,
        emailEnabled: false,
        whatsappEnabled: false,
        smsEnabled: true,
        frequencyDays: 1,
        sendTime: "09:00",
        daysBeforeDue: 3,
        overdueTailDays: 30,
        sendMissedAsSoonAsPossible: true,
        overduePaymentSchedule: {
          useCustomSchedule: true,
          enabled: false,
          frequencyDays: 2,
          sendTime: "10:00",
          overdueTailDays: 60,
        },
      },
    },
  });
  const jobs = automaticCommunications.buildAutomaticCommunicationJobs(snapshot, new Date("2026-08-01T10:00:00"));
  assert.equal(jobs.some((job) => job.paymentId === "p-overdue-disabled"), false);
  assert.equal(jobs.some((job) => job.paymentId === "p-upcoming-shared"), true);
});
