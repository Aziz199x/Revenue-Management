import { Link } from "react-router-dom";
import {
  Building2,
  Wallet,
  AlertTriangle,
  Wrench,
  Bell,
  FileText,
  Zap,
  ChevronLeft,
  Home,
  CalendarClock,
  ClipboardList,
  MessageCircle,
  Gavel,
  Search,
  Send,
  BarChart3,
  ClipboardCheck,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import WhatsappPreview from "@/components/shared/WhatsappPreview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/data/store";
import {
  globalStats,
  collectReminders,
  collectPaymentCards,
  requestStats,
  formatMoney,
  formatDate,
  getDaysUntilDate,
  buildContractExpiryReminders,
  getContractEndDate,
  getActiveContractsNeedingAttention,
  isPaymentPaid,
  normalizePaymentFinancials,
  calculateNetAmountToTransferToOwner,
} from "@/data/helpers";
import { buildPaymentMessageContent, getTenantPhoneNumbers } from "@/utils/automaticCommunications";
import { useMemo, useState } from "react";

const DASHBOARD_PROPERTY_KEY = "dashboard_selected_property";

const kindIcons = {
  rent: Wallet,
  contract: FileText,
  maintenance: Wrench,
  bill: Zap,
  request: ClipboardList,
  eviction: Gavel,
  owner_transfer: Send,
};

const kindColors = {
  rent: "bg-secondary text-primary",
  contract: "bg-amber-100 text-amber-700",
  maintenance: "bg-orange-100 text-orange-700",
  bill: "bg-sky-100 text-sky-700",
  request: "bg-purple-100 text-purple-700",
  eviction: "bg-red-100 text-red-700",
  owner_transfer: "bg-cyan-100 text-cyan-700",
};

export default function Index() {
  const { data } = useStore();
  const [selectedProperty, setSelectedProperty] = useState(() => localStorage.getItem(DASHBOARD_PROPERTY_KEY) || "all");
  const [whatsappPreview, setWhatsappPreview] = useState<{ phones: string[]; message: string } | null>(null);
  const safeProperty = selectedProperty === "all" || data.buildings.some((b) => b.id === selectedProperty) ? selectedProperty : "all";
  const dashboardData = useMemo(() => {
    if (safeProperty === "all") return data;
    const units = data.units.filter((unit) => unit.buildingId === safeProperty);
    const unitIds = new Set(units.map((unit) => unit.id));
    return {
      ...data,
      buildings: data.buildings.filter((building) => building.id === safeProperty),
      units,
      tenants: data.tenants.filter((tenant) => unitIds.has(tenant.unitId)),
      payments: data.payments.filter((payment) => unitIds.has(payment.unitId)),
      contracts: data.contracts.filter((contract) => unitIds.has(contract.unitId)),
      repairs: data.repairs.filter((repair) => unitIds.has(repair.unitId)),
      bills: data.bills.filter((bill) => unitIds.has(bill.unitId)),
    };
  }, [data, safeProperty]);
  const stats = globalStats(dashboardData);
  const reminders = collectReminders(dashboardData).filter((reminder) => reminder.kind !== "contract");
  const contractExpiryReminders = buildContractExpiryReminders(dashboardData.contracts, dashboardData.units, dashboardData.buildings, dashboardData.settings.contractReminderDays);
  const nearestContractStatus = getActiveContractsNeedingAttention(dashboardData.contracts)
    .map((contract) => {
        const unit = dashboardData.units.find((item) => String(item.id) === String(contract.unitId));
        const building = dashboardData.buildings.find((item) => item.id === unit?.buildingId);
        const endDate = getContractEndDate(contract) || contract.endDate;
        return {
          id: `info-${contract.id}`,
          contractId: contract.id,
          unitId: String(contract.unitId),
          tenantName: contract.tenantName || "غير محدد",
          unitName: unit?.name || "غير محددة",
          buildingName: building?.name || "غير محدد",
          contractNumber: contract.contractNumber,
          autoRenewal: contract.autoRenewal === true,
          date: endDate,
          daysRemaining: getDaysUntilDate(endDate) ?? 999999,
        };
      })
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 8);
  const paymentCards = collectPaymentCards(dashboardData);

  // Home display customization (Settings → تخصيص الشاشة الرئيسية)
  const homeContractDays = data.settings.homeContractDays ?? 90;
  const homeUpcomingDays = data.settings.homeUpcomingPaymentDays ?? 30;
  const homeMaxItems = data.settings.homeMaxItems ?? 5;

  const upcomingPayments = paymentCards
    .filter((c) => c.status === "upcoming" && c.days <= homeUpcomingDays)
    .slice(0, homeMaxItems);
  const overduePayments = paymentCards.filter((c) => c.status === "overdue").slice(0, homeMaxItems);
  const generalReminders = reminders.filter((reminder) => reminder.kind !== "rent").slice(0, homeMaxItems);
  const pendingOwnerTransfers = dashboardData.payments
    .filter((payment) => !payment.deletedAt && isPaymentPaid(payment) && !payment.ownerTransferred);
  const pendingOwnerTransferAmount = pendingOwnerTransfers.reduce(
    (sum, payment) => sum + calculateNetAmountToTransferToOwner(normalizePaymentFinancials(payment)),
    0,
  );
  const nearestContracts = [
    ...contractExpiryReminders,
    ...nearestContractStatus.filter((item) =>
      !contractExpiryReminders.some((reminder) => reminder.contractId === item.id.replace(/^info-/, "")),
    ),
  ]
    .filter((item) => (item.daysRemaining ?? 0) <= homeContractDays)
    .slice(0, homeMaxItems);

  return (
    <div>
      <PageHeader
        title="مدير العقارات"
        subtitle="لوحة التحكم الرئيسية"
        action={
          <div className="flex items-center gap-1">
            <Link to="/reports" aria-label="التقارير المالية" title="التقارير المالية" className="rounded-full p-2 text-primary hover:bg-secondary">
              <BarChart3 className="h-5 w-5" />
            </Link>
            <Link to="/actions" aria-label="مركز الإجراءات" title="مركز الإجراءات" className="rounded-full p-2 text-orange-700 hover:bg-orange-50">
              <ClipboardCheck className="h-5 w-5" />
            </Link>
            <Link to="/search" aria-label="البحث الشامل" title="البحث الشامل" className="rounded-full p-2 hover:bg-secondary">
              <Search className="h-5 w-5" />
            </Link>
          </div>
        }
      />
      <div className="space-y-4 p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">فلترة حسب العقار</label>
          <Select value={safeProperty} onValueChange={(value) => { setSelectedProperty(value); localStorage.setItem(DASHBOARD_PROPERTY_KEY, value); }}>
            <SelectTrigger className="rounded-2xl bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العقارات</SelectItem>
              {data.buildings.map((building) => <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Hero income card */}
        <div className="animate-fade-up rounded-3xl bg-primary p-5 text-primary-foreground">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Wallet className="h-4 w-4" />
            صافي الدخل بعد رسوم التحصيل
          </div>
          <p className="mt-1 text-3xl font-extrabold">{formatMoney(stats.totalIncome)}</p>
          {stats.totalCollectionFees > 0 && (
            <div className="mt-2 flex gap-4 text-xs opacity-80">
              <span>إجمالي الإيجار المحصل: {formatMoney(stats.totalGrossIncome)}</span>
              <span>رسوم التحصيل: {formatMoney(stats.totalCollectionFees)}</span>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-xs opacity-80">غير مدفوع</p>
              <p className="font-bold">{formatMoney(stats.unpaidTotal)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-xs opacity-80">متأخرات</p>
              <p className="font-bold">{formatMoney(stats.overdueTotal)}</p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <Link to="/buildings" className="rounded-2xl border border-border bg-card p-3 text-center active:scale-95 transition-transform">
            <Building2 className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-lg font-bold">{data.buildings.length}</p>
            <p className="text-[11px] text-muted-foreground">عقار</p>
          </Link>
          <Link to="/buildings" className="rounded-2xl border border-border bg-card p-3 text-center active:scale-95 transition-transform">
            <Home className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-lg font-bold">{data.units.length}</p>
            <p className="text-[11px] text-muted-foreground">وحدة</p>
          </Link>
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <Wrench className="mx-auto h-5 w-5 text-amber-600" />
            <p className="mt-1 text-lg font-bold">{formatMoney(stats.maintenanceTotal)}</p>
            <p className="text-[11px] text-muted-foreground">صيانة</p>
          </div>
        </div>

        {/* Request Stats */}
        {(() => {
          const rs = requestStats(data);
          return (
            <section className="space-y-2 animate-fade-up" style={{ animationDelay: "120ms" }}>
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-sm font-bold">طلبات المستأجرين</h2>
                  <p className="text-[11px] text-muted-foreground">ملخص حالة جميع الطلبات</p>
                </div>
                <Link
                  to="/requests"
                  className="flex items-center gap-1 rounded-xl bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 transition-transform active:scale-95"
                >
                  عرض جميع الطلبات
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-2xl border border-border bg-card p-2.5 text-center">
                  <ClipboardList className="mx-auto h-4 w-4 text-purple-600" />
                  <p className="text-sm font-bold">{rs.open}</p>
                  <p className="text-[10px] text-muted-foreground">مفتوحة</p>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-2.5 text-center">
                  <AlertTriangle className="mx-auto h-4 w-4 text-red-600" />
                  <p className="text-sm font-bold">{rs.urgent}</p>
                  <p className="text-[10px] text-red-600">عاجلة</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-2.5 text-center">
                  <CalendarClock className="mx-auto h-4 w-4 text-amber-600" />
                  <p className="text-sm font-bold">{rs.overdue}</p>
                  <p className="text-[10px] text-amber-600">متأخرة</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
                  <ClipboardList className="mx-auto h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-bold">{rs.completedThisMonth}</p>
                  <p className="text-[10px] text-emerald-600">هذا الشهر</p>
                </div>
              </div>
            </section>
          );
        })()}

        {stats.overdueTotal > 0 && (
          <Link
            to="/payments"
            className="flex items-center gap-3 rounded-3xl border border-red-200 bg-red-50 p-4 animate-fade-up"
            style={{ animationDelay: "160ms" }}
          >
            <div className="rounded-full bg-red-100 p-2.5">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-700">لديك متأخرات إيجار</p>
              <p className="text-xs text-red-600">{formatMoney(stats.overdueTotal)} بحاجة للتحصيل</p>
            </div>
            <ChevronLeft className="h-5 w-5 text-red-400" />
          </Link>
        )}

        {pendingOwnerTransfers.length > 0 && (
          <Link
            to="/payments"
            className="flex items-center gap-3 rounded-3xl border border-cyan-200 bg-cyan-50 p-4 animate-fade-up"
            style={{ animationDelay: "170ms" }}
          >
            <div className="rounded-full bg-cyan-100 p-2.5">
              <Send className="h-5 w-5 text-cyan-700" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-cyan-800">دفعات بانتظار التحويل للمالك</p>
              <p className="text-xs text-cyan-700">
                {pendingOwnerTransfers.length} دفعة · {formatMoney(pendingOwnerTransferAmount)}
              </p>
            </div>
            <ChevronLeft className="h-5 w-5 text-cyan-500" />
          </Link>
        )}

        <Tabs
          defaultValue="payments"
          dir="rtl"
          className="animate-fade-up"
          style={{ animationDelay: "180ms" }}
        >
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted p-1">
            <TabsTrigger value="contracts" className="rounded-xl py-2 text-[11px] font-bold">
              أقرب العقود
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-xl py-2 text-[11px] font-bold">
              الدفعات القادمة
            </TabsTrigger>
            <TabsTrigger value="general" className="rounded-xl py-2 text-[11px] font-bold">
              التذكيرات العامة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contracts" className="mt-3 space-y-2">
            {nearestContracts.length === 0 ? (
              <EmptyState icon={CalendarClock} title="لا توجد عقود قريبة" description="ستظهر هنا أقرب العقود للانتهاء" />
            ) : (
              nearestContracts.map((reminder) => (
                <Link key={reminder.id} to={`/units/${encodeURIComponent(reminder.unitId)}?tab=contract&item=${encodeURIComponent(reminder.contractId)}`} className={`block overflow-hidden rounded-2xl border px-3 py-2.5 ${reminder.autoRenewal ? "border-sky-200 bg-sky-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className={`text-xs font-semibold ${reminder.autoRenewal ? "text-sky-700" : "text-amber-800"}`}>{reminder.autoRenewal ? "عقد سيتجدد تلقائيا" : "عقد قريب من الانتهاء"}</p>
                      <p className="text-sm font-bold text-foreground">{reminder.tenantName || "مستأجر غير محدد"}</p>
                      <p className="truncate text-xs text-muted-foreground">العقار: {reminder.buildingName || "غير محدد"} · الوحدة: {reminder.unitName || "غير محددة"}</p>
                      <p className="text-[11px] text-muted-foreground">رقم العقد: {reminder.contractNumber || "غير مسجل"} · ينتهي: {formatDate(reminder.date)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${reminder.autoRenewal ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                      {reminder.daysRemaining === 0 ? "اليوم" : `بعد ${reminder.daysRemaining} يوم`}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-3 space-y-2">
            {[...overduePayments, ...upcomingPayments].length === 0 ? (
              <EmptyState icon={Wallet} title="لا توجد دفعات قريبة" description="ستظهر هنا الدفعات القادمة أو المتأخرة" />
            ) : (
              [...overduePayments, ...upcomingPayments].map((pc) => (
                <Link
                  key={pc.id}
                  to={pc.route}
                  className={`block rounded-3xl border p-3.5 transition-transform active:scale-[0.98] ${pc.status === "overdue" ? "border-red-200 bg-red-50" : "border-border bg-card"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{pc.tenantName}</p>
                      <p className="truncate text-xs text-muted-foreground">{pc.buildingName} · {pc.unitName}</p>
                      <p className="mt-1 font-bold text-primary">{formatMoney(pc.amount)}</p>
                    </div>
                    <div className="mr-2 text-left">
                      <p className={`text-xs font-bold ${pc.status === "overdue" ? "text-red-600" : pc.days === 0 ? "text-amber-600" : "text-primary"}`}>
                        {pc.status === "overdue" ? `متأخر ${Math.abs(pc.days)} يوم` : pc.days === 0 ? "اليوم" : `بعد ${pc.days} يوم`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(pc.dueDate)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </TabsContent>

          <TabsContent value="general" className="mt-3 space-y-2">
            {generalReminders.length === 0 ? (
              <EmptyState icon={Bell} title="لا توجد تذكيرات عامة" description="ستظهر هنا الصيانة والفواتير والتحويلات المعلقة" />
            ) : (
              generalReminders.map((r) => {
                const Icon = kindIcons[r.kind];
                return (
                  <Link key={r.id} to={r.route} className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3.5 transition-transform active:scale-[0.98]">
                    <div className={`rounded-2xl p-2.5 ${r.kind === "contract" && r.autoRenewal ? "bg-sky-100 text-sky-700" : kindColors[r.kind]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-bold ${r.days < 0 ? "text-red-600" : r.days <= 7 ? "text-amber-600" : "text-primary"}`}>
                        {r.days < 0 ? `متأخر ${-r.days} يوم` : r.days === 0 ? "اليوم" : `بعد ${r.days} يوم`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(r.date)}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        {/* Overdue Payments */}
        {false && overduePayments.length > 0 && (
          <div className="animate-fade-up" style={{ animationDelay: "140ms" }}>
            <h2 className="mb-2 flex items-center gap-2 font-bold text-red-600">
              <AlertTriangle className="h-4 w-4" /> دفعات متأخرة
            </h2>
            <div className="space-y-2">
              {overduePayments.map((pc) => (
                <div
                  key={pc.id}
                  className="rounded-3xl border border-red-200 bg-red-50 p-3.5 transition-transform active:scale-[0.98]"
                >
                  <Link
                    to={pc.route}
                    className="block"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{pc.tenantName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {pc.buildingName} · {pc.unitName}
                        </p>
                        <p className="mt-1 font-bold text-primary">{formatMoney(pc.amount)}</p>
                      </div>
                      <div className="mr-2 text-left">
                        <p className="text-xs font-bold text-red-600">متأخر {Math.abs(pc.days)} يوم</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(pc.dueDate)}</p>
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-100 py-2 text-[11px] font-semibold text-emerald-700 active:scale-[0.98] transition-transform"
                    onClick={() => {
                      console.log('[WhatsApp] Button clicked');
                      const payment = data.payments.find((p) => p.id === pc.paymentId);
                      const tenant = data.tenants.find((t) =>
                        t.id === payment?.tenantId || (!payment?.tenantId && t.unitId === payment?.unitId)
                      );
                      const phones = getTenantPhoneNumbers(tenant);
                      if (!payment || phones.length === 0) return;
                      const msg = buildPaymentMessageContent(data, payment, tenant, "overduePayment").message;
                      setWhatsappPreview({ phones, message: msg });
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    تذكير واتساب
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Payments */}
        {false && upcomingPayments.length > 0 && (
          <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
            <h2 className="mb-2 flex items-center gap-2 font-bold text-primary">
              <CalendarClock className="h-4 w-4" /> الدفعات القادمة
            </h2>
            <div className="space-y-2">
              {upcomingPayments.map((pc) => (
                <Link
                  key={pc.id}
                  to={pc.route}
                  className="block rounded-3xl border border-border bg-card p-3.5 transition-transform active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{pc.tenantName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pc.buildingName} · {pc.unitName}
                      </p>
                      <p className="mt-1 font-bold text-primary">{formatMoney(pc.amount)}</p>
                    </div>
                    <div className="mr-2 text-left">
                      <p className={`text-xs font-bold ${pc.days === 0 ? "text-amber-600" : "text-primary"}`}>
                        {pc.days === 0 ? "اليوم" : `بعد ${pc.days} يوم`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(pc.dueDate)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reminders */}
        {false && contractExpiryReminders.length > 0 && (
          <div className="animate-fade-up">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><CalendarClock className="h-4 w-4 text-amber-600" /> تذكيرات العقود الأقرب للانتهاء</h2>
            <div className="space-y-2">
              {contractExpiryReminders.slice(0, 5).map((reminder) => (
                <Link key={reminder.id} to={`/units/${encodeURIComponent(reminder.unitId)}?tab=contract&item=${encodeURIComponent(reminder.contractId)}`} className={`block overflow-hidden rounded-2xl border px-3 py-2.5 ${reminder.autoRenewal ? "border-sky-200 bg-sky-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className={`text-xs font-semibold ${reminder.autoRenewal ? "text-sky-700" : "text-amber-800"}`}>{reminder.autoRenewal ? "عقد سيتجدد تلقائيًا" : "عقد يحتاج إجراء"}</p>
                    <p className="text-sm font-bold text-foreground">{reminder.tenantName || "مستأجر غير محدد"}</p>
                    <p className="truncate text-xs text-muted-foreground">العقار: {reminder.buildingName || "غير محدد"} · الوحدة: {reminder.unitName || "غير محددة"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">رقم العقد: {reminder.contractNumber || "غير مسجل"}{reminder.lessorName ? ` · المؤجر: ${reminder.lessorName}` : ""}</p>
                    <p className="text-[11px] text-muted-foreground">تاريخ الانتهاء: {formatDate(reminder.date)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${reminder.autoRenewal ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{reminder.daysRemaining === 0 ? "ينتهي اليوم" : `بعد ${reminder.daysRemaining} يوم`}</span>
                  </div>
                  <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${reminder.autoRenewal ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{reminder.autoRenewal ? "تجديد تلقائي مفعّل" : "تجديد تلقائي غير مفعّل"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {false && nearestContractStatus.length > 0 && (
          <div className="animate-fade-up">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><CalendarClock className="h-4 w-4 text-primary" /> أقرب العقود للانتهاء</h2>
            <div className="space-y-2">
              {nearestContractStatus.map((item) => (
                <Link key={item.id} to={`/units/${encodeURIComponent(item.unitId)}?tab=contract&item=${encodeURIComponent(item.contractId)}`} className={`block overflow-hidden rounded-2xl border px-3 py-2.5 ${item.autoRenewal ? "border-sky-200 bg-sky-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className={`text-xs font-semibold ${item.autoRenewal ? "text-sky-700" : "text-amber-800"}`}>
                      {item.autoRenewal ? "عقد سيتجدد تلقائيًا" : "عقد قريب من الانتهاء"}
                    </p>
                    <p className="text-sm font-bold text-foreground">{item.tenantName}</p>
                    <p className="truncate text-xs text-muted-foreground">العقار: {item.buildingName} · الوحدة: {item.unitName}</p>
                    <p className="text-[11px] text-muted-foreground">رقم العقد: {item.contractNumber || "غير مسجل"} · ينتهي: {formatDate(item.date)}</p>
                  </div>
                  <p className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.autoRenewal ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>بعد {item.daysRemaining} يوم</p>
                  </div>
                  <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${item.autoRenewal ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{item.autoRenewal ? "تجديد تلقائي مفعّل" : "تجديد تلقائي غير مفعّل"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="hidden animate-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <Bell className="h-4 w-4 text-primary" /> التذكيرات
            </h2>
          </div>
          {reminders.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="لا توجد تذكيرات"
              description="ستظهر هنا مواعيد الإيجار والعقود والصيانة والفواتير"
            />
          ) : (
            <div className="space-y-2">
              {reminders.map((r) => {
                const Icon = kindIcons[r.kind];
                return (
                  <Link
                    key={r.id}
                    to={r.route}
                    className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3.5 transition-transform active:scale-[0.98]"
                  >
                    <div className={`rounded-2xl p-2.5 ${r.kind === "contract" && r.autoRenewal ? "bg-sky-100 text-sky-700" : kindColors[r.kind]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-bold ${r.days < 0 ? "text-red-600" : r.days <= 7 ? "text-amber-600" : "text-primary"}`}>
                        {r.kind === "contract"
                          ? (r.days < 0 ? `منتهي منذ ${-r.days} يوم` : r.days === 0 ? "ينتهي اليوم" : `ينتهي خلال ${r.days} يوم`)
                          : (r.days < 0 ? `متأخر ${-r.days} يوم` : r.days === 0 ? "اليوم" : `بعد ${r.days} يوم`)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(r.date)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {whatsappPreview && (
        <WhatsappPreview
          open={!!whatsappPreview}
          onOpenChange={(o) => !o && setWhatsappPreview(null)}
          phones={whatsappPreview.phones}
          message={whatsappPreview.message}
          title="تذكير واتساب - دفعة متأخرة"
        />
      )}
    </div>
  );
}
