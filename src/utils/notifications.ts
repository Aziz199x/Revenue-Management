import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { AppData, NotificationSound, Settings } from "@/data/types";
import { collectReminders, ReminderItem } from "@/data/helpers";

const soundKey = (sound: NotificationSound) => sound.replace(/\.wav$/, "").replace(/[^a-z0-9_]/g, "_");
const channelIds = (settings: Settings) => ({
  contract: `contract_reminders_v4_${soundKey(settings.contractNotificationSound)}`,
  payment: `payment_reminders_v4_${soundKey(settings.paymentNotificationSound)}`,
  maintenance: `maintenance_reminders_v3_${soundKey(settings.maintenanceNotificationSound)}`,
  general: "general_reminders_v3",
});
const SCHEDULED_IDS_KEY = "rental-manager-scheduled-ids-v2";
const WEB_NOTIFIED_KEY = "rental-manager-notified-v1";
const LAST_SENT_KEY = "rental-manager-reminder-last-sent-v2";
const MAX_NATIVE_SCHEDULED_NOTIFICATIONS = 64;
const MAX_SCHEDULES_PER_REMINDER = 4;
let permissionRequestedThisSession = false;

interface NotificationSettingsPlugin {
  openChannel(options: { channelId: string }): Promise<void>;
}

const NativeNotificationSettings = registerPlugin<NotificationSettingsPlugin>("NotificationSettings");

export type PermissionResult = "granted" | "denied" | "unsupported";

export async function openSystemNotificationSoundSettings(
  type: "payment" | "contract" | "maintenance",
  settings: Settings,
): Promise<boolean> {
  if (!isNative()) return false;
  await ensureAndroidChannels(settings);
  const ids = channelIds(settings);
  await NativeNotificationSettings.openChannel({ channelId: ids[type] });
  return true;
}

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
async function ensureAndroidChannels(settings: Settings) {
  const ids = channelIds(settings);
  try {
    await Promise.all([
      LocalNotifications.createChannel({
        id: ids.contract,
        name: "تذكيرات العقود",
        description: "تنبيهات انتهاء العقود والتجديد التلقائي",
        importance: 5,
        visibility: 1,
        sound: settings.contractNotificationSound,
        vibration: true,
      }),
      LocalNotifications.createChannel({
        id: ids.general,
        name: "التذكيرات العامة",
        description: "تنبيهات الصيانة والفواتير والطلبات",
        importance: 4,
        visibility: 1,
        sound: "default",
        vibration: true,
      }),
      LocalNotifications.createChannel({
        id: ids.payment,
        name: "تذكيرات الدفعات",
        description: "تنبيهات دفعات الإيجار المتأخرة",
        importance: 5,
        visibility: 1,
        sound: settings.paymentNotificationSound,
        vibration: true,
      }),
      LocalNotifications.createChannel({
        id: ids.maintenance,
        name: "طلبات الصيانة المعلقة",
        description: "تنبيهات طلبات الصيانة التي ما زالت معلقة",
        importance: 5,
        visibility: 1,
        sound: settings.maintenanceNotificationSound,
        vibration: true,
      }),
    ]);
  } catch (error) {
    console.error("[Notifications] channel creation failed:", error);
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
        return "granted";
      }
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display === "granted") {
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
  if (r.kind === "contract") {
    const expiryDate = new Date(r.date + "T00:00:00").toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    if (r.autoRenewal) return `العقد للوحدة ${r.unitName || r.subtitle} سيتجدد تلقائيًا بعد ${r.days} يوم (${expiryDate}).`;
    if (r.days < 0) return `العقد: ${r.subtitle} — منتهي منذ ${-r.days} يوم (${expiryDate})`;
    if (r.days === 0) return `العقد: ${r.subtitle} — ينتهي اليوم (${expiryDate})`;
    return `العقد للوحدة ${r.unitName || r.subtitle} ينتهي بعد ${r.days} يوم ويحتاج إجراء في منصة إيجار (${expiryDate}).`;
  }
  if (r.kind === "rent" && r.days < 0) {
    return `لديك دفعة إيجار متأخرة للوحدة ${r.unitName || r.subtitle} بمبلغ ${(r.amount ?? 0).toLocaleString("ar-SA")} ر.س.`;
  }
  const prefix = r.title === "استحقاق إيجار" ? "دفعة إيجار" : r.title;
  if (r.days < 0) return `${prefix}: ${r.subtitle} — متأخر منذ ${-r.days} يوم`;
  if (r.days === 0) return `${prefix}: ${r.subtitle} — يستحق اليوم`;
  return `${prefix}: ${r.subtitle} — بعد ${r.days} يوم`;
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
  if (r.kind === "contract" && r.days < -3) return null;
  return new Date(Date.now() + 5000);
}

