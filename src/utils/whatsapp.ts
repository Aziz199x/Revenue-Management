<<<<<<< HEAD
import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';

function normalizeSaudiPhone(phone: string): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/[^\d]/g, '');

  if (cleaned.startsWith('00966')) {
    cleaned = cleaned.substring(2);
  }

  if (cleaned.startsWith('96605')) {
    cleaned = '966' + cleaned.substring(4);
  } else if (cleaned.startsWith('05')) {
    cleaned = '966' + cleaned.substring(1);
  } else if (cleaned.startsWith('5')) {
    cleaned = '966' + cleaned;
  } else if (cleaned.startsWith('9665')) {
  } else {
    return null;
  }

  if (!/^9665\d{8}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export function validatePhone(phone?: string): string | null {
  if (!phone || !phone.trim()) return null;
  return normalizeSaudiPhone(phone);
}

export async function openWhatsApp(phone: string, message: string) {
  const normalizedPhone = normalizeSaudiPhone(phone);

  console.log('[WhatsApp] Original phone:', phone);
  console.log('[WhatsApp] Normalized phone:', normalizedPhone);

  if (!normalizedPhone) {
    throw new Error('رقم الجوال غير صحيح أو غير موجود');
  }

  const encodedMessage = encodeURIComponent(message || '');
  const url = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;

  console.log('[WhatsApp] URL:', url);
  console.log('[WhatsApp] Native platform:', Capacitor.isNativePlatform());

  try {
    if (Capacitor.isNativePlatform()) {
      await AppLauncher.openUrl({ url });
    } else {
      window.open(url, '_blank');
    }
  } catch (error) {
    console.error('[WhatsApp] AppLauncher failed:', error);

    try {
      window.location.href = url;
    } catch {
      console.error('[WhatsApp] fallback failed');
      throw new Error('تعذر فتح واتساب. تأكد من تثبيت واتساب وصحة رقم الجوال');
    }
  }
}

export function fillTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value ?? "");
  }
  return result;
}

export function getDefaultPaymentMessage(
  tenantName?: string,
  buildingName?: string,
  unitName?: string,
  amount?: number,
  dueDate?: string,
): string {
  const lines = [
    `السلام عليكم`,
    tenantName ? `عزيزي/عزيزتي ${tenantName}،` : "",
    `نود تذكيركم بأن موعد سداد الإيجار للوحدة ${unitName || ""} في عقار ${buildingName || ""} قد حلّ.`,
    amount !== undefined ? `المبلغ المستحق: ${amount.toLocaleString("ar-SA")} ر.س.` : "",
    dueDate ? `موعد السداد: ${dueDate}` : "",
    "نأمل سرعة السداد، وشكرًا لكم.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function getPaymentReminderMessage(
  unitName?: string,
  buildingName?: string,
  amount?: number,
  dueDate?: string,
): string {
  const amountStr = amount !== undefined ? amount.toLocaleString("ar-SA") : "";
  return `السلام عليكم، نود تذكيركم بأن دفعة الإيجار للوحدة ${unitName || ""} في عقار ${buildingName || ""} بمبلغ ${amountStr} ر.س، وموعد السداد ${dueDate || ""}. نأمل سرعة السداد، وشكرًا لكم.`;
}

export function getOverdueReminderMessage(
  unitName?: string,
  buildingName?: string,
  amount?: number,
  dueDate?: string,
): string {
  const amountStr = amount !== undefined ? amount.toLocaleString("ar-SA") : "";
  return `السلام عليكم، نود إفادتكم بأن دفعة الإيجار للوحدة ${unitName || ""} في عقار ${buildingName || ""} بمبلغ ${amountStr} ر.س، وموعد السداد كان بتاريخ ${dueDate || ""}، ولم يتم تسجيل سدادها حتى الآن. نأمل سرعة السداد، وشكرًا لكم.`;
}

export function buildPaymentReminderMessage(params: {
  tenantName?: string;
  buildingName?: string;
  unitName?: string;
  amount: string;
  dueDate?: string;
  isOverdue?: boolean;
}): string {
  const { unitName, buildingName, amount, dueDate, isOverdue } = params;
  if (isOverdue) {
    return `السلام عليكم، نود إفادتكم بأن دفعة الإيجار للوحدة ${unitName || ""} في عقار ${buildingName || ""} بمبلغ ${amount}، وموعد السداد كان بتاريخ ${dueDate || ""}، ولم يتم تسجيل سدادها حتى الآن. نأمل سرعة السداد، وشكرًا لكم.`;
  }
  return `السلام عليكم، نود تذكيركم بأن دفعة الإيجار للوحدة ${unitName || ""} في عقار ${buildingName || ""} بمبلغ ${amount}، وموعد السداد ${dueDate || ""}. نأمل سرعة السداد، وشكرًا لكم.`;
}

export function getDefaultOverdueMessage(
  tenantName?: string,
  buildingName?: string,
  unitName?: string,
  amount?: number,
  dueDate?: string,
): string {
  const lines = [
    `السلام عليكم`,
    tenantName ? `عزيزي/عزيزتي ${tenantName}،` : "",
    `نود إفادتكم بأن دفعة الإيجار للوحدة ${unitName || ""} في عقار ${buildingName || ""} لم يتم تسجيل سدادها حتى الآن.`,
    amount !== undefined ? `المبلغ المستحق: ${amount.toLocaleString("ar-SA")} ر.س.` : "",
    dueDate ? `موعد السداد: ${dueDate}` : "",
    "نأمل سرعة السداد، وشكرًا لكم.",
  ];
  return lines.filter(Boolean).join("\n");
=======
export interface WhatsappMessageData {
  tenantName?: string;
  phone?: string;
  unitName?: string;
  buildingName?: string;
  amount?: number;
  dueDate?: string;
  status?: string;
}

export function buildWhatsappMessage(data: WhatsappMessageData): string {
  const lines: string[] = [];
  if (data.tenantName) lines.push(`السلام عليكم ${data.tenantName}`);
  if (data.unitName || data.buildingName)
    lines.push(`الوحدة: ${data.unitName ?? ""} - ${data.buildingName ?? ""}`.trim());
  if (data.amount) lines.push(`المبلغ المستحق: ${data.amount.toLocaleString("ar-SA")} ر.س`);
  if (data.dueDate) lines.push(`تاريخ الاستحقاق: ${data.dueDate}`);
  if (data.status) lines.push(`الحالة: ${data.status}`);
  lines.push("شكراً لكم");
  return lines.join("\n");
}

export function sendWhatsapp(phone: string | undefined, message: string, useBusiness: boolean) {
  const cleanPhone = (phone || "").replace(/[^0-9]/g, "");
  const base = useBusiness ? "https://api.whatsapp.com/send" : "https://wa.me/";
  if (cleanPhone) {
    const url = useBusiness
      ? `${base}?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `${base}${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  } else {
    const url = `${base}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
}
