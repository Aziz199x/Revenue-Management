import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Wallet,
  ClipboardList,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/buildings", label: "العقارات", icon: Building2 },
  { to: "/payments", label: "الدفعات", icon: Wallet },
  { to: "/requests", label: "الطلبات", icon: ClipboardList },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[1600px] border-t border-border bg-card/95 backdrop-blur md:sticky md:top-0 md:col-start-1 md:row-start-1 md:h-screen md:border-r md:border-t-0 md:[direction:rtl]">
      <div className="grid grid-cols-5 pb-safe-nav md:flex md:h-full md:flex-col md:justify-center md:gap-2 md:px-2 md:pb-0">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors md:justify-center md:rounded-2xl md:py-4",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "rounded-2xl px-4 py-1 transition-colors md:px-3 md:py-2",
                    isActive && "bg-secondary",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
