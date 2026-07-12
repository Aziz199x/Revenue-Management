import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Cloud,
  Download,
  Upload,
  FileSpreadsheet,
  LogOut,
  CheckCircle2,
  Loader2,
  Clock,
  HardDrive,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import SettingsSubPageHeader from "@/components/settings/SettingsSubPageHeader";
import { useStore } from "@/data/store";
import { EMPTY_DATA } from "@/data/types";
import { exportJSON, exportCSV, parseBackup } from "@/utils/backup";
import {
  signIn,
  signOut,
  isSignedIn,
  getConnectedEmail,
  uploadBackup,
  listBackups,
  downloadBackup,
  clearTokens,
  BackupFileInfo,
} from "@/utils/googleDrive";
import { validateBackupJson, createEmergencySnapshot, getEmergencySnapshot, clearEmergencySnapshot } from "@/utils/backupData";
import { showSuccess, showError } from "@/utils/toast";

const LAST_BACKUP_KEY = "google_drive_last_backup";

function formatFileSize(bytes: string): string {
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function BackupPage() {
  const { data, update, replaceAll } = useStore();
  const location = useLocation();
  const openedFromSettings = location.pathname.startsWith("/settings/");
  const fileRef = useRef<HTMLInputElement>(null);

  const [signedIn, setSignedIn] = useState(isSignedIn());
  const [email, setEmail] = useState(getConnectedEmail());
  const [lastBackupDate, setLastBackupDate] = useState<string>(() => {
    try { return localStorage.getItem(LAST_BACKUP_KEY) || ""; } catch { return ""; }
  });

  const [signingIn, setSigningIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [listingBackups, setListingBackups] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);

  const [selectedBackup, setSelectedBackup] = useState<BackupFileInfo | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setSignedIn(isSignedIn());
    setEmail(getConnectedEmail());
  }, []);

  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signIn({ forceAccountSelection: true });
      setSignedIn(true);
      setEmail(getConnectedEmail());
      showSuccess("تم ربط حساب Google بنجاح");
    } catch (e) {
      showError(e instanceof Error ? e.message : "تعذر ربط حساب Google");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (loggingOut) return;
    console.log("[Google Logout] clicked");
    console.log("[Google Logout] current account:", email);
    setLoggingOut(true);
    try {
      await signOut();
      clearTokens();
      try {
        localStorage.removeItem("google_drive_account");
        localStorage.removeItem("google_drive_token");
        localStorage.removeItem("google_drive_last_backup");
      } catch (storageError) {
        console.warn("[Google Logout] localStorage cleanup warning:", storageError);
      }
      setSignedIn(false);
      setEmail(null);
      setLastBackupDate("");
      setBackups([]);
      console.log("[Google Logout] local state cleared");
      showSuccess("تم تسجيل الخروج من Google");
    } catch (error) {
      console.error("[Google Logout] failed:", error);
      showError("تعذر تسجيل الخروج من Google");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      await uploadBackup(data);
      const now = new Date().toISOString();
      localStorage.setItem(LAST_BACKUP_KEY, now);
      setLastBackupDate(now);
      showSuccess("تم رفع النسخة الاحتياطية إلى Google Drive بنجاح");
    } catch (e) {
      showError(e instanceof Error ? e.message : "تعذر رفع النسخة الاحتياطية");
    } finally {
      setUploading(false);
    }
  };

  const handleListBackups = async () => {
    setListingBackups(true);
    setListDialogOpen(true);
    try {
      const files = await listBackups();
      setBackups(files);
    } catch (e) {
      setBackups([]);
      showError(e instanceof Error ? e.message : "تعذر تحميل قائمة النسخ الاحتياطية");
    } finally {
      setListingBackups(false);
    }
  };

  const handleSelectBackup = (backup: BackupFileInfo) => {
    setSelectedBackup(backup);
    setListDialogOpen(false);
    setConfirmDialogOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackup) return;
    setConfirmDialogOpen(false);
    setRestoring(true);
    createEmergencySnapshot(data);
    try {
      const text = await downloadBackup(selectedBackup.id);
      const restored = validateBackupJson(text);
      if (!restored) {
        throw new Error("ملف النسخة الاحتياطية غير صالح");
      }
      replaceAll(restored);
      clearEmergencySnapshot();
      showSuccess("تمت استعادة البيانات بنجاح");
    } catch (e) {
      const snapshot = getEmergencySnapshot();
      if (snapshot) {
        replaceAll(snapshot);
        clearEmergencySnapshot();
        showError(e instanceof Error ? e.message : "فشلت الاستعادة، تم الرجوع للبيانات السابقة");
      } else {
        showError(e instanceof Error ? e.message : "فشلت استعادة النسخة الاحتياطية");
      }
    } finally {
      setRestoring(false);
      setSelectedBackup(null);
    }
  };

  const handleExportJSON = async () => {
    setImporting(true);
    try {
      await exportJSON(data);
      showSuccess("تم تجهيز الملف بنجاح");
    } catch {
      showError("تعذر تصدير الملف، حاول مرة أخرى");
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = async () => {
    setImporting(true);
    try {
      await exportCSV(data);
      showSuccess("تم تجهيز الملف بنجاح");
    } catch {
      showError("تعذر تصدير الملف، حاول مرة أخرى");
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = async (file: File) => {
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
    } catch {
      showError("تعذر استيراد الملف");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      {openedFromSettings ? (
        <SettingsSubPageHeader title="النسخ الاحتياطي والاستعادة" subtitle="النسخ المحلي والنسخ عبر Google Drive" />
      ) : (
        <PageHeader title="النسخ الاحتياطي والاستعادة" subtitle="Google Drive" />
      )}

      <div className="space-y-4 p-4">
        {/* Google Drive Account */}
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

          {!signedIn ? (
            <Button
              className="w-full rounded-xl"
              onClick={handleSignIn}
              disabled={signingIn}
            >
              {signingIn ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="ml-2 h-4 w-4" />
              )}
              {signingIn ? "جاري تسجيل الدخول..." : "ربط حساب Google"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-2xl bg-muted p-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{email}</p>
                  <p className="text-xs text-muted-foreground">الحساب المتصل</p>
                </div>
              </div>

              {lastBackupDate && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  آخر نسخة احتياطية: {formatDate(lastBackupDate)}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl text-xs"
                onClick={handleSignIn}
                disabled={signingIn || loggingOut || uploading || restoring}
              >
                {signingIn ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Cloud className="ml-1 h-3.5 w-3.5" />}
                {signingIn ? "جاري اختيار الحساب..." : "تغيير حساب Google"}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full min-w-0 rounded-xl px-2 text-[0.7rem] leading-tight sm:px-3 sm:text-xs"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="ml-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  ) : (
                    <Upload className="ml-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  )}
                  {uploading ? "جاري الرفع..." : "رفع نسخة احتياطية"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full min-w-0 rounded-xl px-2 text-[0.7rem] leading-tight sm:px-3 sm:text-xs"
                  onClick={handleListBackups}
                  disabled={restoring}
                >
                  <Download className="ml-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  استعادة نسخة
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-xl text-xs text-muted-foreground"
                onClick={handleSignOut}
                disabled={signingIn || loggingOut}
              >
                {loggingOut ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <LogOut className="ml-1 h-3.5 w-3.5" />}
                {loggingOut ? "جاري تسجيل الخروج..." : "تسجيل الخروج من Google"}
              </Button>
            </div>
          )}
        </div>

        {/* Local Backup */}
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-secondary p-2.5">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">النسخ المحلي</p>
              <p className="text-xs text-muted-foreground">
                تصدير أو استيراد من الجهاز
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full justify-start rounded-xl"
            onClick={handleExportJSON}
            disabled={importing}
          >
            <Download className="ml-2 h-4 w-4" />
            {importing ? "جاري التجهيز..." : "تصدير نسخة احتياطية (JSON)"}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start rounded-xl"
            onClick={handleExportCSV}
            disabled={importing}
          >
            <FileSpreadsheet className="ml-2 h-4 w-4" />
            {importing ? "جاري التجهيز..." : "تصدير تقرير (CSV / Excel)"}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start rounded-xl"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
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
              if (f) handleImportFile(f);
            }}
          />
        </div>

        {/* Restore loading overlay */}
        {restoring && (
          <div className="flex items-center justify-center gap-2 rounded-3xl bg-muted p-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري استعادة النسخة الاحتياطية...
          </div>
        )}

        <div className="space-y-3 rounded-3xl border border-red-200 bg-red-50/50 p-4">
          <p className="text-sm font-bold text-red-700">إدارة البيانات</p>
          <p className="text-xs leading-5 text-red-700">
            مسح البيانات يحذف العقارات والوحدات والعقود والدفعات نهائيا من هذا الجهاز. يفضل إنشاء نسخة احتياطية قبل المتابعة.
          </p>
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
                  سيتم حذف جميع العقارات والوحدات والدفعات نهائيا. ننصح بتصدير نسخة احتياطية أولا.
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

      {/* Backup list dialog */}
      <Dialog open={listDialogOpen} onOpenChange={(v) => { if (!v) setListDialogOpen(false); }}>
        <DialogContent className="max-w-[90vw] rounded-3xl dialog-safe max-h-[80vh] overflow-y-auto">
          <DialogHeader className="text-right">
            <DialogTitle className="text-right">النسخ الاحتياطية في Google Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {listingBackups && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري تحميل القائمة...
              </div>
            )}
            {!listingBackups && backups.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                لا توجد نسخ احتياطية في Google Drive
              </p>
            )}
            {!listingBackups && backups.map((b) => (
              <button
                key={b.id}
                type="button"
                className="flex w-full flex-col gap-1 rounded-2xl border border-border bg-card p-3 text-right active:scale-[0.98] transition-transform"
                onClick={() => handleSelectBackup(b)}
              >
                <span className="text-sm font-medium">{b.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(b.createdTime)}
                  {b.size ? ` · ${formatFileSize(b.size)}` : ""}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-3xl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>استعادة النسخة الاحتياطية؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم استبدال البيانات الحالية بالنسخة المحددة. هل تريد المتابعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={handleConfirmRestore}>
              استعادة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
