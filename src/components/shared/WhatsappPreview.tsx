import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  phone?: string;
  phones?: string[];
  message: string;
  title?: string;
}

export default function WhatsappPreview({
  open,
  onOpenChange,
  phone,
  phones,
  message,
  title,
}: Props) {
  const [editedMessage, setEditedMessage] = useState(message);
  const [sending, setSending] = useState(false);
  const availablePhones = Array.from(new Set([...(phones || []), ...(phone ? [phone] : [])].filter(Boolean)));
  const [selectedPhones, setSelectedPhones] = useState<string[]>(availablePhones);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setEditedMessage(message);
      setSelectedPhones(availablePhones);
      setCurrentIndex(0);
    }
  }, [open, message, phone, JSON.stringify(phones)]);

  const handleSend = async () => {
    console.log('[WhatsApp] Preview send clicked');
    setSending(true);
    try {
      const currentPhone = selectedPhones[currentIndex];
      if (!currentPhone) throw new Error("اختر رقمًا واحدًا على الأقل");
      await openWhatsApp(currentPhone, editedMessage);
      if (currentIndex < selectedPhones.length - 1) {
        setCurrentIndex((index) => index + 1);
        toast.success("عند العودة للتطبيق افتح الرسالة للرقم التالي");
      } else {
        onOpenChange(false);
      }
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
          {availablePhones.length > 1 && (
            <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-bold text-emerald-800">اختر أرقام واتساب المراد الإرسال إليها</p>
              {availablePhones.map((number) => (
                <label key={number} className="flex items-center justify-between gap-3 text-xs">
                  <span dir="ltr">{number}</span>
                  <Checkbox
                    checked={selectedPhones.includes(number)}
                    onCheckedChange={(checked) => {
                      setSelectedPhones((current) => checked
                        ? Array.from(new Set([...current, number]))
                        : current.filter((item) => item !== number));
                      setCurrentIndex(0);
                    }}
                  />
                </label>
              ))}
              <p className="text-[10px] text-muted-foreground">يفتح واتساب لكل رقم بالتتابع؛ ارجع للتطبيق بعد كل إرسال للانتقال للرقم التالي.</p>
            </div>
          )}
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
              disabled={sending || selectedPhones.length === 0}
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
              {sending
                ? "جاري الفتح..."
                : selectedPhones.length > 1
                ? `فتح واتساب (${Math.min(currentIndex + 1, selectedPhones.length)}/${selectedPhones.length})`
                : "فتح واتساب"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
