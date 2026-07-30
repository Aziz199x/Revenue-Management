package com.aziz.revenue;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Native notification engine. Owns ALL background scheduling.
 *
 * Design: chained exact alarms + WorkManager safety net.
 *  - The JS layer pushes a declarative "reminder plan" (facts + settings, no
 *    concrete timestamps) via NativeRemindersPlugin whenever data changes.
 *  - The engine computes the NEXT occurrence and arms exactly one
 *    setExactAndAllowWhileIdle(RTC_WAKEUP) alarm.
 *  - When it fires, ReminderAlarmReceiver delivers everything due, records it
 *    in a persistent ledger (duplicate guard), and re-arms the next alarm.
 *  - A 6-hour WorkManager job re-runs the same idempotent routine in case an
 *    OEM kills the alarm; BOOT_COMPLETED / MY_PACKAGE_REPLACED / TIME_SET
 *    receivers do the same after reboots, updates and clock changes.
 *
 * The WebView/React runtime is never required for a notification to fire.
 */
public final class ReminderEngine {

    private static final String TAG = "ReminderEngine";
    public static final String ACTION_FIRE = "com.aziz.revenue.REMINDER_FIRE";
    private static final int ALARM_REQUEST_CODE = 987001;
    private static final long LOOKBACK_MS = 12L * 60 * 60 * 1000;   // deliver missed slots up to 12h late
    private static final int OVERDUE_RENT_TAIL_DAYS = 90;           // keep nagging overdue rent up to 90 days
    private static final int OVERDUE_OTHER_TAIL_DAYS = 3;
    private static final String WORK_NAME = "aziz-reminder-maintenance";

    private ReminderEngine() {}

    // ------------------------------------------------------------------
    // Public entry points (all idempotent)
    // ------------------------------------------------------------------

    /** Called from the Capacitor plugin when JS pushes a new plan. */
    public static synchronized void applyPlan(Context context, String planJson) {
        ReminderPlanStore store = new ReminderPlanStore(context);
        store.savePlan(planJson);
        // Baseline: never retro-deliver slots that predate the plan push —
        // the app was open, the user just saw the data.
        store.setLastRun(System.currentTimeMillis());
        ensureChannels(context, store.getPlan());
        ensureMaintenanceWorker(context);
        armNextAlarm(context);
    }

    /** Called by the alarm receiver, the boot/update receiver and the worker. */
    public static synchronized void deliverDueAndReschedule(Context context) {
        ReminderPlanStore store = new ReminderPlanStore(context);
        JSONObject plan = store.getPlan();
        long now = System.currentTimeMillis();
        JSONObject planSettings = plan != null ? plan.optJSONObject("settings") : null;
        if (planSettings == null || !planSettings.optBoolean("notificationsEnabled", false)) {
            cancelAlarm(context);
            return;
        }
        ensureChannels(context, plan);
        long from = Math.max(store.getLastRun(), now - LOOKBACK_MS);
        try {
            deliverDue(context, store, plan, from, now);
        } catch (Exception e) {
            Log.e(TAG, "deliverDue failed", e);
        }
        store.setLastRun(now);
        armNextAlarm(context);
    }

