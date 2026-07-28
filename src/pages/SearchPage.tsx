import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, DoorOpen, Search, User, Wallet, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { useStore } from "@/data/store";
import { Building, Unit } from "@/data/types";
import { formatMoney, formatDate, getPaymentAmount } from "@/data/helpers";
import { PAYMENT_STATUS_LABELS } from "@/data/labels";

const normalize = (value?: string | number | null): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();

const MAX_PER_GROUP = 15;

export default function SearchPage() {
  const { data } = useStore();
  const [query, setQuery] = useState("");
  const q = normalize(query);

  const results = useMemo(() => {
    if (q.length < 2) return null;
    const match = (...fields: (string | number | null | undefined)[]) =>
      fields.some((field) => normalize(field).includes(q));

    const unitById = new Map<string, Unit>(data.units.map((u) => [u.id, u]));
    const buildingById = new Map<string, Building>(data.buildings.map((b) => [b.id, b]));
    const unitLabel = (unitId?: string) => {
      const unit = unitId ? unitById.get(unitId) : undefined;
      const building = unit ? buildingById.get(unit.buildingId) : undefined;
      return [building?.name, unit?.name].filter(Boolean).join(" — ");
    };

    const buildings = data.buildings.filter((b) => match(b.name, b.address)).slice(0, MAX_PER_GROUP);
    const units = data.units.filter((u) => match(u.name)).slice(0, MAX_PER_GROUP);
    const tenants = data.tenants.filter((t) => match(t.name, t.phone, t.nationalId)).slice(0, MAX_PER_GROUP);
    const contracts = data.contracts.filter((c) => match(c.contractNumber, c.tenantName)).slice(0, MAX_PER_GROUP);
    const payments = data.payments
      .filter((p) => !p.deletedAt)
      .filter((p) => match(p.tenantName, p.notes, getPaymentAmount(p)))
      .slice(0, MAX_PER_GROUP);

    return { buildings, units, tenants, contracts, payments, unitLabel };
  }, [q, data]);

  const empty = results
    && results.buildings.length === 0 && results.units.length === 0
    && results.tenants.length === 0 && results.contracts.length === 0
    && results.payments.length === 0;

  const rowClass = "flex items-center gap-3 rounded-2xl border border-border bg-card p-3";

  return (
    <div>
      <PageHeader title="البحث الشامل" subtitle="ابحث في العقارات والوحدات والمستأجرين والعقود والدفعات" back />
      <div className="space-y-4 p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="اسم مستأجر، جوال، وحدة، عقار، رقم عقد، مبلغ..."
            className="rounded-xl pr-9"
          />
        </div>

        {!results && (
          <p className="text-center text-xs text-muted-foreground">اكتب حرفين على الأقل للبحث</p>
        )}

        {empty && <EmptyState icon={Search} title="لا توجد نتائج" description="جرب كلمة بحث مختلفة" />}

        {results && results.buildings.length > 0 && (
          <section className="space-y-2">
            <p className="text-sm font-bold">العقارات</p>
            {results.buildings.map((b) => (
              <Link key={b.id} to={`/buildings/${b.id}`} className={rowClass}>
                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{b.name}</p>
                  {b.address && <p className="truncate text-xs text-muted-foreground">{b.address}</p>}
                </div>
              </Link>
            ))}
          </section>
        )}

        {results && results.units.length > 0 && (
          <section className="space-y-2">
            <p className="text-sm font-bold">الوحدات</p>
            {results.units.map((u) => (
              <Link key={u.id} to={`/units/${u.id}`} className={rowClass}>
                <DoorOpen className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{results.unitLabel(u.id) || u.name}</p>
                  {u.rentAmount ? <p className="text-xs text-muted-foreground">{formatMoney(u.rentAmount)}</p> : null}
                </div>
              </Link>
            ))}
          </section>
        )}

        {results && results.tenants.length > 0 && (
          <section className="space-y-2">
            <p className="text-sm font-bold">المستأجرون</p>
            {results.tenants.map((t) => (
              <Link key={t.id} to={t.unitId ? `/units/${t.unitId}` : "/buildings"} className={rowClass}>
                <User className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[t.phone, results.unitLabel(t.unitId)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        )}

        {results && results.contracts.length > 0 && (
          <section className="space-y-2">
            <p className="text-sm font-bold">العقود</p>
            {results.contracts.map((c) => (
              <Link key={c.id} to={c.unitId ? `/units/${c.unitId}` : "/buildings"} className={rowClass}>
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.tenantName || c.contractNumber || "عقد"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[c.contractNumber, results.unitLabel(c.unitId), `${formatDate(c.startDate)} → ${formatDate(c.endDate)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        )}

        {results && results.payments.length > 0 && (
          <section className="space-y-2">
            <p className="text-sm font-bold">الدفعات</p>
            {results.payments.map((p) => (
              <Link key={p.id} to={p.unitId ? `/units/${p.unitId}` : "/payments"} className={rowClass}>
                <Wallet className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {formatMoney(getPaymentAmount(p))} · {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.tenantName, results.unitLabel(p.unitId), formatDate(p.dueDateGregorian || p.nextDueDate || p.paymentDate)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
