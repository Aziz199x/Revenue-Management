export type UnitStatus = "occupied" | "vacant" | "maintenance";
export type PaymentStatus = "paid" | "unpaid" | "partial" | "overdue";
export type BillStatus = "paid" | "unpaid";
export type RepairStatus = "pending" | "completed" | "cancelled";
export type BillType = "electricity" | "water" | "other";
export type RentPeriod = "monthly" | "yearly";

export interface Building {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface Unit {
  id: string;
  buildingId: string;
  name: string;
  floor?: string;
  type: string;
  rentAmount: number;
  rentPeriod: RentPeriod;
  status: UnitStatus;
  notes?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  unitId: string;
  name: string;
  phone?: string;
  nationalId?: string;
  email?: string;
  notes?: string;
  extraInfo?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  unitId: string;
  amount: number;
  paidAmount?: number;
  paymentDate: string;
  nextDueDate?: string;
  status: PaymentStatus;
  notes?: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  unitId: string;
  startDate: string;
  endDate: string;
  reminderDays: number;
  notes?: string;
  createdAt: string;
}

export interface Bill {
  id: string;
  unitId: string;
  type: BillType;
  typeLabel?: string;
  amount: number;
  billDate: string;
  dueDate?: string;
  status: BillStatus;
  notes?: string;
  createdAt: string;
}

export interface Repair {
  id: string;
  unitId: string;
  description: string;
  repairDate: string;
  cost: number;
  contractor?: string;
  status: RepairStatus;
  notes?: string;
  createdAt: string;
}

export interface Settings {
  contractReminderDays: number;
  rentReminderDays: number;
  notificationsEnabled: boolean;
}

export interface AppData {
  buildings: Building[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
  contracts: Contract[];
  bills: Bill[];
  repairs: Repair[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  contractReminderDays: 30,
  rentReminderDays: 7,
  notificationsEnabled: false,
};

export const EMPTY_DATA: AppData = {
  buildings: [],
  units: [],
  tenants: [],
  payments: [],
  contracts: [],
  bills: [],
  repairs: [],
  settings: DEFAULT_SETTINGS,
};
