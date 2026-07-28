package com.aziz.revenue;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * Persistent, process-death-safe storage for the reminder plan and the
 * delivery ledger. Lives in app-private SharedPreferences, so it survives:
 *  - WebView / React process death
 *  - app updates
 *  - device reboots
 * It is intentionally independent of WebView localStorage.
 */
public final class ReminderPlanStore {

    private static final String PREFS = "aziz_reminder_engine";
    private static final String KEY_PLAN = "plan_json_v1";
    private static final String KEY_LEDGER = "delivered_ledger_v1";
    private static final String KEY_LAST_RUN = "last_run_epoch_ms";
    private static final long LEDGER_TTL_MS = 14L * 24 * 60 * 60 * 1000; // 14 days

    private final SharedPreferences prefs;

    public ReminderPlanStore(Context context) {
        this.prefs = context.getApplicationContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public void savePlan(String planJson) {
        prefs.edit().putString(KEY_PLAN, planJson).apply();
    }

    public JSONObject getPlan() {
        String raw = prefs.getString(KEY_PLAN, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return null;
        }
    }

    public long getLastRun() {
        return prefs.getLong(KEY_LAST_RUN, 0L);
    }

    public void setLastRun(long epochMs) {
        prefs.edit().putLong(KEY_LAST_RUN, epochMs).apply();
    }

    /** True when this occurrence was already delivered (duplicate guard). */
    public boolean wasDelivered(String occurrenceKey) {
        return ledger().has(occurrenceKey);
    }

    public void markDelivered(String occurrenceKey, long epochMs) {
        JSONObject ledger = ledger();
        try {
            ledger.put(occurrenceKey, epochMs);
        } catch (JSONException ignored) {}
        prune(ledger, epochMs);
        prefs.edit().putString(KEY_LEDGER, ledger.toString()).apply();
    }

    public int ledgerSize() {
        return ledger().length();
    }

    private JSONObject ledger() {
        String raw = prefs.getString(KEY_LEDGER, "{}");
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private void prune(JSONObject ledger, long now) {
        Iterator<String> keys = ledger.keys();
        java.util.List<String> stale = new java.util.ArrayList<>();
        while (keys.hasNext()) {
            String key = keys.next();
            long ts = ledger.optLong(key, 0L);
            if (now - ts > LEDGER_TTL_MS) stale.add(key);
        }
        for (String key : stale) ledger.remove(key);
    }
}
