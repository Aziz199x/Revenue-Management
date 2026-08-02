package com.aziz.revenue;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.telephony.SmsManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(
        name = "SmsSender",
        permissions = {
                @Permission(alias = "sms", strings = {Manifest.permission.SEND_SMS})
        }
)
public class SmsSenderPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("sms", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void send(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("يلزم السماح للتطبيق بإرسال رسائل SMS");
            return;
        }
        String phone = call.getString("phone");
        String message = call.getString("message");
        String requestId = call.getString("requestId");
        if (phone == null || phone.trim().isEmpty() || message == null || message.trim().isEmpty()) {
            call.reject("رقم الجوال ونص الرسالة مطلوبان");
            return;
        }
        if (requestId == null || requestId.trim().isEmpty()) {
            requestId = "sms-" + System.nanoTime();
        }
        final String finalRequestId = requestId;
        try {
            SmsManager manager = SmsManager.getDefault();
            ArrayList<String> parts = manager.divideMessage(message);
            Context context = getContext();
            String action = context.getPackageName() + ".SMS_SENT." + System.nanoTime();
            int partCount = Math.max(1, parts.size());
            AtomicInteger remainingParts = new AtomicInteger(partCount);
            AtomicBoolean finished = new AtomicBoolean(false);
            Handler handler = new Handler(Looper.getMainLooper());

            final BroadcastReceiver[] receiverHolder = new BroadcastReceiver[1];
            Runnable cleanup = () -> {
                try {
                    context.unregisterReceiver(receiverHolder[0]);
                } catch (Exception ignored) {
                }
            };
            Runnable timeout = () -> {
                if (finished.compareAndSet(false, true)) {
                    cleanup.run();
                    notifySmsStatus(finalRequestId, "sent", null, true);
                }
            };

            BroadcastReceiver receiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context ignoredContext, Intent ignoredIntent) {
                    int resultCode = getResultCode();
                    if (resultCode != Activity.RESULT_OK) {
                        if (finished.compareAndSet(false, true)) {
                            handler.removeCallbacks(timeout);
                            cleanup.run();
                            notifySmsStatus(finalRequestId, "failed", smsFailureMessage(resultCode), false);
                        }
                        return;
                    }
                    if (remainingParts.decrementAndGet() == 0 && finished.compareAndSet(false, true)) {
                        handler.removeCallbacks(timeout);
                        cleanup.run();
                        notifySmsStatus(finalRequestId, "sent", null, false);
                    }
                }
            };
            receiverHolder[0] = receiver;
            IntentFilter filter = new IntentFilter(action);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                context.registerReceiver(receiver, filter);
            }

            ArrayList<PendingIntent> sentIntents = new ArrayList<>();
            int baseRequestCode = (int) (System.nanoTime() & 0x3fffffff);
            for (int index = 0; index < partCount; index++) {
                Intent sentIntent = new Intent(action).setPackage(context.getPackageName());
                sentIntents.add(PendingIntent.getBroadcast(
                        context,
                        baseRequestCode + index,
                        sentIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                ));
            }
            handler.postDelayed(timeout, 10 * 60_000L);
            try {
                if (parts.size() > 1) {
                    manager.sendMultipartTextMessage(phone, null, parts, sentIntents, null);
                } else {
                    manager.sendTextMessage(phone, null, message, sentIntents.get(0), null);
                }
                JSObject result = new JSObject();
                result.put("queued", true);
                result.put("requestId", finalRequestId);
                call.resolve(result);
            } catch (Exception error) {
                handler.removeCallbacks(timeout);
                if (finished.compareAndSet(false, true)) {
                    cleanup.run();
                    call.reject("تعذر إرسال SMS عبر شريحة الهاتف", error);
                }
            }
        } catch (Exception error) {
            call.reject("تعذر إرسال SMS عبر شريحة الهاتف", error);
        }
    }

    private void notifySmsStatus(String requestId, String status, String error, boolean assumed) {
        JSObject event = new JSObject();
        event.put("requestId", requestId);
        event.put("status", status);
        event.put("assumed", assumed);
        event.put("updatedAt", System.currentTimeMillis());
        if (error != null && !error.isEmpty()) event.put("error", error);
        notifyListeners("smsStatusChanged", event, true);
    }

    private String smsFailureMessage(int resultCode) {
        if (resultCode == SmsManager.RESULT_ERROR_NO_SERVICE) {
            return "فشل إرسال SMS: لا توجد خدمة شبكة جوال";
        }
        if (resultCode == SmsManager.RESULT_ERROR_RADIO_OFF) {
            return "فشل إرسال SMS: شريحة الهاتف أو شبكة الجوال متوقفة";
        }
        if (resultCode == SmsManager.RESULT_ERROR_LIMIT_EXCEEDED) {
            return "فشل إرسال SMS: تجاوز الهاتف حد الإرسال المسموح";
        }
        if (resultCode == SmsManager.RESULT_ERROR_FDN_CHECK_FAILURE) {
            return "فشل إرسال SMS: الرقم غير مسموح به في إعدادات الشريحة";
        }
        return "فشل إرسال SMS؛ تحقق من رصيد الشريحة وصحة الرقم وتغطية الشبكة";
    }
}
