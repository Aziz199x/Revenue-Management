import { Capacitor } from "@capacitor/core";
import { AppData } from "./types";

const DATABASE_NAME = "revenue_management";
const SCHEMA_VERSION = 1;
const MIGRATION_BACKUP_KEY = "rental-manager-pre-sqlite-migration";

let connectionPromise: Promise<import("@capacitor-community/sqlite").SQLiteDBConnection> | null = null;

async function connection() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      const consistency = await sqlite.checkConnectionsConsistency();
      const existing = await sqlite.isConnection(DATABASE_NAME, false);
      const db = consistency.result && existing.result
        ? await sqlite.retrieveConnection(DATABASE_NAME, false)
        : await sqlite.createConnection(DATABASE_NAME, false, "no-encryption", SCHEMA_VERSION, false);
      const isOpen = await db.isDBOpen();
      if (!isOpen.result) await db.open();
      await db.execute(`
        CREATE TABLE IF NOT EXISTS app_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          schema_version INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
      `);
      return db;
    })().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

export async function loadAppDataFromSQLite(fallback: AppData): Promise<AppData> {
  if (!Capacitor.isNativePlatform()) return fallback;
  try {
    const db = await connection();
    if (!db) return fallback;
    const result = await db.query("SELECT payload FROM app_state WHERE id = 1 LIMIT 1");
    const payload = result.values?.[0]?.payload;
    if (typeof payload === "string" && payload.trim()) return JSON.parse(payload) as AppData;

    try {
      localStorage.setItem(MIGRATION_BACKUP_KEY, JSON.stringify(fallback));
    } catch (error) {
      console.warn("[SQLite] unable to keep local migration mirror", error);
    }
    await saveAppDataToSQLite(fallback);
    return fallback;
  } catch (error) {
    console.error("[SQLite] load failed; using compatibility storage", error);
    return fallback;
  }
}

export async function saveAppDataToSQLite(data: AppData): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const db = await connection();
    if (!db) return;
    await db.run(
      `INSERT INTO app_state (id, schema_version, updated_at, payload)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         schema_version = excluded.schema_version,
         updated_at = excluded.updated_at,
         payload = excluded.payload`,
      [SCHEMA_VERSION, new Date().toISOString(), JSON.stringify(data)],
      true,
    );
  } catch (error) {
    console.error("[SQLite] save failed; compatibility mirror remains available", error);
  }
}

