import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsSubPageHeaderProps {
  title: string;
  subtitle?: string;
}

export default function SettingsSubPageHeader({ title, subtitle }: SettingsSubPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 px-4 pb-3 pt-safe backdrop-blur">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={() => navigate("/settings")}
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}
