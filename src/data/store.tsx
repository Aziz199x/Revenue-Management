import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { AppData, EMPTY_DATA, DEFAULT_SETTINGS } from "./types";

const STORAGE_KEY = "rental-manager-data-v1";

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_DATA,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
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
    setData({
      ...EMPTY_DATA,
      ...newData,
      settings: { ...DEFAULT_SETTINGS, ...(newData.settings || {}) },
    });
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
