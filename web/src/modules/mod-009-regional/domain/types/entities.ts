// NexCargo MOD-009 — Regional & Cross-Border Logistics Operations Module Domain Types
// Wave 4 — Increment 1 — Authorized per HAO-WAVE3-AUTH-001 execution order D-SEQ-W3-001
// Reference: MOD-009 §4 Core Domain Entities (§§4.1–§4.7), §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO customs/regulatory enforcement or legal compliance execution (§7.1)
// - NO routing optimization, pricing calculation, or dispatch execution (§7.9)
// - All structures are design-time specification artifacts only

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type {
  BorderStatus,
  SegmentStatus,
  ValidationStatus,
  ClearanceStatus,
  CongestionLevel,
  RiskLevel,
  PermitAvailabilityState,
  ComplianceCheckpointType,
  CurrencyConversionAction,
  SegmentationMethod,
  CorridorAssignmentMethod,
  EnforcementLevel,
  BorderEventSource,
} from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Operational constraints structure for Region per MOD-009 §4.1 */
export interface OperationalConstraints {
  /** Maximum vehicle weight per road classification (kg) */
  maxVehicleWeightKg?: number;
  /** Required transit permits by transport mode */
  requiredTransitPermits: string[];
  /** Working hours restrictions */
  workingHoursRestrictions?: Record<string, string>;
  /** Hazardous material route limitations */
  hazardousMaterialRestrictions: boolean;
}

/** Structured compliance metadata for cross-border segments per MOD-009 §4.2 */
export interface ComplianceMetadata {
  /** Flag indicating if shipment requires additional documentation review */
  requiresAdditionalReview: boolean;
  /** Documents flagged as incomplete or requiring verification */
  flaggedDocuments: string[];
  /** Last compliance check timestamp */
  lastComplianceCheckAt: Date;
}

/** Operational rules structure for corridor definition per MOD-009 §4.3 */
export interface CorridorOperationalRules {
  /** Allowed transport modes on this corridor */
  permittedTransportModes: string[];
  /** Minimum safety requirements */
  minimumSafetyRequirements: string[];
  /** Weather-sensitive closures */
  weatherSensitiveClosures: boolean;
  /** Border post identifiers along corridor */
  borderPostIds: string[];
}

/** Document reference for customs documents per MOD-009 §4.2 */
export interface CustomsDocumentReference {
  /** MOD-004 document identifier */
  documentId: string;
  /** Document type classification */
  documentType: string;
  /** Whether this document has been validated */
  isValidated: boolean;
}

/** Vehicle licensing requirement structure per MOD-009 §4.5 */
export interface VehicleLicensingRequirement {
  /** License category required */
  licenseCategory: string;
  /** Issuing authority */
  issuingAuthority: string;
  /** Validity period in months */
  validityPeriodMonths: number;
}

/** Driver authorization requirement per MOD-009 §4.5 */
export interface DriverAuthorizationRequirement {
  /** Authorization type (e.g., CDL, GDL, special permit) */
  authorizationType: string;
  /** Expiry date */
  expiryDate: Date;
}

/** Cargo restriction structure per MOD-009 §4.5 */
export interface CargoRestriction {
  /** Cargo category being restricted */
  cargoCategory: string;
  /** Maximum quantity allowed (kg or liters) */
  maxQuantity: number;
  /** Special handling requirements */
  specialHandling: string[];
}

/** Insurance requirement detail per MOD-009 §4.5 */
export interface InsuranceRequirement {
  /** Type of insurance (liability, cargo, transit) */
  insuranceType: string;
  /** Minimum coverage amount */
  minimumCoverageAmount: number;
  /** Approved insurers list */
  approvedInsurers: string[];
}

/** Source reference for border congestion data per MOD-009 §4.7 */
export interface DataSrcReference {
  /** Source module producing this data */
  sourceModule: string;
  /** Data entity type */
  entityType: string;
}

/** Conversion rate trace record per MOD-009 §4.6, §7.5 */
export interface ConversionRateTraceRecord {
  /** Unique trace identifier */
  traceId: string;
  /** Applied rate value */
  appliedRate: number;
  /** Rate source system name */
  rateSourceName: string;
  /** Timestamp when rate was obtained */
  obtainedAt: Date;
  /** Confidence score in rate accuracy */
  confidenceScore: number;
}