/**
 * Cancels all previously scheduled reminder notifications and schedules a
 * fresh batch based on the current app data and settings. Safe to call
 * whenever the data changes; it fully replaces the previous schedule.
 */
async function syncScheduledNotificationsNow(data: AppData, forceOnOpen = false) {
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

  let granted = await checkPermissionGranted();
  if (!granted && !permissionRequestedThisSession) {
    permissionRequestedThisSession = true;
    granted = (await requestNotificationPermission()) === "granted";
  }
  console.log("[Notifications] sync", { paymentsLoaded: data.payments.length, paymentNotificationsEnabled: data.settings.overduePaymentNotificationsEnabled, permissionGranted: granted });
  if (!granted) return;

  await ensureAndroidChannels(data.settings);

  const tracked = getTrackedIds();
  if (tracked.length) {
    try {
      await LocalNotifications.cancel({
        notifications: tracked.map((id) => ({ id })),
      });
      console.log("[Notifications] cancelled previous scheduled IDs:", tracked);
    } catch (error) {
      console.warn("[Notifications] previous cancellation failed:", error);
    }
  }

  const reminders = collectReminders(data);
  const overdueFound = reminders.filter((reminder) => reminder.kind === "rent" && reminder.days < 0);
  console.log("[Notifications] overdue payments found:", overdueFound.length);
  const now = Date.now();
  let lastSent: Record<string, number> = {};
  try { lastSent = JSON.parse(localStorage.getItem(LAST_SENT_KEY) || "{}"); } catch { lastSent = {}; }
  const eligibleReminders = reminders.filter((reminder) => !(reminder.kind === "rent" && reminder.days < 0 && !data.settings.overduePaymentNotificationsEnabled));
  const ids = channelIds(data.settings);
  const channelFor = (reminder: ReminderItem) => reminder.kind === "contract"
    ? ids.contract
    : reminder.kind === "rent"
      ? ids.payment
      : reminder.kind === "maintenance"
        ? ids.maintenance
        : ids.general;
  const soundFor = (reminder: ReminderItem) => reminder.kind === "contract"
    ? data.settings.contractNotificationSound
    : reminder.kind === "rent"
      ? data.settings.paymentNotificationSound
      : reminder.kind === "maintenance"
        ? data.settings.maintenanceNotificationSound
        : "default";
  const deliveryKey = (reminder: ReminderItem, at: Date) => `${reminder.id}:${channelFor(reminder)}:${at.toISOString().slice(0, 16)}`;
  const toSchedule: {
    id: number;
    title: string;
    body: string;
    channelId: string;
    smallIcon: string;
    largeIcon: string;
    sound: string;
    schedule: { at: Date };
  }[] = [];

  for (const r of eligibleReminders) {
    const windowDays =
      r.kind === "contract"
        ? (r.reminderWindow ?? data.settings.contractReminderDays)
        : data.settings.rentReminderDays;
    const triggerTimes = buildScheduleTimes(r, data.settings, windowDays);
    for (const triggerAt of triggerTimes) {
      const key = deliveryKey(r, triggerAt);
      const id = hashId(key);
      toSchedule.push({
        id,
        title: r.kind === "contract" ? (r.autoRenewal ? "عقد سيتجدد تلقائيا" : "تذكير عقد") : r.kind === "rent" && r.days < 0 ? "دفعة متأخرة" : r.kind === "rent" ? "موعد سداد الإيجار" : r.kind === "maintenance" ? "طلب صيانة معلق" : r.title,
        body: reminderBody(r),
        channelId: channelFor(r),
        smallIcon: "ic_notification",
        largeIcon: "ic_launcher",
        sound: soundFor(r),
        schedule: { at: triggerAt },
      });
      console.log("[Notifications] scheduling:", { reminderId: r.id, notificationId: id, at: triggerAt.toISOString(), kind: r.kind, channelId: channelFor(r) });
    }
  }

  const limitedSchedule = toSchedule
    .sort((a, b) => a.schedule.at.getTime() - b.schedule.at.getTime())
    .slice(0, MAX_NATIVE_SCHEDULED_NOTIFICATIONS);
  const scheduledIds = new Set(limitedSchedule.map((notification) => notification.id));

  const staleIds = tracked.filter((id) => !scheduledIds.has(id));
  if (staleIds.length) {
    try { await LocalNotifications.cancel({ notifications: staleIds.map((id) => ({ id })) }); }
    catch (error) { console.warn("[Notifications] stale cancellation failed:", error); }
    console.log("[Notifications] cancelled stale IDs:", staleIds);
  }

  if (limitedSchedule.length === 0) {
    saveTrackedIds([]);
    return;
  }

  try {
    await LocalNotifications.schedule({ notifications: limitedSchedule });
    const pending = await LocalNotifications.getPending();
    const pendingIds = new Set(pending.notifications.map((notification) => notification.id));
    lastSent.lastNativeSyncAt = now;
    saveTrackedIds([...pendingIds].filter((id) => scheduledIds.has(id)));
    localStorage.setItem(LAST_SENT_KEY, JSON.stringify(lastSent));
    console.log("[Notifications] scheduled count:", limitedSchedule.length, "generated count:", toSchedule.length, "pending count:", pending.notifications.length);
  } catch (error) {
    console.error("[Notifications] scheduling failed:", error);
    // Scheduling can fail if permission was revoked mid-flight; ignore.
  }
}

