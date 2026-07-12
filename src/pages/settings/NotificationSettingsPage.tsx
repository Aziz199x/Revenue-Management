import { useEffect, useState } from "react";
import { Bell, Loader2, RotateCcw, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import SettingsSubPageHeader from "@/components/settings/SettingsSubPageHeader";
import { useStore } from "@/data/store";
import { NotificationSound } from "@/data/types";
import {
  clearAllScheduledNotifications,
  getNotificationDiagnostics,
  NotificationDiagnostics,
  notificationsSupported,
  openAppNotificationSettings,
  openSystemNotificationSoundSettings,
  requestNotificationPermission,
  scheduleTestNotification,
  syncScheduledNotifications,
} from "@/utils/notifications";
import { showError, showSuccess } from "@/utils/toast";

export default function NotificationSettingsPage() {
  const { data, update } = useStore();
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
  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [testing, setTesting] = useState(false);

  const refreshDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      setDiagnostics(await getNotificationDiagnostics(data));
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  useEffect(() => {
    void refreshDiagnostics();
  }, [data]);

  const saveContractReminder = () => {
    const days = contractReminderChoice === "custom" ? Number(customContractReminder) : Number(contractReminderChoice);
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

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      if (!notificationsSupported()) {
        showError("هذا الجهاز لا يدعم الإشعارات المحلية");
        return;
      }
      const result = await requestNotificationPermission(data.settings);
      if (result !== "granted") {
        showError("لم يتم منح إذن الإشعارات. فعله من إعدادات الهاتف ثم حاول مرة أخرى.");
        return;
      }
      showSuccess("تم تفعيل الإشعارات المحلية");
    }
    const nextData = { ...data, settings: { ...data.settings, notificationsEnabled: enabled } };
    update((prev) => ({ ...prev, settings: { ...prev.settings, notificationsEnabled: enabled } }));
    await syncScheduledNotifications(nextData);
  };

  const saveFrequency = (hours: number) => {
    if (!Number.isFinite(hours) || hours < 1) {
      showError("يرجى إدخال عدد ساعات صحيح");
      return;
    }
    update((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        reminderFrequencyHours: hours,
        reminderFrequencyDays: Math.max(1, Math.ceil(hours / 24)),
      },
    }));
    showSuccess("تم حفظ تكرار الإشعارات");
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const result = await scheduleTestNotification(data.settings);
      if (result.success) showSuccess("تم إرسال إشعار اختبار");
      else showError(result.error || "تعذر جدولة إشعار الاختبار");
      await refreshDiagnostics();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <SettingsSubPageHeader title="الإشعارات والتنبيهات" subtitle="إعداد تنبيهات العقود والدفعات والصيانة" />
      <div className="space-y-4 p-4">
        <section className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary p-2.5">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">الإشعارات المحلية</p>
                <p className="text-xs text-muted-foreground">تنبيهات الإيجار والعقود والفواتير</p>
              </div>
            </div>
            <Switch checked={data.settings.notificationsEnabled} onCheckedChange={toggleNotifications} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">تذكير العقود قبل</Label>
              <Select value={contractReminderChoice} onValueChange={setContractReminderChoice}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 أيام</SelectItem>
                  <SelectItem value="15">15 يوم</SelectItem>
                  <SelectItem value="30">30 يوم</SelectItem>
                  <SelectItem value="60">60 يوم</SelectItem>
                  <SelectItem value="custom">مدة مخصصة</SelectItem>
                </SelectContent>
              </Select>
              {contractReminderChoice === "custom" && (
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={customContractReminder}
                  onChange={(event) => setCustomContractReminder(event.target.value)}
                  placeholder="مثال: 80"
                  className="rounded-xl"
                />
              )}
              <Button type="button" size="sm" className="w-full rounded-xl" onClick={saveContractReminder}>حفظ</Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">تذكير الإيجار قبل</Label>
              <Select
                value={String(data.settings.rentReminderDays)}
                onValueChange={(value) => update((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, rentReminderDays: Number(value) },
                }))}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 أيام</SelectItem>
                  <SelectItem value="7">7 أيام</SelectItem>
                  <SelectItem value="15">15 يوم</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div>
              <p className="text-sm font-semibold">تذكير الدفعات المتأخرة</p>
              <p className="text-xs text-muted-foreground">إشعار للدفعات غير المسددة</p>
            </div>
            <Switch
              checked={data.settings.overduePaymentNotificationsEnabled}
              onCheckedChange={(enabled) => update((prev) => ({
                ...prev,
                settings: { ...prev.settings, overduePaymentNotificationsEnabled: enabled },
              }))}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <p className="text-sm font-bold">توقيت الإشعارات</p>
          <div className="space-y-2">
            <Label className="text-xs">تكرار الإشعارات</Label>
            <Select
              value={frequencyChoice}
              onValueChange={(value) => {
                setFrequencyChoice(value);
                if (value !== "custom") saveFrequency(Number(value));
              }}
            >
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">كل ساعة</SelectItem>
                <SelectItem value="2">كل ساعتين</SelectItem>
                <SelectItem value="3">كل 3 ساعات</SelectItem>
                <SelectItem value="4">كل 4 ساعات</SelectItem>
                <SelectItem value="24">يوميا</SelectItem>
                <SelectItem value="custom">مخصص</SelectItem>
              </SelectContent>
            </Select>
            {frequencyChoice === "custom" && (
              <div className="flex gap-2">
                <Input type="number" min={1} value={customFrequency} onChange={(event) => setCustomFrequency(event.target.value)} placeholder="عدد الساعات" className="rounded-xl" />
                <Button type="button" onClick={() => saveFrequency(Number(customFrequency))}>حفظ</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">وقت البداية</Label>
              <Input type="time" value={data.settings.notificationWindowStart ?? "09:00"} onChange={(event) => update((prev) => ({ ...prev, settings: { ...prev.settings, notificationWindowStart: event.target.value || "09:00" } }))} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">وقت النهاية</Label>
              <Input type="time" value={data.settings.notificationWindowEnd ?? "21:00"} onChange={(event) => update((prev) => ({ ...prev, settings: { ...prev.settings, notificationWindowEnd: event.target.value || "21:00" } }))} className="rounded-xl" />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <p className="text-sm font-bold">أصوات الإشعارات</p>
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
        </section>

        <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <p className="text-sm font-bold">الاختبار والتشخيص</p>
          <div className="grid grid-cols-2 gap-2">
            <Button className="rounded-xl" onClick={runTest} disabled={testing}>
              {testing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <TestTube2 className="ml-2 h-4 w-4" />}
              اختبار
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={refreshDiagnostics} disabled={loadingDiagnostics}>
              {loadingDiagnostics ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RotateCcw className="ml-2 h-4 w-4" />}
              تحديث الحالة
            </Button>
          </div>
          <div className="rounded-2xl bg-muted p-3 text-xs leading-6 text-muted-foreground">
            <p>حالة الإذن: {diagnostics?.permissionStatus ?? "غير معروف"}</p>
            <p>التذكيرات الموجودة: {diagnostics?.remindersFound ?? 0}</p>
            <p>الإشعارات المجدولة: {diagnostics?.scheduledNotifications ?? 0}</p>
            <p>المعلقة في النظام: {diagnostics?.pendingNativeNotifications ?? 0}</p>
            <p>القادم: {diagnostics?.nextNotificationLabel ?? "لا يوجد"}</p>
            <p>المنبه الدقيق: {diagnostics?.exactAlarmStatus ?? "غير معروف"}</p>
            {diagnostics?.nativeStatus && (
              <>
                <p>إشعارات التطبيق من Android: {diagnostics.nativeStatus.notificationsEnabled ? "مفعلة" : "معطلة"}</p>
                <p>قناة الاختبار: {diagnostics.nativeStatus.channelExists ? (diagnostics.nativeStatus.channelEnabled ? "مفعلة" : "معطلة") : "غير موجودة"}</p>
                {diagnostics.nativeStatus.channelImportance !== undefined && <p>أهمية قناة الاختبار: {diagnostics.nativeStatus.channelImportance}</p>}
              </>
            )}
            {diagnostics?.lastSyncError && <p className="text-red-700">آخر خطأ: {diagnostics.lastSyncError}</p>}
          </div>
          <Button
            variant="outline"
            className="w-full rounded-xl text-xs"
            onClick={async () => {
              const result = await clearAllScheduledNotifications();
              if (result.success) showSuccess(`تم إلغاء ${result.cancelledCount} إشعار`);
              else showError(result.error || "تعذر إلغاء الإشعارات");
              await refreshDiagnostics();
            }}
          >
            إلغاء كل الإشعارات المجدولة
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl text-xs"
            onClick={async () => {
              try {
                const opened = await openAppNotificationSettings();
                if (!opened) showError("إعدادات إشعارات التطبيق متاحة داخل تطبيق Android فقط");
              } catch {
                showError("تعذر فتح إعدادات إشعارات التطبيق");
              }
            }}
          >
            فتح إعدادات إشعارات التطبيق
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl text-xs"
            onClick={async () => {
              try {
                const opened = await openSystemNotificationSoundSettings("test", data.settings);
                if (!opened) showError("إعدادات قناة الاختبار متاحة داخل تطبيق Android فقط");
              } catch {
                showError("تعذر فتح إعدادات قناة الاختبار");
              }
            }}
          >
            فتح إعدادات قناة اختبار الإشعارات
          </Button>
        </section>
      </div>
    </div>
  );
}
