// NexCargo MOD-009 — Regional & Cross-Border Logistics Operations Module Advisory & Structural Validation Services
// Wave 4 — Increment 1 — Authorized per HAO-WAVE3-AUTH-001 execution order D-SEQ-W3-001
// Reference: MOD-009 §7 Rules of Operation, ESS-004 Integration Contracts, ESS-006 Security Compliance
//
// NO LEGAL EXECUTION PRINCIPLE: These services validate structural integrity ONLY.
// They do NOT enforce customs laws, execute regulatory compliance, interpret legal requirements,
// validate real-world customs clearance, or enforce compliance independently of ESS-006.
// Per MOD-009 §7.1 No Legal Execution Rule, §7.9 Neutrality Rule, §11 Architecture Boundary Rule.

import type {
  RegionObject,
  CrossBorderShipmentSegmentObject,
  LogisticsCorridorObject,
  BorderTransitionEventObject,
  CountryComplianceProfileObject,
  MultiCurrencyTransactionContextObject,
  BorderCongestionReportObject,
  TempPermitAuthorizationObject,
} from '../types/entities';
import {
  BorderStatus,
  SegmentStatus,
  ValidationStatus,
  ClearanceStatus,
  CongestionLevel,
  RiskLevel,
  PermitAvailabilityState,
  SegmentationMethod,
  CorridorAssignmentMethod,
  EnforcementLevel,
  BorderEventSource,
  CurrencyConversionAction,
} from '../enums';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

const VALID_BORDER_STATUSES = Object.values(BorderStatus);
const VALID_SEGMENT_STATUSES = Object.values(SegmentStatus);
const VALID_VALIDATION_STATUSES = Object.values(ValidationStatus);
const VALID_CLEARANCE_STATUSES = Object.values(ClearanceStatus);
const VALID_CONGESTION_LEVELS = Object.values(CongestionLevel);
const VALID_RISK_LEVELS = Object.values(RiskLevel);
const VALID_PERMIT_STATES = Object.values(PermitAvailabilityState);
const VALID_SEGMENTATION_METHODS = Object.values(SegmentationMethod);
const VALID_ASSIGNMENT_METHODS = Object.values(CorridorAssignmentMethod);
const VALID_ENFORCEMENT_LEVELS = Object.values(EnforcementLevel);
const SOURCE_MODULE_PATTERN = /^MOD-\d{3}$/;
const MOZAMBIQUE_COUNTRY_CODE = 'MZ';
const MAX_TRANSIT_TIME_DAYS = 30;

export function enforceNoLegalExecutionRule(corridor: LogisticsCorridorObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!VALID_RISK_LEVELS.includes(corridor.riskLevel)) {
    errors.push({ code: 'INVALID_RISK_LEVEL', field: 'riskLevel', message: `Risk level must be one of: ${VALID_RISK_LEVELS.join(', ')}` });
  }
  if (corridor.operationalRules) {
    const rules = corridor.operationalRules as Record<string, unknown>;
    for (const keyword of ['auto_reject', 'customs_execution', 'legal_enforcement']) {
      if (rules[keyword] === true || rules[keyword] === 'AUTO') {
        errors.push({ code: 'NO_AUTOMATED_LEGAL_EXECUTION', field: 'operationalRules', message: `Operational rules cannot include automated legal/customs execution ('${keyword}') — all enforcement deferred to external systems + ESS-006 per §7.1` });
      }
    }
  }
  if (!VALID_ASSIGNMENT_METHODS.includes(corridor.assignmentMethod)) {
    errors.push({ code: 'INVALID_ASSIGNMENT_METHOD', field: 'assignmentMethod', message: `Corridor assignment method must be one of: ${VALID_ASSIGNMENT_METHODS.join(', ')}` });
  }
  return { valid: errors.length === 0, errors };
}

