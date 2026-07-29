package com.aziz.revenue;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationSettings")
public class NotificationSettingsPlugin extends Plugin {
    @PluginMethod
    public void openChannel(PluginCall call) {
        String channelId = call.getString("channelId");
        if (channelId == null || channelId.isEmpty()) {
            openAppSettings(call);
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            intent.putExtra(Settings.EXTRA_CHANNEL_ID, channelId);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(new JSObject());
        } catch (Exception channelError) {
            openAppSettings(call);
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(new JSObject());
        } catch (Exception appSettingsError) {
            call.reject("Unable to open notification settings", appSettingsError);
        }
    }

    /**
     * Opens the OEM "autostart / background launch" management screen.
     * On MIUI/ColorOS/FuntouchOS/EMUI-style ROMs, alarms and broadcasts are
     * blocked for apps without this permission even when battery is
     * unrestricted. Tries known OEM activities, falls back to app details.
     */
    @PluginMethod
    public void openAutoStartSettings(PluginCall call) {
        final String[][] components = {
            // Xiaomi / Redmi / Poco (MIUI, HyperOS)
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            // Huawei
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"},
            // Honor
            {"com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            // Oppo / Realme (ColorOS)
            {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
            // Vivo / iQOO (FuntouchOS)
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"},
            // OnePlus
            {"com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"},
            // Samsung (battery / sleeping apps)
            {"com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"},
            // Asus
            {"com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"},
        };
        for (String[] component : components) {
            try {
                Intent intent = new Intent();
                intent.setClassName(component[0], component[1]);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                JSObject result = new JSObject();
                result.put("opened", component[0]);
                call.resolve(result);
                return;
            } catch (Exception ignored) {
                // try the next known OEM screen
            }
        }
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", "app_details");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Unable to open autostart settings", e);
        }
    }

    /**
     * Opens the system dialog asking the user to exempt the app from battery
     * optimization (Doze restrictions). Falls back to the optimization list
     * screen, then to app details, if the direct request is unavailable.
     */
    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(new JSObject());
        } catch (Exception directRequestError) {
            try {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve(new JSObject());
            } catch (Exception listError) {
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    call.resolve(new JSObject());
                } catch (Exception detailsError) {
                    call.reject("Unable to open battery optimization settings", detailsError);
                }
            }
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        boolean notificationsEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        result.put("notificationsEnabled", notificationsEnabled);
        result.put("sdkInt", Build.VERSION.SDK_INT);

        PowerManager powerManager = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        if (powerManager != null) {
            result.put("batteryUnrestricted", powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        }
        result.put("manufacturer", Build.MANUFACTURER);

        String channelId = call.getString("channelId");
        if (channelId != null && !channelId.isEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            NotificationChannel channel = manager != null ? manager.getNotificationChannel(channelId) : null;
            result.put("channelId", channelId);
            result.put("channelExists", channel != null);
            if (channel != null) {
                result.put("channelImportance", channel.getImportance());
                result.put("channelEnabled", channel.getImportance() != NotificationManager.IMPORTANCE_NONE);
                result.put("channelSound", channel.getSound() != null ? channel.getSound().toString() : "");
                result.put("channelName", String.valueOf(channel.getName()));
            }
        }

        call.resolve(result);
    }
}
