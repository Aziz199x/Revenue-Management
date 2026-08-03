import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/data/helpers";
import {
  createMaintenanceExpenseItemDraft,
  hasInvalidMaintenanceExpenseItems,
  MaintenanceExpenseItemDraft,
} from "@/data/maintenanceExpenseItems";

const GENERAL_BUILDING_VALUE = "__building__";

export default function MaintenanceExpenseItemsEditor({
  items,
  onChange,
  units = [],
}: {
  items: MaintenanceExpenseItemDraft[];
  onChange: (items: MaintenanceExpenseItemDraft[]) => void;
  /** Units of the same building/property, so each item can be attributed to a
   * specific unit instead of always being recorded as general building
   * maintenance. */
  units?: Array<{ id: string; name: string }>;
}) {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.cost) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>بنود صيانة المبنى</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={() => onChange([...items, createMaintenanceExpenseItemDraft()])}
        >
          <Plus className="ml-1 h-3.5 w-3.5" />
          إضافة بند
        </Button>
      </div>
      {items.map((item, index) => (
        <div key={item.id} className="rounded-2xl border border-violet-200 bg-white/80 p-2.5">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="text-[11px]">وصف البند {index + 1}</Label>
              <Input
                value={item.description}
                onChange={(event) => onChange(items.map((current) =>
                  current.id === item.id ? { ...current, description: event.target.value } : current
                ))}
                placeholder="مثال: إصلاح مضخة المياه"
                className="rounded-xl"
              />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-[11px]">التكلفة</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={item.cost}
                onChange={(event) => onChange(items.map((current) =>
                  current.id === item.id ? { ...current, cost: event.target.value } : current
                ))}
                className="rounded-xl"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-destructive"
              aria-label={`حذف بند الصيانة ${index + 1}`}
              onClick={() => onChange(items.filter((current) => current.id !== item.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {units.length > 0 && (
            <div className="mt-2 space-y-1">
              <Label className="text-[11px]">يخص</Label>
              <Select
                value={item.unitId || GENERAL_BUILDING_VALUE}
                onValueChange={(value) => onChange(items.map((current) =>
                  current.id === item.id
                    ? { ...current, unitId: value === GENERAL_BUILDING_VALUE ? undefined : value }
                    : current
                ))}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL_BUILDING_VALUE}>صيانة عامة للعقار</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ))}
      <p className="rounded-xl bg-violet-100 px-3 py-2 text-xs font-bold text-violet-900">
        إجمالي البنود اليدوية: {formatMoney(total)}
      </p>
      {hasInvalidMaintenanceExpenseItems(items) && (
        <p className="text-xs font-semibold text-red-700">أدخل وصفًا وتكلفة صحيحة لكل بند.</p>
      )}
    </div>
  );
}
