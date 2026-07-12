import { MessageCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SettingsSubPageHeader from "@/components/settings/SettingsSubPageHeader";
import { useStore } from "@/data/store";
import { DEFAULT_WHATSAPP_TEMPLATES } from "@/data/types";
import { showSuccess } from "@/utils/toast";

export default function WhatsAppSettingsPage() {
  const { data, update } = useStore();

  const updateTemplate = (field: keyof typeof data.settings.whatsappTemplates, value: string) => {
    update((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        whatsappTemplates: {
          ...prev.settings.whatsappTemplates,
          [field]: value,
        },
      },
    }));
  };

  return (
    <div>
      <SettingsSubPageHeader title="إعدادات واتساب" subtitle="إدارة تطبيق واتساب وقوالب الرسائل" />
      <div className="space-y-4 p-4">
        <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-100 p-2.5">
              <MessageCircle className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-bold">قوالب رسائل واتساب</p>
              <p className="text-xs text-muted-foreground">تستخدم هذه القوالب في تذكيرات الدفعات والعقود</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">رسالة تذكير بالإيجار</Label>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-border bg-background p-3 text-xs"
              dir="rtl"
              value={data.settings.whatsappTemplates.paymentReminder}
              onChange={(event) => updateTemplate("paymentReminder", event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">رسالة تذكير بالدفعة المتأخرة</Label>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-border bg-background p-3 text-xs"
              dir="rtl"
              value={data.settings.whatsappTemplates.overduePayment}
              onChange={(event) => updateTemplate("overduePayment", event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">رسالة انتهاء العقد</Label>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-border bg-background p-3 text-xs"
              dir="rtl"
              value={data.settings.whatsappTemplates.contractExpiry}
              onChange={(event) => updateTemplate("contractExpiry", event.target.value)}
            />
          </div>

          <div className="rounded-2xl bg-muted p-3">
            <p className="text-[11px] leading-5 text-muted-foreground">
              المتغيرات المتاحة: {"{tenantName}"} {"{buildingName}"} {"{unitName}"} {"{amount}"} {"{dueDate}"} {"{contractEndDate}"} {"{ownerName}"}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl text-xs"
            onClick={() => {
              update((prev) => ({
                ...prev,
                settings: { ...prev.settings, whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES },
              }));
              showSuccess("تمت استعادة قوالب واتساب الافتراضية");
            }}
          >
            <RotateCcw className="ml-1 h-3.5 w-3.5" />
            استعادة القوالب الافتراضية
          </Button>
        </section>
      </div>
    </div>
  );
}
