package com.aziz.revenue;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridge between the React data layer and the native ReminderEngine.
 * JS pushes a declarative plan; everything else (occurrence computation,
 * alarm chaining, reboot/update recovery, duplicate guarding) is native.
 */
@CapacitorPlugin(name = "NativeReminders")
public class NativeRemindersPlugin extends Plugin {

    @Override
    public void load() {
        // Guarantee the safety net exists even if JS never pushes a plan
        // in this session (e.g. app opened and immediately closed).
        ReminderEngine.ensureMaintenanceWorker(getContext());
    }

    @PluginMethod
    public void setPlan(PluginCall call) {
        String plan = call.getString("plan");
        if (plan == null || plan.isEmpty()) {
            call.reject("plan is required");
            return;
        }
        try {
            ReminderEngine.applyPlan(getContext(), plan);
            call.resolve(buildStatus());
        } catch (Exception e) {
            call.reject("Failed to apply reminder plan", e);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    /** Opens the Android 12+ "Alarms & reminders" screen for this app. */
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Unable to open exact alarm settings", e);
        }
    }

    private JSObject buildStatus() {
        Context context = getContext();
        JSObject result = new JSObject();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        boolean exact = alarmManager != null && ReminderEngine.canUseExactAlarms(context, alarmManager);
        result.put("exactAlarmsAllowed", exact);
        result.put("sdkInt", Build.VERSION.SDK_INT);
        Long next = ReminderEngine.peekNextOccurrence(context);
        result.put("armed", next != null);
        if (next != null) {
            result.put("nextOccurrenceAt", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", java.util.Locale.US)
                    .format(new java.util.Date(next)));
            result.put("nextOccurrenceEpochMs", (double) next);
        }
        result.put("deliveredLedgerSize", new ReminderPlanStore(context).ledgerSize());
        return result;
    }
}
