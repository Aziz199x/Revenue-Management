export type UnitStatus = "occupied" | "rented_not_renewing" | "vacant" | "maintenance";
export type PaymentStatus = "paid" | "unpaid" | "partial" | "overdue";
export type BillStatus = "paid" | "unpaid";
export type RepairStatus = "pending" | "completed" | "cancelled";
export type BillType = "electricity" | "water" | "other";
export type RentPeriod = "monthly" | "quarterly" | "semi_annually" | "yearly" | "flexible";
export type RentPeriodNew = RentPeriod | "semi_annual" | "annual" | "custom" | "imported_schedule";
export type PaymentMethod = "bank_transfer" | "cash" | "ejar_platform" | "other";
export type PaymentReceiveMethod = "office_collection" | PaymentMethod;
export type CollectionFeeStatus = "collected" | "uncollected" | "waived" | "settled" | "partially_settled";
export type ContractDurationType = "6_months" | "1_year" | "custom" | "2_years" | "manual_end";

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

export interface Building {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  createdAt: string;
  collectionFeePercent: number;
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
  manualStatus?: UnitStatus;
  collectionFeeOverrideEnabled?: boolean;
  collectionFeePercent?: number | null;
  notes?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  unitId: string;
  buildingId?: string;
  name: string;
  phone?: string;
  nationalId?: string;
  email?: string;
  notes?: string;
  extraInfo?: string;
  electricityAccountName?: string;
  electricityAccountNumber?: string;
  electricityMeterNumber?: string;
  electricityNotes?: string;
  activeContractId?: string;
  createdAt: string;
  updatedAt?: string;
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
  contractId?: string;
  tenantId?: string;
  tenantPhone?: string;
  buildingName?: string;
  unitName?: string;
  tenantName?: string;
  receivedDate?: string;
  receivedAmount?: number;
  paymentMethod?: PaymentMethod;
  receiveMethod?: PaymentReceiveMethod;
  paymentNumber?: number;
  dueDateGregorian?: string;
  dueDateHijri?: string;
  paymentDeadlineGregorian?: string;
  paymentDeadlineHijri?: string;
  rentalPeriod?: string;
  deletedAt?: string;
  grossAmount?: number;
  collectionFeePercent?: number;
  collectionFeePercentage?: number;
  collectionFeeAmount?: number;
  collectionFeeStatus?: CollectionFeeStatus;
  collectionFeeSettledAmount?: number;
  collectionFeeRemainingAmount?: number;
  collectionFeeReason?: string;
  collectionFeeSettledAt?: string;
  collectionFeeSettlementNote?: string;
  netAmountAfterCollectionFee?: number;
  maintenanceDeductionAmount?: number;
  netAmountToTransferToOwner?: number;
  ownerTransferred?: boolean;
  ownerTransferDate?: string | null;
  ownerTransferMethod?: PaymentMethod | null;
  ownerTransferNotes?: string;
}

