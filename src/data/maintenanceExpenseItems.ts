export interface MaintenanceExpenseItemDraft {
  id: string;
  description: string;
  cost: string;
  /** Unit this maintenance item belongs to. Undefined/"" means general building maintenance. */
  unitId?: string;
}

export interface MaintenanceExpenseItem {
  description: string;
  cost: number;
  unitId?: string;
}

export function createMaintenanceExpenseItemDraft(defaultUnitId?: string): MaintenanceExpenseItemDraft {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    cost: "",
    unitId: defaultUnitId,
  };
}

export function normalizeMaintenanceExpenseItems(
  items: MaintenanceExpenseItemDraft[],
): MaintenanceExpenseItem[] {
  return items
    .map((item) => ({
      description: item.description.trim(),
      cost: Math.max(0, Number(item.cost) || 0),
      unitId: item.unitId || undefined,
    }))
    .filter((item) => item.description && item.cost > 0);
}

export function hasInvalidMaintenanceExpenseItems(items: MaintenanceExpenseItemDraft[]): boolean {
  return items.length === 0 || items.some((item) => !item.description.trim() || !(Number(item.cost) > 0));
}
