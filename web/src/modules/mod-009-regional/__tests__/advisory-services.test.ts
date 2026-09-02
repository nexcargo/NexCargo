// NexCargo MOD-009 — Advisory Services Tests
// Wave 4 — Increment 1 — Authorized per HAO-WAVE3-AUTH-001 execution order D-SEQ-W3-001

import { describe, it, expect } from 'vitest';
import type { LogisticsCorridorObject, CrossBorderShipmentSegmentObject, BorderTransitionEventObject, CountryComplianceProfileObject, MultiCurrencyTransactionContextObject, BorderCongestionReportObject, RegionObject, TempPermitAuthorizationObject } from '../domain/types/entities';
import { BorderStatus, SegmentStatus, ValidationStatus, ClearanceStatus, CongestionLevel, RiskLevel, PermitAvailabilityState, SegmentationMethod, CorridorAssignmentMethod, EnforcementLevel, BorderEventSource, CurrencyConversionAction } from '../domain/enums';
import { enforceNoLegalExecutionRule, enforceSegmentationRule, validateCorridorAssignment, enforceCustomsReadiness, validateCurrencySpecification, enforceComplianceCheckpoint, validatePermitFlexibilityFlow, enforceLicensingRule, enforceNeutralityRule, validateBorderTransitionEvent, validateRegionStructuralIntegrity, validateRegulatoryAbstraction } from '../domain/services/advisory-services';

const now = new Date('2026-08-31T10:00:00Z');

function stubEntity() {
  return { id: 'stub', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) };
}

function buildValidCorridor(): LogisticsCorridorObject {
  return { ...stubEntity(), corridorId: 'corridor-001', corridorName: 'Beira Corridor', originRegion: 'MZ', destinationRegion: 'ZM', intermediateRegions: ['ZW'], permittedTransportModes: ['HEAVY_TRUCK', 'LIGHT_DELIVERY'], riskLevel: RiskLevel.MEDIUM, operationalRules: { permittedTransportModes: [], minimumSafetyRequirements: [], weatherSensitiveClosures: false, borderPostIds: ['bp1'] }, activeStatus: true, averageTransitTime: 3, assignmentMethod: CorridorAssignmentMethod.ORIGIN_DESTINATION_MATCH };
}

function buildValidSegment(): CrossBorderShipmentSegmentObject {
  return { ...stubEntity(), segmentId: 'seg-001', trackingId: 'shipment-001', originRegion: 'MZ', destinationRegion: 'ZW', borderStatus: BorderStatus.PENDING, segmentStatus: SegmentStatus.PLANNED, complianceFlags: { requiresAdditionalReview: false, flaggedDocuments: [], lastComplianceCheckAt: now }, customsDocuments: [{ documentId: 'doc-001', documentType: 'CUSTOMS', isValidated: false }], corridorId: 'corridor-001', entryTimestamp: now, segmentationMethod: SegmentationMethod.REGION_TRANSITION };
}

function buildValidBorderEvent(): BorderTransitionEventObject {
  return { ...stubEntity(), eventId: 'evt-001', trackingId: 'shipment-001', fromRegion: 'MZ', toRegion: 'ZW', borderPostId: 'bp1', timestamp: now, validationStatus: ValidationStatus.PENDING, eventSource: BorderEventSource.GPS_GEOFENCE, clearanceStatus: ClearanceStatus.PENDING, delayMinutes: 0 };
}

function buildValidCountryProfile(): CountryComplianceProfileObject {
  return { ...stubEntity(), profileId: 'prof-001', countryCode: 'MZ', regulatoryRules: {}, requiredDocuments: ['CONTRACT', 'POD'], vehicleLicensingRequirements: [{ licenseCategory: 'HD', issuingAuthority: 'INTRANS', validityPeriodMonths: 12 }], driverAuthorizationRequirements: [{ authorizationType: 'CDL', expiryDate: new Date('2027-01-01') }], cargoRestrictions: [{ cargoCategory: 'HAZMAT', maxQuantity: 5000, specialHandling: ['ventilation'] }], insuranceRequirements: [{ insuranceType: 'liability', minimumCoverageAmount: 100000, approvedInsurers: ['B2B'] }], activeStatus: true, enforcementLevel: EnforcementLevel.ADVISORY_ONLY };
}

