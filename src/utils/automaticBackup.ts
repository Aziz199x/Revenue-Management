import { Capacitor } from "@capacitor/core";
import { AppData } from "@/data/types";
import { deleteBackup, isSignedIn, listBackups, uploadBackup } from "@/utils/googleDrive";

const LAST_AUTO_BACKUP_KEY = "automatic_backup_last_run";
const LAST_AUTO_DRIVE_BACKUP_KEY = "automatic_drive_backup_last_run";
const LAST_AUTO_BACKUP_FINGERPRINT_KEY = "automatic_backup_last_fingerprint";
const LAST_AUTO_DRIVE_FINGERPRINT_KEY = "automatic_drive_backup_last_fingerprint";
const GOOGLE_DRIVE_LAST_BACKUP_KEY = "google_drive_last_backup";
const WEB_BACKUPS_KEY = "automatic_backup_versions";

export interface AutomaticBackupVersion {
  id: string;
  createdAt: string;
  size: number;
}

function intervalMs(frequency: AppData["settings"]["automaticBackupFrequency"]): number {
  if (frequency === "weekly") return 7 * 24 * 60 * 60 * 1000;
  if (frequency === "monthly") return 30 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function dueAt(lastRunKey: string, data: AppData): boolean {
  const last = Number(localStorage.getItem(lastRunKey) || 0);
  return !last || Date.now() - last >= intervalMs(data.settings.automaticBackupFrequency);
}

export function automaticBackupFingerprint(data: AppData): string {
  const value = JSON.stringify(data);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${value.length}-${(hash >>> 0).toString(36)}`;
}

function fileStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function saveLocalVersion(data: AppData): Promise<void> {
  const retention = Math.max(3, Math.min(60, Number(data.settings.backupRetentionCount) || 14));
  const { readEvidenceAttachment } = await import("@/utils/evidenceAttachments");
  const evidenceAttachments = await Promise.all(
    (data.evidenceAttachments || []).map(async (attachment) => {
      if (attachment.dataUrl || !attachment.storagePath) return attachment;
      try {
        return { ...attachment, dataUrl: await readEvidenceAttachment(attachment) };
      } catch (error) {
        console.warn("[Backup] automatic version could not embed evidence", attachment.id, error);
        return attachment;
      }
    }),
  );
  const payload = JSON.stringify({
    appName: "Revenue Management",
    backupVersion: 1,
    createdAt: new Date().toISOString(),
    data: { ...data, evidenceAttachments },
  });
  if (Capacitor.isNativePlatform()) {
    const { Directory, Encoding, Filesystem } = await import("@capacitor/filesystem");
    await Filesystem.writeFile({
      path: `automatic-backups/backup-${fileStamp()}.json`,
      data: payload,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    const directory = await Filesystem.readdir({ path: "automatic-backups", directory: Directory.Data });
    const files = directory.files
      .map((entry) => entry.name)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse();
    for (const name of files.slice(retention)) {
      await Filesystem.deleteFile({ path: `automatic-backups/${name}`, directory: Directory.Data });
    }
    return;
  }
  const versions = JSON.parse(localStorage.getItem(WEB_BACKUPS_KEY) || "[]") as Array<{ createdAt: string; payload: string }>;
  versions.unshift({ createdAt: new Date().toISOString(), payload });
  localStorage.setItem(WEB_BACKUPS_KEY, JSON.stringify(versions.slice(0, retention)));
}

let running: Promise<void> | null = null;

async function pruneGoogleDriveVersions(retention: number): Promise<void> {
  const backups = await listBackups();
  for (const backup of backups.slice(retention)) {
    await deleteBackup(backup.id);
  }
}

export async function runAutomaticBackupIfDue(
  data: AppData,
  options: { force?: boolean } = {},
): Promise<void> {
  if (!data.settings.automaticBackupEnabled || running) return running || Promise.resolve();
  const force = options.force === true;
  const fingerprint = automaticBackupFingerprint(data);
  const localDue = force || dueAt(LAST_AUTO_BACKUP_KEY, data);
  const driveEnabled = data.settings.automaticGoogleDriveBackup && isSignedIn();
  const driveDue = driveEnabled && (force || dueAt(LAST_AUTO_DRIVE_BACKUP_KEY, data));
  if (!localDue && !driveDue) return;

  running = (async () => {
    const now = Date.now();
    if (localDue) {
      const lastFingerprint = localStorage.getItem(LAST_AUTO_BACKUP_FINGERPRINT_KEY);
      if (force || fingerprint !== lastFingerprint) {
        await saveLocalVersion(data);
        localStorage.setItem(LAST_AUTO_BACKUP_FINGERPRINT_KEY, fingerprint);
      }
      localStorage.setItem(LAST_AUTO_BACKUP_KEY, String(now));
    }

    if (driveDue) {
      const lastDriveFingerprint = localStorage.getItem(LAST_AUTO_DRIVE_FINGERPRINT_KEY);
      try {
        if (force || fingerprint !== lastDriveFingerprint) {
          await uploadBackup(data);
          localStorage.setItem(LAST_AUTO_DRIVE_FINGERPRINT_KEY, fingerprint);
          localStorage.setItem(GOOGLE_DRIVE_LAST_BACKUP_KEY, new Date(now).toISOString());
          const retention = Math.max(3, Math.min(60, Number(data.settings.backupRetentionCount) || 14));
          try {
            await pruneGoogleDriveVersions(retention);
          } catch (error) {
            console.warn("[Backup] Google Drive retention cleanup postponed", error);
          }
        }
        localStorage.setItem(LAST_AUTO_DRIVE_BACKUP_KEY, String(now));
      } catch (error) {
        // Keep the Drive timestamp unchanged so the periodic manager retries
        // automatically when connectivity or account access returns.
        console.warn("[Backup] automatic Google Drive upload postponed", error);
      }
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

export function getLastAutomaticBackupDate(): string | null {
  const value = Number(localStorage.getItem(LAST_AUTO_BACKUP_KEY) || 0);
  return value ? new Date(value).toISOString() : null;
}

export async function listAutomaticBackupVersions(): Promise<AutomaticBackupVersion[]> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Directory, Encoding, Filesystem } = await import("@capacitor/filesystem");
      const directory = await Filesystem.readdir({ path: "automatic-backups", directory: Directory.Data });
      const versions: AutomaticBackupVersion[] = [];
      for (const entry of directory.files.filter((item) => item.name.endsWith(".json"))) {
        try {
          const file = await Filesystem.readFile({
            path: `automatic-backups/${entry.name}`,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
          });
          const text = typeof file.data === "string" ? file.data : "";
          const parsed = JSON.parse(text) as { createdAt?: string };
          versions.push({
            id: entry.name,
            createdAt: parsed.createdAt || new Date(entry.mtime || Date.now()).toISOString(),
            size: new TextEncoder().encode(text).length,
          });
        } catch (error) {
          console.warn("[Backup] skipped unreadable automatic version", entry.name, error);
        }
      }
      return versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }
  const versions = JSON.parse(localStorage.getItem(WEB_BACKUPS_KEY) || "[]") as Array<{ createdAt: string; payload: string }>;
  return versions.map((version, index) => ({
    id: String(index),
    createdAt: version.createdAt,
    size: new TextEncoder().encode(version.payload).length,
  }));
}

export async function loadAutomaticBackupVersion(id: string): Promise<AppData> {
  let text = "";
  if (Capacitor.isNativePlatform()) {
    const { Directory, Encoding, Filesystem } = await import("@capacitor/filesystem");
    const result = await Filesystem.readFile({
      path: `automatic-backups/${id}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    text = typeof result.data === "string" ? result.data : "";
  } else {
    const versions = JSON.parse(localStorage.getItem(WEB_BACKUPS_KEY) || "[]") as Array<{ payload: string }>;
    text = versions[Number(id)]?.payload || "";
  }
  const parsed = JSON.parse(text) as { data?: AppData };
  if (!parsed.data || !Array.isArray(parsed.data.buildings) || !Array.isArray(parsed.data.units)) {
    throw new Error("النسخة التلقائية غير صالحة");
  }
  return parsed.data;
}
