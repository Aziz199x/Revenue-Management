import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StoreProvider, useStore } from "@/data/store";
import { checkAndNotify } from "@/utils/notifications";
import { setupStatusBar } from "@/utils/statusBar";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Buildings from "./pages/Buildings";
import BuildingDetails from "./pages/BuildingDetails";
import UnitDetails from "./pages/UnitDetails";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function NotificationChecker() {
  const { data } = useStore();
  useEffect(() => {
    checkAndNotify(data);
    const interval = setInterval(() => checkAndNotify(data), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [data]);
  return null;
}

const App = () => {
  useEffect(() => {
    setupStatusBar();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <StoreProvider>
        <NotificationChecker />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/buildings" element={<Buildings />} />
              <Route path="/buildings/:buildingId" element={<BuildingDetails />} />
              <Route path="/units/:unitId" element={<UnitDetails />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<SettingsPage />} />
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
