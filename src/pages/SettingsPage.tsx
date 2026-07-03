import { useRef, useState } from "react";
import {
  Bell,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import PageHeader from "@/components/shared/PageHeader";
import { useStore } from "@/data/store";
import { EMPTY_DATA } from "@/data/types";
import { exportJSON, exportCSV, parseBackup } from "@/utils/backup";
import {
  notificationsSupported,
  requestNotificationPermission,
  syncScheduledNotifications,
} from "@/utils/notifications";
import { showSuccess, showError } from "@/utils/toast";

export default function SettingsPage() {
  const { data, update, replaceAll } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      if (!notificationsSupported()) {
        showError("هذا الجهاز لا يدعم الإشعارات المحلية");
        return;
      }
      const result = await requestNotificationPermission();
      if (result === "denied") {
        showError(
          "تم رفض إذن الإشعارات. الرجاء تفعيل الإشعارات لهذا التطبيق من إعدادات الهاتف.",
        );
        return;
      }
      if (result === "unsupported") {
        showError("هذا الجهاز لا يدعم الإشعارات المحلية");
        return;
      }
      showSuccess("تم تفعيل الإشعارات المحلية");
    }
    update((prev) => ({
      ...prev,
      settings: { ...prev.settings, notificationsEnabled: enabled },
    }));
    await syncScheduledNotifications({
      ...data,
      settings: { ...data.settings, notificationsEnabled: enabled },
    });
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      if (!parsed) {
        showError("ملف النسخة الاحتياطية غير صالح");
        return;
      }
      replaceAll(parsed);
      showSuccess("تم استيراد البيانات بنجاح");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="التذكيرات والنسخ الاحتياطي" />
      <div className="space-y-4 p-4">
        {/* Privacy note */}
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4">
          <div className="rounded-full bg-secondary p-2.5">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-bold">بياناتك على جهازك فقط</p>
            <p className="text-xs text-muted-foreground">
              يعمل التطبيق دون إنترنت بالكامل. جميع البيانات محفوظة محلياً على
              هاتفك ولا تُرسل لأي خادم.
            </p>
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary p-2.5">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">الإشعارات المحلية</p>
                <p className="text-xs text-muted-foreground">
                  تنبيهات الإيجار والعقود والفواتير
                </p>
              </div>
            </div>
            <Switch
              checked={data.settings.notificationsEnabled}
              onCheckedChange={toggleNotifications}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">تذكير العقود قبل</Label>
              <Select
                value={String(data.settings.contractReminderDays)}
                onValueChange={(v) =>
                  update((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, contractReminderDays: Number(v) },
                  }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 أيام</SelectItem>
                  <SelectItem value="15">15 يوم</SelectItem>
                  <SelectItem value="30">30 يوم</SelectItem>
                  <SelectItem value="60">60 يوم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تذكير الإيجار قبل</Label>
              <Select
                value={String(data.settings.rentReminderDays)}
                onValueChange={(v) =>
                  update((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, rentReminderDays: Number(v) },
                  }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 أيام</SelectItem>
                  <SelectItem value="7">7 أيام</SelectItem>
                  <SelectItem value="15">15 يوم</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Backup */}
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-secondary p-2.5">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">النسخ الاحتياطي والنقل</p>
              <p className="text-xs text-muted-foreground">
                صدّر بياناتك أو انقلها إلى هاتف آخر
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => exportJSON(data)}>
            <Download className="ml-2 h-4 w-4" />
            تصدير نسخة احتياطية (JSON)
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => exportCSV(data)}>
            <FileSpreadsheet className="ml-2 h-4 w-4" />
            تصدير تقرير (CSV / Excel)
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
        </div>

        {/* Danger zone */}
        <div className="rounded-3xl border border-red-200 bg-red-50/50 p-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full rounded-xl">
                <Trash2 className="ml-2 h-4 w-4" />
                مسح جميع البيانات
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] rounded-3xl">
              <AlertDialogHeader className="text-right">
                <AlertDialogTitle>مسح جميع البيانات؟</AlertDialogTitle>
                <AlertDialogDescription>
                  سيتم حذف جميع العقارات والوحدات والدفعات نهائياً. ننصح بتصدير
                  نسخة احتياطية أولاً.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2">
                <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-xl bg-destructive"
                  onClick={() => {
                    replaceAll(EMPTY_DATA);
                    showSuccess("تم مسح جميع البيانات");
                  }}
                >
                  مسح الكل
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