// ============================================================
// Entity types (extend BaseEntity with snake_case fields)
// Per BaseEntity: id, created_at, updated_at, version, bumpVersion(), toJSON()
// ============================================================

/**
 * Region Object — geographic logistics zone.
 * Per MOD-009 §4.1
 * Represents SADC region/country logistics context.
 * Maintains consistent segmentation rules across countries.
 */
export interface RegionObject extends BaseEntity {
  /** Unique region identifier */
  regionId: string;
  /** Display name for the region */
  regionName: string;
  /** Array of ISO country codes covered */
  countryList: string[];
  /** Regulatory classification for compliance purposes */
  regulatoryClassification: string;
  /** Operational rules for the region */
  operationalConstraints: OperationalConstraints;
  /** Whether the region is currently active */
  activeStatus: boolean;
  /** Default language (pt/en) */
  defaultLanguage: string;
  /** Supported languages */
  supportedLanguages: string[];
  /** Primary currency code (MZN, ZAR, USD) */
  currencyCode: string;
  /** Temporary cross-border permit rules at borders */
  crossBorderPermitRules: JSON;
  /** Insurance requirements including COMESA Yellow Card via B2B */
  insuranceRequirements: JSON;
}

/**
 * CrossBorderShipmentSegment Object — shipment segment between jurisdictions.
 * Per MOD-009 §4.2
 * Every cross-border shipment MUST be split into logical segments.
 * Segments MUST retain full traceability to original shipment.
 * Each border crossing is a formal shipment milestone.
 */
export interface CrossBorderShipmentSegmentObject extends BaseEntity {
  /** Unique segment identifier */
  segmentId: string;
  /** MOD-003 tracking/shipment reference — all segments share one trackingId */
  trackingId: string;
  /** Origin region ID */
  originRegion: string;
  /** Destination region ID */
  destinationRegion: string;
  /** Border crossing status */
  borderStatus: BorderStatus;
  /** Overall segment lifecycle status */
  segmentStatus: SegmentStatus;
  /** Structured compliance metadata */
  complianceFlags: ComplianceMetadata;
  /** Array of MOD-004 document references */
  customsDocuments: CustomsDocumentReference[];
  /** Assigned corridor reference */
  corridorId: string;
  /** When segment begins */
  entryTimestamp: Date;
  /** When segment completes (optional) */
  exitTimestamp?: Date;
  /** Segmentation method used */
  segmentationMethod: SegmentationMethod;
}

/**
 * LogisticsCorridor Object — predefined logistics route abstraction.
 * Per MOD-009 §4.3
 * All cross-border shipments MUST map to at least one corridor.
 * Corridor selection influences pricing, ETA, and risk scoring (advisory only).
 * AI (MOD-006) provides corridor optimisation suggestions.
 */
export interface LogisticsCorridorObject extends BaseEntity {
  /** Unique corridor identifier */
  corridorId: string;
  /** Display name for the corridor */
  corridorName: string;
  /** Origin region ID */
  originRegion: string;
  /** Destination region ID */
  destinationRegion: string;
  /** Intermediate regions traversed */
  intermediateRegions: string[];
  /** Allowed transport modes */
  permittedTransportModes: string[];
  /** Risk level classification */
  riskLevel: RiskLevel;
  /** Corridor usage operational rules */
  operationalRules: CorridorOperationalRules;
  /** Whether corridor is currently active */
  activeStatus: boolean;
  /** Historical average transit time in days */
  averageTransitTime: number;
  /** Assignment method used */
  assignmentMethod: CorridorAssignmentMethod;
}

/**
 * BorderTransitionEvent Object — crossing between jurisdictions.
 * Per MOD-009 §4.4
 * Triggered by geofencing (MOD-003). Forces GPS location update.
 * Customs documentation must be validated before border crossing.
 * Events consumed by: MOD-003, MOD-006, MOD-010, MOD-012.
 */
export interface BorderTransitionEventObject extends BaseEntity {
  /** Unique event identifier */
  eventId: string;
  /** MOD-003 tracking/shipment reference */
  trackingId: string;
  /** From-region ID */
  fromRegion: string;
  /** To-region ID */
  toRegion: string;
  /** Border post identifier */
  borderPostId: string;
  /** Event timestamp */
  timestamp: Date;
  /** Validation status */
  validationStatus: ValidationStatus;
  /** How the event was detected */
  eventSource: BorderEventSource;
  /** Customs clearance status */
  clearanceStatus: ClearanceStatus;
  /** Delay duration in minutes (if applicable) */
  delayMinutes: number;
}

