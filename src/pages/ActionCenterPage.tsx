import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Wallet,
  Wrench,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { useStore } from "@/data/store";
import {
  collectPaymentCards,
  daysUntil,
  findEarlierUnreceivedPayments,
  formatDate,
  formatMoney,
  getActiveContractsNeedingAttention,
  getContractEndDate,
  isPaymentPaid,
} from "@/data/helpers";

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  detail?: string;
  route: string;
  amount?: number;
}

interface ActionGroup {
  id: string;
  title: string;
  description: string;
  color: string;
  icon: typeof Wallet;
  items: ActionItem[];
}

export default function ActionCenterPage() {
  const { data } = useStore();
  const groups = useMemo<ActionGroup[]>(() => {
    const unitContext = (unitId: string) => {
      const unit = data.units.find((item) => item.id === unitId);
      const building = data.buildings.find((item) => item.id === unit?.buildingId);
      return {
        unitName: unit?.name || "وحدة غير محددة",
        buildingName: building?.name || "عقار غير محدد",
      };
    };

    const sequenceErrors: ActionItem[] = [];
    for (const payment of data.payments.filter((item) => !item.deletedAt && isPaymentPaid(item))) {
      const earlier = findEarlierUnreceivedPayments(data, payment);
      if (!earlier.length) continue;
      const context = unitContext(payment.unitId);
      sequenceErrors.push({
        id: `sequence-${payment.id}`,
        title: `خطأ في تسلسل دفعات ${context.unitName}`,
        subtitle: `${context.buildingName} · تم استلام دفعة لاحقة قبل ${earlier.length} دفعة`,
        detail: `أقدم دفعة غير مستلمة: ${formatDate(earlier[0].dueDateGregorian || earlier[0].paymentDate)}`,
        route: `/units/${encodeURIComponent(payment.unitId)}?tab=payments&item=${encodeURIComponent(earlier[0].id)}`,
      });
    }

    const ownerTransfers = data.payments
      .filter((payment) => !payment.deletedAt && isPaymentPaid(payment) && !payment.ownerTransferred && !payment.ownerSettledByMaintenance)
      .map((payment) => {
        const context = unitContext(payment.unitId);
        return {
          id: `transfer-${payment.id}`,
          title: `تحويل مستحق للمالك - ${context.unitName}`,
          subtitle: context.buildingName,
          detail: payment.receivedDate ? `تم الاستلام: ${formatDate(payment.receivedDate)}` : undefined,
          amount: Number(payment.netAmountToTransferToOwner ?? payment.receivedAmount ?? payment.amount),
          route: `/units/${encodeURIComponent(payment.unitId)}?tab=payments&item=${encodeURIComponent(payment.id)}`,
        };
      });

    const paymentActions = collectPaymentCards(data)
      .filter((item) => item.days <= 30)
      .map((item) => ({
        id: item.id,
        title: `${item.status === "overdue" ? "دفعة متأخرة" : "دفعة تستحق قريبًا"} - ${item.unitName}`,
        subtitle: `${item.buildingName} · ${item.tenantName}`,
        detail: `${formatDate(item.dueDate)}${item.days < 0 ? ` · متأخرة ${-item.days} يوم` : ` · بعد ${item.days} يوم`}`,
        amount: item.amount,
        route: item.route,
      }));

    const maintenance = data.repairs
      .filter((repair) => repair.status !== "cancelled" && !repair.isDeductedFromOwnerTransfer)
      .map((repair) => {
        const context = unitContext(repair.unitId || "");
        const building = data.buildings.find((item) => item.id === repair.buildingId);
        return {
          id: `maintenance-${repair.id}`,
          title: repair.status === "pending" ? `صيانة معلقة - ${repair.description}` : `صيانة بانتظار التسوية - ${repair.description}`,
          subtitle: repair.unitId ? `${context.buildingName} · ${context.unitName}` : building?.name || "صيانة عامة",
          detail: formatDate(repair.repairDate),
          amount: repair.cost,
          route: repair.unitId
            ? `/units/${encodeURIComponent(repair.unitId)}?tab=repairs&item=${encodeURIComponent(repair.id)}`
            : `/buildings/${encodeURIComponent(repair.buildingId || "")}?tab=maintenance&item=${encodeURIComponent(repair.id)}`,
        };
      });

    const contracts = getActiveContractsNeedingAttention(data.contracts)
      .filter((contract) => daysUntil(getContractEndDate(contract) || "") <= (contract.expiryReminderDays || 80))
      .map((contract) => {
        const context = unitContext(contract.unitId);
        const endDate = getContractEndDate(contract) || "";
        return {
          id: `contract-${contract.id}`,
          title: `عقد يقترب من الانتهاء - ${context.unitName}`,
          subtitle: `${context.buildingName} · ${contract.tenantName || "مستأجر غير محدد"}`,
          detail: `${formatDate(endDate)} · بعد ${daysUntil(endDate)} يوم`,
          route: `/units/${encodeURIComponent(contract.unitId)}?tab=contract&item=${encodeURIComponent(contract.id)}`,
        };
      });

    const requests = data.tenantRequests
      .filter((request) =>
        request.status !== "completed"
        && request.status !== "cancelled"
        && !!request.expectedCompletionDate
        && daysUntil(request.expectedCompletionDate) < 0
      )
      .map((request) => {
        const context = unitContext(request.unitId);
        return {
          id: `request-${request.id}`,
          title: `طلب مستأجر متأخر - ${request.title}`,
          subtitle: `${context.buildingName} · ${context.unitName}`,
          detail: `متأخر ${Math.abs(daysUntil(request.expectedCompletionDate || ""))} يوم`,
          amount: request.cost,
          route: `/requests/${encodeURIComponent(request.id)}`,
        };
      });

    return [
      { id: "sequence", title: "أخطاء تسلسل الدفعات", description: "تحتاج مراجعة فورية قبل أي تحويل", color: "red", icon: AlertTriangle, items: sequenceErrors },
      { id: "transfer", title: "مبالغ يجب تحويلها للمالك", description: "دفعات مستلمة ولم يُغلق إجراء المالك", color: "orange", icon: ArrowLeftRight, items: ownerTransfers },
      { id: "payments", title: "دفعات يجب استلامها", description: "المتأخرة والمستحقة خلال 30 يومًا", color: "emerald", icon: Wallet, items: paymentActions },
      { id: "maintenance", title: "صيانة معلقة أو بانتظار التسوية", description: "أعمال لم تُخصم من مستحقات المالك", color: "amber", icon: Wrench, items: maintenance },
      { id: "contracts", title: "عقود تقترب من الانتهاء", description: "عقود تحتاج قرار تجديد أو إنهاء", color: "sky", icon: CalendarClock, items: contracts },
      { id: "requests", title: "طلبات مستأجرين متأخرة", description: "تجاوزت موعد الإنجاز المتوقع", color: "violet", icon: ClipboardList, items: requests },
    ];
  }, [data]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const colors: Record<string, string> = {
    red: "border-red-200 bg-red-50 text-red-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  };

  return (
    <div>
      <PageHeader title="مركز الإجراءات" subtitle={`${total} إجراء يحتاج متابعة`} back />
      <div className="space-y-4 p-4">
        {total === 0 ? (
          <EmptyState icon={CheckCircle2} title="لا توجد إجراءات معلقة" description="جميع العمليات المالية والإدارية مكتملة" />
        ) : groups.map((group) => {
          if (!group.items.length) return null;
          const Icon = group.icon;
          return (
            <section key={group.id} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <Icon className="h-4 w-4 text-primary" /> {group.title}
                  </h2>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{group.description}</p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">{group.items.length}</span>
              </div>
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  to={item.route}
                  className={`block rounded-2xl border p-3 transition-transform active:scale-[0.99] ${colors[group.color]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{item.title}</p>
                      <p className="mt-1 text-[11px] opacity-80">{item.subtitle}</p>
                      {item.detail && <p className="mt-1 text-[10px] opacity-75">{item.detail}</p>}
                    </div>
                    {item.amount !== undefined && item.amount > 0 && (
                      <span className="shrink-0 text-xs font-bold">{formatMoney(item.amount)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
