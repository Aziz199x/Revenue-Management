import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { AppData } from "@/data/types";
import { collectReminders, ReminderItem } from "@/data/helpers";

const CHANNEL_ID = "rental-reminders";
const SCHEDULED_IDS_KEY = "rental-manager-scheduled-ids-v1";
const WEB_NOTIFIED_KEY = "rental-manager-notified-v1";

export type PermissionResult = "granted" | "denied" | "unsupported";

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Whether local notifications can be used at all in the current environment.
 * On native Capacitor apps this is always true. In a plain web browser it
 * depends on the browser's Notification API support.
 */
export function notificationsSupported(): boolean {
  if (isNative()) return true;
  return typeof window !== "undefined" && "Notification" in window;
}

/** Creates the Android notification channel (no-op on iOS/web). */
async function ensureAndroidChannel() {
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "تذكيرات الإيجار والعقود",
      description: "تذكيرات مواعيد الإيجار والعقود والفواتير والصيانة",
      importance: 4,
      visibility: 1,
    });
  } catch {
    // Channel creation can fail on platforms that don't support it; ignore.
  }
}

/** Checks whether notification permission is currently granted. */
export async function checkPermissionGranted(): Promise<boolean> {
  if (isNative()) {
    try {
      const res = await LocalNotifications.checkPermissions();
      return res.display === "granted";
    } catch {
      return false;
    }
  }
  return notificationsSupported() && Notification.permission === "granted";
}

/**
 * Requests notification permission using the appropriate API for the
 * current platform (native Capacitor dialog or browser prompt).
 */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (isNative()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === "granted") {
        await ensureAndroidChannel();
        return "granted";
      }
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display === "granted") {
        await ensureAndroidChannel();
        return "granted";
      }
      return "denied";
    } catch {
      return "denied";
    }
  }

  if (!notificationsSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  return result === "granted" ? "granted" : "denied";
}

/** Deterministic 32-bit integer id required by the native scheduler. */
function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483647 || 1;
}

function getTrackedIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SCHEDULED_IDS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTrackedIds(ids: number[]) {
  localStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
}

function reminderBody(r: ReminderItem): string {
  if (r.days < 0) return `${r.subtitle} — متأخر منذ ${-r.days} يوم`;
  if (r.days === 0) return `${r.subtitle} — يستحق اليوم`;
  return `${r.subtitle} — بعد ${r.days} يوم`;
}

function computeTriggerDate(r: ReminderItem, windowDays: number): Date | null {
  const daysFromWindow = r.days - windowDays;
  if (daysFromWindow > 0) {
    // Far enough in the future: schedule right at the reminder window.
    const target = new Date(r.date + "T09:00:00");
    target.setDate(target.getDate() - windowDays);
    return target;
  }
  // Already inside the reminder window or overdue.
  if (r.days < -3) return null; // too old, skip to avoid notification spam
  return new Date(Date.now() + 5000);
}

/**
 * Cancels all previously scheduled reminder notifications and schedules a
 * fresh batch based on the current app data and settings. Safe to call
 * whenever the data changes; it fully replaces the previous schedule.
 */
export async function syncScheduledNotifications(data: AppData) {
  if (!isNative()) {
    // On plain web, fall back to a lightweight immediate-check approach.
    checkAndNotifyWeb(data);
    return;
  }

  if (!data.settings.notificationsEnabled) {
    const tracked = getTrackedIds();
    if (tracked.length) {
      try {
        await LocalNotifications.cancel({
          notifications: tracked.map((id) => ({ id })),
        });
      } catch {
        // ignore
      }
      saveTrackedIds([]);
    }
    return;
  }

  const granted = await checkPermissionGranted();
  if (!granted) return;

  await ensureAndroidChannel();

  const tracked = getTrackedIds();
  if (tracked.length) {
    try {
      await LocalNotifications.cancel({
        notifications: tracked.map((id) => ({ id })),
      });
    } catch {
      // ignore
    }
  }

  const reminders = collectReminders(data);
  const toSchedule: {
    id: number;
    title: string;
    body: string;
    channelId: string;
    schedule: { at: Date };
  }[] = [];

  for (const r of reminders) {
    const windowDays =
      r.kind === "contract"
        ? data.settings.contractReminderDays
        : data.settings.rentReminderDays;
    const triggerAt = computeTriggerDate(r, windowDays);
    if (!triggerAt) continue;

    toSchedule.push({
      id: hashId(r.id),
      title: r.title,
      body: reminderBody(r),
      channelId: CHANNEL_ID,
      schedule: { at: triggerAt },
    });
  }

  if (toSchedule.length === 0) {
    saveTrackedIds([]);
    return;
  }

  try {
    await LocalNotifications.schedule({ notifications: toSchedule });
    saveTrackedIds(toSchedule.map((n) => n.id));
  } catch {
    // Scheduling can fail if permission was revoked mid-flight; ignore.
  }
}

// --- Web browser fallback (used only outside the native app, e.g. in the
// Dyad preview). Not used when running as a real Android/iOS app. ---

function getWebNotified(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(WEB_NOTIFIED_KEY) || "{}");
  } catch {
    return {};
  }
}

function checkAndNotifyWeb(data: AppData) {
  if (!notificationsSupported()) return;
  if (!data.settings.notificationsEnabled) return;
  if (Notification.permission !== "granted") return;

  const today = new Date().toISOString().slice(0, 10);
  const notified = getWebNotified();
  const reminders = collectReminders(data);

  for (const r of reminders) {
    const windowDays =
      r.kind === "contract"
        ? data.settings.contractReminderDays
        : data.settings.rentReminderDays;

    const shouldNotify =
      (r.days >= 0 && r.days <= windowDays) || (r.days < 0 && r.days >= -3);
    if (!shouldNotify) continue;
    if (notified[r.id] === today) continue;

    try {
      new Notification(r.title, {
        body: reminderBody(r),
        tag: r.id,
        dir: "rtl",
        lang: "ar",
      });
      notified[r.id] = today;
    } catch {
      // Notification constructor may fail on some mobile browsers
    }
  }

  localStorage.setItem(WEB_NOTIFIED_KEY, JSON.stringify(notified));
}