function parseClock(value: string | undefined, fallback: string): { hour: number; minute: number } {
  const raw = value || fallback;
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return parseClock(fallback, "09:00");
  return {
    hour: Math.min(23, Math.max(0, Number(match[1]) || 0)),
    minute: Math.min(59, Math.max(0, Number(match[2]) || 0)),
  };
}

function atClock(day: Date, clock: { hour: number; minute: number }): Date {
  const date = new Date(day);
  date.setHours(clock.hour, clock.minute, 0, 0);
  return date;
}

function buildScheduleTimes(r: ReminderItem, settings: Settings, windowDays: number): Date[] {
  const startClock = parseClock(settings.notificationWindowStart, "09:00");
  const endClock = parseClock(settings.notificationWindowEnd, "21:00");
  const intervalHours = Math.max(1, Number(settings.reminderFrequencyHours || 24));
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${r.date}T00:00:00`);
  if (Number.isNaN(due.getTime())) return [];

  let startDay = new Date(today);
  if (r.days >= 0) {
    startDay = new Date(due);
    startDay.setDate(startDay.getDate() - windowDays);
    if (startDay < today) startDay = new Date(today);
  }

  let endDay = new Date(due);
  if (r.kind === "rent" && r.days < 0) {
    endDay = new Date(today);
    endDay.setDate(endDay.getDate() + 7);
  } else if (r.kind !== "rent" && r.days < 0) {
    endDay = new Date(today);
    endDay.setDate(endDay.getDate() + 3);
  } else {
    endDay = new Date(due);
  }

  const results: Date[] = [];
  for (const day = new Date(startDay); day <= endDay && results.length < MAX_SCHEDULES_PER_REMINDER; day.setDate(day.getDate() + 1)) {
    const startAt = atClock(day, startClock);
    const endAt = atClock(day, endClock);
    if (endAt < startAt) endAt.setDate(endAt.getDate() + 1);
    for (const at = new Date(startAt); at <= endAt && results.length < MAX_SCHEDULES_PER_REMINDER; at.setHours(at.getHours() + intervalHours)) {
      if (at.getTime() <= now.getTime() + 30000) continue;
      if (r.kind !== "rent" && r.days >= 0 && at > due) continue;
      results.push(new Date(at));
    }
  }
  return results;
}

let syncQueue: Promise<void> = Promise.resolve();

/** Serialize startup/settings/data syncs so one run cannot cancel another. */
export function syncScheduledNotifications(data: AppData, options: { forceOnOpen?: boolean } = {}): Promise<void> {
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(() => syncScheduledNotificationsNow(data, options.forceOnOpen === true));
  return syncQueue;
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
    if (r.kind === "rent" && r.days < 0 && !data.settings.overduePaymentNotificationsEnabled) continue;
    const windowDays =
      r.kind === "contract"
        ? (r.reminderWindow ?? data.settings.contractReminderDays)
        : data.settings.rentReminderDays;

    const shouldNotify = (r.days >= 0 && r.days <= windowDays)
      || (r.kind === "rent" && r.days < 0)
      || (r.kind !== "rent" && r.days < 0 && r.days >= -3);
    if (!shouldNotify) continue;
    if (notified[r.id] === today) continue;

    try {
      new Notification(r.kind === "rent" && r.days < 0 ? "دفعة إيجار متأخرة" : r.title, {
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
