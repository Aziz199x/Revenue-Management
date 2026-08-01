import { useEffect, useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { openSms } from "@/utils/sms";
import { showError, showSuccess } from "@/utils/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phones: string[];
  message: string;
}

export default function SmsPreview({ open, onOpenChange, phones, message }: Props) {
  const uniquePhones = Array.from(new Set(phones.filter(Boolean)));
  const [selectedPhones, setSelectedPhones] = useState(uniquePhones);
  const [editedMessage, setEditedMessage] = useState(message);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedPhones(uniquePhones);
    setEditedMessage(message);
    setCurrentIndex(0);
  }, [open, message, JSON.stringify(phones)]);

  const openCurrent = async () => {
    const currentPhone = selectedPhones[currentIndex];
    if (!currentPhone) {
      showError("اختر رقمًا واحدًا على الأقل");
      return;
    }
    setOpening(true);
    try {
      await openSms(currentPhone, editedMessage);
      if (currentIndex < selectedPhones.length - 1) {
        setCurrentIndex((index) => index + 1);
        showSuccess("عند العودة للتطبيق افتح الرسالة للرقم التالي");
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "تعذر فتح تطبيق الرسائل");
    } finally {
      setOpening(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader><DialogTitle className="text-right">إرسال رسالة SMS</DialogTitle></DialogHeader>
        <div className="space-y-3" dir="rtl">
          {uniquePhones.length > 1 && (
            <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-bold text-sky-800">اختر الأرقام</p>
              {uniquePhones.map((number) => (
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
            </div>
          )}
          <Textarea value={editedMessage} onChange={(event) => setEditedMessage(event.target.value)} className="min-h-40 rounded-2xl" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
              <X className="ml-1 h-4 w-4" /> إلغاء
            </Button>
            <Button className="flex-1 rounded-xl" disabled={opening || selectedPhones.length === 0} onClick={openCurrent}>
              <MessageSquareText className="ml-1 h-4 w-4" />
              {selectedPhones.length > 1 ? `فتح الرسائل (${currentIndex + 1}/${selectedPhones.length})` : "فتح الرسائل"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
