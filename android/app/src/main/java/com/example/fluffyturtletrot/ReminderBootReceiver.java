package com.aziz.revenue;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Restores the alarm chain after events that clear AlarmManager state:
 *  - device reboot (BOOT_COMPLETED / LOCKED_BOOT_COMPLETED / QUICKBOOT)
 *  - app update (MY_PACKAGE_REPLACED)
 *  - wall-clock or timezone changes (TIME_SET / TIMEZONE_CHANGED)
 * The reminder plan itself lives in SharedPreferences, so nothing is lost.
 */
public class ReminderBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        switch (action) {
            case Intent.ACTION_BOOT_COMPLETED:
            case Intent.ACTION_LOCKED_BOOT_COMPLETED:
            case Intent.ACTION_MY_PACKAGE_REPLACED:
            case Intent.ACTION_TIME_CHANGED:
            case Intent.ACTION_TIMEZONE_CHANGED:
            case "android.intent.action.QUICKBOOT_POWERON":
                PendingResult pending = goAsync();
                new Thread(() -> {
                    try {
                        Context app = context.getApplicationContext();
                        ReminderEngine.ensureMaintenanceWorker(app);
                        ReminderEngine.deliverDueAndReschedule(app);
                    } catch (Exception e) {
                        android.util.Log.e("ReminderBootReceiver", "restore failed", e);
                    } finally {
                        pending.finish();
                    }
                }).start();
                break;
            default:
                break;
        }
    }
}
