import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function localDate(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(days: number): string {
  const value = new Date(`${localDate()}T00:00:00`);
  value.setDate(value.getDate() + Math.max(1, days));
  return localDate(value);
}

export interface CommunicationGraceValue {
  until: string;
  reason: string;
}

export default function CommunicationGraceDialog({
  open,
  onOpenChange,
  title,
  description,
  currentUntil,
  currentReason,
  onSave,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  currentUntil?: string;
  currentReason?: string;
  onSave: (value: CommunicationGraceValue) => void;
  onClear?: () => void;
}) {
  const [days, setDays] = useState(7);
  const [until, setUntil] = useState(addDays(7));
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setUntil(currentUntil || addDays(7));
    setReason(currentReason || "");
    if (currentUntil) {
      const difference = Math.ceil(
        (new Date(`${currentUntil}T00:00:00`).getTime() - new Date(`${localDate()}T00:00:00`).getTime())
        / 86_400_000,
      );
      setDays(Math.max(1, difference));
    } else {
      setDays(7);
    }
  }, [currentReason, currentUntil, open]);

  const valid = useMemo(() => !!until && until >= localDate() && !!reason.trim(), [reason, until]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[92vw] overflow-y-auto rounded-3xl sm:max-w-lg" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-right">
            <CalendarClock className="h-5 w-5 text-amber-600" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-right leading-6">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>مدة المهلة بالأيام</Label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[3, 7, 14, 30].map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={days === value ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => {
                    setDays(value);
                    setUntil(addDays(value));
                  }}
                >
                  {value}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(event) => {
                const value = Math.max(1, Math.min(365, Number(event.target.value) || 1));
                setDays(value);
                setUntil(addDays(value));
              }}
              className="mt-2 rounded-xl"
            />
          </div>
          <div>
            <Label>نهاية المهلة</Label>
            <Input type="date" min={localDate()} value={until} onChange={(event) => setUntil(event.target.value)} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label>سبب المهلة *</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="مثال: طلب المستأجر مهلة لترتيب السداد أو للرد بشأن التجديد"
              className="mt-1 min-h-24 rounded-xl"
            />
          </div>
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
            ستتوقف الرسائل التلقائية المرتبطة بهذا البند حتى نهاية المهلة، وتعود تلقائيًا بعد انتهائها إذا بقي الإجراء مستحقًا.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            disabled={!valid}
            className="rounded-xl"
            onClick={() => {
              onSave({ until, reason: reason.trim() });
              onOpenChange(false);
            }}
          >
            حفظ المهلة
          </Button>
          {currentUntil && onClear && (
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => {
                onClear();
                onOpenChange(false);
              }}
            >
              <Trash2 className="ml-1 h-4 w-4" />
              إلغاء المهلة
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
