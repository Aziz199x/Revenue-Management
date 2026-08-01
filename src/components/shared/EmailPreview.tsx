import { useEffect, useState } from "react";
import { ExternalLink, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EmailProviderError,
  openEmailComposer,
  openExternalUrl,
  sendGmailEmail,
  sendOutlookEmail,
} from "@/utils/communicationAccounts";
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
  const [sendError, setSendError] = useState<EmailProviderError | null>(null);

  useEffect(() => {
    if (!open) return;
    setEditedSubject(subject);
    setEditedBody(body);
    setSendError(null);
  }, [open, subject, body]);

  const send = async () => {
    if (!provider) {
      showError("اربط حساب Gmail أو Outlook من إعدادات الإرسال التلقائي أولًا");
      return;
    }
    setSending(true);
    setSendError(null);
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
      const providerError = error instanceof EmailProviderError
        ? error
        : new EmailProviderError(
            error instanceof Error ? error.message : "تعذر إرسال البريد",
            "email_send_failed",
          );
      setSendError(providerError);
      showError(providerError.message);
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
          {sendError && (
            <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
              <p className="font-bold">تعذر الإرسال المباشر</p>
              <p>{sendError.message}</p>
              {sendError.helpUrl && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl border-amber-300 bg-white"
                  onClick={() => openExternalUrl(sendError.helpUrl!).catch((error) => showError(error instanceof Error ? error.message : "تعذر فتح إعداد Google"))}
                >
                  <ExternalLink className="ml-2 h-4 w-4" />
                  فتح صفحة تفعيل Gmail API
                </Button>
              )}
            </div>
          )}
          <Button className="w-full rounded-xl" disabled={sending || recipients.length === 0} onClick={send}>
            <Send className="ml-2 h-4 w-4" />
            {sending ? "جاري الإرسال..." : `إرسال عبر ${provider === "outlook" ? "Outlook" : "Gmail"}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            disabled={sending || recipients.length === 0}
            onClick={() => openEmailComposer(recipients, editedSubject, editedBody)
              .catch((error) => showError(error instanceof Error ? error.message : "تعذر فتح تطبيق البريد"))}
          >
            <Mail className="ml-2 h-4 w-4" />
            فتح الرسالة في تطبيق البريد
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