/**
 * CountryComplianceProfile Object — country-specific regulatory requirements.
 * Per MOD-009 §4.5
 * Country-specific rules apply automatically based on route.
 * Regulatory constraints enforced via configuration (not hardcoded).
 * Non-compliant shipments flagged for review.
 */
export interface CountryComplianceProfileObject extends BaseEntity {
  /** Unique profile identifier */
  profileId: string;
  /** ISO country code */
  countryCode: string;
  /** Structured compliance rules */
  regulatoryRules: JSON;
  /** Required document types */
  requiredDocuments: string[];
  /** Vehicle licensing rules */
  vehicleLicensingRequirements: VehicleLicensingRequirement[];
  /** Driver authorization rules */
  driverAuthorizationRequirements: DriverAuthorizationRequirement[];
  /** Cargo restrictions */
  cargoRestrictions: CargoRestriction[];
  /** Insurance requirements */
  insuranceRequirements: InsuranceRequirement[];
  /** Whether profile is active */
  activeStatus: boolean;
  /** Enforcement level for violations */
  enforcementLevel: EnforcementLevel;
}

/**
 * MultiCurrencyTransactionContext Object — financial context for cross-border transactions.
 * Per MOD-009 §4.6
 * Currency conversion rates stored per transaction.
 * Escrow (MOD-005) defines settlement currency.
 * Currency context advisory for pricing optimisation (not executed).
 */
export interface MultiCurrencyTransactionContextObject extends BaseEntity {
  /** Unique transaction context identifier */
  transactionId: string;
  /** Shipment reference */
  shipmentId: string;
  /** Origin currency code (e.g., MZN) */
  originCurrency: string;
  /** Destination currency code (e.g., ZAR) */
  destinationCurrency: string;
  /** Settlement currency (per MOD-005 escrow) */
  settlementCurrency: string;
  /** Applied conversion rate */
  conversionRate: number;
  /** Rate timestamp */
  rateTimestamp: Date;
  /** Source system that provided the rate */
  rateSource: string;
  /** Trace records for rate history and auditability */
  rateTraceRecords: ConversionRateTraceRecord[];
  /** Action taken */
  actionType: CurrencyConversionAction;
}

/**
 * BorderCongestionReport Object — intelligence on border delays and congestion.
 * Per MOD-009 §4.7
 * Predictions advisory only (no execution).
 * Affects ETA calculations (MOD-006 integration).
 * Alerts generated for high-delay risk crossings.
 */
export interface BorderCongestionReportObject extends BaseEntity {
  /** Unique report identifier */
  reportId: string;
  /** Border post identifier */
  borderPostId: string;
  /** Historical average wait time in minutes */
  averageWaitTime: number;
  /** Real-time estimated wait time in minutes */
  currentWaitTimeEstimate: number;
  /** Current congestion level */
  congestionLevel: CongestionLevel;
  /** Report generation timestamp */
  reportTimestamp: Date;
  /** Sources of congestion data */
  dataSources: DataSrcReference[];
  /** Confidence in the estimate */
  confidenceScore: number;
}

/**
 * TempPermitAuthorization Object — temporary cross-border permit availability.
 * Per MOD-009 §3.6, §5.4 Permit Flow
 * Transporters may obtain temporary permits at border.
 * MUST NOT block transporters solely due to missing pre-existing documentation.
 * Coordination with MOD-001 matching engine flexibility rule.
 */
export interface TempPermitAuthorizationObject extends BaseEntity {
  /** Unique permit authorization identifier */
  permitAuthId: string;
  /** Associated shipment/tracking ID */
  trackingId: string;
  /** Transporter user identifier */
  transporterId: string;
  /** Permit availability state */
  permitStatus: PermitAvailabilityState;
  /** Country/region where permit is valid */
  validRegion: string;
  /** Issue type (at_border, pre_issued, emergency) */
  issueType: string;
  /** Requested by transporter */
  requestedAt: Date;
  /** Authorized by border authority */
  authorizedAt?: Date;
  /** Expiration timestamp */
  expiresAt: Date;
}
