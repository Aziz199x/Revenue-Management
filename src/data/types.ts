// ===================== Core Status Types =====================
export type UnitStatus =
  | "occupied"
  | "vacant"
  | "maintenance"
  | "occupied_no_renewal"
  | "expired_not_vacated";

export type PaymentStatus = "paid" | "unpaid" | "partial" | "overdue";
export type PaymentMethod = "cash" | "bank_transfer" | "ejar" | "";
export type BillStatus = "paid" | "unpaid";
export type RepairStatus = "pending" | "completed" | "cancelled";
export type BillType = "electricity" | "water" | "other";
export type RentPeriod = "monthly" | "quarterly" | "semi_annually" | "yearly";
export type ContractStatus = "active" | "future" | "expired" | "ending_soon";

export type RequestType =
  | "maintenance"
  | "plumbing"
  | "electrical"
  | "ac"
  | "cleaning"
  | "complaint"
  | "contract"
  | "payment"
  | "other";

export type RequestStatus = "new" | "pending" | "in_progress" | "completed" | "cancelled";
export type RequestPriority = "low" | "medium" | "high" | "urgent";

export type WhatsappPref = "ask" | "whatsapp" | "whatsapp_business";

// ===================== Entities =====================
export interface Building {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  collectionPercentage?: number; // default collection fee % for all units
  createdAt: string;
}

export interface Unit {
  id: string;
  buildingId: string;
  name: string;
  floor?: string;
  area?: string;
  type: string;
  rentAmount: number;
  rentPeriod: RentPeriod;
  status: UnitStatus;
  notes?: string;
  // electricity account info
  electricityAccountName?: string;
  electricityAccountNumber?: string;
  electricityMeterNumber?: string;
  electricityNotes?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  unitId?: string;
  name: string;
  phone?: string;
  nationalId?: string;
  email?: string;
  notes?: string;
  // electricity account info
  electricityAccountName?: string;
  electricityAccountNumber?: string;
  electricityMeterNumber?: string;
  electricityNotes?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  contractId?: string;
  unitId: string;
  buildingId?: string;
  tenantName?: string;
  buildingName?: string;
  unitName?: string;
  amount: number;
  paidAmount?: number;
  dueDate: string;
  receivedDate?: string;
  paymentMethod?: PaymentMethod;
  status: PaymentStatus;
  collectionFeeAmount?: number;
  maintenanceDeduction?: number;
  ownerNet?: number;
  transferredToOwner?: boolean;
  transferredDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  unitId: string;
  buildingId?: string;
  tenantName: string;
  tenantPhone?: string;
  contractNumber?: string;
  electricityAccountNumber?: string;
  electricityMeterNumber?: string;
  startDate: string;
  endDate: string;
  annualRent: number;
  paymentCycle: RentPeriod;
  autoRenewal: boolean;
  reminderDays: number;
  collectionPercentage?: number;
  notes?: string;
  createdAt: string;
}

export interface Bill {
  id: string;
  unitId?: string;
  buildingId?: string;
  type: BillType;
  typeLabel?: string;
  amount: number;
  billDate: string;
  dueDate?: string;
  reminderDate?: string;
  status: BillStatus;
  notes?: string;
  createdAt: string;
}

export interface Repair {
  id: string;
  unitId?: string;
  buildingId?: string;
  description: string;
  repairDate: string;
  cost: number;
  paidBy?: string;
  contractor?: string;
  status: RepairStatus;
  notes?: string;
  createdAt: string;
}

export interface TenantRequest {
  id: string;
  buildingId?: string;
  unitId?: string;
  tenantName?: string;
  tenantPhone?: string;
  title: string;
  type: RequestType | string;
  description: string;
  requestDate: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  priority: RequestPriority;
  status: RequestStatus;
  cost?: number;
  technicianName?: string;
  notes?: string;
  addedToMaintenance?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  contractReminderDays: number;
  rentReminderDays: number;
  notificationsEnabled: boolean;
  collectionFeePercentage: number;
  whatsappPreference: WhatsappPref;
}

export interface AppData {
  buildings: Building[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
  contracts: Contract[];
  bills: Bill[];
  repairs: Repair[];
  tenantRequests: TenantRequest[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  contractReminderDays: 30,
  rentReminderDays: 7,
  notificationsEnabled: false,
  collectionFeePercentage: 0,
  whatsappPreference: "ask",
};

export const EMPTY_DATA: AppData = {
  buildings: [],
  units: [],
  tenants: [],
  payments: [],
  contracts: [],
  bills: [],
  repairs: [],
  tenantRequests: [],
  settings: DEFAULT_SETTINGS,
};
