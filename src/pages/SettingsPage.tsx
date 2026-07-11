import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import {
<<<<<<< HEAD
  Bell,
  Cloud,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  ShieldCheck,
  Smartphone,
  MessageCircle,
  RotateCcw,
  ChevronLeft,
=======
  Bell, Download, Upload, FileSpreadsheet, Trash2, ShieldCheck, Smartphone,
  Cloud, LogOut, RefreshCw, Percent, MessageCircle,
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import PageHeader from "@/components/shared/PageHeader";
import { useStore } from "@/data/store";
<<<<<<< HEAD
import { EMPTY_DATA, DEFAULT_WHATSAPP_TEMPLATES, NotificationSound } from "@/data/types";
import { exportJSON, exportCSV, parseBackup } from "@/utils/backup";
import {
  notificationsSupported,
  requestNotificationPermission,
  syncScheduledNotifications,
  openSystemNotificationSoundSettings,
} from "@/utils/notifications";
=======
import { EMPTY_DATA, WhatsappPref } from "@/data/types";
import { exportJSON, exportCSV, parseBackup } from "@/utils/backup";
import { notificationsSupported, requestNotificationPermission, syncScheduledNotifications } from "@/utils/notifications";
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
import { showSuccess, showError } from "@/utils/toast";

const GDRIVE_EMAIL_KEY = "aziz-gdrive-email";

export default function SettingsPage() {
  const { data, update, replaceAll } = useStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
<<<<<<< HEAD
  const initialContractReminder = data.settings.defaultContractExpiryReminderDays;
  const [contractReminderChoice, setContractReminderChoice] = useState(
    [7, 15, 30, 60].includes(initialContractReminder) ? String(initialContractReminder) : "custom",
  );
  const [customContractReminder, setCustomContractReminder] = useState(
    [7, 15, 30, 60].includes(initialContractReminder) ? "" : String(initialContractReminder),
  );
  const currentFrequencyHours = data.settings.reminderFrequencyHours ?? Math.max(1, (data.settings.reminderFrequencyDays || 1) * 24);
  const [frequencyChoice, setFrequencyChoice] = useState([1, 2, 3, 4, 24].includes(currentFrequencyHours) ? String(currentFrequencyHours) : "custom");
  const [customFrequency, setCustomFrequency] = useState([1, 2, 3, 4, 24].includes(currentFrequencyHours) ? "" : String(currentFrequencyHours));

  const saveContractReminder = () => {
    const days = contractReminderChoice === "custom"
      ? Number(customContractReminder)
      : Number(contractReminderChoice);
    if (!Number.isFinite(days) || days <= 0) {
      showError("يرجى إدخال عدد أيام صحيح");
      return;
    }
    update((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        contractReminderDays: days,
        defaultContractExpiryReminderDays: days,
      },
    }));
    showSuccess("تم حفظ إعدادات التذكير");
  };
=======
  const [gdriveEmail, setGdriveEmail] = useState<string>(() => localStorage.getItem(GDRIVE_EMAIL_KEY) || "");
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      if (!notificationsSupported()) { showError("هذا الجهاز لا يدعم الإشعارات"); return; }
      const result = await requestNotificationPermission();
      if (result === "denied") { showError("تم رفض إذن الإشعارات"); return; }
      if (result === "unsupported") { showError("هذا الجهاز لا يدعم الإشعارات"); return; }
      showSuccess("تم تفعيل الإشعارات");
    }
    update((prev) => ({ ...prev, settings: { ...prev.settings, notificationsEnabled: enabled } }));
    await syncScheduledNotifications({ ...data, settings: { ...data.settings, notificationsEnabled: enabled } });
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      if (!parsed) { showError("ملف غير صالح"); return; }
      replaceAll(parsed);
      showSuccess("تم الاستيراد");
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const connectGdrive = () => {
    // In a real app this would trigger Google OAuth with prompt=select_account
    // For now we use the token client flow placeholder
    const email = window.prompt("أدخل بريد Gmail المرتبط:", gdriveEmail || "");
    if (email) {
      localStorage.setItem(GDRIVE_EMAIL_KEY, email);
      setGdriveEmail(email);
      showSuccess("تم ربط Google Drive");
    }
  };

  const disconnectGdrive = () => {
    localStorage.removeItem(GDRIVE_EMAIL_KEY);
    setGdriveEmail("");
    showSuccess("تم تسجيل الخروج");
  };

  const backupNow = () => {
    exportJSON(data);
    showSuccess("تم النسخ الاحتياطي");
  };

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="التذكيرات والنسخ الاحتياطي" />
      <div className="space-y-4 p-4">
        {/* Privacy */}
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4">
          <div className="rounded-full bg-secondary p-2.5"><ShieldCheck className="h-5 w-5 text-primary" /></div>
          <div className="text-sm">
            <p className="font-bold">بياناتك على جهازك فقط</p>
            <p className="text-xs text-muted-foreground">يعمل التطبيق دون إنترنت بالكامل. جميع البيانات محفوظة محلياً على هاتفك.</p>
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary p-2.5"><Bell className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm font-bold">الإشعارات المحلية</p><p className="text-xs text-muted-foreground">تنبيهات الإيجار والعقود والفواتير</p></div>
            </div>
            <Switch checked={data.settings.notificationsEnabled} onCheckedChange={toggleNotifications} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
