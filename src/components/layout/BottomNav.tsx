<<<<<<< HEAD
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
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md border-t border-border bg-card/95 backdrop-blur">
      <div className="grid grid-cols-5 pb-safe-nav">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "rounded-2xl px-4 py-1 transition-colors",
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
=======
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Wallet,
  ClipboardList,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/buildings", label: "العقارات", icon: Building2 },
  { to: "/payments", label: "الدفعات", icon: Wallet },
  { to: "/requests", label: "الطلبات", icon: ClipboardList },
  { to: "/reports", label: "التقارير", icon: BarChart3 },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md border-t border-border bg-card/95 backdrop-blur">
      <div className="grid grid-cols-6 pb-safe-nav">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "rounded-xl px-2.5 py-1 transition-colors",
                    isActive && "bg-secondary",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
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
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
