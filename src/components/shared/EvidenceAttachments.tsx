import { useRef, useState } from "react";
import { Eye, FilePlus2, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/data/store";
import { EvidenceAttachment, EvidenceAttachmentKind, EvidenceEntityType } from "@/data/types";
import {
  deleteEvidenceFile,
  readEvidenceAttachment,
  saveEvidenceAttachment,
} from "@/utils/evidenceAttachments";
import { showError, showSuccess } from "@/utils/toast";

const kindLabels: Record<EvidenceAttachmentKind, string> = {
  payment_receipt: "إثبات الاستلام",
  owner_transfer: "إثبات التحويل",
  maintenance_invoice: "فاتورة الصيانة",
  contract: "نسخة العقد",
  clearance: "المخالصة",
};

interface Props {
  entityType: EvidenceEntityType;
  entityId: string;
  kind: EvidenceAttachmentKind;
  buildingId?: string;
  unitId?: string;
  compact?: boolean;
}

export default function EvidenceAttachments({
  entityType,
  entityId,
  kind,
  buildingId,
  unitId,
  compact = false,
}: Props) {
  const { data, update } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState<{ attachment: EvidenceAttachment; url: string } | null>(null);
  const attachments = data.evidenceAttachments.filter(
    (attachment) => attachment.entityType === entityType
      && attachment.entityId === entityId
      && attachment.kind === kind,
  );

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setSaving(true);
    try {
      const added: EvidenceAttachment[] = [];
      for (const file of Array.from(files)) {
        added.push(await saveEvidenceAttachment(file, {
          entityType,
          entityId,
          kind,
          buildingId,
          unitId,
        }));
      }
      await update((previous) => ({
        ...previous,
        evidenceAttachments: [...previous.evidenceAttachments, ...added],
      }), { suppressAudit: true });
      showSuccess(`تم حفظ ${added.length} إثبات`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "تعذر حفظ الإثبات");
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const view = async (attachment: EvidenceAttachment) => {
    try {
      const url = await readEvidenceAttachment(attachment);
      // Android's embedded WebView has no built-in PDF renderer, so an
      // <iframe> for a PDF data URL just shows a blank page. Hand the file
      // to the system's own PDF viewer / share sheet instead, which can
      // always open it.
      if (attachment.fileType === "application/pdf" && Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const base64 = url.split(",")[1] ?? "";
        const safeName = attachment.fileName.replace(/[\\/:*?"<>|]/g, "-");
        const result = await Filesystem.writeFile({
          path: `evidence-view/${attachment.id}-${safeName}`,
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        });
        await Share.share({ title: attachment.fileName, url: result.uri, dialogTitle: "فتح المستند" });
        return;
      }
      setViewer({ attachment, url });
    } catch (error) {
      showError(error instanceof Error ? error.message : "تعذر عرض الإثبات");
    }
  };

  const remove = async (attachment: EvidenceAttachment) => {
    await deleteEvidenceFile(attachment);
    await update((previous) => ({
      ...previous,
      evidenceAttachments: previous.evidenceAttachments.filter((item) => item.id !== attachment.id),
    }), { suppressAudit: true });
    showSuccess("تم حذف الإثبات");
  };

  return (
    <div className={`min-w-0 ${compact ? "space-y-1.5" : "space-y-2 rounded-2xl border border-border bg-muted/30 p-3"}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => void addFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`rounded-full text-[10px] ${compact ? "h-8" : "w-full"}`}
        disabled={saving}
        onClick={() => inputRef.current?.click()}
      >
        {saving ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="ml-1 h-3.5 w-3.5" />}
        {kindLabels[kind]}{attachments.length ? ` (${attachments.length})` : ""}
      </Button>
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex min-w-0 items-center gap-1 rounded-xl bg-card px-2 py-1.5 text-[10px]">
          <Paperclip className="h-3 w-3 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate" title={attachment.fileName}>{attachment.fileName}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => void view(attachment)} aria-label="عرض الإثبات">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => void remove(attachment)} aria-label="حذف الإثبات">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Dialog open={!!viewer} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogContent className="max-h-[88vh] max-w-[94vw] overflow-y-auto rounded-3xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-right">{viewer?.attachment.fileName}</DialogTitle>
          </DialogHeader>
          {viewer?.attachment.fileType === "application/pdf" ? (
            <iframe title="عرض ملف الإثبات" src={viewer.url} className="h-[70vh] w-full rounded-2xl border" />
          ) : viewer ? (
            <img src={viewer.url} alt={viewer.attachment.fileName} className="mx-auto max-h-[70vh] rounded-2xl object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