export interface Contract {
  id: string;
  unitId: string;
  tenantId?: string;
  tenantName?: string;
  rentAmount?: number;
  paymentFrequency?: RentPeriod | RentPeriodNew;
  startDate: string;
  endDate: string;
  contractDurationType?: ContractDurationType;
  customDurationMonths?: number;
  expiryReminderDays: number;
  autoRenewal: boolean;
  tenantRenewalPreference?: "unknown" | "renewing" | "not_renewing";
  notes?: string;
  createdAt: string;
  contractNumber?: string;
  contractType?: string;
  contractSealingDate?: string;
  contractSealingLocation?: string;
  annualRent?: number;
  totalContractValue?: number;
  numberOfPayments?: number;
  regularPaymentAmount?: number;
  lastPaymentAmount?: number;
  securityDeposit?: number;
  brokerageFee?: number;
  lessorName?: string;
  lessorIdType?: string;
  lessorIdNumber?: string;
  lessorPhone?: string;
  lessorEmail?: string;
  lessorNationalAddress?: string;
  tenantIdType?: string;
  tenantIdNumber?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantNationalAddress?: string;
  brokerOfficeName?: string;
  brokerName?: string;
  brokerCrNumber?: string;
  brokerPhone?: string;
  titleDeedNumber?: string;
  titleDeedIssuer?: string;
  titleDeedIssueDate?: string;
  propertyAddress?: string;
  propertyUsage?: string;
  propertyType?: string;
  numberOfUnits?: number;
  numberOfFloors?: number;
  numberOfParkingLots?: number;
  numberOfElevators?: number;
  unitType?: string;
  unitNumber?: string;
  floorNumber?: string;
  unitArea?: number;
  furnishedStatus?: string;
  kitchenCabinetsInstalled?: boolean;
  numberOfAcUnits?: number;
  collectionFeePercent?: number;
  electricityMeterNumber?: string;
  waterMeterNumber?: string;
  gasMeterNumber?: string;
  electricityCurrentReading?: string;
  waterCurrentReading?: string;
  gasCurrentReading?: string;
  electricityAnnualAmount?: number;
  waterAnnualAmount?: number;
  gasAnnualAmount?: number;
  parkingAnnualAmount?: number;
  availablePaymentMethods?: string;
  originalPdfPath?: string;
  importedFromEjar?: boolean;
  status?: "active" | "expired" | "eviction_needed" | "eviction_filed" | "eviction_completed" | "cancelled" | "terminated";
  deletedAt?: string;
  tenantDidNotLeave?: boolean;
  evictionCaseNeeded?: boolean;
  evictionCaseFiled?: boolean;
  evictionCaseNumber?: string | null;
  evictionCaseDate?: string | null;
  evictionCourtName?: string | null;
  evictionPlatform?: string | null;
  evictionNotes?: string | null;
  evictionCompletedDate?: string | null;
}

export interface ContractAttachment {
  id: string;
  contractId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  createdAt: string;
}

export interface EjarImportContract {
  contractNumber?: string;
  contractType?: string;
  contractSealingDate?: string;
  contractSealingLocation?: string;
  startDate?: string;
  endDate?: string;
  durationText?: string;
  expiryReminderDays: number;
  autoRenewal: boolean;
}

export interface EjarImportTenant {
  name?: string;
  idType?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  nationalAddress?: string;
}

export interface EjarImportLessor {
  name?: string;
  idType?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  nationalAddress?: string;
}

export interface EjarImportProperty {
  address?: string;
  usage?: string;
  type?: string;
  numberOfUnits?: string;
  numberOfFloors?: string;
  numberOfParkingLots?: string;
  numberOfElevators?: string;
}

export interface EjarImportUnit {
  unitType?: string;
  unitNumber?: string;
  floorNumber?: string;
  area?: string;
  electricityMeterNumber?: string;
  waterMeterNumber?: string;
}

export interface EjarImportFinancial {
  annualRent?: string;
  regularPaymentAmount?: string;
  lastPaymentAmount?: string;
  totalContractValue?: string;
  paymentCycle?: string;
  numberOfPayments?: string;
  availablePaymentMethods?: string;
}

export interface EjarImportBroker {
  officeName?: string;
  brokerName?: string;
  crNumber?: string;
  phone?: string;
}

export interface EjarImportOwnership {
  titleDeedNumber?: string;
  titleDeedIssuer?: string;
  titleDeedIssueDate?: string;
}

export interface EjarImportPayment {
  paymentNumber: number;
  dueDateGregorian?: string;
  dueDateHijri?: string;
  paymentDeadlineGregorian?: string;
  paymentDeadlineHijri?: string;
  rentalPeriod?: string;
  amount?: string;
  status: "unpaid";
}

export interface EjarImportData {
  contract: EjarImportContract;
  tenant: EjarImportTenant;
  lessor: EjarImportLessor;
  property: EjarImportProperty;
  unit: EjarImportUnit;
  financial: EjarImportFinancial;
  broker: EjarImportBroker;
  ownership: EjarImportOwnership;
  payments: EjarImportPayment[];
  warnings?: string[];
  reviewFields?: string[];
}

