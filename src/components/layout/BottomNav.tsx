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
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[1600px] border-t border-border bg-card/95 backdrop-blur min-[500px]:sticky min-[500px]:top-0 min-[500px]:col-start-1 min-[500px]:row-start-1 min-[500px]:h-screen min-[500px]:border-r min-[500px]:border-t-0 min-[500px]:[direction:rtl]">
      <div className="grid grid-cols-5 pb-safe-nav min-[500px]:flex min-[500px]:h-full min-[500px]:flex-col min-[500px]:justify-center min-[500px]:gap-2 min-[500px]:px-1.5 min-[500px]:pb-0">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors min-[500px]:justify-center min-[500px]:rounded-2xl min-[500px]:py-3",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "rounded-2xl px-4 py-1 transition-colors min-[500px]:px-2.5 min-[500px]:py-2",
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
