package com.aziz.revenue;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
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

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        boolean notificationsEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        result.put("notificationsEnabled", notificationsEnabled);
        result.put("sdkInt", Build.VERSION.SDK_INT);

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
