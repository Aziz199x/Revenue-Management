import { AppData, EMPTY_DATA, DEFAULT_SETTINGS } from "@/data/types";

const BACKUP_KEY = "rental-emergency-backup";

export function validateBackupJson(text: string): AppData | null {
  try {
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== "object") return null;

    if (parsed.backupVersion !== undefined) {
      if (parsed.backupVersion !== 1) return null;
      if (!parsed.data || typeof parsed.data !== "object") return null;
      if (!Array.isArray(parsed.data.buildings)) return null;
      if (!Array.isArray(parsed.data.units)) return null;
      return {
        ...EMPTY_DATA,
        ...parsed.data,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.data.settings || {}) },
      } as AppData;
    }

    if (!Array.isArray(parsed.buildings) || !Array.isArray(parsed.units)) return null;
    return { ...EMPTY_DATA, ...parsed } as AppData;
  } catch {
    return null;
  }
}

export function createEmergencySnapshot(data: AppData) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("[Backup] Failed to create emergency snapshot:", e);
  }
}

export function getEmergencySnapshot(): AppData | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...EMPTY_DATA, ...parsed } as AppData;
  } catch {
    return null;
  }
}

export function clearEmergencySnapshot() {
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch {}
}
