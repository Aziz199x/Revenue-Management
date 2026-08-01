import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { StoreProvider, useStore } from "@/data/store";
import { mergeCommunicationLogs } from "@/data/communicationLogs";
import { syncScheduledNotifications } from "@/utils/notifications";
import { setupStatusBar } from "@/utils/statusBar";
import { hasOpenModal, dismissTopModal } from "@/utils/modalStack";
import { toast } from "sonner";
import { runAutomaticBackupIfDue } from "@/utils/automaticBackup";
import {
  buildAutomaticCommunicationJobs,
  isCommunicationOnline,
  runAutomaticCommunicationCycle,
} from "@/utils/automaticCommunications";
import AppLayout from "@/components/layout/AppLayout";
import { AppDialogProvider } from "@/components/shared/AppDialogProvider";
import Index from "./pages/Index";
import Buildings from "./pages/Buildings";
import BuildingDetails from "./pages/BuildingDetails";
import UnitDetails from "./pages/UnitDetails";
import Payments from "./pages/Payments";
import SearchPage from "./pages/SearchPage";
import OwnerReportPage from "./pages/OwnerReportPage";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/SettingsPage";
import NotificationSettingsPage from "./pages/settings/NotificationSettingsPage";
import HomeDisplaySettingsPage from "./pages/settings/HomeDisplaySettingsPage";
import WhatsAppSettingsPage from "./pages/settings/WhatsAppSettingsPage";
import AutomaticCommunicationsSettingsPage from "./pages/settings/AutomaticCommunicationsSettingsPage";
import TenantRequests from "./pages/TenantRequests";
import RequestDetails from "./pages/RequestDetails";
import BackupPage from "./pages/BackupPage";
import MonthClosePage from "./pages/MonthClosePage";
import AuditLogPage from "./pages/AuditLogPage";
import ActionCenterPage from "./pages/ActionCenterPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function NotificationChecker() {
  const { data } = useStore();
  const latestData = useRef(data);
  latestData.current = data;

  useEffect(() => {
    syncScheduledNotifications(data);
  }, [data]);

  useEffect(() => {
    syncScheduledNotifications(latestData.current, { forceOnOpen: true });
    if (!Capacitor.isNativePlatform()) return;
    let listener: { remove: () => Promise<void> } | undefined;
    void (async () => {
      const { App } = await import("@capacitor/app");
      listener = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) syncScheduledNotifications(latestData.current, { forceOnOpen: true });
      });
    })();
    return () => { void listener?.remove(); };
  }, []);
  return null;
}

function AutomaticBackupManager() {
  const { data } = useStore();
  const latestData = useRef(data);
  latestData.current = data;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runAutomaticBackupIfDue(latestData.current);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [data]);

  return null;
}

