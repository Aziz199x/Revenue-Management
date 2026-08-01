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
          <div className="min-[500px]:grid min-[500px]:grid-cols-[14rem_minmax(0,1fr)] min-[500px]:[direction:ltr]">
            <SettingsSectionNav />
            <div className="min-w-0 min-[500px]:col-start-2 min-[500px]:[direction:rtl]">
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
