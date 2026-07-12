import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { AppData, Settings, NotificationSound } from "@/data/types";
import { collectReminders, ReminderItem, daysUntil } from "@/data/helpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_SOUND_FILES: NotificationSound[] = [
  "payment_overdue.wav",
  "contract_reminder.wav",
  "default",
];

const channelIds = (settings: Settings) => ({
  contract: `contract_reminders_v5_${soundKey(settings.contractNotificationSound)}`,
  payment: `payment_reminders_v5_${soundKey(settings.paymentNotificationSound)}`,
  maintenance: `maintenance_reminders_v4_${soundKey(settings.maintenanceNotificationSound)}`,
  general: "general_reminders_v4",
  test: "notification_test_v2",
});

const SCHEDULED_IDS_KEY = "rental-manager-scheduled-ids-v4";
const WEB_NOTIFIED_KEY = "rental-manager-notified-v3";
const LAST_SYNC_FINGERPRINT_KEY = "rental-manager-notification-fingerprint-v1";
const LAST_SYNC_RESULT_KEY = "rental-manager-last-sync-result-v1";
const MAX_NATIVE_SCHEDULED_NOTIFICATIONS = 64;
const MAX_SCHEDULES_PER_REMINDER = 4;

let permissionRequestedThisSession = false;
let channelCreationAttempts = new Map<string, boolean>();

interface NotificationSettingsPlugin {
  openChannel(options: { channelId: string }): Promise<void>;
  openAppSettings(): Promise<void>;
  getStatus(options?: { channelId?: string }): Promise<NativeNotificationStatus>;
}