function PaymentReminderCountdown() {
  const { data } = useStore();
  const pending = data.payments.filter((payment) => {
    if (!payment.automaticReminderHoldUntil || payment.deletedAt || payment.status === "paid") return false;
    return new Date(payment.automaticReminderHoldUntil).getTime() > Date.now();
  });
  const signature = pending
    .map((payment) => `${payment.id}:${payment.automaticReminderHoldUntil}:${payment.status}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (!signature) return;
    const completed = new Set<string>();
    const toastIds = pending.map((payment) => `payment-reminder-countdown-${payment.id}`);
    const render = () => {
      for (const payment of pending) {
        const remaining = Math.max(
          0,
          Math.ceil((new Date(payment.automaticReminderHoldUntil!).getTime() - Date.now()) / 1000),
        );
        const toastId = `payment-reminder-countdown-${payment.id}`;
        if (remaining <= 0) {
          toast.dismiss(toastId);
          if (!completed.has(payment.id)) {
            completed.add(payment.id);
            window.dispatchEvent(new CustomEvent("automatic-communication-ready"));
          }
          continue;
        }
        const unit = data.units.find((item) => item.id === payment.unitId);
        toast.warning(`سيتم إشعار المستأجر خلال ${remaining} ثانية`, {
          id: toastId,
          duration: Infinity,
          description: `${unit?.name || payment.unitName || "الوحدة"} — أعد حالة الدفعة إلى «مدفوع» لإلغاء الإرسال.`,
        });
      }
    };
    render();
    const interval = window.setInterval(render, 1000);
    return () => {
      window.clearInterval(interval);
      toastIds.forEach((id) => toast.dismiss(id));
    };
  // The signature intentionally changes only when a hold is added, removed, or paid.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return null;
}

function AutomaticCommunicationManager() {
  const { data, update } = useStore();
  const latestData = useRef(data);
  const offlineNoticeShown = useRef(false);
  latestData.current = data;

  useEffect(() => {
    let active = true;
    let listener: { remove: () => Promise<void> } | undefined;
    const notify = async (title: string, body: string, kind: "success" | "warning" = "success") => {
      if (kind === "warning") toast.warning(title, { description: body });
      else toast.success(title, { description: body });
      if (!Capacitor.isNativePlatform()) return;
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const permission = await LocalNotifications.checkPermissions();
        if (permission.display !== "granted") return;
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.max(1, Math.floor(Date.now() % 2_000_000_000)),
            title,
            body,
            schedule: { at: new Date(Date.now() + 500) },
          }],
        });
      } catch (error) {
        console.warn("[Automatic Communications] unable to show status notification", error);
      }
    };
    const run = async () => {
      if (!active || !latestData.current.settings.automaticCommunications?.enabled) return;
      const pendingJobs = buildAutomaticCommunicationJobs(latestData.current);
      if (pendingJobs.length === 0) return;
      if (!isCommunicationOnline()) {
        if (!offlineNoticeShown.current) {
          offlineNoticeShown.current = true;
          await notify(
            "تعذر الإرسال التلقائي",
            "لا يوجد اتصال بالإنترنت. الرسائل معلقة وستتم المحاولة فور عودة الاتصال.",
            "warning",
          );
        }
        return;
      }
      offlineNoticeShown.current = false;
      try {
        const logs = await runAutomaticCommunicationCycle(latestData.current);
        if (!active) return;
        if (logs.length > 0) {
          await update((previous) => ({
            ...previous,
            communicationLogs: mergeCommunicationLogs(previous.communicationLogs || [], logs),
            settings: {
              ...previous.settings,
              automaticCommunications: {
                ...previous.settings.automaticCommunications,
                lastRunAt: new Date().toISOString(),
              },
            },
          }));
          latestData.current = {
            ...latestData.current,
            communicationLogs: mergeCommunicationLogs(latestData.current.communicationLogs || [], logs),
            settings: {
              ...latestData.current.settings,
              automaticCommunications: {
                ...latestData.current.settings.automaticCommunications,
                lastRunAt: new Date().toISOString(),
              },
            },
          };
        }
        for (const log of logs.filter((item) => item.status === "sent")) {
          const channel = log.channel === "email" ? "البريد" : log.channel === "whatsapp" ? "واتساب" : "SMS";
          await notify(
            `تم إشعار ${log.tenantName || "المستأجر"}`,
            `تم الإرسال عبر ${channel} للوحدة ${log.unitName || "غير محددة"}.`,
          );
        }
        const failures = logs.filter((item) => item.status === "failed");
        if (failures.length > 0) {
          toast.error(`تعذر إرسال ${failures.length} رسالة؛ ستتم إعادة المحاولة تلقائيًا`);
        }
      } catch (error) {
        console.warn("[Automatic Communications] cycle postponed", error);
      }
    };
    const onlineHandler = () => { void run(); };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("automatic-communication-ready", onlineHandler);
    const startup = window.setTimeout(() => { void run(); }, 1500);
    const interval = window.setInterval(() => { void run(); }, 5 * 60 * 1000);
    if (Capacitor.isNativePlatform()) {
      void import("@capacitor/app").then(async ({ App }) => {
        listener = await App.addListener("appStateChange", () => {
          void run();
        });
      });
    }
    return () => {
      active = false;
      window.clearTimeout(startup);
      window.clearInterval(interval);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("automatic-communication-ready", onlineHandler);
      void listener?.remove();
    };
  }, [data.settings.automaticCommunications, update]);
  return null;
}

function BackButtonHandler() {
  const navigate = useNavigate();
  const lastBack = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        await App.addListener("backButton", ({ canGoBack }) => {
          if (cancelled) return;
          if (hasOpenModal()) {
            dismissTopModal();
            return;
          }
          if (canGoBack || window.location.pathname !== "/") {
            navigate(-1);
            return;
          }
          const now = Date.now();
          if (now - lastBack.current < 2000) {
            App.exitApp();
          } else {
            lastBack.current = now;
            toast("اضغط رجوع مرة أخرى للخروج من التطبيق", { duration: 2500 });
          }
        });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return null;
}

function reminderRouteFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const route = parsed.searchParams.get("route");
    return route && route.startsWith("/") && !route.startsWith("//") ? route : null;
  } catch {
    return null;
  }
}

function NotificationNavigationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let appUrlListener: { remove: () => Promise<void> } | undefined;
    let notificationListener: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    void (async () => {
      const [{ App }, { LocalNotifications }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/local-notifications"),
      ]);

      const openRoute = (route: unknown) => {
        if (cancelled || typeof route !== "string" || !route.startsWith("/") || route.startsWith("//")) return;
        navigate(route);
      };

      appUrlListener = await App.addListener("appUrlOpen", ({ url }) => {
        openRoute(reminderRouteFromUrl(url));
      });
      notificationListener = await LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
        openRoute((notification.extra as { route?: unknown } | undefined)?.route);
      });

      const launchUrl = await App.getLaunchUrl();
      openRoute(reminderRouteFromUrl(launchUrl?.url));
    })().catch((error) => {
      console.error("[Notifications] Failed to initialize reminder navigation", error);
    });

    return () => {
      cancelled = true;
      void appUrlListener?.remove();
      void notificationListener?.remove();
    };
  }, [navigate]);

  return null;
}

const App = () => {
  useEffect(() => {
    setupStatusBar();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        await Keyboard.addListener("keyboardWillShow", (info) => {
          if (cancelled) return;
          document.documentElement.style.setProperty("--keyboard-height", `${info.keyboardHeight}px`);
          document.body.classList.add("keyboard-open");
        });
        await Keyboard.addListener("keyboardWillHide", () => {
          if (cancelled) return;
          document.documentElement.style.setProperty("--keyboard-height", "0px");
          document.body.classList.remove("keyboard-open");
        });
      } catch {
        // Keyboard plugin not available
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <StoreProvider>
        <NotificationChecker />
        <AutomaticBackupManager />
        <PaymentReminderCountdown />
        <AutomaticCommunicationManager />
        <AppDialogProvider>
          <BrowserRouter>
            <BackButtonHandler />
            <NotificationNavigationHandler />
            <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/buildings" element={<Buildings />} />
              <Route path="/buildings/:buildingId" element={<BuildingDetails />} />
              <Route path="/units/:unitId" element={<UnitDetails />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/month-close" element={<MonthClosePage />} />
              <Route path="/reports/audit" element={<AuditLogPage />} />
              <Route path="/actions" element={<ActionCenterPage />} />
              <Route path="/reports/owner/:buildingId" element={<OwnerReportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
              <Route path="/settings/home" element={<HomeDisplaySettingsPage />} />
              <Route path="/settings/backup" element={<BackupPage />} />
              <Route path="/settings/whatsapp" element={<WhatsAppSettingsPage />} />
              <Route path="/settings/communications" element={<AutomaticCommunicationsSettingsPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="/requests" element={<TenantRequests />} />
              <Route path="/requests/:requestId" element={<RequestDetails />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppDialogProvider>
      </StoreProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