export interface TenantRequest {
  id: string;
  unitId: string;
  buildingId: string;
  tenantId?: string;
  title: string;
  type: RequestType;
  customType?: string;
  description: string;
  requestDate: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  priority: RequestPriority;
  status: RequestStatus;
  cost?: number;
  technicianName?: string;
  notes?: string;
  addedToRepairs: boolean;
  createdAt: string;
  updatedAt: string;
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
  unitId?: string;
  buildingId?: string;
  description: string;
  repairDate: string;
  cost: number;
  contractor?: string;
  status: RepairStatus;
  notes?: string;
  createdAt: string;
  isDeductedFromOwnerTransfer?: boolean;
  deductedFromPaymentId?: string | null;
}

export interface CollectionFeeSettlement {
  settlementId: string;
  propertyId: string;
  paymentId: string;
  sourcePaymentId?: string;
  sourceUnitId?: string;
  targetPaymentId?: string;
  targetUnitId?: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  note?: string;
  createdAt: string;
}

export interface WhatsAppTemplates {
  paymentReminder: string;
  overduePayment: string;
  contractExpiry: string;
}

export interface Settings {
  contractReminderDays: number;
  defaultContractExpiryReminderDays: number;
  rentReminderDays: number;
  notificationsEnabled: boolean;
  overduePaymentNotificationsEnabled: boolean;
  reminderFrequencyDays: number;
  reminderFrequencyHours: number;
  notificationWindowStart: string;
  notificationWindowEnd: string;
  paymentNotificationSound: NotificationSound;
  contractNotificationSound: NotificationSound;
  maintenanceNotificationSound: NotificationSound;
  whatsappTemplates: WhatsAppTemplates;
}

export type NotificationSound = "payment_overdue.wav" | "contract_reminder.wav" | "default";

export interface AppData {
  buildings: Building[];
  units: Unit[];
  tenants: Tenant[];
  payments: Payment[];
  contracts: Contract[];
  bills: Bill[];
  repairs: Repair[];
  tenantRequests: TenantRequest[];
  contractAttachments: ContractAttachment[];
  collectionFeeSettlements: CollectionFeeSettlement[];
  settings: Settings;
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplates = {
  paymentReminder:
    "السلام عليكم، نود تذكيركم بأن موعد سداد الإيجار للوحدة {unitName} في عقار {buildingName} قد حلّ، بمبلغ {amount} ر.س. نأمل سرعة السداد، وشكرًا لكم.",
  overduePayment:
    "السلام عليكم، نود إفادتكم بأن دفعة الإيجار للوحدة {unitName} في عقار {buildingName} مستحقة ولم يتم تسجيل سدادها حتى الآن، بمبلغ {amount} ر.س. نأمل سرعة السداد، وشكرًا لكم.",
  contractExpiry:
    "السلام عليكم، نود إفادتكم بأن عقد إيجار الوحدة {unitName} في عقار {buildingName} سينتهي في تاريخ {contractEndDate}. يرجى التواصل لتجديد العقد أو لترتيب التسليم. وشكرًا لكم.",
};

export const DEFAULT_SETTINGS: Settings = {
  contractReminderDays: 80,
  defaultContractExpiryReminderDays: 80,
  rentReminderDays: 7,
  notificationsEnabled: false,
  overduePaymentNotificationsEnabled: true,
  reminderFrequencyDays: 1,
  reminderFrequencyHours: 24,
  notificationWindowStart: "09:00",
  notificationWindowEnd: "21:00",
  paymentNotificationSound: "payment_overdue.wav",
  contractNotificationSound: "contract_reminder.wav",
  maintenanceNotificationSound: "default",
  whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES,
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
  contractAttachments: [],
  collectionFeeSettlements: [],
  settings: DEFAULT_SETTINGS,
};
