import { useEffect, useState } from "react";
import { MessageCircle, Briefcase, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Capacitor } from "@capacitor/core";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (packageName: string | null) => void;
}

interface AppOption {
  packageName: string;
  label: string;
  icon: typeof MessageCircle;
}

export default function WhatsappPicker({ open, onOpenChange, onSelect }: Props) {
  const [options, setOptions] = useState<AppOption[]>([
    { packageName: "com.whatsapp", label: "واتساب", icon: MessageCircle },
  ]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (!Capacitor.isNativePlatform()) {
        setOptions([
          { packageName: "com.whatsapp", label: "واتساب", icon: MessageCircle },
        ]);
        return;
      }
      try {
        const { AppLauncher } = await import("@capacitor/app-launcher");
        const canWA = await AppLauncher.canOpenUrl({ url: "whatsapp://send" });
        if (canWA.value) {
          const found: AppOption[] = [];
          found.push({ packageName: "com.whatsapp", label: "واتساب", icon: MessageCircle });
          found.push({ packageName: "com.whatsapp.w4b", label: "واتساب أعمال", icon: Briefcase });
          setOptions(found);
        } else {
          setOptions([]);
        }
      } catch {
        setOptions([
          { packageName: "com.whatsapp", label: "واتساب", icon: MessageCircle },
        ]);
      }
    })();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85vw] rounded-3xl dialog-safe">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right">اختيار تطبيق واتساب</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {options.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              لا يوجد تطبيق واتساب مثبت على الجهاز.
            </p>
          )}
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.packageName}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-right active:scale-[0.98] transition-transform"
                onClick={() => onSelect(opt.packageName)}
              >
                <div className="rounded-full bg-emerald-100 p-2.5">
                  <Icon className="h-5 w-5 text-emerald-700" />
                </div>
                <span className="font-bold">{opt.label}</span>
              </button>
            );
          })}
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => onSelect(null)}
          >
            <X className="ml-1 h-4 w-4" />
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