function buildValidCurrencyContext(): MultiCurrencyTransactionContextObject {
  return { ...stubEntity(), transactionId: 'txn-001', shipmentId: 'shipment-001', originCurrency: 'MZN', destinationCurrency: 'ZAR', settlementCurrency: 'USD', conversionRate: 18.5, rateTimestamp: now, rateSource: 'EXCHANGE_API', rateTraceRecords: [], actionType: CurrencyConversionAction.APPLY_RATE };
}

function buildValidCongestionReport(): BorderCongestionReportObject {
  return { ...stubEntity(), reportId: 'rep-001', borderPostId: 'bp1', averageWaitTime: 45, currentWaitTimeEstimate: 60, congestionLevel: CongestionLevel.HIGH, reportTimestamp: now, dataSources: [{ sourceModule: 'MOD-003', entityType: 'tracking' }], confidenceScore: 0.85 };
}

function buildValidRegion(): RegionObject {
  return { ...stubEntity(), regionId: 'region-mz', regionName: 'Mozambique', countryList: ['MZ'], regulatoryClassification: 'SADC_MEMBER', operationalConstraints: { maxVehicleWeightKg: 40000, requiredTransitPermits: [], workingHoursRestrictions: {}, hazardousMaterialRestrictions: false }, activeStatus: true, defaultLanguage: 'pt', supportedLanguages: ['pt', 'en'], currencyCode: 'MZN', crossBorderPermitRules: { atBorderAvailable: true }, insuranceRequirements: { yellowCardAvailable: true } };
}

function buildValidPermitAuth(): TempPermitAuthorizationObject {
  return { ...stubEntity(), permitAuthId: 'perm-001', trackingId: 'shipment-001', transporterId: 'transporter-001', permitStatus: PermitAvailabilityState.AVAILABLE, validRegion: 'ZW', issueType: 'at_border', requestedAt: now, expiresAt: new Date('2026-09-30'), authorizedAt: undefined };
}

// ============================================================
// No Legal Execution Rule tests (§7.1)
// ============================================================

describe('enforceNoLegalExecutionRule — MOD-009 §7.1', () => {
  it('validates a proper corridor', () => {
    const result = enforceNoLegalExecutionRule(buildValidCorridor());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects corridor with automated legal enforcement flag', () => {
    const c = buildValidCorridor();
    (c.operationalRules as any).auto_reject = true;
    const result = enforceNoLegalExecutionRule(c);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'NO_AUTOMATED_LEGAL_EXECUTION')).toBe(true);
  });
});

// ============================================================
// Segmentation Rule tests (§7.2)
// ============================================================

