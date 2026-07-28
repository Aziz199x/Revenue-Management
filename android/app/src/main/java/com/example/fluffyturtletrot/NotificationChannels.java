package com.aziz.revenue;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

/**
 * Single source of truth for notification channels.
 * Channel IDs MUST stay in sync with src/utils/notifications.ts (channelIds()).
 * Channels are created idempotently: Android ignores re-creation of an existing
 * channel, so calling ensure() from receivers/workers/boot is safe and cheap.
 */
public final class NotificationChannels {

    public static final String CHANNEL_PAYMENT = "payment_reminders";
    public static final String CHANNEL_CONTRACT = "contract_reminders";
    public static final String CHANNEL_MAINTENANCE = "maintenance_reminders";
    public static final String CHANNEL_GENERAL = "general_reminders";
    public static final String CHANNEL_TEST = "notification_test";

    private NotificationChannels() {}

    public static void ensure(Context context, String paymentSound, String contractSound, String maintenanceSound) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        create(context, manager, CHANNEL_PAYMENT, "تذكيرات الدفعات",
                "تنبيهات الدفعات المستحقة والمتأخرة", NotificationManager.IMPORTANCE_HIGH, paymentSound);
        create(context, manager, CHANNEL_CONTRACT, "تذكيرات العقود",
                "تنبيهات انتهاء وتجديد العقود", NotificationManager.IMPORTANCE_HIGH, contractSound);
        create(context, manager, CHANNEL_MAINTENANCE, "طلبات الصيانة المعلقة",
                "تنبيهات طلبات الصيانة التي ما زالت معلقة", NotificationManager.IMPORTANCE_HIGH, maintenanceSound);
        create(context, manager, CHANNEL_GENERAL, "التذكيرات العامة",
                "تنبيهات الفواتير والطلبات العامة", NotificationManager.IMPORTANCE_DEFAULT, null);
        create(context, manager, CHANNEL_TEST, "اختبار الإشعارات",
                "قناة اختبار إشعارات التطبيق", NotificationManager.IMPORTANCE_HIGH, null);
    }

    private static void create(Context context, NotificationManager manager, String id,
                               String name, String description, int importance, String soundResName) {
        if (manager.getNotificationChannel(id) != null) return; // immutable once created
        NotificationChannel channel = new NotificationChannel(id, name, importance);
        channel.setDescription(description);
        channel.enableVibration(true);
        channel.setShowBadge(true);
        Uri sound = soundUri(context, soundResName);
        if (sound != null) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            channel.setSound(sound, attrs);
        }
        manager.createNotificationChannel(channel);
    }

    /** Maps "payment_overdue.wav" / "payment_overdue" to android.resource:// URI, null => system default. */
    public static Uri soundUri(Context context, String soundResName) {
        if (soundResName == null || soundResName.isEmpty() || "default".equals(soundResName)) return null;
        String base = soundResName.replace(".wav", "").replaceAll("[^a-z0-9_]", "_");
        int resId = context.getResources().getIdentifier(base, "raw", context.getPackageName());
        if (resId == 0) return null;
        return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/" + resId);
    }

    public static String channelForKind(String kind) {
        if ("contract".equals(kind) || "eviction".equals(kind)) return CHANNEL_CONTRACT;
        if ("rent".equals(kind)) return CHANNEL_PAYMENT;
        if ("maintenance".equals(kind)) return CHANNEL_MAINTENANCE;
        return CHANNEL_GENERAL;
    }
}
