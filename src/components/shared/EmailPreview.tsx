import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendGmailEmail, sendOutlookEmail } from "@/utils/communicationAccounts";
import { showError, showSuccess } from "@/utils/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: string[];
  subject: string;
  body: string;
  provider: "gmail" | "outlook" | null;
  title?: string;
  onSent?: (recipients: string[]) => void;
}

export default function EmailPreview({
  open,
  onOpenChange,
  recipients,
  subject,
  body,
  provider,
  title = "إرسال بريد للمستأجر",
  onSent,
}: Props) {
  const [editedSubject, setEditedSubject] = useState(subject);
  const [editedBody, setEditedBody] = useState(body);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEditedSubject(subject);
    setEditedBody(body);
  }, [open, subject, body]);

  const send = async () => {
    if (!provider) {
      showError("اربط حساب Gmail أو Outlook من إعدادات الإرسال التلقائي أولًا");
      return;
    }
    setSending(true);
    try {
      for (const recipient of recipients) {
        if (provider === "gmail") {
          await sendGmailEmail(recipient, editedSubject, editedBody);
        } else {
          await sendOutlookEmail(recipient, editedSubject, editedBody);
        }
      }
      onSent?.(recipients);
      showSuccess(`تم إرسال البريد إلى ${recipients.length} عنوان`);
      onOpenChange(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : "تعذر إرسال البريد");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-end gap-2 text-right">
            {title}
            <Mail className="h-5 w-5 text-primary" />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-right" dir="rtl">
          <div>
            <Label>إلى</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {recipients.map((recipient) => (
                <span key={recipient} dir="ltr" className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {recipient}
                </span>
              ))}
            </div>
          </div>
          <div>
            <Label>الموضوع</Label>
            <Input value={editedSubject} onChange={(event) => setEditedSubject(event.target.value)} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label>نص الرسالة</Label>
            <Textarea value={editedBody} onChange={(event) => setEditedBody(event.target.value)} className="mt-1 min-h-56 rounded-xl leading-7" />
          </div>
          <Button className="w-full rounded-xl" disabled={sending || recipients.length === 0} onClick={send}>
            <Send className="ml-2 h-4 w-4" />
            {sending ? "جاري الإرسال..." : `إرسال عبر ${provider === "outlook" ? "Outlook" : "Gmail"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
