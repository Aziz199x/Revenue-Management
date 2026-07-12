import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { StoreProvider, useStore } from "@/data/store";
import { syncScheduledNotifications } from "@/utils/notifications";
import { setupStatusBar } from "@/utils/statusBar";
import { hasOpenModal, dismissTopModal } from "@/utils/modalStack";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Buildings from "./pages/Buildings";
import BuildingDetails from "./pages/BuildingDetails";
import UnitDetails from "./pages/UnitDetails";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/SettingsPage";
import NotificationSettingsPage from "./pages/settings/NotificationSettingsPage";
import WhatsAppSettingsPage from "./pages/settings/WhatsAppSettingsPage";
import TenantRequests from "./pages/TenantRequests";
import RequestDetails from "./pages/RequestDetails";
import BackupPage from "./pages/BackupPage";
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
        <BrowserRouter>
          <BackButtonHandler />
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/buildings" element={<Buildings />} />
              <Route path="/buildings/:buildingId" element={<BuildingDetails />} />
              <Route path="/units/:unitId" element={<UnitDetails />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
              <Route path="/settings/backup" element={<BackupPage />} />
              <Route path="/settings/whatsapp" element={<WhatsAppSettingsPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="/requests" element={<TenantRequests />} />
              <Route path="/requests/:requestId" element={<RequestDetails />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
