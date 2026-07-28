package com.aziz.revenue;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Fires when the armed alarm triggers. Delivers everything due and re-arms
 * the next alarm (self-perpetuating chain). Runs without the WebView.
 */
public class ReminderAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                ReminderEngine.deliverDueAndReschedule(context.getApplicationContext());
            } catch (Exception e) {
                android.util.Log.e("ReminderAlarmReceiver", "delivery failed", e);
            } finally {
                pending.finish();
            }
        }).start();
    }
}
