import { useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { modalManager } from "@/utils/modalStack";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export default function FormSheet({ open, onOpenChange, title, children }: Props) {
  useEffect(() => {
    const close = () => onOpenChange(false);
    if (open) {
      modalManager.open(close);
    }
    return () => {
      modalManager.close(close);
    };
  }, [open, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
<<<<<<< HEAD
        className="bottom-sheet-content max-h-[85dvh] overflow-y-auto rounded-t-3xl modal-safe"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px) + var(--keyboard-height, 0px))" }}
=======
        className="sheet-safe-bottom max-h-[90dvh] overflow-y-auto rounded-t-3xl"
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
      >
        <SheetHeader className="text-right">
          <SheetTitle className="text-right">{title}</SheetTitle>
        </SheetHeader>
        <div className="pt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
