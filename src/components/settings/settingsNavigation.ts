import {
  Bell,
  Cloud,
  LayoutDashboard,
  MessageCircle,
  Send,
} from "lucide-react";

export const settingsItems = [
  {
    to: "/settings/notifications",
    icon: Bell,
    title: "الإشعارات والتنبيهات",
    description: "تنبيهات العقود والدفعات والصيانة",
  },
  {
    to: "/settings/home",
    icon: LayoutDashboard,
    title: "تخصيص الشاشة الرئيسية",
    description: "العقود والدفعات الظاهرة في لوحة التحكم",
  },
  {
    to: "/settings/backup",
    icon: Cloud,
    title: "النسخ الاحتياطي والاستعادة",
    description: "النسخ المحلي وGoogle Drive وإدارة البيانات",
  },
  {
    to: "/settings/communications",
    icon: Send,
    title: "الإرسال التلقائي والبريد",
    description: "جدولة الإيجار وربط حسابات الإرسال",
  },
  {
    to: "/settings/whatsapp",
    icon: MessageCircle,
    title: "قوالب التبليغ",
    description: "قوالب واتساب والبريد للأفراد والشركات",
  },
] as const;
