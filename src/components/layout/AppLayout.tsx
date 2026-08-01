import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import SettingsSectionNav from "@/components/settings/SettingsSectionNav";

export default function AppLayout() {
  const location = useLocation();
  const isSettingsSubPage = location.pathname.startsWith("/settings/");

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1600px] bg-background">
      <main className="pb-safe">
        {isSettingsSubPage ? (
          <div className="min-[760px]:grid min-[760px]:min-h-[calc(100dvh-4.75rem)] min-[760px]:grid-cols-[15rem_minmax(0,1fr)] min-[760px]:[direction:ltr]">
            <SettingsSectionNav />
            <div className="min-w-0 min-[760px]:col-start-2 min-[760px]:[direction:rtl]">
              <Outlet />
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <BottomNav />
    </div>
  );
}
