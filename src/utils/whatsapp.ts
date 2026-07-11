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
}