export function enforceSegmentationRule(segment: CrossBorderShipmentSegmentObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!VALID_SEGMENT_STATUSES.includes(segment.segmentStatus)) {
    errors.push({ code: 'INVALID_SEGMENT_STATUS', field: 'segmentStatus', message: `Segment status must be one of: ${VALID_SEGMENT_STATUSES.join(', ')}` });
  }
  if (!VALID_BORDER_STATUSES.includes(segment.borderStatus)) {
    errors.push({ code: 'INVALID_BORDER_STATUS', field: 'borderStatus', message: `Border status must be one of: ${VALID_BORDER_STATUSES.join(', ')}` });
  }
  if (!segment.trackingId || typeof segment.trackingId !== 'string') {
    errors.push({ code: 'TRACKING_ID_REQUIRED', field: 'trackingId', message: 'Every cross-border segment must reference its parent tracking ID (MOD-003) for full traceability per §7.2' });
  }
  if (!segment.originRegion || !segment.destinationRegion) {
    errors.push({ code: 'ORIGIN_DESTINATION_REQUIRED', field: 'originRegion/destinationRegion', message: 'Cross-border segments must define both origin and destination regions per §7.2' });
  }
  if (!VALID_SEGMENTATION_METHODS.includes(segment.segmentationMethod)) {
    errors.push({ code: 'SEGMENTATION_METHOD_REQUIRED', field: 'segmentationMethod', message: 'Segmentation method must be explicitly recorded per §7.2' });
  }
  if (!segment.complianceFlags || !Array.isArray(segment.customsDocuments)) {
    errors.push({ code: 'COMPLIANCE_METADATA_REQUIRED', field: 'complianceFlags/customsDocuments', message: 'Segments must include compliance flags and customs document references per §4.2' });
  } else {
    for (let i = 0; i < segment.customsDocuments.length; i++) {
      const doc = segment.customsDocuments[i];
      if (!doc.documentId || typeof doc.documentId !== 'string') {
        errors.push({ code: `DOCUMENT_${i}_MISSING_ID`, field: 'customsDocuments', message: `Customs document at index ${i} must have a MOD-004 document ID` });
        break;
      }
    }
  }
  if (!(segment.entryTimestamp instanceof Date) || isNaN(segment.entryTimestamp.getTime())) {
    errors.push({ code: 'ENTRY_TIMESTAMP_REQUIRED', field: 'entryTimestamp', message: 'Entry timestamp is mandatory for segment traceability per §7.2' });
  }
  if (!segment.corridorId || typeof segment.corridorId !== 'string') {
    errors.push({ code: 'CORRIDOR_ASSIGNMENT_REQUIRED', field: 'corridorId', message: 'All cross-border shipments MUST map to at least one corridor per §7.3' });
  }
  return { valid: errors.length === 0, errors };
}

export function validateCorridorAssignment(corridor: LogisticsCorridorObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!corridor.originRegion || !corridor.destinationRegion) {
    errors.push({ code: 'ORIGIN_DESTINATION_REQUIRED', field: 'originRegion/destinationRegion', message: 'Corridors must define both origin and destination regions per §4.3' });
  }
  if (!Number.isFinite(corridor.averageTransitTime) || corridor.averageTransitTime <= 0) {
    errors.push({ code: 'TRANSIT_TIME_MUST_BE_POSITIVE', field: 'averageTransitTime', message: 'Average transit time must be a positive finite number — advisory figure per §7.3' });
  }
  if (corridor.averageTransitTime > MAX_TRANSIT_TIME_DAYS) {
    errors.push({ code: 'TRANSIT_TIME_UNREASONABLY_HIGH', field: 'averageTransitTime', message: `Average transit time exceeds ${MAX_TRANSIT_TIME_DAYS} days — unusual corridor requiring manual review` });
  }
  if (!Array.isArray(corridor.permittedTransportModes) || corridor.permittedTransportModes.length === 0) {
    errors.push({ code: 'PERMITTED_TRANSPORT_MODES_REQUIRED', field: 'permittedTransportModes', message: 'Corridors must specify permitted transport modes per §4.3' });
  }
  if (!corridor.operationalRules) {
    errors.push({ code: 'OPERATIONAL_RULES_REQUIRED', field: 'operationalRules', message: 'Corridors must define operational rules per §4.3' });
  }
  return { valid: errors.length === 0, errors };
}

