import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  AppData,
  EMPTY_DATA,
  DEFAULT_SETTINGS,
  Payment,
  Contract,
} from "./types";

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
    return migrateData(parsed);
  } catch {
    return EMPTY_DATA;
  }
}

function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

interface StoreContextValue {
  data: AppData;
  update: (updater: (prev: AppData) => AppData) => void;
  replaceAll: (data: AppData) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => updater(prev));
  }, []);

  const replaceAll = useCallback((newData: AppData) => {
    const migrated = migrateData(newData);
    setData(migrated);
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
