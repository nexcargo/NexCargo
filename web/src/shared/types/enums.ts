// NexCargo Domain Enums — Canonical type definitions sourced from Primitive Registry (Priority 0)
// All modules MUST use these enums. No local redefinitions allowed.

/** User roles per PROMPT 7 + MOD-010 */
export enum UserRole {
  SHIPPER = 'SHIPPER',
  TRANSPORTER = 'TRANSPORTER',
  DRIVER = 'DRIVER',
  FLEET_OWNER = 'FLEET_OWNER',
  DISPATCHER = 'DISPATCHER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  AI_SYSTEM_AGENT = 'AI_SYSTEM_AGENT',
}

/** Language preferences per ESS-007 + ESS-008 */
export enum LanguagePreference {
  PT = 'pt',
  EN = 'en',
}

/** Region mapping per ESS-009 */
export enum Region {
  MOZAMBIQUE = 'MZ',
  SOUTH_AFRICA = 'ZA',
  ZIMBABWE = 'ZW',
  ZAMBIA = 'ZM',
  MALAWI = 'MW',
  BOTSWANA = 'BW',
  DRC = 'CD',
  ESWATINI = 'SZ',
}

/** Currency codes for SADC region per MOD-009 + MOD-013 */
export enum CurrencyCode {
  MZN = 'MZN',
  ZAR = 'ZAR',
  USD = 'USD',
}

/** Shipment lifecycle states per MOD-003 */
export enum ShipmentStatus {
  CREATED = 'CREATED',
  BOOKED = 'BOOKED',
  AWAITING_PICKUP = 'AWAITING_PICKUP',
  PICKUP_ACKNOWLEDGED = 'PICKUP_ACKNOWLEDGED',
  IN_TRANSIT = 'IN_TRANSIT',
  AT_BORDER = 'AT_BORDER',
  DELAYED = 'DELAYED',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
}

/** Escrow/Payment states per MOD-005 + MOD-013 */
export enum EscrowState {
  PENDING_CREATION = 'PENDING_CREATION',
  FUNDS_INITIATED = 'FUNDS_INITIATED',
  FUNDS_LOCKED = 'FUNDS_LOCKED',
  PARTIAL_RELEASE = 'PARTIAL_RELEASE',
  FINAL_RELEASE = 'FINAL_RELEASE',
  DISPUTE_HOLD = 'DISPUTE_HOLD',
  ESCROW_CLOSED = 'ESCROW_CLOSED',
}

/** Payment method types per MOD-005 + MOD-013 */
export enum PaymentMethod {
  MPESA = 'MPESA',
  MKESH = 'MKESH',
  EMOLA = 'EMOLA',
  CARD = 'CARD',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

/** Contract states per MOD-002 */
export enum ContractStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  NEGOTIATING = 'NEGOTIATING',
  SIGNED = 'SIGNED',
  IN_EXECUTION = 'IN_EXECUTION',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED',
}

/** Asset availability states per MOD-014 */
export enum AssetAvailabilityState {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  SUSPENDED = 'SUSPENDED',
}

/** Vehicle types per MOD-014 */
export enum VehicleType {
  HEAVY_TRUCK = 'HEAVY_TRUCK',
  LIGHT_DELIVERY = 'LIGHT_DELIVERY',
  TRAILER = 'TRAILER',
  REFRIGERATED = 'REFRIGERATED',
  SPECIALISED = 'SPECIALISED',
}

/** Document types per MOD-004 */
export enum DocumentType {
  CONTRACT = 'CONTRACT',
  POD = 'POD',
  BILL_OF_LADING = 'BILL_OF_LADING',
  CUSTOMS_DOCUMENT = 'CUSTOMS_DOCUMENT',
  VEHICLE_REGISTRATION = 'VEHICLE_REGISTRATION',
  DRIVER_LICENSE = 'DRIVER_LICENSE',
  INSURANCE_CERTIFICATE = 'INSURANCE_CERTIFICATE',
}

/** Event classifications per Event Registry */
export enum EventClassification {
  BUSINESS = 'BUSINESS',
  FINANCIAL = 'FINANCIAL',
  COMPLIANCE = 'COMPLIANCE',
  AI_ADVISORY = 'AI_ADVISORY',
  ANALYTICS = 'ANALYTICS',
  NOTIFICATION = 'NOTIFICATION',
  INTEGRATION = 'INTEGRATION',
  OBSERVABILITY = 'OBSERVABILITY',
  SECURITY = 'SECURITY',
}

/** Event criticality levels per Event Registry */
export enum EventCriticality {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/** Alert severity per ESS-005 + MOD-017 */
export enum AlertSeverity {
  SEV_1 = 'SEV_1',
  SEV_2 = 'SEV_2',
  SEV_3 = 'SEV_3',
}

/** Dispute categories per MOD-015 */
export enum DisputeCategory {
  PAYMENT = 'PAYMENT',
  DELIVERY = 'DELIVERY',
  DAMAGE = 'DAMAGE',
  DELAY = 'DELAY',
  CONTRACT = 'CONTRACT',
}

/** Dispute escalation level per MOD-015 */
export enum EscalationLevel {
  L1_AGENT = 'L1_AGENT',
  L2_SUPERVISOR = 'L2_SUPERVISOR',
  L3_ADMIN = 'L3_ADMIN',
}

/** Notification channel per MOD-016 */
export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  WHATSAPP = 'WHATSAPP',
}

/** AI decision tier per ESS-003 */
export enum AIDecisionTier {
  TIER_1_ADVISORY = 'TIER_1_ADVISORY',
  TIER_2_ASSISTED_EXECUTION = 'TIER_2_ASSISTED_EXECUTION',
  TIER_3_RESTRICTED = 'TIER_3_RESTRICTED',
}

/** Financial integration status per ESS-001F */
export enum FinancialIntegrationStatus {
  PENDING = 'PENDING',
  INITIATED = 'INITIATED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}
