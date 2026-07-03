import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "@/data/labels";

export default function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        STATUS_COLORS[status] || "bg-slate-200 text-slate-700",
      )}
    >
      {label}
    </span>
  );
}
