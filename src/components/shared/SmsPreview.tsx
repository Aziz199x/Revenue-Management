import { useEffect, useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { openSms, requestAutomaticSmsPermission, sendAutomaticSms } from "@/utils/sms";
import { validatePhone } from "@/utils/whatsapp";
import { showError, showSuccess } from "@/utils/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phones: string[];
  message: string;
}

export default function SmsPreview({ open, onOpenChange, phones, message }: Props) {
  // Different raw formats of the same number (e.g. "053 882 4240" and
  // "966538824240") must collapse to a single entry — dedupe by the
  // normalized identity, not the raw string.
  const uniquePhones = (() => {
    const seenNormalized = new Set<string>();
    const result: string[] = [];
    for (const candidate of phones.filter(Boolean)) {
      const key = validatePhone(candidate) ?? candidate.trim();
      if (seenNormalized.has(key)) continue;
      seenNormalized.add(key);
      result.push(candidate);
    }
    return result;
  })();
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

  const sendDirect = async () => {
    if (selectedPhones.length === 0) {
      showError("اختر رقمًا واحدًا على الأقل");
      return;
    }
    setOpening(true);
    try {
      const granted = await requestAutomaticSmsPermission();
      if (!granted) throw new Error("يلزم السماح للتطبيق بإرسال رسائل SMS");
      for (const phone of selectedPhones) {
        await sendAutomaticSms(phone, editedMessage);
      }
      showSuccess(`أكدت شريحة الهاتف إرسال ${selectedPhones.length} رسالة بنجاح`);
      onOpenChange(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : "فشل إرسال SMS؛ تحقق من الرصيد والشبكة");
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
          {Capacitor.isNativePlatform() && (
            <p className="rounded-xl border border-violet-200 bg-violet-50 p-2 text-[11px] leading-5 text-violet-800">
              الإرسال المباشر ينتظر تأكيد شريحة الهاتف، ويعرض فشل الشبكة أو الرصيد بدل تسجيل الرسالة كناجحة. لا يضمن ذلك قراءة المستلم للرسالة.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
              <X className="ml-1 h-4 w-4" /> إلغاء
            </Button>
            <Button className="flex-1 rounded-xl" disabled={opening || selectedPhones.length === 0} onClick={Capacitor.isNativePlatform() ? sendDirect : openCurrent}>
              <MessageSquareText className="ml-1 h-4 w-4" />
              {Capacitor.isNativePlatform()
                ? (selectedPhones.length > 1 ? `إرسال مباشر (${selectedPhones.length})` : "إرسال مباشر")
                : (selectedPhones.length > 1 ? `فتح الرسائل (${currentIndex + 1}/${selectedPhones.length})` : "فتح الرسائل")}
            </Button>
          </div>
          {Capacitor.isNativePlatform() && (
            <Button variant="outline" className="w-full rounded-xl" disabled={opening || selectedPhones.length === 0} onClick={openCurrent}>
              فتح الرسالة في تطبيق SMS للتعديل والإرسال اليدوي
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