const NativeNotificationSettings = registerPlugin<NotificationSettingsPlugin>("NotificationSettings", {
  web: () => ({
    openChannel: async () => {
      throw new Error("System notification settings are only available in the native Android app");
    },
    openAppSettings: async () => {
      throw new Error("System notification settings are only available in the native Android app");
    },
    getStatus: async () => ({ notificationsEnabled: notificationsSupported() && Notification.permission === "granted" }),
  }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermissionResult = "granted" | "denied" | "prompt" | "unsupported";

export interface NotificationTestResult {
  success: boolean;
  permissionGranted: boolean;
  isNative: boolean;
  notificationId?: number;
  scheduledAt?: string;
  pendingNotifications?: number;
  error?: string;
}

export interface NotificationSyncResult {
  success: boolean;
  permissionGranted: boolean;
  remindersFound: number;
  notificationsGenerated: number;
  notificationsScheduled: number;
  pendingNotifications: number;
  notificationsCancelled: number;
  nextNotificationAt?: string;
  exactAlarmStatus?: string;
  soundFallbacks?: string[];
  error?: string;
  fingerprintChanged: boolean;
}

export interface NotificationDiagnostics {
  isNative: boolean;
  notificationsSupported: boolean;
  permissionStatus: PermissionResult;
  remindersFound: number;
  notificationsGenerated: number;
  scheduledNotifications: number;
  pendingNativeNotifications: number;
  nextNotificationAt?: string;
  nextNotificationLabel?: string;
  exactAlarmStatus: string;
  soundFallbacks: string[];
  lastSyncError?: string;
  lastSyncAt?: string;
  channelsCreated: string[];
  nativeStatus?: NativeNotificationStatus;
}

export interface NativeNotificationStatus {
  notificationsEnabled: boolean;
  sdkInt?: number;
  channelId?: string;
  channelExists?: boolean;
  channelImportance?: number;
  channelEnabled?: boolean;
  channelSound?: string;
  channelName?: string;
}

interface DesiredNotification {
  id: number;
  title: string;
  body: string;
  channelId: string;
  sound: string;
  schedule: { at: Date };
  reminderId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function notificationsSupported(): boolean {
  if (isNative()) return true;
  return typeof window !== "undefined" && "Notification" in window;
}

function soundKey(sound?: string): string {
  return (sound || "default").replace(/\.wav$/, "").replace(/[^a-z0-9_]/g, "_") || "default";
}

function normalizeSound(sound?: string): { sound: NotificationSound; fallback: boolean } {
  if (!sound) return { sound: "default", fallback: true };
  if (KNOWN_SOUND_FILES.includes(sound as NotificationSound)) {
    return { sound: sound as NotificationSound, fallback: false };
  }
  return { sound: "default", fallback: true };
}

function safeSoundForChannel(sound: string): string {
  if (sound === "default") return "default";
  if (KNOWN_SOUND_FILES.includes(sound as NotificationSound)) return sound;
  return "default";
}

/** Deterministic 32-bit positive integer id required by the native scheduler. */
export function hashId(id: string): number {
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

function getLastSyncFingerprint(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_FINGERPRINT_KEY);
  } catch {
    return null;
  }
}

function saveLastSyncFingerprint(fingerprint: string) {
  localStorage.setItem(LAST_SYNC_FINGERPRINT_KEY, fingerprint);
}

function getLastSyncResult(): NotificationSyncResult | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastSyncResult(result: NotificationSyncResult) {
  try {
    localStorage.setItem(LAST_SYNC_RESULT_KEY, JSON.stringify(result));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export async function checkPermissionStatus(): Promise<PermissionResult> {
  if (isNative()) {
    try {
      const res = await LocalNotifications.checkPermissions();
      if (res.display === "granted") return "granted";
      if (res.display === "denied") return "denied";
      return "prompt";
    } catch (e) {
      console.error("[Notifications] checkPermissions error:", e);
      return "unsupported";
    }
  }

  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "prompt";
}

export async function checkPermissionGranted(): Promise<boolean> {
  const status = await checkPermissionStatus();
  return status === "granted";
}

/**
 * Requests notification permission.
 * On native, also ensures Android channels are created when permission is granted.
 */
export async function requestNotificationPermission(settings?: Settings): Promise<PermissionResult> {
  if (isNative()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === "granted") {
        if (settings) await ensureAndroidChannels(settings);
        return "granted";
      }
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display === "granted") {
        if (settings) await ensureAndroidChannels(settings);
        return "granted";
      }
      return requested.display === "denied" ? "denied" : "prompt";
    } catch (e) {
      console.error("[Notifications] requestPermissions error:", e);
      return "unsupported";
    }
  }

  if (!notificationsSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  if (result === "granted") return "granted";
  if (result === "denied") return "denied";
  return "prompt";
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export async function openSystemNotificationSoundSettings(
  type: "payment" | "contract" | "maintenance" | "test",
  settings: Settings,
): Promise<boolean> {
  if (!isNative()) return false;
  await ensureAndroidChannels(settings);
  if (type === "test") await ensureTestChannel();
  const ids = channelIds(settings);
  const channelId = type === "payment" ? ids.payment : type === "contract" ? ids.contract : type === "maintenance" ? ids.maintenance : ids.test;
  await NativeNotificationSettings.openChannel({ channelId });
  return true;
}

export async function openAppNotificationSettings(): Promise<boolean> {
  if (!isNative()) return false;
  await NativeNotificationSettings.openAppSettings();
  return true;
}

export async function getNativeNotificationStatus(settings?: Settings): Promise<NativeNotificationStatus | undefined> {
  if (!isNative()) return undefined;
  const ids = channelIds(settings || ({} as Settings));
  return NativeNotificationSettings.getStatus({ channelId: ids.test });
}

async function ensureAndroidChannels(settings: Settings): Promise<string[]> {
  const ids = channelIds(settings);
  const created: string[] = [];
  const soundFallbacks: string[] = [];

  const paymentSound = normalizeSound(settings.paymentNotificationSound);
  if (paymentSound.fallback) soundFallbacks.push(`payment: ${settings.paymentNotificationSound} -> default`);

  const contractSound = normalizeSound(settings.contractNotificationSound);
  if (contractSound.fallback) soundFallbacks.push(`contract: ${settings.contractNotificationSound} -> default`);

  const maintenanceSound = normalizeSound(settings.maintenanceNotificationSound);
  if (maintenanceSound.fallback) soundFallbacks.push(`maintenance: ${settings.maintenanceNotificationSound} -> default`);

  const channels: { id: string; name: string; description: string; importance: 4 | 5; sound: string }[] = [
    {
      id: ids.payment,
      name: "تذكيرات الدفعات",
      description: "تنبيهات الدفعات المستحقة والمتأخرة",
      importance: 5,
      sound: paymentSound.sound,
    },
    {
      id: ids.contract,
      name: "تذكيرات العقود",
      description: "تنبيهات انتهاء وتجديد العقود",
      importance: 5,
      sound: contractSound.sound,
    },
    {
      id: ids.maintenance,
      name: "طلبات الصيانة المعلقة",
      description: "تنبيهات طلبات الصيانة التي ما زالت معلقة",
      importance: 5,
      sound: maintenanceSound.sound,
    },
    {
      id: ids.general,
      name: "التذكيرات العامة",
      description: "تنبيهات الفواتير والطلبات العامة",
      importance: 4,
      sound: "default",
    },
  ];

  for (const channel of channels) {
    if (channelCreationAttempts.get(channel.id)) continue;
    try {
      await LocalNotifications.createChannel({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        importance: channel.importance,
        visibility: 1,
        sound: safeSoundForChannel(channel.sound),
        vibration: true,
      });
      created.push(channel.id);
      channelCreationAttempts.set(channel.id, true);
      console.log("[Notifications] Created channel:", channel.id, "sound:", channel.sound);
    } catch (error) {
      console.error("[Notifications] Failed to create channel:", channel.id, error);
      // Try fallback to default sound
      try {
        await LocalNotifications.createChannel({
          id: channel.id,
          name: channel.name,
          description: channel.description,
          importance: channel.importance,
          visibility: 1,
          sound: "default",
          vibration: true,
        });
        created.push(channel.id);
        channelCreationAttempts.set(channel.id, true);
        soundFallbacks.push(`${channel.id}: sound fallback to default`);
        console.log("[Notifications] Created channel with default sound fallback:", channel.id);
      } catch (fallbackError) {
        console.error("[Notifications] Channel fallback failed:", channel.id, fallbackError);
      }
    }
  }

  return created;
}

async function ensureTestChannel(): Promise<boolean> {
  const id = channelIds({} as Settings).test;
  if (channelCreationAttempts.get(id)) return true;
  try {
    await LocalNotifications.createChannel({
      id,
      name: "اختبار الإشعارات",
      description: "قناة اختبار إشعارات التطبيق",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "default",
    });
    channelCreationAttempts.set(id, true);
    return true;
  } catch (e) {
    console.error("[Notifications] Test channel creation failed:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scheduling internals
// ---------------------------------------------------------------------------

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

function getFrequencyIntervalHours(settings: Settings): number {
  const hours = Number(settings.reminderFrequencyHours);
  return Number.isFinite(hours) && hours >= 1 ? hours : 24;
}

function getNotificationTimesForDay(settings: Settings): string[] {
  const startClock = parseClock(settings.notificationWindowStart, "09:00");
  const endClock = parseClock(settings.notificationWindowEnd, "21:00");
  const intervalHours = getFrequencyIntervalHours(settings);

  const startMinutes = startClock.hour * 60 + startClock.minute;
  const endMinutes = endClock.hour * 60 + endClock.minute;

  if (startMinutes >= endMinutes) return [];

  const times: string[] = [];
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += intervalHours * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    times.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
  return times;
}

function nextValidTimeAtOrAfter(baseDate: Date, timeStr: string, settings: Settings): Date | null {
  const [h, m] = timeStr.split(":").map(Number);
  const startClock = parseClock(settings.notificationWindowStart, "09:00");
  const endClock = parseClock(settings.notificationWindowEnd, "21:00");

  if (h < startClock.hour || h > endClock.hour) return null;
  if (h === startClock.hour && m < startClock.minute) return null;
  if (h === endClock.hour && m > endClock.minute) return null;

  const candidate = new Date(baseDate);
  candidate.setHours(h, m, 0, 0);
  return candidate;
}

function buildReminderScheduleTimes(r: ReminderItem, settings: Settings): Date[] {
  const now = new Date();
  const times = getNotificationTimesForDay(settings);
  if (times.length === 0) return [];

  const due = new Date(`${r.date}T00:00:00`);
  if (Number.isNaN(due.getTime())) return [];

  const windowDays =
    r.kind === "contract"
      ? (r.reminderWindow ?? settings.contractReminderDays)
      : settings.rentReminderDays;

  const anchorDays: number[] = [];

  if (r.kind === "contract") {
    const firstReminderDay = -windowDays;
    const sevenDaysBefore = -7;
    const threeDaysBefore = -3;
    const expiryDay = 0;
    anchorDays.push(firstReminderDay, sevenDaysBefore, threeDaysBefore, expiryDay);
  } else if (r.kind === "rent" && r.days < 0) {
    anchorDays.push(0, 1, 3, 7);
  } else if (r.kind === "rent") {
    const firstReminderDay = -windowDays;
    const oneDayBefore = -1;
    const dueDay = 0;
    anchorDays.push(firstReminderDay, oneDayBefore, dueDay);
  } else {
    const firstReminderDay = -windowDays;
    const dueDay = 0;
    anchorDays.push(firstReminderDay, dueDay);
  }

  const results: Date[] = [];
  const seen = new Set<number>();

  for (const offset of anchorDays) {
    if (results.length >= MAX_SCHEDULES_PER_REMINDER) break;

    const anchor = new Date(due);
    anchor.setDate(anchor.getDate() + offset);

    // Skip anchors that are before the reminder window start
    if (r.kind === "contract" && r.days >= 0 && anchor < new Date(new Date().setHours(0, 0, 0, 0))) {
      continue;
    }

    for (const timeStr of times) {
      if (results.length >= MAX_SCHEDULES_PER_REMINDER) break;

      const candidate = nextValidTimeAtOrAfter(anchor, timeStr, settings);
      if (!candidate) continue;
      if (candidate <= now) continue;
      if (r.kind === "contract" && candidate > due) continue;

      const key = candidate.getTime();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(candidate);
    }
  }

  return results.sort((a, b) => a.getTime() - b.getTime());
}

function channelForReminder(r: ReminderItem, settings: Settings): string {
  const ids = channelIds(settings);
  if (r.kind === "contract" || r.kind === "eviction") return ids.contract;
  if (r.kind === "rent") return ids.payment;
  if (r.kind === "maintenance") return ids.maintenance;
  return ids.general;
}

function soundForReminder(r: ReminderItem, settings: Settings): string {
  if (r.kind === "contract" || r.kind === "eviction") {
    return normalizeSound(settings.contractNotificationSound).sound;
  }
  if (r.kind === "rent") {
    return normalizeSound(settings.paymentNotificationSound).sound;
  }
  if (r.kind === "maintenance") {
    return normalizeSound(settings.maintenanceNotificationSound).sound;
  }
  return "default";
}

function reminderTitle(r: ReminderItem): string {
  if (r.kind === "contract") return r.autoRenewal ? "عقد سيتجدد تلقائيا" : "تذكير عقد";
  if (r.kind === "rent" && r.days < 0) return "دفعة متأخرة";
  if (r.kind === "rent") return "موعد سداد الإيجار";
  if (r.kind === "maintenance") return "طلب صيانة معلق";
  return r.title;
}

function reminderBody(r: ReminderItem): string {
  if (r.kind === "contract") {
    const expiryDate = new Date(r.date + "T00:00:00").toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    if (r.autoRenewal) {
      return `العقد للوحدة ${r.unitName || r.subtitle} سيتجدد تلقائيًا بعد ${r.days} يوم (${expiryDate}).`;
    }
    if (r.days < 0) return `العقد: ${r.subtitle} — منتهي منذ ${-r.days} يوم (${expiryDate})`;
    if (r.days === 0) return `العقد: ${r.subtitle} — ينتهي اليوم (${expiryDate})`;
    return `العقد للوحدة ${r.unitName || r.subtitle} ينتهي بعد ${r.days} يوم ويحتاج إجراء في منصة إيجار (${expiryDate}).`;
  }
  if (r.kind === "rent" && r.days < 0) {
    return `لديك دفعة إيجار متأخرة للوحدة ${r.unitName || r.subtitle} بمبلغ ${(r.amount ?? 0).toLocaleString("ar-SA")} ر.س.`;
  }
  const prefix = r.title === "موعد سداد الإيجار" ? "دفعة إيجار" : r.title;
  if (r.days < 0) return `${prefix}: ${r.subtitle} — متأخر منذ ${-r.days} يوم`;
  if (r.days === 0) return `${prefix}: ${r.subtitle} — يستحق اليوم`;
  return `${prefix}: ${r.subtitle} — بعد ${r.days} يوم`;
}

function buildDesiredNotifications(data: AppData): DesiredNotification[] {
  const reminders = collectReminders(data);
  const eligibleReminders = reminders.filter((r) => {
    if (r.kind === "rent" && r.days < 0 && !data.settings.overduePaymentNotificationsEnabled) {
      return false;
    }
    return true;
  });

  const desired: DesiredNotification[] = [];

  for (const r of eligibleReminders) {
    const windowDays =
      r.kind === "contract"
        ? (r.reminderWindow ?? data.settings.contractReminderDays)
        : data.settings.rentReminderDays;

    // Skip if too far in the future
    if (r.days > windowDays) continue;
    // Skip stale non-rent reminders older than a few days
    if (r.days < -3 && r.kind !== "rent") continue;

    const times = buildReminderScheduleTimes(r, data.settings);
    for (const at of times) {
      const channelId = channelForReminder(r, data.settings);
      const sound = soundForReminder(r, data.settings);
      const key = `${r.id}|${channelId}|${at.toISOString()}`;
      const id = hashId(key);
      desired.push({
        id,
        title: reminderTitle(r),
        body: reminderBody(r),
        channelId,
        sound,
        schedule: { at },
        reminderId: r.id,
      });
    }
  }

  return desired
    .sort((a, b) => a.schedule.at.getTime() - b.schedule.at.getTime())
    .slice(0, MAX_NATIVE_SCHEDULED_NOTIFICATIONS);
}

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------

function buildNotificationFingerprint(data: AppData): string {
  const relevantContracts = data.contracts.map((c) => ({
    id: c.id,
    unitId: c.unitId,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    deletedAt: c.deletedAt,
    autoRenewal: c.autoRenewal,
    tenantDidNotLeave: c.tenantDidNotLeave,
  }));

  const relevantPayments = data.payments.map((p) => ({
    id: p.id,
    unitId: p.unitId,
    amount: p.amount,
    paidAmount: p.paidAmount,
    receivedAmount: p.receivedAmount,
    status: p.status,
    nextDueDate: p.nextDueDate,
    paymentDate: p.paymentDate,
    deletedAt: p.deletedAt,
  }));

  const relevantRepairs = data.repairs.map((r) => ({
    id: r.id,
    unitId: r.unitId,
    status: r.status,
    repairDate: r.repairDate,
  }));

  const relevantBills = data.bills.map((b) => ({
    id: b.id,
    unitId: b.unitId,
    status: b.status,
    dueDate: b.dueDate,
  }));

  const relevantRequests = data.tenantRequests.map((r) => ({
    id: r.id,
    unitId: r.unitId,
    status: r.status,
    priority: r.priority,
    requestDate: r.requestDate,
    expectedCompletionDate: r.expectedCompletionDate,
  }));

  const fingerprint = JSON.stringify({
    contracts: relevantContracts,
    payments: relevantPayments,
    repairs: relevantRepairs,
    bills: relevantBills,
    requests: relevantRequests,
    settings: {
      notificationsEnabled: data.settings.notificationsEnabled,
      overduePaymentNotificationsEnabled: data.settings.overduePaymentNotificationsEnabled,
      contractReminderDays: data.settings.contractReminderDays,
      rentReminderDays: data.settings.rentReminderDays,
      reminderFrequencyHours: data.settings.reminderFrequencyHours,
      notificationWindowStart: data.settings.notificationWindowStart,
      notificationWindowEnd: data.settings.notificationWindowEnd,
      paymentNotificationSound: data.settings.paymentNotificationSound,
      contractNotificationSound: data.settings.contractNotificationSound,
      maintenanceNotificationSound: data.settings.maintenanceNotificationSound,
    },
  });

  return hashId(fingerprint).toString();
}

// ---------------------------------------------------------------------------
// Core sync
// ---------------------------------------------------------------------------

async function syncScheduledNotificationsNow(
  data: AppData,
  forceOnOpen = false,
): Promise<NotificationSyncResult> {
  const result: NotificationSyncResult = {
    success: false,
    permissionGranted: false,
    remindersFound: 0,
    notificationsGenerated: 0,
    notificationsScheduled: 0,
    pendingNotifications: 0,
    notificationsCancelled: 0,
    fingerprintChanged: false,
    exactAlarmStatus: "غير معروف (يتطلب Android 12+ وقد يحتاج تفعيل يدوي من إعدادات التطبيق)",
    soundFallbacks: [],
  };

  if (!isNative()) {
    result.exactAlarmStatus = "غير مطلوب في معاينة المتصفح";
    checkAndNotifyWeb(data);
    result.success = true;
    result.permissionGranted = notificationsSupported() && Notification.permission === "granted";
    saveLastSyncResult(result);
    return result;
  }

  if (!data.settings.notificationsEnabled) {
    const tracked = getTrackedIds();
    if (tracked.length) {
      try {
        await LocalNotifications.cancel({ notifications: tracked.map((id) => ({ id })) });
        result.notificationsCancelled = tracked.length;
      } catch (e) {
        console.error("[Notifications] Cancel on disabled failed:", e);
      }
      saveTrackedIds([]);
    }
    saveLastSyncFingerprint("disabled");
    result.success = true;
    saveLastSyncResult(result);
    return result;
  }

  // Permission check
  let permissionStatus = await checkPermissionStatus();
  if (permissionStatus !== "granted" && !permissionRequestedThisSession) {
    permissionRequestedThisSession = true;
    permissionStatus = await requestNotificationPermission(data.settings);
  }
  result.permissionGranted = permissionStatus === "granted";

  if (!result.permissionGranted) {
    result.error = "تم رفض إذن الإشعارات. يرجى تفعيله من إعدادات التطبيق في الهاتف.";
    saveLastSyncResult(result);
    return result;
  }

  // Fingerprint check
  const fingerprint = buildNotificationFingerprint(data);
  const lastFingerprint = getLastSyncFingerprint();
  result.fingerprintChanged = forceOnOpen || lastFingerprint !== fingerprint;

  if (!result.fingerprintChanged) {
    // Even if fingerprint hasn't changed, verify pending notifications still exist on forceOnOpen
    if (forceOnOpen) {
      try {
        const pending = await LocalNotifications.getPending();
        result.pendingNotifications = pending.notifications.length;
      } catch {
        // ignore
      }
    }
    result.success = true;
    saveLastSyncResult(result);
    return result;
  }

  // Ensure channels
  try {
    await ensureAndroidChannels(data.settings);
  } catch (e) {
    console.error("[Notifications] Channel ensure failed:", e);
  }

  // Build desired notifications
  const desired = buildDesiredNotifications(data);
  result.remindersFound = collectReminders(data).length;
  result.notificationsGenerated = desired.length;

  // Read pending notifications
  let pending: { notifications: { id: number }[] } = { notifications: [] };
  try {
    pending = await LocalNotifications.getPending();
    result.pendingNotifications = pending.notifications.length;
  } catch (e) {
    console.error("[Notifications] getPending failed:", e);
    result.error = "تعذر قراءة الإشعارات المعلقة";
    saveLastSyncResult(result);
    return result;
  }

  const desiredIds = new Set(desired.map((n) => n.id));
  const pendingIds = new Set(pending.notifications.map((n) => n.id));

  // Cancel stale notifications (pending but not desired)
  const staleIds = pending.notifications
    .map((n) => n.id)
    .filter((id) => !desiredIds.has(id));

  if (staleIds.length > 0) {
    try {
      await LocalNotifications.cancel({ notifications: staleIds.map((id) => ({ id })) });
      result.notificationsCancelled = staleIds.length;
      console.log("[Notifications] Cancelled stale:", staleIds.length);
    } catch (e) {
      console.error("[Notifications] Stale cancellation failed:", e);
    }
  }

  // Schedule missing notifications (desired but not pending)
  const missing = desired.filter((n) => !pendingIds.has(n.id));

  if (missing.length > 0) {
    try {
      await LocalNotifications.schedule({
        notifications: missing.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          channelId: n.channelId,
          sound: safeSoundForChannel(n.sound),
          smallIcon: "ic_notification",
          largeIcon: "ic_launcher",
          schedule: n.schedule,
        })),
      });
      result.notificationsScheduled = missing.length;
      console.log("[Notifications] Scheduled missing:", missing.length);
    } catch (e: any) {
      console.error("[Notifications] Scheduling failed:", e);
      result.error = e?.message || "تعذر جدولة الإشعارات";
      saveLastSyncResult(result);
      return result;
    }
  }

  // Update tracked IDs
  try {
    const newPending = await LocalNotifications.getPending();
    const tracked = newPending.notifications.map((n) => n.id);
    saveTrackedIds(tracked);
    result.pendingNotifications = tracked.length;

    const next = desired.find((n) => n.schedule.at > new Date())?.schedule.at;
    if (next) result.nextNotificationAt = next.toISOString();
  } catch (e) {
    console.error("[Notifications] Final pending read failed:", e);
  }

  saveLastSyncFingerprint(fingerprint);
  result.success = true;
  saveLastSyncResult(result);
  return result;
}

let syncQueue: Promise<NotificationSyncResult> = Promise.resolve({
  success: true,
  permissionGranted: false,
  remindersFound: 0,
  notificationsGenerated: 0,
  notificationsScheduled: 0,
  pendingNotifications: 0,
  notificationsCancelled: 0,
  fingerprintChanged: false,
  exactAlarmStatus: "",
  soundFallbacks: [],
});

export function syncScheduledNotifications(
  data: AppData,
  options: { forceOnOpen?: boolean } = {},
): Promise<NotificationSyncResult> {
  syncQueue = syncQueue
    .catch(() => ({
      success: false,
      permissionGranted: false,
      remindersFound: 0,
      notificationsGenerated: 0,
      notificationsScheduled: 0,
      pendingNotifications: 0,
      notificationsCancelled: 0,
      fingerprintChanged: false,
      exactAlarmStatus: "",
      soundFallbacks: [],
      error: "فشل المزامنة السابقة",
    }))
    .then(() => syncScheduledNotificationsNow(data, options.forceOnOpen === true));
  return syncQueue;
}

// ---------------------------------------------------------------------------
// Test notification
// ---------------------------------------------------------------------------

export async function scheduleTestNotification(settings?: Settings): Promise<NotificationTestResult> {
  const result: NotificationTestResult = {
    success: false,
    permissionGranted: false,
    isNative: isNative(),
  };

  if (!isNative()) {
    result.error = "الإشعارات المحلية متاحة فقط داخل تطبيق Android. استخدم APK المثبت على الهاتف.";
    return result;
  }

  const permissionStatus = await checkPermissionStatus();
  result.permissionGranted = permissionStatus === "granted";

  if (!result.permissionGranted) {
    const requested = await requestNotificationPermission(settings);
    result.permissionGranted = requested === "granted";
    if (!result.permissionGranted) {
      result.error = "تم رفض إذن الإشعارات. يرجى تفعيله من إعدادات التطبيق في الهاتف.";
      return result;
    }
  }

  if (settings) await ensureAndroidChannels(settings);
  const channelOk = await ensureTestChannel();
  if (!channelOk) {
    result.error = "تعذر إنشاء قناة اختبار الإشعارات";
    return result;
  }

  const nativeStatus = await getNativeNotificationStatus(settings);
  if (nativeStatus && !nativeStatus.notificationsEnabled) {
    result.error = "إشعارات التطبيق معطلة من إعدادات Android";
    return result;
  }
  if (nativeStatus?.channelExists && nativeStatus.channelEnabled === false) {
    result.error = "قناة اختبار الإشعارات معطلة من إعدادات Android";
    return result;
  }

  const notificationId = hashId(`test-${Date.now()}`);
  const ids = channelIds({} as Settings);
  const notification = {
    id: notificationId,
    title: "اختبار الإشعارات",
    body: "إذا وصل هذا الإشعار فإن نظام التنبيهات يعمل بشكل صحيح.",
    channelId: ids.test,
    sound: "default",
    smallIcon: "ic_notification",
    largeIcon: "ic_launcher",
    autoCancel: true,
  };

  try {
    await LocalNotifications.schedule({
      notifications: [notification],
    });

    try {
      const pending = await LocalNotifications.getPending();
      result.pendingNotifications = pending.notifications.length;
    } catch {
      // ignore
    }

    result.success = true;
    result.notificationId = notificationId;
    result.scheduledAt = new Date().toISOString();
    console.log("[Notifications] Test notification sent:", notificationId);
  } catch (e: any) {
    console.error("[Notifications] Test notification failed with test channel:", e);
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            ...notification,
            id: hashId(`test-fallback-${Date.now()}`),
            channelId: undefined,
          },
        ],
      });
      result.success = true;
      result.notificationId = notificationId;
      result.scheduledAt = new Date().toISOString();
      console.log("[Notifications] Test notification sent with default channel fallback");
    } catch (fallbackError: any) {
      console.error("[Notifications] Test fallback failed:", fallbackError);
      result.error = fallbackError?.message || e?.message || "تعذر إرسال إشعار الاختبار";
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Clear all notifications
// ---------------------------------------------------------------------------

export async function clearAllScheduledNotifications(): Promise<{
  success: boolean;
  cancelledCount: number;
  error?: string;
}> {
  if (!isNative()) {
    return { success: true, cancelledCount: 0 };
  }

  try {
    const pending = await LocalNotifications.getPending();
    const count = pending.notifications.length;
    if (count > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    saveTrackedIds([]);
    saveLastSyncFingerprint("");
    return { success: true, cancelledCount: count };
  } catch (e: any) {
    console.error("[Notifications] Clear all failed:", e);
    return { success: false, cancelledCount: 0, error: e?.message || "تعذر إلغاء الإشعارات" };
  }
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export async function getNotificationDiagnostics(data: AppData): Promise<NotificationDiagnostics> {
  const permissionStatus = await checkPermissionStatus();
  const lastResult = getLastSyncResult();

  const diagnostics: NotificationDiagnostics = {
    isNative: isNative(),
    notificationsSupported: notificationsSupported(),
    permissionStatus,
    remindersFound: lastResult?.remindersFound ?? 0,
    notificationsGenerated: lastResult?.notificationsGenerated ?? 0,
    scheduledNotifications: lastResult?.notificationsScheduled ?? 0,
    pendingNativeNotifications: lastResult?.pendingNotifications ?? 0,
    exactAlarmStatus:
      "غير معروف (يتطلب Android 12+ وقد يحتاج تفعيل يدوي من إعدادات التطبيق)",
    soundFallbacks: lastResult?.soundFallbacks ?? [],
    lastSyncError: lastResult?.error,
    lastSyncAt: lastResult ? new Date().toISOString() : undefined,
    channelsCreated: Array.from(channelCreationAttempts.keys()),
  };

  if (!isNative()) {
    diagnostics.exactAlarmStatus = "غير مطلوب في معاينة المتصفح";
    diagnostics.remindersFound = collectReminders(data).length;
    return diagnostics;
  }

  try {
    await ensureTestChannel();
    diagnostics.nativeStatus = await getNativeNotificationStatus(data.settings);
    if (diagnostics.nativeStatus && !diagnostics.nativeStatus.notificationsEnabled) {
      diagnostics.lastSyncError = "إشعارات التطبيق معطلة من إعدادات Android";
    } else if (diagnostics.nativeStatus?.channelExists && diagnostics.nativeStatus.channelEnabled === false) {
      diagnostics.lastSyncError = "قناة اختبار الإشعارات معطلة من إعدادات Android";
    }
  } catch (e) {
    console.error("[Notifications] Native status failed:", e);
  }

  if (data.settings.notificationsEnabled && permissionStatus === "granted") {
    try {
      const pending = await LocalNotifications.getPending();
      diagnostics.pendingNativeNotifications = pending.notifications.length;

      const next = pending.notifications
        .map((n) => (n as any).schedule?.at)
        .filter(Boolean)
        .map((d) => new Date(d))
        .filter((d) => d > new Date())
        .sort((a, b) => a.getTime() - b.getTime())[0];

      if (next) {
        diagnostics.nextNotificationAt = next.toISOString();
        diagnostics.nextNotificationLabel = next.toLocaleString("ar-SA", {
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch (e) {
      console.error("[Notifications] Diagnostics pending read failed:", e);
    }
  }

  return diagnostics;
}

// ---------------------------------------------------------------------------
// Web fallback
// ---------------------------------------------------------------------------

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

    const shouldNotify =
      (r.days >= 0 && r.days <= windowDays) ||
      (r.kind === "rent" && r.days < 0) ||
      (r.kind !== "rent" && r.days < 0 && r.days >= -3);
    if (!shouldNotify) continue;
    if (notified[r.id] === today) continue;

    try {
      new Notification(reminderTitle(r), {
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

// Re-export hashId for external use if needed
export { hashId as generateNotificationId };