export function enforceCustomsReadiness(segment: CrossBorderShipmentSegmentObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!VALID_BORDER_STATUSES.includes(segment.borderStatus)) {
    errors.push({ code: 'INVALID_BORDER_STATUS', field: 'borderStatus', message: `Border status must be one of: ${VALID_BORDER_STATUSES.join(', ')}` });
  }
  if (segment.originRegion !== segment.destinationRegion && (!segment.customsDocuments || segment.customsDocuments.length === 0)) {
    errors.push({ code: 'CROSS_BORDER_REQUIRES_DOCUMENTS', field: 'customsDocuments', message: 'Cross-border segments (origin ≠ destination) must reference MOD-004 customs documents per §7.4' });
  }
  return { valid: errors.length === 0, errors };
}

export function validateCurrencySpecification(context: MultiCurrencyTransactionContextObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!context.settlementCurrency || typeof context.settlementCurrency !== 'string') {
    errors.push({ code: 'SETTLEMENT_CURRENCY_REQUIRED', field: 'settlementCurrency', message: 'Every cross-border transaction must specify settlement currency per §7.5' });
  }
  if (!Number.isFinite(context.conversionRate) || context.conversionRate <= 0) {
    errors.push({ code: 'CONVERSION_RATE_MUST_BE_POSITIVE', field: 'conversionRate', message: 'Conversion rate must be a positive finite number per §7.5' });
  }
  if (!(context.rateTimestamp instanceof Date) || isNaN(context.rateTimestamp.getTime())) {
    errors.push({ code: 'RATE_TIMESTAMP_REQUIRED', field: 'rateTimestamp', message: 'Rate timestamp required for conversion traceability per §7.5' });
  }
  if (!context.rateSource || typeof context.rateSource !== 'string') {
    errors.push({ code: 'RATE_SOURCE_REQUIRED', field: 'rateSource', message: 'Currency conversion rate source must be documented per §7.5' });
  }
  if (!Object.values(CurrencyConversionAction).includes(context.actionType as never)) {
    errors.push({ code: 'INVALID_CONVERSION_ACTION', field: 'actionType', message: `Currency conversion action must be one of: ${Object.values(CurrencyConversionAction).join(', ')}` });
  }
  return { valid: errors.length === 0, errors };
}

export function enforceComplianceCheckpoint(profile): ValidationResult {
  const errors: ValidationError[] = [];
  const p = profile as any;
  if (!p.countryCode || !/^[A-Z]{2,3}$/.test(p.countryCode)) {
    errors.push({ code: 'COUNTRY_CODE_INVALID_FORMAT', field: 'countryCode', message: 'Country code must be a 3-character ISO code in uppercase' });
  }
  if (!Array.isArray(p.requiredDocuments ?? [])) {
    errors.push({ code: 'REQUIRED_DOCUMENTS_LIST_REQUIRED', field: 'requiredDocuments', message: 'Profiles must define required documents array per §4.5' });
  }
  const enVals = ['ADVISORY_ONLY','FLAG_FOR_REVIEW','BLOCK_PLANNING','MOD_010_ENFORCED'];
  if (!enVals.includes(String(p.enforcementLevel ?? ''))) {
    errors.push({ code: 'INVALID_ENFORCEMENT_LEVEL', field: 'enforcementLevel', message: 'Invalid enforcement level' });
  }
  return { valid: errors.length === 0, errors };
}

