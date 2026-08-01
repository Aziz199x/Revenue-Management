import { NavLink } from "react-router-dom";
import { Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { settingsItems } from "./settingsNavigation";

export default function SettingsSectionNav() {
  return (
    <aside
      className="hidden min-[760px]:sticky min-[760px]:top-0 min-[760px]:flex min-[760px]:h-[calc(100dvh-4.75rem)] min-[760px]:flex-col min-[760px]:justify-center min-[760px]:overflow-y-auto min-[760px]:border-r min-[760px]:border-border min-[760px]:bg-card/70 min-[760px]:px-4 min-[760px]:pb-4 min-[760px]:pt-[max(1rem,env(safe-area-inset-top))] min-[760px]:[direction:rtl]"
      aria-label="صفحات الإعدادات"
    >
      <div className="mb-4 rounded-3xl border border-primary/10 bg-secondary/70 p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-background p-2 text-primary">
            <Settings className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold">الإعدادات</p>
            <p className="text-[10px] text-muted-foreground">انتقال سريع بين الصفحات</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-background p-3 shadow-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[10px] leading-5 text-muted-foreground">بيانات التطبيق محفوظة على جهازك.</p>
      </div>

      <nav className="space-y-2">
        {settingsItems.map(({ to, icon: Icon, title, description }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-start gap-2 rounded-2xl border border-transparent p-3 transition-colors",
                isActive
                  ? "border-primary/25 bg-secondary text-primary shadow-sm"
                  : "text-foreground hover:bg-muted",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn("mt-0.5 rounded-xl p-2", isActive ? "bg-background" : "bg-muted")}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{title}</span>
                  <span className="mt-0.5 block text-[9px] leading-4 text-muted-foreground">{description}</span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