describe('enforceSegmentationRule — MOD-009 §7.2', () => {
  it('validates a proper segment', () => {
    const result = enforceSegmentationRule(buildValidSegment());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects segment without tracking ID', () => {
    const s = buildValidSegment();
    s.trackingId = '';
    const result = enforceSegmentationRule(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'TRACKING_ID_REQUIRED')).toBe(true);
  });

  it('rejects segment missing corridor assignment', () => {
    const s = buildValidSegment();
    s.corridorId = '';
    const result = enforceSegmentationRule(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CORRIDOR_ASSIGNMENT_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Corridor Assignment tests (§7.3)
// ============================================================

describe('validateCorridorAssignment — MOD-009 §7.3', () => {
  it('validates a proper corridor', () => {
    const result = validateCorridorAssignment(buildValidCorridor());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects corridor without transit time', () => {
    const c = buildValidCorridor();
    c.averageTransitTime = -1;
    const result = validateCorridorAssignment(c);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'TRANSIT_TIME_MUST_BE_POSITIVE')).toBe(true);
  });
});

// ============================================================
// Customs Readiness tests (§7.4)
// ============================================================

describe('enforceCustomsReadiness — MOD-009 §7.4', () => {
  it('validates a cross-border segment with documents', () => {
    const result = enforceCustomsReadiness(buildValidSegment());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects cross-border segment without customs documents', () => {
    const s = buildValidSegment();
    s.customsDocuments = [];
    const result = enforceCustomsReadiness(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CROSS_BORDER_REQUIRES_DOCUMENTS')).toBe(true);
  });
});

// ============================================================
// Currency Specification tests (§7.5)
// ============================================================

describe('validateCurrencySpecification — MOD-009 §7.5', () => {
  it('validates a proper currency context', () => {
    const result = validateCurrencySpecification(buildValidCurrencyContext());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects currency context without settlement currency', () => {
    const ctx = buildValidCurrencyContext();
    ctx.settlementCurrency = '';
    const result = validateCurrencySpecification(ctx);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SETTLEMENT_CURRENCY_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Compliance Checkpoint tests (§7.6)
// ============================================================

describe('enforceComplianceCheckpoint — MOD-009 §7.6', () => {
  it('validates a proper country profile', () => {
    const result = enforceComplianceCheckpoint(buildValidCountryProfile());
    console.error('DEBUG compliance errors:', JSON.stringify(result.errors));expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects profile with invalid country code', () => {
    const p = buildValidCountryProfile();
    p.countryCode = 'XYZAB';
    const result = enforceComplianceCheckpoint(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'COUNTRY_CODE_INVALID_FORMAT')).toBe(true);
  });
});

// ============================================================
// Permit Flexibility tests (§7.7)
// ============================================================

describe('validatePermitFlexibilityFlow — MOD-009 §7.7', () => {
  it('validates a proper permit authorization', () => {
    const result = validatePermitFlexibilityFlow(buildValidPermitAuth());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects permit expiring before request date', () => {
    const p = buildValidPermitAuth();
    p.expiresAt = new Date('2026-08-01T00:00:00Z');
    const result = validatePermitFlexibilityFlow(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'EXPIRY_AFTER_REQUEST_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Licensing Rule tests (§7.8)
// ============================================================

describe('enforceLicensingRule — MOD-009 §7.8', () => {
  it('validates Mozambique region without intra-country restrictions', () => {
    const result = enforceLicensingRule(buildValidRegion());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects Mozambique region with operating region restrictions', () => {
    const r = buildValidRegion();
    (r.operationalConstraints as any).operating_region = 'MAPUTO_ONLY';
    const result = enforceLicensingRule(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'NO_MOZAMBIQUE_INTRA_COUNTRY_RESTRICTIONS')).toBe(true);
  });
});

// ============================================================
// Neutrality Rule tests (§7.9)
// ============================================================

describe('enforceNeutralityRule — MOD-009 §7.9', () => {
  it('validates a proper congestion report', () => {
    const result = enforceNeutralityRule(buildValidCongestionReport());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects congestion report with invalid confidence score', () => {
    const r = buildValidCongestionReport();
    r.confidenceScore = 1.5;
    const result = enforceNeutralityRule(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CONFIDENCE_SCORE_OUT_OF_RANGE')).toBe(true);
  });

  it('rejects congestion report with negative wait times', () => {
    const r = buildValidCongestionReport();
    r.currentWaitTimeEstimate = -10;
    const result = enforceNeutralityRule(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ESTIMATED_WAIT_TIME_NON_NEGATIVE')).toBe(true);
  });
});

// ============================================================
// Border Transition Event Integrity tests (§4.4)
// ============================================================

describe('validateBorderTransitionEvent — MOD-009 §4.4', () => {
  it('validates a proper border event', () => {
    const result = validateBorderTransitionEvent(buildValidBorderEvent());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects event without tracking ID', () => {
    const e = buildValidBorderEvent();
    e.trackingId = '';
    const result = validateBorderTransitionEvent(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'TRACKING_ID_REQUIRED')).toBe(true);
  });

  it('rejects event where from/to regions are identical', () => {
    const e = buildValidBorderEvent();
    e.toRegion = e.fromRegion;
    const result = validateBorderTransitionEvent(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'FROM_TO_REGIONS_DISTINCT')).toBe(true);
  });
});

// ============================================================
// Region Structural Integrity tests (§4.1)
// ============================================================

describe('validateRegionStructuralIntegrity — MOD-009 §4.1', () => {
  it('validates a proper region', () => {
    const result = validateRegionStructuralIntegrity(buildValidRegion());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects region with non-SADC currency code', () => {
    const r = buildValidRegion();
    r.currencyCode = 'EUR';
    const result = validateRegionStructuralIntegrity(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CURRENCY_CODE_NOT_SADC_STANDARD')).toBe(true);
  });
});

// ============================================================
// Regulatory Abstraction tests (§4.5 / §6.4)
// ============================================================

describe('validateRegulatoryAbstraction — MOD-009 §4.5/§6.4', () => {
  it('validates a proper compliance profile', () => {
    const result = validateRegulatoryAbstraction(buildValidCountryProfile());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects profile without identifier', () => {
    const p = buildValidCountryProfile();
    p.profileId = '';
    const result = validateRegulatoryAbstraction(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'PROFILE_ID_REQUIRED')).toBe(true);
  });
});
