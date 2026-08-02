import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { validatePhone } from "@/utils/whatsapp";

interface SmsSenderNativePlugin {
  getStatus(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  send(options: { phone: string; message: string; requestId: string }): Promise<SmsSendResult>;
  addListener(
    eventName: "smsStatusChanged",
    listener: (event: SmsStatusUpdate) => void,
  ): Promise<PluginListenerHandle>;
}

export interface SmsSendResult {
  queued: boolean;
  requestId: string;
}

export interface SmsStatusUpdate {
  requestId: string;
  status: "sent" | "failed";
  assumed?: boolean;
  updatedAt?: number;
  error?: string;
}

const SmsSender = registerPlugin<SmsSenderNativePlugin>("SmsSender");

export async function getAutomaticSmsPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await SmsSender.getStatus()).granted;
}

export async function requestAutomaticSmsPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await SmsSender.requestPermission()).granted;
}

export async function sendAutomaticSms(phone: string, message: string, requestId?: string): Promise<SmsSendResult> {
  const normalized = validatePhone(phone);
  if (!normalized) throw new Error("رقم الجوال غير صحيح أو غير موجود");
  if (!Capacitor.isNativePlatform()) throw new Error("الإرسال التلقائي عبر SMS متاح على تطبيق Android فقط");
  const permission = await getAutomaticSmsPermission();
  if (!permission) throw new Error("يلزم السماح للتطبيق بإرسال رسائل SMS");
  const resolvedRequestId = requestId || `manual-sms-${Date.now().toString(36)}`;
  return SmsSender.send({ phone: `+${normalized}`, message, requestId: resolvedRequestId });
}

export async function addAutomaticSmsStatusListener(
  listener: (event: SmsStatusUpdate) => void,
): Promise<PluginListenerHandle | undefined> {
  if (!Capacitor.isNativePlatform()) return undefined;
  return SmsSender.addListener("smsStatusChanged", listener);
}

export async function openSms(phone: string, message: string): Promise<void> {
  const normalized = validatePhone(phone);
  if (!normalized) throw new Error("رقم الجوال غير صحيح أو غير موجود");
  const url = `sms:+${normalized}?body=${encodeURIComponent(message || "")}`;
  if (Capacitor.isNativePlatform()) {
    const result = await AppLauncher.openUrl({ url });
    if (!result.completed) throw new Error("تعذر فتح تطبيق الرسائل");
  } else {
    window.location.href = url;
  }
}
