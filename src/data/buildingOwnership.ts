import {
  AppData,
  Building,
  BuildingOwner,
  BuildingOwnershipVersion,
  OwnerTransferAllocation,
  Payment,
} from "./types";
import { calculateNetAmountToTransferToOwner, normalizePaymentFinancials } from "./helpers";

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function normalizeOwners(owners?: BuildingOwner[]): BuildingOwner[] {
  return (owners || [])
    .map((owner) => ({
      ...owner,
      name: owner.name.trim(),
      percentage: roundMoney(Number(owner.percentage) || 0),
      phone: owner.phone?.trim() || undefined,
      bankAccount: owner.bankAccount?.trim() || undefined,
    }))
    .filter((owner) => owner.name && owner.percentage > 0);
}

export function ownersAreValid(owners: BuildingOwner[]): boolean {
  if (owners.length === 0) return false;
  return Math.abs(owners.reduce((sum, owner) => sum + owner.percentage, 0) - 100) < 0.01;
}

export function ownershipChanged(before: BuildingOwner[] = [], after: BuildingOwner[] = []): boolean {
  const compact = (owners: BuildingOwner[]) => normalizeOwners(owners)
    .map(({ id, name, percentage, phone, bankAccount }) => ({ id, name, percentage, phone, bankAccount }));
  return JSON.stringify(compact(before)) !== JSON.stringify(compact(after));
}

export function appendOwnershipVersion(
  building: Building,
  owners: BuildingOwner[],
  effectiveFrom: string,
  reason: string,
  createdAt = new Date().toISOString(),
): BuildingOwnershipVersion[] {
  const normalized = normalizeOwners(owners);
  if (!ownershipChanged(building.owners, normalized)) return building.ownershipHistory || [];
  return [
    ...(building.ownershipHistory || []),
    {
      id: `ownership-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      effectiveFrom,
      owners: normalized,
      reason: reason.trim(),
      createdAt,
    },
  ];
}

export function ownersForDate(building: Building | undefined, date: string): BuildingOwner[] {
  if (!building) return [];
  const version = [...(building.ownershipHistory || [])]
    .filter((item) => item.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.createdAt.localeCompare(a.createdAt))[0];
  if ((building.ownershipHistory || []).length > 0 && !version) {
    return [{ id: `owner-${building.id}`, name: "مالك العقار", percentage: 100 }];
  }
  const owners = normalizeOwners(version ? version.owners : building.owners);
  if (owners.length > 0) return owners;
  return [{ id: `owner-${building.id}`, name: "مالك العقار", percentage: 100 }];
}

export function buildingForPayment(data: AppData, payment: Payment): Building | undefined {
  const unit = data.units.find((item) => item.id === payment.unitId);
  return data.buildings.find((item) => item.id === unit?.buildingId);
}

export function createOwnerTransferAllocations(
  data: AppData,
  payment: Payment,
  transferDate: string,
  transferred = true,
): OwnerTransferAllocation[] {
  const building = buildingForPayment(data, payment);
  const owners = ownersForDate(building, transferDate);
  const net = calculateNetAmountToTransferToOwner(normalizePaymentFinancials(payment));
  let allocated = 0;
  return owners.map((owner, index) => {
    const amount = index === owners.length - 1
      ? roundMoney(net - allocated)
      : roundMoney(net * owner.percentage / 100);
    allocated = roundMoney(allocated + amount);
    return {
      ownerId: owner.id,
      ownerName: owner.name,
      percentage: owner.percentage,
      amount,
      transferred,
      transferDate: transferred ? transferDate : null,
      transferMethod: transferred ? payment.ownerTransferMethod || "bank_transfer" : null,
    };
  });
}

export function getOwnerTransferAllocations(data: AppData, payment: Payment): OwnerTransferAllocation[] {
  if (payment.ownerTransferAllocations?.length) return payment.ownerTransferAllocations;
  const date = payment.ownerTransferDate || payment.receivedDate || payment.paymentDate;
  return createOwnerTransferAllocations(data, payment, date, !!payment.ownerTransferred);
}

export function synchronizeOwnerTransferAllocations(data: AppData): AppData {
  return {
    ...data,
    payments: data.payments.map((payment) => {
      if (!payment.ownerTransferred) {
        return payment.ownerTransferAllocations?.length
          ? { ...payment, ownerTransferAllocations: undefined }
          : payment;
      }
      if (payment.ownerTransferAllocations?.length) return payment;
      const transferDate = payment.ownerTransferDate || payment.receivedDate || payment.paymentDate;
      return {
        ...payment,
        ownerTransferAllocations: createOwnerTransferAllocations(data, payment, transferDate, true),
      };
    }),
  };
}
