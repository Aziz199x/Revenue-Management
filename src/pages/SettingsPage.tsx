import { Link } from "react-router-dom";
import {
  Bell,
  ChevronLeft,
  Cloud,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

const settingsItems = [
  {
    to: "/settings/notifications",
    icon: Bell,
    title: "الإشعارات والتنبيهات",
    description: "إعداد تنبيهات العقود والدفعات والصيانة",
  },
  {
    to: "/settings/backup",
    icon: Cloud,
    title: "النسخ الاحتياطي والاستعادة",
    description: "النسخ المحلي وGoogle Drive وإدارة البيانات",
  },
  {
    to: "/settings/whatsapp",
    icon: MessageCircle,
    title: "إعدادات واتساب",
    description: "إدارة تطبيق واتساب وقوالب الرسائل",
  },
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="إدارة إعدادات التطبيق" />
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4">
          <div className="rounded-full bg-secondary p-2.5">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-bold">بياناتك على جهازك فقط</p>
            <p className="text-xs text-muted-foreground">
              اختر القسم المطلوب لإدارة إعدادات التطبيق بدون ازدحام في صفحة واحدة.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {settingsItems.map(({ to, icon: Icon, title, description }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-[76px] items-center gap-3 rounded-3xl border border-border bg-card p-4 text-right transition-transform active:scale-[0.98]"
            >
              <div className="rounded-2xl bg-secondary p-3">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
              <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
