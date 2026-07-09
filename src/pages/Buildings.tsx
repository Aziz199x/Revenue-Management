import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Building2, Search, DoorOpen, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormSheet from "@/components/shared/FormSheet";
import BuildingForm from "@/components/forms/BuildingForm";
import { useStore, genId } from "@/data/store";
import { buildingStats, formatMoney, formatDate, todayISO } from "@/data/helpers";
import { showSuccess } from "@/utils/toast";

export default function Buildings() {
  const { data, update } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const buildings = data.buildings.filter((b) =>
    b.name.includes(query.trim()),
  );

  return (
    <div>
      <PageHeader
        title="العقارات"
        subtitle={`${data.buildings.length} عقار`}
        action={
          <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="ml-1 h-4 w-4" /> إضافة
          </Button>
        }
      />
      <div className="space-y-3 p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث عن عقار..."
            className="rounded-2xl bg-card pr-9"
          />
        </div>

        {buildings.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="لا توجد عقارات بعد"
            description="ابدأ بإضافة أول عقار لك من زر الإضافة بالأعلى"
          />
        ) : (
          buildings.map((b, i) => {
            const stats = buildingStats(data, b.id);
            return (
              <Link
                key={b.id}
                to={`/buildings/${b.id}`}
                className="block animate-fade-up rounded-3xl border border-border bg-card p-4 shadow-sm transition-transform active:scale-[0.98]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-secondary p-3">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">{b.name}</p>
                      {b.address && (
                        <p className="text-xs text-muted-foreground">{b.address}</p>
                      )}
                    </div>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                    {stats.unitsCount} وحدة
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                  <div className="col-span-2 rounded-2xl bg-muted p-2 sm:col-span-1">
                    <p className="text-[11px] text-muted-foreground">الدخل</p>
                    <p className="text-sm font-bold text-primary">
                      {formatMoney(stats.totalIncome)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted p-2">
                    <p className="text-[11px] text-muted-foreground">مؤجرة</p>
                    <p className="text-sm font-bold text-emerald-700">{stats.occupied}</p>
                  </div>
                  <div className="rounded-2xl bg-muted p-2">
                    <p className="text-[11px] text-muted-foreground">شاغرة</p>
                    <p className="text-sm font-bold text-slate-600">{stats.vacant}</p>
                  </div>
                  <div className="min-w-0 rounded-2xl bg-muted p-2">
                    <p className="text-[11px] text-muted-foreground">رسوم التحصيل</p>
                    <p className="break-words text-sm font-bold text-amber-700">{formatMoney(stats.totalCollectionFees)}</p>
                  </div>
                  <div className="min-w-0 rounded-2xl bg-muted p-2">
                    <p className="text-[11px] text-muted-foreground">تكاليف الصيانة</p>
                    <p className="break-words text-sm font-bold text-orange-700">{formatMoney(stats.maintenanceCost)}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <DoorOpen className="h-3.5 w-3.5 text-primary" />
                    أقرب استحقاق إيجار: {formatDate(stats.upcomingDue)}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-accent-foreground" />
                    أقرب انتهاء عقد: {formatDate(stats.nearestExpiry)}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <FormSheet open={open} onOpenChange={setOpen} title="إضافة عقار جديد">
        <BuildingForm
          onSubmit={(values) => {
            update((prev) => ({
              ...prev,
              buildings: [
                ...prev.buildings,
                { id: genId(), createdAt: todayISO(), ...values },
              ],
            }));
            setOpen(false);
            showSuccess("تمت إضافة العقار بنجاح");
          }}
        />
      </FormSheet>
    </div>
  );
}