export function validatePermitFlexibilityFlow(permit: TempPermitAuthorizationObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!VALID_PERMIT_STATES.includes(permit.permitStatus)) {
    errors.push({ code: 'INVALID_PERMIT_STATUS', field: 'permitStatus', message: `Permit status must be one of: ${VALID_PERMIT_STATES.join(', ')}` });
  }
  if (permit.requestedAt && permit.expiresAt && permit.expiresAt <= permit.requestedAt) {
    errors.push({ code: 'EXPIRY_AFTER_REQUEST_REQUIRED', field: 'expiresAt', message: 'Permit expiration must be after request date per §7.7' });
  }
  if (!(permit.requestedAt instanceof Date) || isNaN(permit.requestedAt.getTime())) {
    errors.push({ code: 'REQUESTED_AT_REQUIRED', field: 'requestedAt', message: 'Requested-at timestamp is mandatory' });
  }
  if (!(permit.expiresAt instanceof Date) || isNaN(permit.expiresAt.getTime())) {
    errors.push({ code: 'EXPIRES_AT_REQUIRED', field: 'expiresAt', message: 'Expiration timestamp is mandatory per §7.7' });
  }
  if (!permit.transporterId || typeof permit.transporterId !== 'string') {
    errors.push({ code: 'TRANSPORTER_ID_REQUIRED', field: 'transporterId', message: 'Permits must reference requesting transporter per §7.7' });
  }
  if (!permit.validRegion || typeof permit.validRegion !== 'string') {
    errors.push({ code: 'VALID_REGION_REQUIRED', field: 'validRegion', message: 'Temp permits must specify valid region per §7.7' });
  }
  return { valid: errors.length === 0, errors };
}

export function enforceLicensingRule(region): ValidationResult {
  const errors: ValidationError[] = [];
  const r = region as any;
  // Mozambique rule: transport licenses valid nationwide, no intra-country restrictions
  if (Array.isArray(r.countryList) && r.countryList.includes('MZ')) {
    const constraints = r.operationalConstraints ?? {};
    for (const kw of ['operating_region','regional_restrictions','province_restrictions']) {
      if (constraints[kw] != null) {
        errors.push({ code: 'NO_MOZAMBIQUE_INTRA_COUNTRY_RESTRICTIONS', field: 'operationalConstraints', message: `Mozambique licenses valid nationwide - '${kw}' conflicts with §7.8 Licensing Rule` });
      }
    }
  }
  // All regions must define permit rules
  if (typeof r.crossBorderPermitRules !== 'object' || r.crossBorderPermitRules === null) {
    errors.push({ code: 'PERMIT_RULES_STRUCTURE_REQUIRED', field: 'crossBorderPermitRules', message: 'Regions must define cross-border permit rules per §3.6 and §7.7' });
  }
  return { valid: errors.length === 0, errors };
}

