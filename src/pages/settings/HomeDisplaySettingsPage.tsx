import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import SettingsSubPageHeader from "@/components/settings/SettingsSubPageHeader";
import { useStore } from "@/data/store";

export default function HomeDisplaySettingsPage() {
  const { data, update } = useStore();

  const setSetting = (key: "homeContractDays" | "homeUpcomingPaymentDays" | "homeMaxItems", value: number) =>
    update((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));

  return (
    <div>
      <SettingsSubPageHeader title="تخصيص الشاشة الرئيسية" subtitle="تحكم في العقود والدفعات الظاهرة في لوحة التحكم" />
      <div className="space-y-4 p-4">
        <section className="space-y-4 rounded-3xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">إظهار العقود التي تنتهي خلال</Label>
            <Select
              value={String(data.settings.homeContractDays ?? 90)}
              onValueChange={(value) => setSetting("homeContractDays", Number(value))}
            >
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 يوم</SelectItem>
                <SelectItem value="60">60 يوم</SelectItem>
                <SelectItem value="90">90 يوم</SelectItem>
                <SelectItem value="120">120 يوم</SelectItem>
                <SelectItem value="180">180 يوم</SelectItem>
                <SelectItem value="99999">كل العقود</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">يشمل العقود التي ستتجدد تلقائيًا — العقود الأبعد من هذه المدة تختفي من الرئيسية فقط وتبقى في صفحاتها.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">إظهار الدفعات القادمة خلال</Label>
            <Select
              value={String(data.settings.homeUpcomingPaymentDays ?? 30)}
              onValueChange={(value) => setSetting("homeUpcomingPaymentDays", Number(value))}
            >
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 أيام</SelectItem>
                <SelectItem value="15">15 يوم</SelectItem>
                <SelectItem value="30">30 يوم</SelectItem>
                <SelectItem value="60">60 يوم</SelectItem>
                <SelectItem value="99999">كل الدفعات</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">أقصى عدد عناصر في كل قائمة</Label>
            <Select
              value={String(data.settings.homeMaxItems ?? 5)}
              onValueChange={(value) => setSetting("homeMaxItems", Number(value))}
            >
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="15">15</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
        <p className="text-[11px] text-muted-foreground">
          الدفعات المتأخرة تظهر دائمًا لأهميتها، ويحدها فقط أقصى عدد للعناصر.
        </p>
      </div>
    </div>
  );
}
