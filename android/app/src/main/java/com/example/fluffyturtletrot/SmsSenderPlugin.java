package com.aziz.revenue;

import android.Manifest;
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
        if (phone == null || phone.trim().isEmpty() || message == null || message.trim().isEmpty()) {
            call.reject("رقم الجوال ونص الرسالة مطلوبان");
            return;
        }
        try {
            SmsManager manager = SmsManager.getDefault();
            ArrayList<String> parts = manager.divideMessage(message);
            if (parts.size() > 1) {
                manager.sendMultipartTextMessage(phone, null, parts, null, null);
            } else {
                manager.sendTextMessage(phone, null, message, null, null);
            }
            JSObject result = new JSObject();
            result.put("queued", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("تعذر إرسال SMS عبر شريحة الهاتف", error);
        }
    }
}
