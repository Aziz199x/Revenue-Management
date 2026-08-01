import { useState } from "react";
import { AtSign, Building2, MessageCircle, RotateCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SettingsSubPageHeader from "@/components/settings/SettingsSubPageHeader";
import { useStore } from "@/data/store";
import {
  DEFAULT_COMPANY_EMAIL_TEMPLATES,
  DEFAULT_COMPANY_WHATSAPP_TEMPLATES,
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_WHATSAPP_TEMPLATES,
  EmailTemplates,
  WhatsAppTemplates,
} from "@/data/types";
import { showSuccess } from "@/utils/toast";

type Audience = "individual" | "company";
type TemplateKind = keyof EmailTemplates;

const templateLabels: Record<TemplateKind, string> = {
  paymentReminder: "تذكير بموعد الإيجار",
  overduePayment: "إشعار دفعة متأخرة",
  contractExpiry: "تذكير انتهاء العقد",
};

export default function WhatsAppSettingsPage() {
  const { data, update } = useStore();
  const [audience, setAudience] = useState<Audience>("individual");

  const whatsappTemplates = audience === "company"
    ? data.settings.companyWhatsappTemplates
    : data.settings.whatsappTemplates;
  const emailTemplates = audience === "company"
    ? data.settings.companyEmailTemplates
    : data.settings.emailTemplates;

  const updateWhatsAppTemplate = (kind: keyof WhatsAppTemplates, value: string) => {
    update((previous) => ({
      ...previous,
      settings: audience === "company"
        ? {
            ...previous.settings,
            companyWhatsappTemplates: { ...previous.settings.companyWhatsappTemplates, [kind]: value },
          }
        : {
            ...previous.settings,
            whatsappTemplates: { ...previous.settings.whatsappTemplates, [kind]: value },
          },
    }));
  };

  const updateEmailTemplate = (kind: TemplateKind, field: "subject" | "body", value: string) => {
    update((previous) => ({
      ...previous,
      settings: audience === "company"
        ? {
            ...previous.settings,
            companyEmailTemplates: {
              ...previous.settings.companyEmailTemplates,
              [kind]: { ...previous.settings.companyEmailTemplates[kind], [field]: value },
            },
          }
        : {
            ...previous.settings,
            emailTemplates: {
              ...previous.settings.emailTemplates,
              [kind]: { ...previous.settings.emailTemplates[kind], [field]: value },
            },
          },
    }));
  };

  const resetChannel = (channel: "whatsapp" | "email") => {
    update((previous) => {
      if (channel === "whatsapp") {
        return {
          ...previous,
          settings: audience === "company"
            ? { ...previous.settings, companyWhatsappTemplates: DEFAULT_COMPANY_WHATSAPP_TEMPLATES }
            : { ...previous.settings, whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES },
        };
      }
      return {
        ...previous,
        settings: audience === "company"
          ? { ...previous.settings, companyEmailTemplates: DEFAULT_COMPANY_EMAIL_TEMPLATES }
          : { ...previous.settings, emailTemplates: DEFAULT_EMAIL_TEMPLATES },
      };
    });
    showSuccess(`تمت استعادة قوالب ${audience === "company" ? "الشركات" : "الأفراد"} الافتراضية`);
  };

  return (
    <div>
      <SettingsSubPageHeader title="قوالب التبليغ" subtitle="قوالب مستقلة لواتساب والبريد وللأفراد والشركات" />
      <div className="mx-auto max-w-[1400px] space-y-4 p-4">
        <section className="rounded-3xl border border-border bg-card p-3">
          <p className="mb-2 text-sm font-bold">نوع المستلم</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            <Button
              type="button"
              variant={audience === "individual" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => setAudience("individual")}
            >
              <User className="ml-1 h-4 w-4" /> فرد
            </Button>
            <Button
              type="button"
              variant={audience === "company" ? "default" : "ghost"}
              className="rounded-xl"
              onClick={() => setAudience("company")}
            >
              <Building2 className="ml-1 h-4 w-4" /> شركة
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            يختار التطبيق القالب تلقائيًا حسب صفة المستأجر المسجلة في بيانات الوحدة.
          </p>
        </section>

        <Tabs defaultValue="whatsapp" dir="rtl">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl">
            <TabsTrigger value="whatsapp" className="rounded-xl">
              <MessageCircle className="ml-1 h-4 w-4" /> واتساب
            </TabsTrigger>
            <TabsTrigger value="email" className="rounded-xl">
              <AtSign className="ml-1 h-4 w-4" /> البريد
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp" className="mt-4">
            <section className="space-y-4 rounded-3xl border border-emerald-200 bg-card p-4">
              <div>
                <p className="font-bold">قوالب واتساب · {audience === "company" ? "شركة" : "فرد"}</p>
                <p className="text-xs text-muted-foreground">تستخدم في واتساب ورسائل SMS اليدوية والتلقائية.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(templateLabels) as TemplateKind[]).map((kind) => (
                  <div key={kind} className="flex min-w-0 flex-col space-y-1.5 rounded-2xl bg-muted/60 p-3">
                    <Label className="text-sm font-bold">{templateLabels[kind]}</Label>
                    <Textarea
                      className="min-h-40 flex-1 resize-y rounded-2xl text-sm leading-7"
                      dir="rtl"
                      value={whatsappTemplates[kind]}
                      onChange={(event) => updateWhatsAppTemplate(kind, event.target.value)}
                    />
                  </div>
                ))}
              </div>
              <p className="rounded-xl bg-secondary p-2 text-[10px] leading-5 text-muted-foreground">
                المتغيرات: {"{tenantName}"} {"{buildingName}"} {"{unitName}"} {"{paymentNumber}"} {"{amount}"} {"{dueDate}"} {"{periodStart}"} {"{periodEnd}"} {"{contractEndDate}"} {"{ownerName}"}
              </p>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => resetChannel("whatsapp")}>
                <RotateCcw className="ml-1 h-4 w-4" /> استعادة افتراضي {audience === "company" ? "الشركة" : "الفرد"}
              </Button>
            </section>
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <section className="space-y-4 rounded-3xl border border-sky-200 bg-card p-4">
              <div>
                <p className="font-bold">قوالب البريد · {audience === "company" ? "شركة" : "فرد"}</p>
                <p className="text-xs text-muted-foreground">عنوان ونص مستقلان لكل نوع من التبليغات.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(templateLabels) as TemplateKind[]).map((kind) => (
                  <div key={kind} className="flex min-w-0 flex-col space-y-2 rounded-2xl bg-muted/60 p-3">
                    <p className="text-sm font-bold">{templateLabels[kind]}</p>
                    <div>
                      <Label className="text-xs">عنوان الرسالة</Label>
                      <Input
                        value={emailTemplates[kind].subject}
                        onChange={(event) => updateEmailTemplate(kind, "subject", event.target.value)}
                        className="mt-1 rounded-xl text-sm"
                      />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <Label className="text-xs">نص الرسالة</Label>
                      <Textarea
                        value={emailTemplates[kind].body}
                        onChange={(event) => updateEmailTemplate(kind, "body", event.target.value)}
                        className="mt-1 min-h-40 flex-1 resize-y rounded-xl text-sm leading-7"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="rounded-xl bg-secondary p-2 text-[10px] leading-5 text-muted-foreground">
                المتغيرات: {"{recipientGreeting}"} {"{tenantName}"} {"{buildingName}"} {"{unitName}"} {"{amount}"} {"{dueDate}"} {"{periodStart}"} {"{periodEnd}"} {"{contractEndDate}"}
              </p>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => resetChannel("email")}>
                <RotateCcw className="ml-1 h-4 w-4" /> استعادة افتراضي {audience === "company" ? "الشركة" : "الفرد"}
              </Button>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
