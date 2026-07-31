import { Capacitor } from "@capacitor/core";
import { EvidenceAttachment, EvidenceAttachmentKind, EvidenceEntityType } from "@/data/types";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

function createId(): string {
  return `evidence-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(-80);
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

export async function saveEvidenceAttachment(
  file: File,
  input: {
    entityType: EvidenceEntityType;
    entityId: string;
    kind: EvidenceAttachmentKind;
    buildingId?: string;
    unitId?: string;
  },
): Promise<EvidenceAttachment> {
  if (file.size > MAX_FILE_SIZE) throw new Error("حجم الإثبات يجب ألا يتجاوز 8 ميجابايت");
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    throw new Error("يسمح فقط بملفات الصور أو PDF");
  }
  const id = createId();
  const base64 = await fileToBase64(file);
  const attachment: EvidenceAttachment = {
    id,
    ...input,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    createdAt: new Date().toISOString(),
  };
  if (Capacitor.isNativePlatform()) {
    const { Directory, Filesystem } = await import("@capacitor/filesystem");
    const storagePath = `evidence/${id}-${safeFileName(file.name)}`;
    await Filesystem.writeFile({
      path: storagePath,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
    return { ...attachment, storagePath };
  }
  return { ...attachment, dataUrl: `data:${file.type};base64,${base64}` };
}

export async function readEvidenceAttachment(attachment: EvidenceAttachment): Promise<string> {
  if (attachment.dataUrl) return attachment.dataUrl;
  if (!attachment.storagePath) throw new Error("ملف الإثبات غير موجود");
  const { Directory, Filesystem } = await import("@capacitor/filesystem");
  const result = await Filesystem.readFile({ path: attachment.storagePath, directory: Directory.Data });
  if (typeof result.data !== "string") throw new Error("تعذر قراءة ملف الإثبات");
  return `data:${attachment.fileType};base64,${result.data}`;
}

export async function deleteEvidenceFile(attachment: EvidenceAttachment): Promise<void> {
  if (!attachment.storagePath || !Capacitor.isNativePlatform()) return;
  try {
    const { Directory, Filesystem } = await import("@capacitor/filesystem");
    await Filesystem.deleteFile({ path: attachment.storagePath, directory: Directory.Data });
  } catch (error) {
    console.warn("[Evidence] file cleanup failed", error);
  }
}

