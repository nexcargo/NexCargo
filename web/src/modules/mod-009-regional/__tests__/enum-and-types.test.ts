// NexCargo MOD-009 — Enum & Type Definition Tests
// Wave 4 — Increment 1 — Authorized per HAO-WAVE3-AUTH-001 execution order D-SEQ-W3-001

import { describe, it, expect } from 'vitest';
import type {
  RegionObject,
  CrossBorderShipmentSegmentObject,
  LogisticsCorridorObject,
  BorderTransitionEventObject,
  CountryComplianceProfileObject,
  MultiCurrencyTransactionContextObject,
  BorderCongestionReportObject,
  TempPermitAuthorizationObject,
} from '../domain/types/entities';
import {
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
} from '../domain/enums';

const now = new Date('2026-08-31T10:00:00Z');

// ============================================================
// Enum value tests
// ============================================================

describe('MOD-009 BorderStatus enum', () => {
  it('contains all border statuses', () => {
    expect(BorderStatus.PENDING).toBe('PENDING');
    expect(BorderStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(BorderStatus.COMPLETED).toBe('COMPLETED');
    expect(BorderStatus.DELAYED).toBe('DELAYED');
  });
});

describe('MOD-009 SegmentStatus enum', () => {
  it('contains all segment statuses', () => {
    expect(SegmentStatus.PLANNED).toBe('PLANNED');
    expect(SegmentStatus.ACTIVE).toBe('ACTIVE');
    expect(SegmentStatus.COMPLETED).toBe('COMPLETED');
  });
});

describe('MOD-009 ValidationStatus enum', () => {
  it('contains all validation statuses', () => {
    expect(ValidationStatus.PENDING).toBe('PENDING');
    expect(ValidationStatus.VALIDATED).toBe('VALIDATED');
    expect(ValidationStatus.COMPLETED).toBe('COMPLETED');
    expect(ValidationStatus.DELAYED).toBe('DELAYED');
  });
});

describe('MOD-009 ClearanceStatus enum', () => {
  it('contains all clearance statuses', () => {
    expect(ClearanceStatus.PENDING).toBe('PENDING');
    expect(ClearanceStatus.PRE_CLEARED).toBe('PRE_CLEARED');
    expect(ClearanceStatus.CLEARED).toBe('CLEARED');
    expect(ClearanceStatus.HELD).toBe('HELD');
  });
});

describe('MOD-009 CongestionLevel enum', () => {
  it('contains all congestion levels', () => {
    expect(CongestionLevel.LOW).toBe('LOW');
    expect(CongestionLevel.MEDIUM).toBe('MEDIUM');
    expect(CongestionLevel.HIGH).toBe('HIGH');
    expect(CongestionLevel.SEVERE).toBe('SEVERE');
  });
});

describe('MOD-009 RiskLevel enum', () => {
  it('contains all risk levels', () => {
    expect(RiskLevel.LOW).toBe('LOW');
    expect(RiskLevel.MEDIUM).toBe('MEDIUM');
    expect(RiskLevel.HIGH).toBe('HIGH');
  });
});

describe('MOD-009 PermitAvailabilityState enum', () => {
  it('contains all permit states', () => {
    expect(PermitAvailabilityState.AVAILABLE).toBe('AVAILABLE');
    expect(PermitAvailabilityState.UNAVAILABLE).toBe('UNAVAILABLE');
    expect(PermitAvailabilityState.PENDING_ISSUANCE).toBe('PENDING_ISSUANCE');
    expect(PermitAvailabilityState.AT_BORDER_AVAILABLE).toBe('AT_BORDER_AVAILABLE');
  });
});

describe('MOD-009 ComplianceCheckpointType enum', () => {
  it('contains all checkpoint types', () => {
    expect(ComplianceCheckpointType.CUSTOMS_DOCUMENTATION).toBe('CUSTOMS_DOCUMENTATION');
    expect(ComplianceCheckpointType.VEHICLE_LICENSING).toBe('VEHICLE_LICENSING');
    expect(ComplianceCheckpointType.DRIVER_AUTHORIZATION).toBe('DRIVER_AUTHORIZATION');
    expect(ComplianceCheckpointType.CARGO_RESTRICTION).toBe('CARGO_RESTRICTION');
    expect(ComplianceCheckpointType.INSURANCE_VERIFICATION).toBe('INSURANCE_VERIFICATION');
  });
});

describe('MOD-009 CurrencyConversionAction enum', () => {
  it('contains all conversion actions', () => {
    expect(CurrencyConversionAction.APPLY_RATE).toBe('APPLY_RATE');
    expect(CurrencyConversionAction.STORE_RATE).toBe('STORE_RATE');
    expect(CurrencyConversionAction.CONVERT_SETTLEMENT).toBe('CONVERT_SETTLEMENT');
  });
});

describe('MOD-009 SegmentationMethod enum', () => {
  it('contains all segmentation methods', () => {
    expect(SegmentationMethod.REGION_TRANSITION).toBe('REGION_TRANSITION');
    expect(SegmentationMethod.BORDER_CROSSING).toBe('BORDER_CROSSING');
    expect(SegmentationMethod.JURISDICTION_CHANGE).toBe('JURISDICTION_CHANGE');
  });
});

describe('MOD-009 CorridorAssignmentMethod enum', () => {
  it('contains all assignment methods', () => {
    expect(CorridorAssignmentMethod.ORIGIN_DESTINATION_MATCH).toBe('ORIGIN_DESTINATION_MATCH');
    expect(CorridorAssignmentMethod.HISTORICAL_CORRIDOR).toBe('HISTORICAL_CORRIDOR');
    expect(CorridorAssignmentMethod.USER_CONFIRMED).toBe('USER_CONFIRMED');
  });
});

describe('MOD-009 EnforcementLevel enum', () => {
  it('contains all enforcement levels', () => {
    expect(EnforcementLevel.ADVISORY_ONLY).toBe('ADVISORY_ONLY');
    expect(EnforcementLevel.FLAG_FOR_REVIEW).toBe('FLAG_FOR_REVIEW');
    expect(EnforcementLevel.BLOCK_PLANNING).toBe('BLOCK_PLANNING');
    expect(EnforcementLevel.MOD_010_ENFORCED).toBe('MOD_010_ENFORCED');
  });
});

describe('MOD-009 BorderEventSource enum', () => {
  it('contains all event sources', () => {
    expect(BorderEventSource.GPS_GEOFENCE).toBe('GPS');
    expect(BorderEventSource.MANUAL_ENTRY).toBe('MANUAL');
    expect(BorderEventSource.OSBP_INTEGRATION).toBe('OSBP_INTEGRATION');
  });
});

// ============================================================
// BC Contract Interface Tests
// ============================================================

describe('MOD-009 BC Contract Interface Integrity', () => {
  it('can import bc-contract module without circular dependency errors', async () => {
    const mod = await import('../domain/types/bc-contract');
    expect(mod).toBeDefined();
  });
});