export function enforceNeutralityRule(congestionReport: BorderCongestionReportObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!VALID_CONGESTION_LEVELS.includes(congestionReport.congestionLevel)) {
    errors.push({ code: 'INVALID_CONGESTION_LEVEL', field: 'congestionLevel', message: `Congestion level must be one of: ${VALID_CONGESTION_LEVELS.join(', ')}` });
  }
  if (congestionReport.averageWaitTime < 0) {
    errors.push({ code: 'WAIT_TIME_NON_NEGATIVE', field: 'averageWaitTime', message: 'Wait times must be non-negative numbers per §7.9' });
  }
  if (congestionReport.currentWaitTimeEstimate < 0) {
    errors.push({ code: 'ESTIMATED_WAIT_TIME_NON_NEGATIVE', field: 'currentWaitTimeEstimate', message: 'Estimated wait times must be non-negative numbers per §7.9' });
  }
  if (typeof congestionReport.confidenceScore !== 'number' || congestionReport.confidenceScore < 0 || congestionReport.confidenceScore > 1) {
    errors.push({ code: 'CONFIDENCE_SCORE_OUT_OF_RANGE', field: 'confidenceScore', message: 'Confidence scores must be between 0 and 1 per §7.9' });
  }
  if (congestionReport.dataSources) {
    for (let i = 0; i < congestionReport.dataSources.length; i++) {
      const src = congestionReport.dataSources[i];
      if (!src.sourceModule || !SOURCE_MODULE_PATTERN.test(src.sourceModule)) {
        errors.push({ code: `DATA_SOURCE_${i}_INVALID_MODULE`, field: 'dataSources', message: `Data source at index ${i} must reference a valid NexCargo module (MOD-XXX)` });
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateBorderTransitionEvent(event: BorderTransitionEventObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!VALID_VALIDATION_STATUSES.includes(event.validationStatus)) {
    errors.push({ code: 'INVALID_VALIDATION_STATUS', field: 'validationStatus', message: `Validation status must be one of: ${VALID_VALIDATION_STATUSES.join(', ')}` });
  }
  if (!VALID_CLEARANCE_STATUSES.includes(event.clearanceStatus)) {
    errors.push({ code: 'INVALID_CLEARANCE_STATUS', field: 'clearanceStatus', message: `Clearance status must be one of: ${VALID_CLEARANCE_STATUSES.join(', ')}` });
  }
  if (!Object.values(BorderEventSource).includes(event.eventSource as never)) {
    errors.push({ code: 'INVALID_EVENT_SOURCE', field: 'eventSource', message: `Event source must be one of: ${Object.values(BorderEventSource).join(', ')}` });
  }
  if (!event.trackingId || typeof event.trackingId !== 'string') {
    errors.push({ code: 'TRACKING_ID_REQUIRED', field: 'trackingId', message: 'Border events must reference their parent tracking ID per §4.4' });
  }
  if (event.fromRegion === event.toRegion) {
    errors.push({ code: 'FROM_TO_REGIONS_DISTINCT', field: 'fromRegion/toRegion', message: 'Cross-border transitions require distinct from/to regions per §4.4' });
  }
  if (!event.borderPostId || typeof event.borderPostId !== 'string') {
    errors.push({ code: 'BORDER_POST_REQUIRED', field: 'borderPostId', message: 'Border transition events must identify the crossing border post per §4.4' });
  }
  if (typeof event.delayMinutes !== 'number' || event.delayMinutes < 0) {
    errors.push({ code: 'DELAY_MINUTES_NON_NEGATIVE', field: 'delayMinutes', message: 'Delay minutes must be non-negative per §4.4' });
  }
  if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
    errors.push({ code: 'TIMESTAMP_REQUIRED', field: 'timestamp', message: 'Event timestamp is mandatory per §4.4' });
  }
  return { valid: errors.length === 0, errors };
}

export function validateRegionStructuralIntegrity(region: RegionObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!Array.isArray(region.countryList) || region.countryList.length === 0) {
    errors.push({ code: 'COUNTRY_LIST_REQUIRED', field: 'countryList', message: 'Active regions must have at least one country code per §4.1' });
  }
  if (!['pt', 'en'].includes(region.defaultLanguage)) {
    errors.push({ code: 'DEFAULT_LANGUAGE_MUST_BE_PT_OR_EN', field: 'defaultLanguage', message: 'Default language must be pt or en per §4.1' });
  }
  if (region.currencyCode && !['MZN', 'ZAR', 'USD'].includes(region.currencyCode)) {
    errors.push({ code: 'CURRENCY_CODE_NOT_SADC_STANDARD', field: 'currencyCode', message: 'Primary currency must be MZN, ZAR, or USD for SADC compatibility per §4.6' });
  }
  if (!region.operationalConstraints) {
    errors.push({ code: 'OPERATIONAL_CONSTRAINTS_REQUIRED', field: 'operationalConstraints', message: 'Regions must define operational constraints per §4.1' });
  }
  if (!region.crossBorderPermitRules) {
    errors.push({ code: 'CROSS_BORDER_PERMIT_RULES_REQUIRED', field: 'crossBorderPermitRules', message: 'Regions must define cross-border permit rules per §3.6 and §7.7' });
  }
  if (!region.insuranceRequirements) {
    errors.push({ code: 'INSURANCE_REQUIREMENTS_REQUIRED', field: 'insuranceRequirements', message: 'Regions must define insurance requirements per §4.1' });
  }
  return { valid: errors.length === 0, errors };
}

export function validateRegulatoryAbstraction(profile: CountryComplianceProfileObject): ValidationResult {
  const errors: ValidationError[] = [];
  if (!profile.profileId || typeof profile.profileId !== 'string') {
    errors.push({ code: 'PROFILE_ID_REQUIRED', field: 'profileId', message: 'Each country compliance profile must have a unique identifier per §4.5' });
  }
  if (typeof profile.activeStatus !== 'boolean') {
    errors.push({ code: 'ACTIVE_STATUS_REQUIRED', field: 'activeStatus', message: 'Profiles must have explicit active/inactive status per §4.5' });
  }
  return { valid: errors.length === 0, errors };
}
