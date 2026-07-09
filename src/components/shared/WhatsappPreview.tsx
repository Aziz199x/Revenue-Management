import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openWhatsApp } from "@/utils/whatsapp";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  message: string;
  title?: string;
}

export default function WhatsappPreview({
  open,
  onOpenChange,
  phone,
  message,
  title,
}: Props) {
  const [editedMessage, setEditedMessage] = useState(message);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setEditedMessage(message);
  }, [open, message]);

  const handleSend = async () => {
    console.log('[WhatsApp] Preview send clicked');
    setSending(true);
    try {
      await openWhatsApp(phone, editedMessage);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر فتح واتساب.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] rounded-3xl dialog-safe">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right">
            {title || "معاينة الرسالة"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="rounded-2xl border border-border bg-muted px-4 py-2 text-[11px] text-muted-foreground">
            يمكنك تعديل الرسالة قبل إرسالها
          </p>
          <Textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            className="min-h-[160px] rounded-2xl"
            dir="rtl"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              <X className="ml-1 h-4 w-4" />
              إلغاء
            </Button>
            <Button
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSend}
              disabled={sending}
            >
              <MessageCircle className="ml-1 h-4 w-4" />
              {sending ? "جاري الفتح..." : "فتح واتساب"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
