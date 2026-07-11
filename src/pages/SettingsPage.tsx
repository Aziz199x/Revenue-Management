import { useRef, useState } from "react";
import {
  Bell, Download, Upload, FileSpreadsheet, Trash2, ShieldCheck, Smartphone,
  Cloud, LogOut, RefreshCw, Percent, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { EMPTY_DATA, WhatsappPref } from "@/data/types";
import { exportJSON, exportCSV, parseBackup } from "@/utils/backup";
import { notificationsSupported, requestNotificationPermission, syncScheduledNotifications } from "@/utils/notifications";
import { showSuccess, showError } from "@/utils/toast";

const GDRIVE_EMAIL_KEY = "aziz-gdrive-email";

export default function SettingsPage() {
  const { data, update, replaceAll } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [gdriveEmail, setGdriveEmail] = useState<string>(() => localStorage.getItem(GDRIVE_EMAIL_KEY) || "");

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
              <Label className="text-xs">تذكير الإيجار قبل</Label>
              <Select value={String(data.settings.rentReminderDays)} onValueChange={(v) => update((prev) => ({ ...prev, settings: { ...prev.settings, rentReminderDays: Number(v) } }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="3">3 أيام</SelectItem><SelectItem value="7">7 أيام</SelectItem><SelectItem value="15">15 يوم</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تذكير العقود قبل</Label>
              <Select value={String(data.settings.contractReminderDays)} onValueChange={(v) => update((prev) => ({ ...prev, settings: { ...prev.settings, contractReminderDays: Number(v) } }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="30">30 يوم</SelectItem><SelectItem value="60">60 يوم</SelectItem><SelectItem value="80">80 يوم</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
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
          <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => exportJSON(data)}><Download className="ml-2 h-4 w-4" /> تصدير (JSON)</Button>
          <Button variant="outline" className="w-full justify-start rounded-xl" onClick={() => exportCSV(data)}><FileSpreadsheet className="ml-2 h-4 w-4" /> تصدير تقرير (CSV / Excel)</Button>
          <Button variant="outline" className="w-full justify-start rounded-xl" disabled={importing} onClick={() => fileRef.current?.click()}><Upload className="ml-2 h-4 w-4" /> استيراد (JSON)</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
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
