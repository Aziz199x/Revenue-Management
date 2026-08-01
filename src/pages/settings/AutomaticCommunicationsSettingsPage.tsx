import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Mail, MessageCircle, Play, Trash2, Unplug } from "lucide-react";
import SettingsSubPageHeader from "@/components/settings/SettingsSubPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/data/store";
import {
  connectGmail,
  connectOutlook,
  disconnectOutlook,
  disconnectWhatsAppBusiness,
  getGmailAccountStatus,
  getOutlookAccount,
  getWhatsAppBusinessAccount,
  saveWhatsAppBusinessAccount,
} from "@/utils/communicationAccounts";
import { runAutomaticCommunicationCycle } from "@/utils/automaticCommunications";
import { showError, showSuccess } from "@/utils/toast";

function formatLogDate(value?: string): string {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function communicationLogDateKey(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : localDateKey(parsed);
}

export default function AutomaticCommunicationsSettingsPage() {
  const { data, update } = useStore();
  const settings = data.settings.automaticCommunications;
  const [gmailStatus, setGmailStatus] = useState(getGmailAccountStatus());
  const gmailEmail = gmailStatus.email;
  const [outlook, setOutlook] = useState(getOutlookAccount());
  const [outlookClientId, setOutlookClientId] = useState(outlook?.clientId || "");
  const existingWhatsapp = getWhatsAppBusinessAccount();
  const [waPhoneId, setWaPhoneId] = useState(existingWhatsapp?.phoneNumberId || "");
  const [waToken, setWaToken] = useState("");
  const [waVersion, setWaVersion] = useState(existingWhatsapp?.graphVersion || "v23.0");
  const [waLanguage, setWaLanguage] = useState(existingWhatsapp?.languageCode || "ar");
  const [waPaymentTemplate, setWaPaymentTemplate] = useState(existingWhatsapp?.paymentTemplate || "rent_payment_reminder");
  const [waOverdueTemplate, setWaOverdueTemplate] = useState(existingWhatsapp?.overdueTemplate || "overdue_rent_reminder");
  const [waContractTemplate, setWaContractTemplate] = useState(existingWhatsapp?.contractTemplate || "contract_expiry_reminder");
  const [connecting, setConnecting] = useState<"gmail" | "outlook" | null>(null);
  const [running, setRunning] = useState(false);
  const [savedWhatsapp, setSavedWhatsapp] = useState(!!existingWhatsapp?.configured);
  const today = localDateKey(new Date());
  const [logFilter, setLogFilter] = useState<"all" | "month" | "day">("month");
  const [logMonth, setLogMonth] = useState(today.slice(0, 7));
  const [logDay, setLogDay] = useState(today);

  const filteredLogs = useMemo(
    () => [...(data.communicationLogs || [])]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((log) => {
        const date = communicationLogDateKey(log.createdAt);
        if (logFilter === "day") return date === logDay;
        if (logFilter === "month") return date.startsWith(logMonth);
        return true;
      }),
    [data.communicationLogs, logDay, logFilter, logMonth],
  );
  const visibleLogs = filteredLogs.slice(0, 100);

  const updateSchedule = (patch: Partial<typeof settings>) => {
    update((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        automaticCommunications: {
          ...previous.settings.automaticCommunications,
          ...patch,
        },
      },
    }));
  };

  const deleteCommunicationLogs = async (
    selectedLogs: typeof filteredLogs,
    description: string,
  ) => {
    const repeatProtectionMs = Math.max(1, Number(settings.frequencyDays) || 1) * 86_400_000;
    const now = Date.now();
    const deletable = selectedLogs.filter((log) =>
      log.status !== "sent" || now - new Date(log.createdAt).getTime() >= repeatProtectionMs
    );
    const protectedCount = selectedLogs.length - deletable.length;
    if (deletable.length === 0) {
      showError("لا يمكن حذف الرسائل الناجحة الحديثة حتى تنتهي مدة الحماية من تكرار الإرسال");
      return;
    }
    const protectionNote = protectedCount
      ? `\nسيتم الاحتفاظ بـ ${protectedCount} سجل ناجح حديث مؤقتًا لمنع إرسال الرسالة مرتين.`
      : "";
    if (!window.confirm(`حذف ${deletable.length} سجل من ${description}؟${protectionNote}\nلا يمكن التراجع عن الحذف.`)) return;
    const ids = new Set(deletable.map((log) => log.id));
    await update((previous) => ({
      ...previous,
      communicationLogs: (previous.communicationLogs || []).filter((log) => !ids.has(log.id)),
    }));
    showSuccess(`تم حذف ${deletable.length} سجل وتقليل البيانات المحفوظة`);
  };

  const runNow = async () => {
    if (!settings.enabled) {
      showError("فعّل الإرسال التلقائي أولًا");
      return;
    }
    setRunning(true);
    try {
      const logs = await runAutomaticCommunicationCycle(data, new Date(), true);
      if (logs.length > 0) {
        await update((previous) => ({
          ...previous,
          communicationLogs: [...(previous.communicationLogs || []), ...logs].slice(-2000),
          settings: {
            ...previous.settings,
            automaticCommunications: {
              ...previous.settings.automaticCommunications,
              lastRunAt: new Date().toISOString(),
            },
          },
        }));
      }
      const sent = logs.filter((log) => log.status === "sent").length;
      const failed = logs.filter((log) => log.status === "failed").length;
      const latestGmailStatus = getGmailAccountStatus();
      setGmailStatus(latestGmailStatus);
      if (settings.emailProvider === "gmail" && latestGmailStatus.state !== "connected") {
        await update((previous) => ({
          ...previous,
          settings: {
            ...previous.settings,
            automaticCommunications: {
              ...previous.settings.automaticCommunications,
              emailProvider: null,
            },
          },
        }));
      }
      if (failed > 0) {
        showError(`اكتملت الدورة: ${sent} ناجحة، ${failed} فاشلة. يمكنك إعادة المحاولة فورًا بعد معالجة سبب الفشل.`);
      } else {
        showSuccess(logs.length ? `اكتملت الدورة: ${sent} ناجحة` : "لا توجد رسائل مستحقة للإرسال الآن");
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "تعذر تشغيل دورة الإرسال");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <SettingsSubPageHeader title="الإرسال التلقائي" subtitle="جدولة البريد وWhatsApp Business وتوثيق النتائج" />
      <div className="space-y-4 p-4">
        <section className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">تفعيل جدول الإرسال</p>
              <p className="mt-1 text-xs text-muted-foreground">يفحص الدفعات عند فتح التطبيق واستئنافه، ثم يرسل الرسائل المستحقة دون تكرار.</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(enabled) => updateSchedule({ enabled })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted p-3">
              <div className="flex items-center justify-between">
                <Label>البريد الإلكتروني</Label>
                <Switch checked={settings.emailEnabled} onCheckedChange={(emailEnabled) => updateSchedule({ emailEnabled })} />
              </div>
            </div>
            <div className="rounded-2xl bg-muted p-3">
              <div className="flex items-center justify-between">
                <Label>واتساب التلقائي عبر Business API</Label>
                <Switch checked={settings.whatsappEnabled} onCheckedChange={(whatsappEnabled) => updateSchedule({ whatsappEnabled })} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>التكرار</Label>
              <Select value={String(settings.frequencyDays)} onValueChange={(value) => updateSchedule({ frequencyDays: Number(value) })}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">كل يوم</SelectItem>
                  <SelectItem value="2">كل يومين</SelectItem>
                  <SelectItem value="3">كل 3 أيام</SelectItem>
                  <SelectItem value="7">أسبوعيًا</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>وقت الإرسال</Label>
              <Input type="time" value={settings.sendTime} onChange={(event) => updateSchedule({ sendTime: event.target.value })} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>قبل الاستحقاق بعدد أيام</Label>
              <Input type="number" min={0} max={30} value={settings.daysBeforeDue} onChange={(event) => updateSchedule({ daysBeforeDue: Number(event.target.value) })} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>استمرار المتأخرات لمدة</Label>
              <Input type="number" min={1} max={365} value={settings.overdueTailDays} onChange={(event) => updateSchedule({ overdueTailDays: Number(event.target.value) })} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>بدء الجدول من</Label>
              <Input type="date" value={settings.activeFrom || ""} onChange={(event) => updateSchedule({ activeFrom: event.target.value || undefined })} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>انتهاء الجدول في</Label>
              <Input type="date" value={settings.activeUntil || ""} onChange={(event) => updateSchedule({ activeUntil: event.target.value || undefined })} className="mt-1 rounded-xl" />
            </div>
          </div>

          <Button className="w-full rounded-xl" disabled={running} onClick={runNow}>
            <Play className="ml-1 h-4 w-4" /> {running ? "جاري فحص وإرسال الرسائل..." : "فحص المستحق وإرساله الآن"}
          </Button>
          <p className="text-[10px] leading-5 text-muted-foreground">
            الإرسال المحلي يعمل عند تشغيل التطبيق أو عودته للواجهة. الاستمرار أثناء إغلاق الهاتف بالكامل يحتاج لاحقًا خادم جدولة سحابي.
          </p>
        </section>

        <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /><p className="font-bold">حساب إرسال البريد</p></div>
          <div className={`rounded-2xl border p-3 ${
            gmailStatus.state === "connected"
              ? "border-emerald-200 bg-emerald-50/50"
              : gmailStatus.state === "expired"
              ? "border-amber-200 bg-amber-50/50"
              : "border-border"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold">Gmail</p>
                {gmailStatus.state === "connected" && gmailEmail ? (
                  <>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">{gmailEmail}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {settings.emailProvider === "gmail" ? "متصل ومحدد للإرسال" : "حساب متصل"}
                    </span>
                  </>
                ) : gmailStatus.state === "expired" ? (
                  <>
                    {gmailEmail && <p className="truncate text-xs text-muted-foreground" dir="ltr">{gmailEmail}</p>}
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      انتهت الجلسة — أعد ربط الحساب
                    </span>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-muted-foreground">لا يوجد حساب Gmail متصل</p>
                )}
              </div>
              <Button
                size="sm"
                variant={gmailStatus.state === "connected" ? "outline" : "default"}
                className="rounded-xl"
                disabled={connecting !== null}
                onClick={async () => {
                  setConnecting("gmail");
                  try {
                    const email = await connectGmail();
                    setGmailStatus({ email, state: "connected" });
                    updateSchedule({ emailProvider: "gmail", emailEnabled: true });
                    showSuccess(`تم ربط Gmail: ${email}`);
                  } catch (error) {
                    showError(error instanceof Error ? error.message : "تعذر ربط Gmail");
                  } finally {
                    setConnecting(null);
                  }
                }}
              >
                {gmailStatus.state === "connected" ? "إعادة ربط الحساب" : gmailStatus.state === "expired" ? "تجديد تسجيل الدخول" : "ربط Gmail"}
              </Button>
            </div>
          </div>
          <div className="space-y-2 rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">Outlook / Microsoft 365</p>
                <p className="text-xs text-muted-foreground">{outlook?.email || "غير مرتبط"}</p>
              </div>
              {outlook && (
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                  disconnectOutlook();
                  setOutlook(null);
                  if (settings.emailProvider === "outlook") updateSchedule({ emailProvider: null });
                }}><Unplug className="h-4 w-4" /></Button>
              )}
            </div>
            <div>
              <Label className="text-xs">Microsoft Application (Client) ID</Label>
              <Input dir="ltr" value={outlookClientId} onChange={(event) => setOutlookClientId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="mt-1 rounded-xl text-left" />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                في إعدادات تطبيق Microsoft أضف عنوان الرجوع
                <span dir="ltr" className="mx-1 inline-block font-mono">revenuemanagement://oauth/callback</span>
                وفعّل صلاحيات User.Read وMail.Send مع PKCE.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              disabled={connecting !== null}
              onClick={async () => {
                setConnecting("outlook");
                try {
                  const email = await connectOutlook(outlookClientId);
                  setOutlook(getOutlookAccount());
                  updateSchedule({ emailProvider: "outlook", emailEnabled: true });
                  showSuccess(`تم ربط Outlook: ${email}`);
                } catch (error) {
                  showError(error instanceof Error ? error.message : "تعذر ربط Outlook");
                } finally {
                  setConnecting(null);
                }
              }}
            >
              ربط Outlook
            </Button>
          </div>
          <Select
            value={settings.emailProvider === "gmail" && gmailStatus.state !== "connected" ? "none" : settings.emailProvider || "none"}
            onValueChange={(value) => updateSchedule({ emailProvider: value === "none" ? null : value as "gmail" | "outlook" })}
          >
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="حساب الإرسال الافتراضي" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">لا يوجد حساب افتراضي</SelectItem>
              {gmailStatus.state === "connected" && gmailEmail && <SelectItem value="gmail">Gmail · {gmailEmail}</SelectItem>}
              {outlook?.email && <SelectItem value="outlook">Outlook · {outlook.email}</SelectItem>}
            </SelectContent>
          </Select>
        </section>

        <section className="space-y-3 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emerald-700" /><p className="font-bold">WhatsApp Business Platform</p></div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
            واتساب العادي يتيح للتطبيق تجهيز الرسالة وفتحها فقط، ويجب على المستخدم الضغط على إرسال. الإرسال التلقائي الكامل متاح رسميًا من خلال WhatsApp Business API.
          </p>
          <p className="text-xs leading-5 text-muted-foreground">يتطلب رقم WhatsApp Business API وقالبين معتمدين يحتوي كل منهما على متغير نصي واحد للرسالة.</p>
          <Input dir="ltr" value={waPhoneId} onChange={(event) => setWaPhoneId(event.target.value)} placeholder="Phone Number ID" className="rounded-xl text-left" />
          <Input type="password" dir="ltr" value={waToken} onChange={(event) => setWaToken(event.target.value)} placeholder={savedWhatsapp ? "اتركه فارغًا للاحتفاظ بالرمز الحالي" : "Permanent Access Token"} className="rounded-xl text-left" />
          <div className="grid grid-cols-2 gap-2">
            <Input dir="ltr" value={waPaymentTemplate} onChange={(event) => setWaPaymentTemplate(event.target.value)} placeholder="قالب التذكير" className="rounded-xl text-left" />
            <Input dir="ltr" value={waOverdueTemplate} onChange={(event) => setWaOverdueTemplate(event.target.value)} placeholder="قالب التأخير" className="rounded-xl text-left" />
            <Input dir="ltr" value={waContractTemplate} onChange={(event) => setWaContractTemplate(event.target.value)} placeholder="قالب انتهاء العقد" className="rounded-xl text-left" />
            <Input dir="ltr" value={waLanguage} onChange={(event) => setWaLanguage(event.target.value)} placeholder="ar" className="rounded-xl text-left" />
            <Input dir="ltr" value={waVersion} onChange={(event) => setWaVersion(event.target.value)} placeholder="Graph API version" className="rounded-xl text-left" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button className="rounded-xl" onClick={() => {
              if (!waPhoneId.trim() || (!waToken.trim() && !savedWhatsapp)) {
                showError("أدخل Phone Number ID ورمز الوصول");
                return;
              }
              saveWhatsAppBusinessAccount({
                phoneNumberId: waPhoneId.trim(),
                accessToken: waToken.trim(),
                graphVersion: waVersion.trim() || "v23.0",
                languageCode: waLanguage.trim() || "ar",
                paymentTemplate: waPaymentTemplate.trim(),
                overdueTemplate: waOverdueTemplate.trim(),
                contractTemplate: waContractTemplate.trim(),
              });
              setWaToken("");
              setSavedWhatsapp(true);
              updateSchedule({ whatsappEnabled: true });
              showSuccess("تم حفظ ربط WhatsApp Business محليًا");
            }}>حفظ الربط</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => {
              disconnectWhatsAppBusiness();
              setSavedWhatsapp(false);
              updateSchedule({ whatsappEnabled: false });
            }}>فصل الحساب</Button>
          </div>
        </section>

        <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" /><p className="font-bold">سجل الإرسال</p></div>
            <span className="text-xs text-muted-foreground">{filteredLogs.length} سجل</span>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1">
            {([
              ["all", "الكل"],
              ["month", "بالشهر"],
              ["day", "باليوم"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={logFilter === value ? "default" : "ghost"}
                className="h-9 rounded-xl"
                onClick={() => setLogFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {logFilter === "month" && (
            <div>
              <Label className="text-xs">اختر الشهر</Label>
              <Input type="month" value={logMonth} onChange={(event) => setLogMonth(event.target.value)} className="mt-1 rounded-xl" />
            </div>
          )}
          {logFilter === "day" && (
            <div>
              <Label className="text-xs">اختر اليوم</Label>
              <Input type="date" value={logDay} onChange={(event) => setLogDay(event.target.value)} className="mt-1 rounded-xl" />
            </div>
          )}

          {filteredLogs.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => void deleteCommunicationLogs(
                filteredLogs,
                logFilter === "all" ? "السجل كاملًا" : logFilter === "month" ? `شهر ${logMonth}` : `يوم ${logDay}`,
              )}
            >
              <Trash2 className="ml-1 h-4 w-4" />
              حذف نتائج الفترة ({filteredLogs.length})
            </Button>
          )}

          <p className="text-[10px] leading-5 text-muted-foreground">
            لحمايتك من إرسال الرسالة مرتين، لا تُحذف الرسائل الناجحة الحديثة إلا بعد انتهاء مدة التكرار المحددة في الجدول.
          </p>

          {visibleLogs.length === 0 ? (
            <p className="rounded-2xl bg-muted p-4 text-center text-xs text-muted-foreground">لا توجد سجلات في الفترة المحددة</p>
          ) : visibleLogs.map((log) => {
            const payment = log.paymentId ? data.payments.find((item) => item.id === log.paymentId) : undefined;
            const contract = log.contractId ? data.contracts.find((item) => item.id === log.contractId) : undefined;
            const tenantName = log.tenantName
              || data.tenants.find((item) => item.id === log.tenantId)?.name
              || payment?.tenantName
              || contract?.tenantName
              || "مستأجر غير محدد";
            const unitId = payment?.unitId || contract?.unitId;
            const unitName = log.unitName
              || (unitId ? data.units.find((item) => item.id === unitId)?.name : undefined);
            return (
              <div key={log.id} className={`rounded-2xl border p-3 text-xs ${log.status === "sent" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{log.channel === "email" ? "بريد" : "واتساب"} · {tenantName}</p>
                  <div className="flex items-center gap-1">
                    <span>{log.status === "sent" ? "تم الإرسال" : "فشل"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full text-red-600"
                      aria-label="حذف سجل الإرسال"
                      onClick={() => void deleteCommunicationLogs([log], "هذا السجل")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="mt-1 break-all text-left font-semibold text-foreground" dir="ltr">{log.recipient}</p>
                {unitName && <p className="mt-1 text-muted-foreground">الوحدة: {unitName}</p>}
                {log.periodStart && log.periodEnd && (
                  <p className="mt-1 text-muted-foreground">
                    {log.paymentId ? "دفعة الفترة" : "فترة العقد"}: من {formatLogDate(log.periodStart)} إلى {formatLogDate(log.periodEnd)}
                  </p>
                )}
                {log.dueDate && <p className="mt-1 text-muted-foreground">موعد الاستحقاق: {formatLogDate(log.dueDate)}</p>}
                <p className="mt-1 text-muted-foreground">{new Date(log.createdAt).toLocaleString("ar-SA-u-nu-latn")}</p>
                {log.error && <p className="mt-1 text-red-700">{log.error}</p>}
              </div>
            );
          })}
          {filteredLogs.length > visibleLogs.length && (
            <p className="rounded-xl bg-muted p-2 text-center text-[10px] text-muted-foreground">
              يتم عرض أحدث 100 سجل من أصل {filteredLogs.length}. يمكن حذف جميع نتائج الفترة من الزر أعلاه.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