<<<<<<< HEAD
              <Label className="text-xs">تذكير العقود قبل</Label>
              <Select
                value={contractReminderChoice}
                onValueChange={setContractReminderChoice}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 أيام</SelectItem>
                  <SelectItem value="15">15 يوم</SelectItem>
                  <SelectItem value="30">30 يوم</SelectItem>
                  <SelectItem value="60">60 يوم</SelectItem>
                  <SelectItem value="custom">مدة مخصصة</SelectItem>
                </SelectContent>
=======
              <Label className="text-xs">تذكير الإيجار قبل</Label>
              <Select value={String(data.settings.rentReminderDays)} onValueChange={(v) => update((prev) => ({ ...prev, settings: { ...prev.settings, rentReminderDays: Number(v) } }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="3">3 أيام</SelectItem><SelectItem value="7">7 أيام</SelectItem><SelectItem value="15">15 يوم</SelectItem></SelectContent>
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
              </Select>
              {contractReminderChoice === "custom" && (
                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs">عدد الأيام قبل انتهاء العقد</Label>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={customContractReminder}
                    onChange={(event) => setCustomContractReminder(event.target.value)}
                    placeholder="مثال: 80"
                    className="rounded-xl"
                  />
                </div>
              )}
              <Button type="button" size="sm" className="mt-2 w-full rounded-xl" onClick={saveContractReminder}>
                حفظ إعدادات التذكير
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تذكير العقود قبل</Label>
              <Select value={String(data.settings.contractReminderDays)} onValueChange={(v) => update((prev) => ({ ...prev, settings: { ...prev.settings, contractReminderDays: Number(v) } }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="30">30 يوم</SelectItem><SelectItem value="60">60 يوم</SelectItem><SelectItem value="80">80 يوم</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div><p className="text-sm font-semibold">تذكير الدفعات المتأخرة</p><p className="text-xs text-muted-foreground">إشعار يومي للدفعات غير المسددة</p></div>
            <Switch checked={data.settings.overduePaymentNotificationsEnabled} onCheckedChange={(enabled) => update((prev) => ({ ...prev, settings: { ...prev.settings, overduePaymentNotificationsEnabled: enabled } }))} />
          </div>
          <div className="space-y-2 rounded-2xl border border-border p-3">
            <Label className="text-xs">تكرار الإشعارات</Label>
            <Select value={frequencyChoice} onValueChange={(value) => {
              setFrequencyChoice(value);
              if (value !== "custom") update((prev) => ({ ...prev, settings: { ...prev.settings, reminderFrequencyHours: Number(value), reminderFrequencyDays: Math.max(1, Math.ceil(Number(value) / 24)) } }));
            }}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">كل ساعة</SelectItem><SelectItem value="2">كل ساعتين</SelectItem><SelectItem value="3">كل 3 ساعات</SelectItem><SelectItem value="4">كل 4 ساعات</SelectItem><SelectItem value="24">يوميا</SelectItem><SelectItem value="custom">مخصص</SelectItem></SelectContent></Select>
            {frequencyChoice === "custom" && <div className="flex gap-2"><Input type="number" min={1} value={customFrequency} onChange={(event) => setCustomFrequency(event.target.value)} placeholder="عدد الساعات" className="rounded-xl" /><Button type="button" onClick={() => { const hours = Number(customFrequency); if (!Number.isFinite(hours) || hours < 1) { showError("يرجى إدخال عدد ساعات صحيح"); return; } update((prev) => ({ ...prev, settings: { ...prev.settings, reminderFrequencyHours: hours, reminderFrequencyDays: Math.max(1, Math.ceil(hours / 24)) } })); showSuccess("تم حفظ تكرار الإشعارات"); }}>حفظ</Button></div>}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">وقت بداية التنبيهات</Label>
                <Input type="time" value={data.settings.notificationWindowStart ?? "09:00"} onChange={(event) => update((prev) => ({ ...prev, settings: { ...prev.settings, notificationWindowStart: event.target.value || "09:00" } }))} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">وقت نهاية التنبيهات</Label>
                <Input type="time" value={data.settings.notificationWindowEnd ?? "21:00"} onChange={(event) => update((prev) => ({ ...prev, settings: { ...prev.settings, notificationWindowEnd: event.target.value || "21:00" } }))} className="rounded-xl" />
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-border p-3">
            <div>
              <p className="text-sm font-semibold">أصوات الإشعارات</p>
              <p className="text-xs text-muted-foreground">اختر نغمة مستقلة لكل نوع من التذكيرات</p>
            </div>
            {([ 
              ["paymentNotificationSound", "صوت إشعارات الدفعات"],
              ["contractNotificationSound", "صوت العقود القريبة من الانتهاء"],
              ["maintenanceNotificationSound", "صوت طلبات الصيانة المعلقة"],
            ] as const).map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Select
                  value={data.settings[field]}
                  onValueChange={(value) => update((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, [field]: value as NotificationSound },
                  }))}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment_overdue.wav">نغمة تنبيه قوية</SelectItem>
                    <SelectItem value="contract_reminder.wav">نغمة تنبيه هادئة</SelectItem>
                    <SelectItem value="default">صوت الهاتف الافتراضي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs text-muted-foreground">يمكنك اختيار أي نغمة أخرى مثبتة على الهاتف من إعدادات Android:</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([ 
                  ["payment", "صوت الدفعات من النظام"],
                  ["contract", "صوت العقود من النظام"],
                  ["maintenance", "صوت الصيانة من النظام"],
                ] as const).map(([type, label]) => (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-9 whitespace-normal rounded-xl text-xs"
                    onClick={async () => {
                      try {
                        const opened = await openSystemNotificationSoundSettings(type, data.settings);
                        if (!opened) showError("اختيار صوت النظام متاح داخل تطبيق Android فقط");
                      } catch {
                        showError("تعذر فتح إعدادات صوت الإشعارات");
                      }
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Google Drive Backup */}
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2.5">
              <Cloud className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-sm font-bold">النسخ الاحتياطي في Google Drive</p>
              <p className="text-xs text-muted-foreground">
                احفظ بياناتك واستعدها من Google Drive
              </p>
            </div>
          </div>
          <Button
            className="w-full justify-start rounded-xl"
            onClick={() => navigate("/backup")}
          >
            <Cloud className="ml-2 h-4 w-4" />
            فتح صفحة النسخ الاحتياطي
          </Button>
        </div>

        {/* WhatsApp Templates */}
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-3 list-none">
              <div className="rounded-full bg-emerald-100 p-2.5">
                <MessageCircle className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">قوالب رسائل الواتساب</p>
                <p className="text-xs text-muted-foreground group-open:hidden">
                  اضغط لتعديل القوالب
                </p>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">رسالة تذكير بالإيجار</Label>
                <textarea
                  className="min-h-[100px] w-full rounded-2xl border border-border bg-background p-3 text-xs"
                  dir="rtl"
                  value={data.settings.whatsappTemplates.paymentReminder}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        whatsappTemplates: {
                          ...prev.settings.whatsappTemplates,
                          paymentReminder: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">رسالة تذكير بالدفعة المتأخرة</Label>
                <textarea
                  className="min-h-[100px] w-full rounded-2xl border border-border bg-background p-3 text-xs"
                  dir="rtl"
                  value={data.settings.whatsappTemplates.overduePayment}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        whatsappTemplates: {
                          ...prev.settings.whatsappTemplates,
                          overduePayment: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">رسالة انتهاء العقد</Label>
                <textarea
                  className="min-h-[100px] w-full rounded-2xl border border-border bg-background p-3 text-xs"
                  dir="rtl"
                  value={data.settings.whatsappTemplates.contractExpiry}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        whatsappTemplates: {
                          ...prev.settings.whatsappTemplates,
                          contractExpiry: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="rounded-2xl bg-muted p-3">
                <p className="text-[11px] text-muted-foreground">
                  المتغيرات المتاحة: {'{tenantName}'} {'{buildingName}'} {'{unitName}'} {'{amount}'} {'{dueDate}'} {'{contractEndDate}'} {'{ownerName}'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl text-xs"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES,
                    },
                  }))
                }
              >
                <RotateCcw className="ml-1 h-3.5 w-3.5" />
                استعادة القوالب الافتراضية
              </Button>
            </div>
          </details>
        </div>

        {/* Collection fee */}
        <div className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-secondary p-2.5"><Percent className="h-5 w-5 text-orange-500" /></div>
            <div><p className="text-sm font-bold">نسبة تحصيل المكتب</p><p className="text-xs text-muted-foreground">النسبة الافتراضية لجميع العقارات</p></div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">النسبة %</Label>
            <Input type="number" inputMode="decimal" min={0} max={100} value={data.settings.collectionFeePercentage || ""} onChange={(e) => update((prev) => ({ ...prev, settings: { ...prev.settings, collectionFeePercentage: Number(e.target.value) || 0 } }))} placeholder="مثال: 5" className="rounded-xl" />
          </div>
        </div>

        {/* WhatsApp preference */}
        <div className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-secondary p-2.5"><MessageCircle className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-sm font-bold">تفضيل واتساب</p><p className="text-xs text-muted-foreground">التطبيق الافتراضي للرسائل</p></div>
          </div>
          <Select value={data.settings.whatsappPreference} onValueChange={(v) => update((prev) => ({ ...prev, settings: { ...prev.settings, whatsappPreference: v as WhatsappPref } }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ask">اسأل كل مرة</SelectItem>
              <SelectItem value="whatsapp">واتساب</SelectItem>
              <SelectItem value="whatsapp_business">واتساب بزنس</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Google Drive */}
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-secondary p-2.5"><Cloud className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-sm font-bold">Google Drive</p><p className="text-xs text-muted-foreground">نسخ احتياطي واستعادة عبر Google</p></div>
          </div>
          {gdriveEmail && (
            <div className="rounded-xl bg-muted p-3 text-sm"><p className="text-xs text-muted-foreground">الحساب المرتبط:</p><p className="font-semibold text-blue-600" dir="ltr">{gdriveEmail}</p></div>
          )}
          <Button variant="outline" className="w-full justify-start rounded-xl" onClick={connectGdrive}>
            <Cloud className="ml-2 h-4 w-4" />{gdriveEmail ? "تغيير حساب Google" : "ربط Google Drive"}
          </Button>
          {gdriveEmail && (
            <>
              <Button variant="outline" className="w-full justify-start rounded-xl" onClick={backupNow}><Download className="ml-2 h-4 w-4" /> نسخ احتياطي الآن</Button>
              <Button variant="outline" className="w-full justify-start rounded-xl text-destructive" onClick={disconnectGdrive}><LogOut className="ml-2 h-4 w-4" /> تسجيل الخروج من Google Drive</Button>
            </>
          )}
        </div>

        {/* Backup */}
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-secondary p-2.5"><Smartphone className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm font-bold">النسخ الاحتياطي والنقل</p><p className="text-xs text-muted-foreground">صدّر أو انقل بياناتك</p></div>
          </div>
<<<<<<< HEAD
          <Button
            variant="outline"
            className="w-full justify-start rounded-xl"
            disabled={importing}
            onClick={async () => {
              setImporting(true);
              try {
                await exportJSON(data);
                showSuccess("تم تجهيز الملف بنجاح");
              } catch {
                showError("تعذر تصدير الملف، حاول مرة أخرى");
              } finally {
                setImporting(false);
              }
            }}
          >
            <Download className="ml-2 h-4 w-4" />
            {importing ? "جاري تجهيز الملف..." : "تصدير نسخة احتياطية (JSON)"}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start rounded-xl"
            disabled={importing}
            onClick={async () => {
              setImporting(true);
              try {
                await exportCSV(data);
                showSuccess("تم تجهيز الملف بنجاح");
              } catch {
                showError("تعذر تصدير الملف، حاول مرة أخرى");
              } finally {
                setImporting(false);
              }
            }}
          >
            <FileSpreadsheet className="ml-2 h-4 w-4" />
            {importing ? "جاري تجهيز الملف..." : "تصدير تقرير (CSV / Excel)"}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start rounded-xl"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="ml-2 h-4 w-4" />
            استيراد نسخة احتياطية (JSON)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
          />
=======
          <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => exportJSON(data)}><Download className="ml-2 h-4 w-4" /> تصدير (JSON)</Button>
          <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => exportCSV(data)}><FileSpreadsheet className="ml-2 h-4 w-4" /> تصدير تقرير (CSV / Excel)</Button>
          <Button variant="outline" className="w-full justify-start rounded-xl" disabled={importing} onClick={() => fileRef.current?.click()}><Upload className="ml-2 h-4 w-4" /> استيراد (JSON)</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
        </div>

        {/* Danger zone */}
        <div className="rounded-3xl border border-red-200 bg-red-50/50 p-4">
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" className="w-full rounded-xl"><Trash2 className="ml-2 h-4 w-4" /> مسح جميع البيانات</Button></AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] rounded-3xl sheet-safe-bottom">
              <AlertDialogHeader className="text-right"><AlertDialogTitle>مسح جميع البيانات؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف جميع العقارات والوحدات والدفعات نهائياً. ننصح بتصدير نسخة احتياطية أولاً.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2"><AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel><AlertDialogAction className="rounded-xl bg-destructive" onClick={() => { replaceAll(EMPTY_DATA); showSuccess("تم المسح"); }}>مسح الكل</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <p className="text-center text-xs text-muted-foreground">إصدار التطبيق 2.0.0</p>
      </div>
    </div>
  );
}
