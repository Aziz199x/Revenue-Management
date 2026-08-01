import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
}

// On native Android, back navigation is handled exclusively by the system
// back button/gesture (see the "backButton" listener in App.tsx). Showing a
// second, in-app back arrow is redundant and can lead to a different history
// entry than the hardware button, which is confusing. Web and iOS builds
// have no equivalent system control, so they keep the on-screen arrow.
const showInAppBackButton = Capacitor.getPlatform() !== "android";

export default function PageHeader({ title, subtitle, back, action }: Props) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 px-4 pb-3 pt-safe backdrop-blur">
      <div className="flex items-center gap-2">
        {back && showInAppBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={() => navigate(-1)}
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{title}</h1>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}
