import type { AppData, Contract, Unit, UnitStatus } from "./types";

function localIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isActiveContract(contract: Contract, today = localIsoDate()): boolean {
  return !contract.deletedAt
    && contract.status !== "cancelled"
    && contract.status !== "terminated"
    && contract.status !== "eviction_completed"
    && (contract.startDate || (contract as Contract & { contractStartDate?: string }).contractStartDate || "") <= today
    && (contract.endDate || (contract as Contract & { contractEndDate?: string }).contractEndDate || "") >= today;
}

export function normalizeId(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function isActiveContractForUnit(contract: Contract, unitId: unknown): boolean {
  return normalizeId(contract.unitId) === normalizeId(unitId) && isActiveContract(contract);
}

export function hasEvictionPendingContract(unit: Unit, contracts: Contract[]): boolean {
  return contracts.some((contract) => normalizeId(contract.unitId) === normalizeId(unit.id)
    && !contract.deletedAt
    && contract.status !== "eviction_completed"
    && (contract.status === "eviction_needed" || contract.status === "eviction_filed" || contract.tenantDidNotLeave === true));
}

export function shouldShowTenantNotRenewingStatus(contract: Contract): boolean {
  if (!isActiveContract(contract)) return false;
  const endDate = contract.endDate || (contract as Contract & { contractEndDate?: string }).contractEndDate;
  if (!endDate) return false;
  const today = new Date(`${localIsoDate()}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  if (Number.isNaN(end)) return false;
  const daysRemaining = Math.ceil((end - today) / 86400000);
  const warningDays = Number(contract.expiryReminderDays || 60);
  const close = daysRemaining >= 0 && daysRemaining <= warningDays;
  const aliases = contract as Contract & { autoRenew?: boolean; isAutoRenewalEnabled?: boolean };
  const autoRenewal = contract.autoRenewal !== false && aliases.autoRenew !== false && aliases.isAutoRenewalEnabled !== false;
  const noRenewal = contract.tenantRenewalPreference === "not_renewing"
    || (contract as Contract & { renewalStatus?: string }).renewalStatus === "not_renewing"
    || (contract as Contract & { wantsRenewal?: boolean }).wantsRenewal === false
    || (contract as Contract & { noRenewal?: boolean }).noRenewal === true;
  const show = close && (!autoRenewal || noRenewal);
  console.log("[Renewal Status Check]", { contractId: contract.id, unitId: contract.unitId, endDate, daysRemaining, autoRenewal: contract.autoRenewal, tenantRenewalPreference: contract.tenantRenewalPreference, showNotRenewing: show });
  return show;
}

export function getComputedUnitStatus(unit: Unit, contracts: Contract[]): UnitStatus {
  if (unit.manualStatus === "maintenance" || unit.status === "maintenance") return "maintenance";
  const validContracts = contracts
    .filter((contract) => normalizeId(contract.unitId) === normalizeId(unit.id)
      && !contract.deletedAt
      && contract.status !== "cancelled"
      && contract.status !== "terminated"
      && contract.status !== "eviction_completed")
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "") || (a.endDate || "").localeCompare(b.endDate || ""));
  const activeContracts = validContracts.filter((contract) => isActiveContract(contract));
  const activeContract = activeContracts.sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  if (activeContract) {
    const hasContinuation = validContracts.some((contract) => contract.id !== activeContract.id
      && contract.startDate > localIsoDate()
      && contract.endDate > activeContract.endDate);
    if (!hasContinuation && shouldShowTenantNotRenewingStatus(activeContract)) return "rented_not_renewing";
    return "occupied";
  }
  if (hasEvictionPendingContract(unit, contracts)) return "occupied";
  return "vacant";
}

export function withComputedUnitStatuses(data: AppData): AppData {
  const units = data.units.map((unit) => {
    const status = getComputedUnitStatus(unit, data.contracts);
    console.log("[Unit Status] recompute:", {
      unitId: unit.id,
      unitName: unit.name,
      currentUnitStatus: unit.status,
      activeContracts: data.contracts.filter((contract) => isActiveContractForUnit(contract, unit.id)).map((contract) => contract.id),
      computedStatus: status,
    });
    return status === unit.status ? unit : { ...unit, status };
  });
  const liveContractIds = new Set(
    data.contracts.filter((contract) => !contract.deletedAt).map((contract) => contract.id),
  );
  const payments = data.payments.filter(
    (payment) => !payment.deletedAt
      && (!payment.contractId || liveContractIds.has(payment.contractId)),
  );
  return { ...data, units, payments };
}
