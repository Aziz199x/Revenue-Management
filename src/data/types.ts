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

export interface BuildingOwner {
  id: string;
  name: string;
  percentage: number;
  phone?: string;
  bankAccount?: string;
}

export interface BuildingOwnershipVersion {
  id: string;
  effectiveFrom: string;
  owners: BuildingOwner[];
  reason: string;
  createdAt: string;
}

export interface Building {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  createdAt: string;
  collectionFeePercent: number;
  multipleOwnersEnabled?: boolean;
  owners?: BuildingOwner[];
  ownershipHistory?: BuildingOwnershipVersion[];
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
  tenantType?: "individual" | "company";
  phone?: string;
  phoneNumbers?: TenantPhoneNumber[];
  nationalId?: string;
  email?: string;
  emailAddresses?: TenantEmailAddress[];
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

export interface TenantPhoneNumber {
  id: string;
  phone: string;
  label?: string;
  enabled: boolean;
}

export interface TenantEmailAddress {
  id: string;
  email: string;
  label?: string;
  enabled: boolean;
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
  /** True when the owner's net amount was settled against building maintenance instead of being transferred. */
  ownerSettledByMaintenance?: boolean;
  /** Audit note describing the maintenance expenses used for a manual settlement. */
  maintenanceSettlementNote?: string;
  netAmountToTransferToOwner?: number;
  ownerTransferred?: boolean;
  ownerTransferDate?: string | null;
  ownerTransferMethod?: PaymentMethod | null;
  ownerTransferNotes?: string;
  /** Immutable owner split captured when the transfer is recorded. */
  ownerTransferAllocations?: OwnerTransferAllocation[];
  /** Controls which monthly report owns this obligation. */
  reportingMonthMode?: "auto" | "due_month" | "next_month";
  /** Explicit report month (yyyy-mm) chosen by the user. Takes precedence over reportingMonthMode. */
  reportingYearMonth?: string;
}

export interface OwnerTransferAllocation {
  ownerId: string;
  ownerName: string;
  percentage: number;
  amount: number;
  transferred: boolean;
  transferDate?: string | null;
  transferMethod?: PaymentMethod | null;
  notes?: string;
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
  /** Determines whether Ejar pays the owner directly or pays an office representative. */
  lessorCapacity?: "owner" | "representative";
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

export type EvidenceAttachmentKind =
  | "payment_receipt"
  | "owner_transfer"
  | "maintenance_invoice"
  | "contract"
  | "clearance";

export type EvidenceEntityType = "payment" | "repair" | "contract";

export interface EvidenceAttachment {
  id: string;
  entityType: EvidenceEntityType;
  entityId: string;
  kind: EvidenceAttachmentKind;
  buildingId?: string;
  unitId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  /** Native app path inside Directory.Data. */
  storagePath?: string;
  /** Browser fallback only; native files stay outside the JSON database. */
  dataUrl?: string;
  notes?: string;
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

export type FinancialAuditAction =
  | "payment_created"
  | "payment_received"
  | "payment_updated"
  | "payment_deleted"
  | "owner_transferred"
  | "maintenance_deducted"
  | "maintenance_updated"
  | "maintenance_deleted"
  | "settlement_created"
  | "settlement_updated"
  | "settlement_deleted"
  | "building_ownership_updated";

export type FinancialAuditEntityType = "payment" | "repair" | "collection_fee_settlement" | "building";

export interface FinancialAuditEntry {
  id: string;
  /** Groups every entity changed by one user action so undo remains atomic. */
  transactionId: string;
  createdAt: string;
  action: FinancialAuditAction;
  entityType: FinancialAuditEntityType;
  entityId: string;
  yearMonth?: string;
  buildingId?: string;
  unitId?: string;
  label: string;
  reason: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  isPostCloseAdjustment: boolean;
  undoneAt?: string;
}

export interface FinancialMonthCloseBuildingSnapshot {
  buildingId: string;
  buildingName: string;
  expectedRent: number;
  collectedRent: number;
  outstanding: number;
  officeFeesOutstanding: number;
  maintenanceCost: number;
  pendingOwnerTransfers: number;
}

export interface FinancialMonthCloseSnapshot {
  expectedRent: number;
  collectedRent: number;
  outstanding: number;
  officeFeesOutstanding: number;
  maintenanceCost: number;
  pendingOwnerTransfers: number;
  blockingIssues: number;
  warningIssues: number;
  informationalIssues: number;
  buildings: FinancialMonthCloseBuildingSnapshot[];
}

export interface FinancialMonthClose {
  id: string;
  yearMonth: string;
  closedAt: string;
  notes?: string;
  snapshot: FinancialMonthCloseSnapshot;
}

export interface WhatsAppTemplates {
  paymentReminder: string;
  overduePayment: string;
  contractExpiry: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailTemplates {
  paymentReminder: EmailTemplate;
  overduePayment: EmailTemplate;
  contractExpiry: EmailTemplate;
}

export interface AutomaticCommunicationSettings {
  enabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  frequencyDays: number;
  sendTime: string;
  daysBeforeDue: number;
  overdueTailDays: number;
  activeFrom?: string;
  activeUntil?: string;
  emailProvider: "gmail" | "outlook" | null;
  lastRunAt?: string;
}

export type CommunicationChannel = "email" | "whatsapp";
export type CommunicationStatus = "sent" | "failed" | "skipped";

export interface CommunicationLog {
  id: string;
  createdAt: string;
  sentAt?: string;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  recipient: string;
  tenantId?: string;
  paymentId?: string;
  contractId?: string;
  templateKind: "paymentReminder" | "overduePayment" | "contractExpiry";
  provider: "gmail" | "outlook" | "whatsapp_business";
  subject?: string;
  error?: string;
  dedupeKey: string;
}

export interface Settings {
  contractReminderDays: number;
  defaultContractExpiryReminderDays: number;
  rentReminderDays: number;
  notificationsEnabled: boolean;
  overduePaymentNotificationsEnabled: boolean;
  reminderFrequencyDays: number;
  reminderFrequencyHours: number;
  /** Per-type overrides; null/undefined falls back to reminderFrequencyHours. */
  upcomingPaymentFrequencyHours?: number | null;
  overduePaymentFrequencyHours?: number | null;
  contractFrequencyHours?: number | null;
  /** How many days to keep nagging about an overdue rent payment. */
  overdueRentTailDays?: number;
  notificationAllDay: boolean;
  notificationWindowStart: string;
  notificationWindowEnd: string;
  paymentNotificationSound: NotificationSound;
  contractNotificationSound: NotificationSound;
  maintenanceNotificationSound: NotificationSound;
  /** Due dates on or after this day belong to the following report month. */
  reportMonthCutoffDay: number | null;
  /** Home dashboard: show contracts ending within this many days. */
  homeContractDays?: number;
  /** Home dashboard: show upcoming payments due within this many days. */
  homeUpcomingPaymentDays?: number;
  /** Home dashboard: max items per list. */
  homeMaxItems?: number;
  automaticBackupEnabled: boolean;
  automaticBackupFrequency: "daily" | "weekly" | "monthly";
  automaticGoogleDriveBackup: boolean;
  backupRetentionCount: number;
  whatsappTemplates: WhatsAppTemplates;
  emailTemplates: EmailTemplates;
  automaticCommunications: AutomaticCommunicationSettings;
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
  evidenceAttachments: EvidenceAttachment[];
  collectionFeeSettlements: CollectionFeeSettlement[];
  financialAuditLog: FinancialAuditEntry[];
  financialMonthClosures: FinancialMonthClose[];
  communicationLogs: CommunicationLog[];
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

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  paymentReminder: {
    subject: "تذكير بموعد سداد الإيجار – {unitName}",
    body:
      "{recipientGreeting}،\n\nنود تذكيركم بأن دفعة الإيجار الخاصة بالوحدة {unitName} في عقار {buildingName}، عن الفترة من {periodStart} إلى {periodEnd}، تستحق بتاريخ {dueDate} بمبلغ {amount}.\n\nنأمل التكرم بإتمام السداد في الموعد المحدد. إذا تم السداد، يرجى تجاهل هذه الرسالة.\n\nوتفضلوا بقبول فائق الاحترام.",
  },
  overduePayment: {
    subject: "إشعار بتأخر دفعة الإيجار – {unitName}",
    body:
      "{recipientGreeting}،\n\nنفيدكم بأن دفعة الإيجار الخاصة بالوحدة {unitName} في عقار {buildingName}، عن الفترة من {periodStart} إلى {periodEnd}، والمستحقة بتاريخ {dueDate} بمبلغ {amount}، لم يتم تسجيل سدادها حتى تاريخه.\n\nنأمل التكرم بالسداد في أقرب وقت أو التواصل معنا عند وجود أي ملاحظة.\n\nوتفضلوا بقبول فائق الاحترام.",
  },
  contractExpiry: {
    subject: "تذكير بقرب انتهاء عقد الإيجار – {unitName}",
    body:
      "{recipientGreeting}،\n\nنود إشعاركم بأن عقد إيجار الوحدة {unitName} في عقار {buildingName} سينتهي بتاريخ {contractEndDate}.\n\nيرجى التواصل معنا لاستكمال إجراءات التجديد أو التسليم حسب الاتفاق.\n\nوتفضلوا بقبول فائق الاحترام.",
  },
};

export const DEFAULT_SETTINGS: Settings = {
  contractReminderDays: 80,
  defaultContractExpiryReminderDays: 80,
  rentReminderDays: 7,
  notificationsEnabled: false,
  overduePaymentNotificationsEnabled: true,
  reminderFrequencyDays: 1,
  reminderFrequencyHours: 24,
  upcomingPaymentFrequencyHours: null,
  overduePaymentFrequencyHours: null,
  contractFrequencyHours: null,
  overdueRentTailDays: 90,
  notificationAllDay: false,
  notificationWindowStart: "09:00",
  notificationWindowEnd: "21:00",
  paymentNotificationSound: "payment_overdue.wav",
  contractNotificationSound: "contract_reminder.wav",
  maintenanceNotificationSound: "default",
  reportMonthCutoffDay: 25,
  homeContractDays: 90,
  homeUpcomingPaymentDays: 30,
  homeMaxItems: 5,
  automaticBackupEnabled: true,
  automaticBackupFrequency: "daily",
  automaticGoogleDriveBackup: true,
  backupRetentionCount: 14,
  whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES,
  emailTemplates: DEFAULT_EMAIL_TEMPLATES,
  automaticCommunications: {
    enabled: false,
    emailEnabled: false,
    whatsappEnabled: false,
    frequencyDays: 1,
    sendTime: "09:00",
    daysBeforeDue: 3,
    overdueTailDays: 30,
    emailProvider: null,
  },
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
  evidenceAttachments: [],
  collectionFeeSettlements: [],
  financialAuditLog: [],
  financialMonthClosures: [],
  communicationLogs: [],
  settings: DEFAULT_SETTINGS,
};
