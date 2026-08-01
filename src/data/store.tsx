import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { AppData, EMPTY_DATA, DEFAULT_SETTINGS, Payment, Building, Unit, Contract, Tenant } from "./types";
import { withComputedUnitStatuses } from "./unitStatus";
import { buildFinancialAuditEntries, FinancialAuditContext } from "./financialAudit";
import { loadAppDataFromSQLite, saveAppDataToSQLite } from "./sqliteRepository";
import { normalizeOwners, synchronizeOwnerTransferAllocations } from "./buildingOwnership";

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

function migratePayments(payments: Payment[], units: Unit[], buildings: Building[], contracts: Contract[]): Payment[] {
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
    const contract = contracts.find((item) => item.id === payment.contractId);
    const autoOwnerTransfer = !payment.ownerSettledByMaintenance
      && payment.status === "paid"
      && receiveMethod === "ejar_platform"
      && (contract?.lessorCapacity ?? "owner") === "owner";
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
      ownerSettledByMaintenance: payment.ownerSettledByMaintenance ?? false,
      maintenanceSettlementNote: payment.maintenanceSettlementNote,
      ownerTransferred: payment.ownerSettledByMaintenance || autoOwnerTransfer || (payment.ownerTransferred ?? false),
      ownerTransferDate: payment.ownerSettledByMaintenance
        ? null
        : autoOwnerTransfer
        ? payment.ownerTransferDate ?? payment.receivedDate ?? null
        : payment.ownerTransferDate ?? null,
      ownerTransferMethod: payment.ownerSettledByMaintenance
        ? null
        : autoOwnerTransfer ? "ejar_platform" : payment.ownerTransferMethod ?? null,
      ownerTransferNotes: payment.ownerSettledByMaintenance
        ? payment.ownerTransferNotes || "تمت تسوية صافي الدفعة مقابل صيانة المبنى"
        : autoOwnerTransfer ? "تحويل تلقائي عبر منصة إيجار" : payment.ownerTransferNotes ?? "",
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
    return {
      ...contract,
      lessorCapacity: contract.lessorCapacity ?? "owner",
      startDate: startDate ?? contract.startDate,
      endDate: endDate ?? contract.endDate,
    };
  });
}

const STORAGE_KEY = "rental-manager-data-v1";

export function normalizeData(
  parsed: Partial<AppData> & { settings?: Partial<AppData["settings"]> & { defaultCollectionFeePercent?: number } },
  throwOnError = false,
): AppData {
  try {
    const parsedSettings = parsed.settings || {};
    const legacyFee = Number(parsedSettings.defaultCollectionFeePercent) || 0;
    const { defaultCollectionFeePercent: _legacyFee, ...settingsWithoutLegacyFee } = parsedSettings;
    const buildings: Building[] = (parsed.buildings || []).map((building: Partial<Building>) => ({
      ...building,
      collectionFeePercent: building.collectionFeePercent ?? legacyFee,
      multipleOwnersEnabled: building.multipleOwnersEnabled ?? false,
      owners: normalizeOwners(building.owners),
      ownershipHistory: building.ownershipHistory || [],
    })) as Building[];
    const units: Unit[] = parsed.units || [];
    const contracts = migrateContracts(parsed.contracts || []);
    const tenants: Tenant[] = (parsed.tenants || []).map((tenant) => ({
      ...tenant,
      emailAddresses: tenant.emailAddresses?.length
        ? tenant.emailAddresses
        : tenant.email
        ? [{
            id: `email-${tenant.id}-primary`,
            email: tenant.email,
            label: "الرئيسي",
            enabled: true,
          }]
        : [],
    }));
    return synchronizeOwnerTransferAllocations(withComputedUnitStatuses({
      ...EMPTY_DATA,
      ...parsed,
      buildings,
      units,
      tenants,
      contracts,
      payments: migratePayments(parsed.payments || [], units, buildings, contracts),
      repairs: (parsed.repairs || []).map((repair: AppData["repairs"][number]) => ({
        ...repair,
        isDeductedFromOwnerTransfer: repair.isDeductedFromOwnerTransfer ?? false,
        deductedFromPaymentId: repair.deductedFromPaymentId ?? null,
      })),
      settings: {
        ...DEFAULT_SETTINGS,
        ...settingsWithoutLegacyFee,
        whatsappTemplates: {
          ...DEFAULT_SETTINGS.whatsappTemplates,
          ...(parsedSettings.whatsappTemplates || {}),
        },
        emailTemplates: {
          ...DEFAULT_SETTINGS.emailTemplates,
          ...(parsedSettings.emailTemplates || {}),
        },
        automaticCommunications: {
          ...DEFAULT_SETTINGS.automaticCommunications,
          ...(parsedSettings.automaticCommunications || {}),
        },
        defaultContractExpiryReminderDays:
          parsedSettings.defaultContractExpiryReminderDays
          ?? parsedSettings.contractReminderDays
          ?? DEFAULT_SETTINGS.defaultContractExpiryReminderDays,
      },
    }));
  } catch (error) {
    if (throwOnError) throw error;
    return EMPTY_DATA;
  }
}

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    return normalizeData(JSON.parse(raw));
  } catch {
    return EMPTY_DATA;
  }
}

function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

interface StoreContextValue {
  data: AppData;
  update: (updater: (prev: AppData) => AppData, context?: FinancialAuditContext) => Promise<void>;
  replaceAll: (data: AppData) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);
  const sqliteHydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadAppDataFromSQLite(data).then((stored) => {
      if (cancelled) return;
      sqliteHydrated.current = true;
      setData(normalizeData(stored));
    });
    return () => { cancelled = true; };
    // The initial compatibility snapshot is intentionally captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveData(data);
    if (sqliteHydrated.current) void saveAppDataToSQLite(data);
  }, [data]);

  const update = useCallback((updater: (prev: AppData) => AppData, context: FinancialAuditContext = {}) => {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      setData((prev) => {
        try {
          const next = synchronizeOwnerTransferAllocations(withComputedUnitStatuses(updater(prev)));
          const auditEntries = buildFinancialAuditEntries(prev, next, context);
          const nextWithAudit = auditEntries.length > 0
            ? {
                ...next,
                financialAuditLog: [...(next.financialAuditLog || []), ...auditEntries],
              }
            : next;
          if (!settled) {
            settled = true;
            queueMicrotask(resolve);
          }
          return nextWithAudit;
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
    setData(normalizeData(newData, true));
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
