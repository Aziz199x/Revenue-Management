import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor } from "@capacitor/core";
import { validatePhone } from "@/utils/whatsapp";

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
