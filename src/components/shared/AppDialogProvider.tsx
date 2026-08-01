import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "warning" | "destructive";
}

interface PromptOptions extends ConfirmOptions {
  inputLabel?: string;
  placeholder?: string;
  initialValue?: string;
  required?: boolean;
}

interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

type DialogRequest =
  | ({ mode: "confirm"; resolve: (value: boolean) => void } & ConfirmOptions)
  | ({ mode: "prompt"; resolve: (value: string | null) => void } & PromptOptions);

const AppDialogContext = createContext<DialogApi | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState("");
  const [validationVisible, setValidationVisible] = useState(false);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setValue("");
    setValidationVisible(false);
    setRequest({ ...options, mode: "confirm", resolve });
  }), []);

  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => {
    setValue(options.initialValue || "");
    setValidationVisible(false);
    setRequest({ ...options, mode: "prompt", resolve });
  }), []);

  const cancel = () => {
    if (!request) return;
    if (request.mode === "confirm") request.resolve(false);
    else request.resolve(null);
    setRequest(null);
  };

  const submit = () => {
    if (!request) return;
    if (request.mode === "prompt") {
      if (request.required !== false && !value.trim()) {
        setValidationVisible(true);
        return;
      }
      request.resolve(value.trim());
    } else {
      request.resolve(true);
    }
    setRequest(null);
  };

  const destructive = request?.tone === "destructive";
  const warning = request?.tone === "warning";

  return (
    <AppDialogContext.Provider value={{ confirm, prompt }}>
      {children}
      <Dialog open={!!request} onOpenChange={(open) => { if (!open) cancel(); }}>
        <DialogContent className="max-w-[92vw] rounded-3xl border-border bg-card p-5 text-right sm:max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <div className={`mb-2 flex h-11 w-11 items-center justify-center rounded-2xl ${
              destructive || warning ? "bg-amber-100 text-amber-700" : "bg-secondary text-primary"
            }`}>
              {destructive || warning ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
            </div>
            <DialogTitle className="text-right text-lg">{request?.title}</DialogTitle>
            <DialogDescription className="whitespace-pre-line text-right text-sm leading-7">
              {request?.description}
            </DialogDescription>
          </DialogHeader>

          {request?.mode === "prompt" && (
            <div className="space-y-2">
              <Label>{request.inputLabel || "السبب"}</Label>
              <Textarea
                autoFocus
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  if (event.target.value.trim()) setValidationVisible(false);
                }}
                placeholder={request.placeholder || "اكتب التفاصيل هنا"}
                className="min-h-28 rounded-2xl text-sm leading-6"
              />
              {validationVisible && (
                <p className="text-xs font-semibold text-destructive">هذا الحقل مطلوب للمتابعة</p>
              )}
            </div>
          )}

          <DialogFooter className="mt-2 flex-row gap-2 sm:justify-start">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={cancel}>
              {request?.cancelLabel || "إلغاء"}
            </Button>
            <Button
              type="button"
              className={`flex-1 rounded-xl ${destructive ? "bg-destructive hover:bg-destructive/90" : ""}`}
              onClick={submit}
            >
              {request?.confirmLabel || "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): DialogApi {
  const context = useContext(AppDialogContext);
  if (!context) throw new Error("useAppDialog must be used inside AppDialogProvider");
  return context;
}
