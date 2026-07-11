import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { AppData, EMPTY_DATA, DEFAULT_SETTINGS, Payment, Building, Unit, Contract } from "./types";
import { withComputedUnitStatuses } from "./unitStatus";

function normalizeStoredReceiveMethod(method?: string | null): Payment["receiveMethod"] {
  const value = String(method || "").trim().toLowerCase();
  if (value === "office_collection" || value.includes("office") || value.includes("مكتب")) return "office_collection";
  if (value === "bank_transfer" || value.includes("bank") || value.includes("تحويل")) return "bank_transfer";
  if (value === "cash" || value.includes("نقد")) return "cash";
  if (value === "ejar_platform" || value.includes("ejar") || value.includes("إيجار") || value.includes("ايجار")) return "ejar_platform";
  return "other";
}

function feeStatusForReceiveMethod(receiveMethod?: Payment["receiveMethod"], current?: Payment["collectionFeeStatus"]): Payment["collectionFeeStatus"] {
  const normalized = normalizeStoredReceiveMethod(receiveMethod);
  if (current === "waived" || current === "settled" || current === "partially_settled") return current;
  if (normalized === "ejar_platform") return "uncollected";
  if (normalized === "office_collection" || normalized === "cash" || normalized === "bank_transfer" || normalized === "other") return "collected";
  return current ?? "uncollected";
}

function netOwnerAmount(payment: Payment): number {
  const gross = payment.grossAmount ?? payment.amount;
  const fee = payment.collectionFeeAmount ?? 0;
  const maintenance = payment.maintenanceDeductionAmount ?? 0;
  const deductFee = payment.collectionFeeStatus === "collected" || payment.collectionFeeStatus === "settled";
  return Math.round((gross - (deductFee ? fee : 0) - maintenance) * 100) / 100;
}

function migratePayments(payments: Payment[], units: Unit[], buildings: Building[]): Payment[] {
  return payments.map((payment) => {
    const gross = payment.grossAmount ?? payment.amount;
    const unit = units.find((item) => item.id === payment.unitId);
    const buildingPercent = buildings.find((item) => item.id === unit?.buildingId)?.collectionFeePercent ?? 0;
    const resolvedPercent = unit?.collectionFeeOverrideEnabled && unit.collectionFeePercent !== null && unit.collectionFeePercent !== undefined
      ? Number(unit.collectionFeePercent) || 0
      : buildingPercent;
    const needsBuildingFee = payment.collectionFeePercent === undefined;
    const percent = payment.collectionFeePercent ?? resolvedPercent;
    const calculatedFee = Math.round(gross * percent) / 100;
    const fee = payment.status === "paid"
      ? payment.collectionFeeAmount ?? calculatedFee
      : payment.collectionFeePercent === undefined ? calculatedFee : payment.collectionFeeAmount ?? calculatedFee;
    const maintenance = payment.maintenanceDeductionAmount ?? 0;
    const receiveMethod = normalizeStoredReceiveMethod(payment.receiveMethod ?? payment.paymentMethod);
    const collectionFeeStatus = payment.status === "paid"
      ? feeStatusForReceiveMethod(receiveMethod, payment.collectionFeeStatus)
      : payment.collectionFeeStatus;
    const migrated: Payment = {
      ...payment,
      grossAmount: gross,
      receiveMethod,
      collectionFeePercent: percent,
      collectionFeePercentage: payment.collectionFeePercentage ?? percent,
      collectionFeeAmount: fee,
      collectionFeeStatus,
      collectionFeeReason: collectionFeeStatus === "uncollected" && receiveMethod === "ejar_platform"
        ? (payment.collectionFeeReason || "الدفع تم عبر منصة إيجار ووصل المبلغ للمالك مباشرة، ولم يتم تحصيل نسبة المكتب")
        : payment.collectionFeeReason,
      netAmountAfterCollectionFee: payment.status !== "paid" && needsBuildingFee
        ? gross - fee
        : payment.netAmountAfterCollectionFee ?? gross - fee,
      maintenanceDeductionAmount: maintenance,
      netAmountToTransferToOwner: payment.status !== "paid" && needsBuildingFee
        ? Math.round((gross - fee - maintenance) * 100) / 100
        : payment.netAmountToTransferToOwner ?? Math.round((gross - fee - maintenance) * 100) / 100,
      ownerTransferred: payment.ownerTransferred ?? false,
      ownerTransferDate: payment.ownerTransferDate ?? null,
      ownerTransferMethod: payment.ownerTransferMethod ?? null,
      ownerTransferNotes: payment.ownerTransferNotes ?? "",
    };
    return { ...migrated, netAmountToTransferToOwner: netOwnerAmount(migrated) };
  });
}

const ARABIC_MONTHS: Record<string, number> = {
  يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, ابريل: 4, مايو: 5, يونيو: 6,
  يوليو: 7, أغسطس: 8, اغسطس: 8, سبتمبر: 9, أكتوبر: 10, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};

function normalizeIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const input = value.trim().replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const makeDate = (year: number, month: number, day: number) => {
    const candidate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const parsed = new Date(`${candidate}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day
      ? candidate : undefined;
  };
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const slash = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    return first > 12
      ? makeDate(Number(slash[3]), second, first)
      : makeDate(Number(slash[3]), first, second);
  }
  const arabic = input.match(/^(\d{1,2})\s+([\u0600-\u06ff]+)\s+(\d{4})$/);
  if (arabic && ARABIC_MONTHS[arabic[2]]) return makeDate(Number(arabic[3]), ARABIC_MONTHS[arabic[2]], Number(arabic[1]));
  return undefined;
}

function migrateContracts(contracts: Contract[]): Contract[] {
  return contracts.map((contract) => {
    const startDate = normalizeIsoDate(contract.startDate);
    const endDate = normalizeIsoDate(contract.endDate);
    if (!endDate && contract.endDate) console.warn("[Contract Migration] could not normalize end date:", contract.id, contract.endDate);
    return { ...contract, startDate: startDate ?? contract.startDate, endDate: endDate ?? contract.endDate };
  });
}

const STORAGE_KEY = "aziz-revenue-data-v2";

function migrateData(parsed: any): AppData {
  const base: AppData = {
    buildings: parsed.buildings || [],
    units: parsed.units || [],
    tenants: parsed.tenants || [],
    payments: parsed.payments || [],
    contracts: parsed.contracts || [],
    bills: parsed.bills || [],
    repairs: parsed.repairs || [],
    tenantRequests: parsed.tenantRequests || parsed.requests || [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
  };

  // Migrate old payments (paymentDate → dueDate)
  base.payments = base.payments.map((p: any) => ({
    ...p,
    dueDate: p.dueDate || p.paymentDate || p.nextDueDate || new Date().toISOString().slice(0, 10),
    transferredToOwner: p.transferredToOwner ?? false,
  })) as Payment[];

  // Migrate old contracts (add required fields)
  base.contracts = base.contracts.map((c: any) => ({
    ...c,
    tenantName: c.tenantName || "",
    annualRent: c.annualRent ?? 0,
    paymentCycle: c.paymentCycle || "monthly",
    autoRenewal: c.autoRenewal ?? true,
    reminderDays: c.reminderDays ?? 30,
  })) as Contract[];

  // Migrate old units (add electricity fields if missing)
  base.units = base.units.map((u: any) => ({
    ...u,
    status: ["occupied", "vacant", "maintenance", "occupied_no_renewal", "expired_not_vacated"].includes(u.status)
      ? u.status
      : "vacant",
  }));

  return base;
}

function loadData(): AppData {
  try {
    // Try v2 first
    let raw = localStorage.getItem(STORAGE_KEY);
    // Fall back to old key
    if (!raw) raw = localStorage.getItem("rental-manager-data-v1");
    if (!raw) return EMPTY_DATA;
    const parsed = JSON.parse(raw);
    const parsedSettings = parsed.settings || {};
    const legacyFee = Number(parsedSettings.defaultCollectionFeePercent) || 0;
    const { defaultCollectionFeePercent: _legacyFee, ...settingsWithoutLegacyFee } = parsedSettings;
    const buildings: Building[] = (parsed.buildings || []).map((building: Partial<Building>) => ({
      ...building,
      collectionFeePercent: building.collectionFeePercent ?? legacyFee,
    })) as Building[];
    const units: Unit[] = parsed.units || [];
    return withComputedUnitStatuses({
      ...EMPTY_DATA,
      ...parsed,
      buildings,
      units,
      contracts: migrateContracts(parsed.contracts || []),
      payments: migratePayments(parsed.payments || [], units, buildings),
      repairs: (parsed.repairs || []).map((repair: AppData["repairs"][number]) => ({
        ...repair,
        isDeductedFromOwnerTransfer: repair.isDeductedFromOwnerTransfer ?? false,
        deductedFromPaymentId: repair.deductedFromPaymentId ?? null,
      })),
      settings: {
        ...DEFAULT_SETTINGS,
        ...settingsWithoutLegacyFee,
        defaultContractExpiryReminderDays:
          parsedSettings.defaultContractExpiryReminderDays
          ?? parsedSettings.contractReminderDays
          ?? DEFAULT_SETTINGS.defaultContractExpiryReminderDays,
      },
    });
  } catch {
    return EMPTY_DATA;
  }
}

function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

interface StoreContextValue {
  data: AppData;
  update: (updater: (prev: AppData) => AppData) => Promise<void>;
  replaceAll: (data: AppData) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      setData((prev) => {
        try {
          const next = withComputedUnitStatuses(updater(prev));
          if (!settled) {
            settled = true;
            queueMicrotask(resolve);
          }
          return next;
        } catch (error) {
          if (!settled) {
            settled = true;
            queueMicrotask(() => reject(error));
          }
          return prev;
        }
      });
    });
  }, []);

  const replaceAll = useCallback((newData: AppData) => {
    const importedSettings = newData.settings as AppData["settings"] & { defaultCollectionFeePercent?: number };
    const legacyFee = Number(importedSettings.defaultCollectionFeePercent) || 0;
    const { defaultCollectionFeePercent: _legacyFee, ...settingsWithoutLegacyFee } = importedSettings;
    const buildings = (newData.buildings || []).map((building) => ({
      ...building,
      collectionFeePercent: building.collectionFeePercent ?? legacyFee,
    }));
    setData(withComputedUnitStatuses({
      ...EMPTY_DATA,
      ...newData,
      buildings,
      contracts: migrateContracts(newData.contracts || []),
      payments: migratePayments(newData.payments || [], newData.units || [], buildings),
      repairs: (newData.repairs || []).map((repair) => ({
        ...repair,
        isDeductedFromOwnerTransfer: repair.isDeductedFromOwnerTransfer ?? false,
        deductedFromPaymentId: repair.deductedFromPaymentId ?? null,
      })),
      settings: { ...DEFAULT_SETTINGS, ...settingsWithoutLegacyFee },
    }));
  }, []);

  return (
    <StoreContext.Provider value={{ data, update, replaceAll }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}