    /** Arms exactly one alarm for the next computed occurrence. */
    public static synchronized void armNextAlarm(Context context) {
        ReminderPlanStore store = new ReminderPlanStore(context);
        JSONObject plan = store.getPlan();
        if (plan == null) return;
        JSONObject settings = plan.optJSONObject("settings");
        if (settings == null || !settings.optBoolean("notificationsEnabled", false)) {
            cancelAlarm(context);
            return;
        }
        Long next = nextOccurrenceAfter(plan, System.currentTimeMillis());
        if (next == null) {
            cancelAlarm(context);
            Log.i(TAG, "No future occurrences; alarm not armed");
            return;
        }
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        PendingIntent pi = firePendingIntent(context);
        boolean exact = canUseExactAlarms(context, alarmManager);
        try {
            if (exact) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            } else {
                // Inexact fallback: 15-minute window, still wakes the device.
                alarmManager.setWindow(AlarmManager.RTC_WAKEUP, next, 15 * 60 * 1000, pi);
            }
            Log.i(TAG, "Armed " + (exact ? "exact" : "windowed") + " alarm at " + new Date(next));
        } catch (SecurityException e) {
            alarmManager.setWindow(AlarmManager.RTC_WAKEUP, next, 15 * 60 * 1000, pi);
            Log.w(TAG, "Exact alarm rejected, fell back to setWindow", e);
        }
    }

    public static boolean canUseExactAlarms(Context context, AlarmManager alarmManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return alarmManager.canScheduleExactAlarms();
    }

    public static Long peekNextOccurrence(Context context) {
        JSONObject plan = new ReminderPlanStore(context).getPlan();
        if (plan == null) return null;
        return nextOccurrenceAfter(plan, System.currentTimeMillis());
    }

    public static void ensureMaintenanceWorker(Context context) {
        try {
            PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                    ReminderMaintenanceWorker.class, 6, TimeUnit.HOURS)
                    .build();
            WorkManager.getInstance(context.getApplicationContext())
                    .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
        } catch (Exception e) {
            Log.e(TAG, "WorkManager enqueue failed", e);
        }
    }

    // ------------------------------------------------------------------
    // Delivery
    // ------------------------------------------------------------------

    private static void deliverDue(Context context, ReminderPlanStore store, JSONObject plan, long from, long to) {
        JSONObject settings = plan.optJSONObject("settings");
        JSONArray reminders = plan.optJSONArray("reminders");
        if (settings == null || reminders == null) return;
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) {
            Log.w(TAG, "Notifications disabled at OS level; skipping delivery");
            return;
        }

        for (int i = 0; i < reminders.length(); i++) {
            JSONObject reminder = reminders.optJSONObject(i);
            if (reminder == null) continue;
            List<Integer> times = timesOfDayMinutes(settings, frequencyForReminder(reminder, settings));
            if (times.isEmpty()) continue;
            Long slot = latestOccurrenceInRange(reminder, settings, times, from, to);
            if (slot == null) continue;
            String kind = reminder.optString("kind");
            String channel = NotificationChannels.channelForKind(kind);
            String key = reminder.optString("id") + "|" + channel + "|" + slot;
            if (store.wasDelivered(key)) continue;
            postNotification(context, manager, reminder, settings, channel, slot);
            store.markDelivered(key, to);
        }
    }

    private static void postNotification(Context context, NotificationManagerCompat manager,
                                         JSONObject reminder, JSONObject settings, String channelId, long slotMs) {
        int daysUntilDue = daysBetween(todayMidnight(), parseIsoDate(reminder.optString("dueDate")));
        String title = buildTitle(reminder, daysUntilDue);
        String body = buildBody(reminder, daysUntilDue);

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent contentIntent = null;
        if (launch != null) {
            String route = reminder.optString("route", "/");
            String reminderId = reminder.optString("id", "reminder");
            launch.setData(Uri.parse("revenuemanagement://navigate?route=" + Uri.encode(route)));
            launch.putExtra("notificationRoute", route);
            launch.putExtra("notificationReminderId", reminderId);
            launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            contentIntent = PendingIntent.getActivity(context, hashId(reminderId), launch, piFlags);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(context.getResources().getIdentifier("ic_notification", "drawable", context.getPackageName()))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true);
        if (contentIntent != null) builder.setContentIntent(contentIntent);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            String sound = soundForKind(reminder.optString("kind"), settings);
            android.net.Uri uri = NotificationChannels.soundUri(context, sound);
            if (uri != null) builder.setSound(uri);
            builder.setDefaults(uri == null ? Notification.DEFAULT_ALL : Notification.DEFAULT_VIBRATE);
        }

        String idKey = reminder.optString("id") + "|" + channelId + "|" + slotMs;
        try {
            manager.notify(hashId(idKey), builder.build());
        } catch (SecurityException e) {
            Log.e(TAG, "notify() rejected (permission revoked?)", e);
        }
    }

    // ------------------------------------------------------------------
    // Occurrence math (port of buildReminderScheduleTimes semantics,
    // evaluated lazily so the horizon is unlimited)
    // ------------------------------------------------------------------

    private static Long nextOccurrenceAfter(JSONObject plan, long afterMs) {
        JSONObject settings = plan.optJSONObject("settings");
        JSONArray reminders = plan.optJSONArray("reminders");
        if (settings == null || reminders == null) return null;
        Long best = null;
        for (int i = 0; i < reminders.length(); i++) {
            JSONObject reminder = reminders.optJSONObject(i);
            if (reminder == null) continue;
            List<Integer> times = timesOfDayMinutes(settings, frequencyForReminder(reminder, settings));
            if (times.isEmpty()) continue;
            Long candidate = nextForReminder(reminder, settings, times, afterMs);
            if (candidate != null && (best == null || candidate < best)) best = candidate;
        }
        return best;
    }

    private static long[] dayRange(JSONObject reminder, JSONObject settings) {
        Calendar due = parseIsoDate(reminder.optString("dueDate"));
        if (due == null) return null;
        String kind = reminder.optString("kind");
        if ("owner_transfer".equals(kind)) {
            Calendar start = todayMidnight();
            Calendar end = (Calendar) start.clone();
            end.add(Calendar.DAY_OF_MONTH, OVERDUE_RENT_TAIL_DAYS);
            return new long[] { start.getTimeInMillis(), end.getTimeInMillis() };
        }
        boolean isContract = "contract".equals(kind) || "eviction".equals(kind);
        int window = reminder.has("reminderWindow") && !reminder.isNull("reminderWindow")
                ? reminder.optInt("reminderWindow")
                : (isContract ? settings.optInt("contractReminderDays", 30) : settings.optInt("rentReminderDays", 7));

        Calendar start = (Calendar) due.clone();
        start.add(Calendar.DAY_OF_MONTH, -Math.max(0, window));

        Calendar end = (Calendar) due.clone();
        if ("rent".equals(kind)) {
            if (settings.optBoolean("overdueEnabled", true)) {
                end.add(Calendar.DAY_OF_MONTH, Math.max(1, settings.optInt("overdueTailDays", OVERDUE_RENT_TAIL_DAYS)));
            }
        } else {
            end.add(Calendar.DAY_OF_MONTH, OVERDUE_OTHER_TAIL_DAYS);
        }
        return new long[] { start.getTimeInMillis(), end.getTimeInMillis() };
    }

    private static Long nextForReminder(JSONObject reminder, JSONObject settings, List<Integer> times, long afterMs) {
        long[] range = dayRange(reminder, settings);
        if (range == null) return null;
        Calendar day = Calendar.getInstance();
        day.setTimeInMillis(Math.max(range[0], todayMidnight().getTimeInMillis()));
        atMidnight(day);
        while (day.getTimeInMillis() <= range[1]) {
            for (int minutes : times) {
                long candidate = day.getTimeInMillis() + minutes * 60_000L;
                if (candidate > afterMs) return candidate;
            }
            day.add(Calendar.DAY_OF_MONTH, 1);
        }
        return null;
    }

    private static Long latestOccurrenceInRange(JSONObject reminder, JSONObject settings, List<Integer> times, long from, long to) {
        long[] range = dayRange(reminder, settings);
        if (range == null) return null;
        Long latest = null;
        Calendar day = Calendar.getInstance();
        day.setTimeInMillis(from);
        atMidnight(day);
        while (day.getTimeInMillis() <= to) {
            if (day.getTimeInMillis() >= range[0] - 86_400_000L && day.getTimeInMillis() <= range[1]) {
                for (int minutes : times) {
                    long candidate = day.getTimeInMillis() + minutes * 60_000L;
                    if (candidate > from && candidate <= to
                            && candidate >= range[0] && candidate <= range[1] + 86_399_999L) {
                        if (latest == null || candidate > latest) latest = candidate;
                    }
                }
            }
            day.add(Calendar.DAY_OF_MONTH, 1);
        }
        return latest;
    }

    /**
     * Per-category repeat frequency: contracts nearing expiry, upcoming rent,
     * and overdue rent can each have their own interval; each falls back to
     * the global frequencyHours when not customized.
     */
    private static int frequencyForReminder(JSONObject reminder, JSONObject settings) {
        int global = Math.max(1, settings.optInt("frequencyHours", 24));
        String kind = reminder.optString("kind");
        if ("contract".equals(kind) || "eviction".equals(kind)) {
            return Math.max(1, settings.optInt("contractFrequencyHours", global));
        }
        Calendar due = parseIsoDate(reminder.optString("dueDate"));
        boolean overdue = due != null && due.getTimeInMillis() < todayMidnight().getTimeInMillis();
        if (overdue) return Math.max(1, settings.optInt("overdueFrequencyHours", global));
        return Math.max(1, settings.optInt("upcomingFrequencyHours", global));
    }

    /** Times of day (minutes since midnight) derived from user settings. */
    private static List<Integer> timesOfDayMinutes(JSONObject settings, int frequencyHours) {
        frequencyHours = Math.max(1, frequencyHours);
        List<Integer> result = new ArrayList<>();
        if (settings.optBoolean("allDay", false)) {
            for (int hour = 0; hour <= 23; hour += frequencyHours) result.add(hour * 60);
            return result;
        }
        int start = parseClockMinutes(settings.optString("windowStart", "09:00"), 9 * 60);
        int end = parseClockMinutes(settings.optString("windowEnd", "21:00"), 21 * 60);
        if (start >= end) return result;
        for (int m = start; m <= end; m += frequencyHours * 60) result.add(m);
        return result;
    }

    private static int parseClockMinutes(String value, int fallback) {
        try {
            String[] parts = value.split(":");
            int h = Math.min(23, Math.max(0, Integer.parseInt(parts[0].trim())));
            int m = Math.min(59, Math.max(0, Integer.parseInt(parts[1].trim())));
            return h * 60 + m;
        } catch (Exception e) {
            return fallback;
        }
    }

    // ------------------------------------------------------------------
    // Arabic copy (port of reminderTitle/reminderBody in notifications.ts)
    // ------------------------------------------------------------------

    private static String buildTitle(JSONObject reminder, int days) {
        String kind = reminder.optString("kind");
        if ("contract".equals(kind)) {
            return reminder.optBoolean("autoRenewal", false) ? "عقد سيتجدد تلقائيا" : "تذكير عقد";
        }
        if ("rent".equals(kind)) return days < 0 ? "دفعة متأخرة" : "موعد سداد الإيجار";
        if ("maintenance".equals(kind)) return "طلب صيانة معلق";
        if ("owner_transfer".equals(kind)) return "تحويل للمالك مطلوب";
        String title = reminder.optString("title", "");
        return title.isEmpty() ? "تذكير" : title;
    }

    private static String buildBody(JSONObject reminder, int days) {
        String kind = reminder.optString("kind");
        String subtitle = reminder.optString("subtitle", "");
        String unitName = reminder.optString("unitName", subtitle);
        if (unitName.isEmpty()) unitName = subtitle;

        if ("contract".equals(kind)) {
            String expiry = formatArabicDate(reminder.optString("dueDate"));
            if (reminder.optBoolean("autoRenewal", false)) {
                return "العقد للوحدة " + unitName + " سيتجدد تلقائيًا بعد " + days + " يوم (" + expiry + ").";
            }
            if (days < 0) return "العقد: " + subtitle + " — منتهي منذ " + (-days) + " يوم (" + expiry + ")";
            if (days == 0) return "العقد: " + subtitle + " — ينتهي اليوم (" + expiry + ")";
            return "العقد للوحدة " + unitName + " ينتهي بعد " + days + " يوم ويحتاج إجراء في منصة إيجار (" + expiry + ").";
        }
        if ("rent".equals(kind) && days < 0) {
            String amount = formatArabicNumber(reminder.optDouble("amount", 0));
            return "لديك دفعة إيجار متأخرة للوحدة " + unitName + " بمبلغ " + amount + " ر.س.";
        }
        if ("owner_transfer".equals(kind)) {
            String amount = formatArabicNumber(reminder.optDouble("amount", 0));
            return "دفعة مستلمة للوحدة " + unitName + " بقيمة " + amount + " ر.س لم تُحوّل للمالك بعد.";
        }
        String title = reminder.optString("title", "");
        String prefix = "موعد سداد الإيجار".equals(title) || "rent".equals(kind) ? "دفعة إيجار" : title;
        if (days < 0) return prefix + ": " + subtitle + " — متأخر منذ " + (-days) + " يوم";
        if (days == 0) return prefix + ": " + subtitle + " — يستحق اليوم";
        return prefix + ": " + subtitle + " — بعد " + days + " يوم";
    }

    private static String soundForKind(String kind, JSONObject settings) {
        if ("contract".equals(kind) || "eviction".equals(kind)) return settings.optString("contractSound", "default");
        if ("rent".equals(kind)) return settings.optString("paymentSound", "default");
        if ("maintenance".equals(kind)) return settings.optString("maintenanceSound", "default");
        return "default";
    }

    private static String formatArabicDate(String isoDate) {
        Calendar cal = parseIsoDate(isoDate);
        if (cal == null) return isoDate;
        SimpleDateFormat fmt = new SimpleDateFormat("d MMM yyyy", new Locale("ar", "SA"));
        return fmt.format(cal.getTime());
    }

    private static String formatArabicNumber(double value) {
        NumberFormat fmt = NumberFormat.getInstance(new Locale("ar", "SA"));
        return fmt.format(value);
    }

    // ------------------------------------------------------------------
    // Utilities
    // ------------------------------------------------------------------

    private static void ensureChannels(Context context, JSONObject plan) {
        JSONObject settings = plan != null ? plan.optJSONObject("settings") : null;
        NotificationChannels.ensure(context,
                settings != null ? settings.optString("paymentSound", null) : null,
                settings != null ? settings.optString("contractSound", null) : null,
                settings != null ? settings.optString("maintenanceSound", null) : null);
    }

    private static PendingIntent firePendingIntent(Context context) {
        Intent intent = new Intent(context, ReminderAlarmReceiver.class);
        intent.setAction(ACTION_FIRE);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, ALARM_REQUEST_CODE, intent, flags);
    }

    private static void cancelAlarm(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) alarmManager.cancel(firePendingIntent(context));
    }

    private static Calendar parseIsoDate(String iso) {
        if (iso == null || iso.length() < 10) return null;
        try {
            Calendar cal = Calendar.getInstance();
            cal.set(Integer.parseInt(iso.substring(0, 4)),
                    Integer.parseInt(iso.substring(5, 7)) - 1,
                    Integer.parseInt(iso.substring(8, 10)), 0, 0, 0);
            cal.set(Calendar.MILLISECOND, 0);
            return cal;
        } catch (Exception e) {
            return null;
        }
    }

    private static Calendar todayMidnight() {
        Calendar cal = Calendar.getInstance();
        atMidnight(cal);
        return cal;
    }

    private static void atMidnight(Calendar cal) {
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
    }

    private static int daysBetween(Calendar from, Calendar to) {
        if (from == null || to == null) return 0;
        long diff = to.getTimeInMillis() - from.getTimeInMillis();
        return (int) Math.round(diff / 86_400_000.0);
    }

    /** Same algorithm as hashId() in src/utils/notifications.ts. */
    public static int hashId(String id) {
        int hash = 0;
        for (int i = 0; i < id.length(); i++) {
            hash = hash * 31 + id.charAt(i);
        }
        int result = (int) (Math.abs((long) hash) % 2147483647L);
        return result == 0 ? 1 : result;
    }
}
