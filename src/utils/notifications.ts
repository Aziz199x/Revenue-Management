import { AppData } from "@/data/types";
import { collectReminders } from "@/data/helpers";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

const NOTIFIED_KEY = "rental-manager-notified-v1";

function getNotified(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Checks reminders and fires local notifications for items due within
 * their reminder window. Each item is notified at most once per day.
 */
export function checkAndNotify(data: AppData) {
  if (!notificationsSupported()) return;
  if (!data.settings.notificationsEnabled) return;
  if (Notification.permission !== "granted") return;

  const today = new Date().toISOString().slice(0, 10);
  const notified = getNotified();
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

    const body =
      r.days < 0
        ? `${r.subtitle} — متأخر منذ ${-r.days} يوم`
        : r.days === 0
          ? `${r.subtitle} — يستحق اليوم`
          : `${r.subtitle} — بعد ${r.days} يوم`;

    try {
      new Notification(r.title, { body, tag: r.id, dir: "rtl", lang: "ar" });
      notified[r.id] = today;
    } catch {
      // Notification constructor may fail on some mobile browsers
    }
  }

  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
}
