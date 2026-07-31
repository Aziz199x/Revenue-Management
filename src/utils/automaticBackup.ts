import { Capacitor } from "@capacitor/core";
import { AppData } from "@/data/types";
import { isSignedIn, uploadBackup } from "@/utils/googleDrive";

const LAST_AUTO_BACKUP_KEY = "automatic_backup_last_run";
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

function due(data: AppData): boolean {
  if (!data.settings.automaticBackupEnabled) return false;
  const last = Number(localStorage.getItem(LAST_AUTO_BACKUP_KEY) || 0);
  return !last || Date.now() - last >= intervalMs(data.settings.automaticBackupFrequency);
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

export async function runAutomaticBackupIfDue(data: AppData): Promise<void> {
  if (!due(data) || running) return running || Promise.resolve();
  running = (async () => {
    await saveLocalVersion(data);
    if (data.settings.automaticGoogleDriveBackup && isSignedIn()) {
      try {
        await uploadBackup(data);
      } catch (error) {
        console.warn("[Backup] automatic Google Drive upload postponed", error);
      }
    }
    localStorage.setItem(LAST_AUTO_BACKUP_KEY, String(Date.now()));
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
