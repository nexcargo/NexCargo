// NexCargo MOD-012 — Enum & Type Definition Tests
// Wave 2 — Stage 3, Increment 1 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import { validateEventSourceReferences, enforceEventSourceAuthority } from '../domain/services/data-services';

// ============================================================
// Enum value tests
// ============================================================

describe('MOD-012 RefreshPolicy enum', () => {
  it('contains all expected refresh policies', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.RefreshPolicy.REAL_TIME).toBe('REAL_TIME');
      expect(mod.RefreshPolicy.BATCH).toBe('BATCH');
      expect(mod.RefreshPolicy.MANUAL).toBe('MANUAL');
    });
  });
});

describe('MOD-012 AccessLevel enum', () => {
  it('contains all access levels', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.AccessLevel.PUBLIC).toBe('PUBLIC');
      expect(mod.AccessLevel.RESTRICTED).toBe('RESTRICTED');
      expect(mod.AccessLevel.CONFIDENTIAL).toBe('CONFIDENTIAL');
    });
  });
});

describe('MOD-012 AggregationLevel enum', () => {
  it('contains all aggregation levels', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.AggregationLevel.GLOBAL).toBe('GLOBAL');
      expect(mod.AggregationLevel.REGIONAL).toBe('REGIONAL');
      expect(mod.AggregationLevel.USER).toBe('USER');
      expect(mod.AggregationLevel.SHIPMENT).toBe('SHIPMENT');
      expect(mod.AggregationLevel.CORRIDOR).toBe('CORRIDOR');
    });
  });
});

describe('MOD-012 InsightType enum', () => {
  it('contains all insight types', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.InsightType.TREND).toBe('TREND');
      expect(mod.InsightType.ANOMALY).toBe('ANOMALY');
      expect(mod.InsightType.PREDICTION).toBe('PREDICTION');
      expect(mod.InsightType.OPTIMIZATION).toBe('OPTIMIZATION');
    });
  });
});

describe('MOD-012 TimePeriod enum', () => {
  it('contains all time periods', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.TimePeriod.HOURLY).toBe('HOURLY');
      expect(mod.TimePeriod.DAILY).toBe('DAILY');
      expect(mod.TimePeriod.WEEKLY).toBe('WEEKLY');
      expect(mod.TimePeriod.MONTHLY).toBe('MONTHLY');
      expect(mod.TimePeriod.QUARTERLY).toBe('QUARTERLY');
      expect(mod.TimePeriod.YEARLY).toBe('YEARLY');
    });
  });
});

describe('MOD-012 AITrainingPurpose enum', () => {
  it('contains all AI training purposes', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.AITrainingPurpose.ETA_PREDICTION).toBe('ETA_PREDICTION');
      expect(mod.AITrainingPurpose.DELAY_DETECTION).toBe('DELAY_DETECTION');
      expect(mod.AITrainingPurpose.PRICING).toBe('PRICING');
      expect(mod.AITrainingPurpose.FRAUD_DETECTION).toBe('FRAUD_DETECTION');
      expect(mod.AITrainingPurpose.DEMAND_FORECAST).toBe('DEMAND_FORECAST');
    });
  });
});

describe('MOD-012 AnonymizationStatus enum', () => {
  it('contains both statuses', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.AnonymizationStatus.ANONYMIZED).toBe('ANONYMIZED');
      expect(mod.AnonymizationStatus.RAW).toBe('RAW');
    });
  });
});

describe('MOD-012 ReconciliationAlignmentStatus enum', () => {
  it('contains both alignment statuses', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.ReconciliationAlignmentStatus.ALIGNED).toBe('ALIGNED');
      expect(mod.ReconciliationAlignmentStatus.MISMATCH_DETECTED).toBe('MISMATCH_DETECTED');
    });
  });
});

// ============================================================
// BC Contract Alignment tests
// ============================================================

describe('MOD-012 BC Contract Interface Integrity', () => {
  it('dataset lineage requires module origin per ESS-009 §3.1', () => {
    const result = validateEventSourceReferences(['ListingCreated']);
    expect(result.valid).toBe(true);
  });

  it('event ingestion record validates source module convention', () => {
    // Module prefix regex in service enforces MOD-XXX pattern
    const mockRecord = {
      eventId: 'e1', eventType: 'E', sourceModule: 'MOD-001', timestamp: new Date(),
      payload: {}, correlationId: '550e8400-e29b-41d4-a716-446655440000', schemaVersion: 'v1',
      id: 'i1', created_at: new Date(), updated_at: new Date(), version: 1,
      bumpVersion: () => {}, toJSON: () => ({}),
    };
    const result = enforceEventSourceAuthority(mockRecord as never);
    expect(result.valid).toBe(true);
  });

  it('event ingestion rejects non-conforming source module', () => {
    const mockRecord = {
      eventId: 'e1', eventType: 'E', sourceModule: 'BAD_FORMAT', timestamp: new Date(),
      payload: {}, correlationId: '550e8400-e29b-41d4-a716-446655440000', schemaVersion: 'v1',
      id: 'i1', created_at: new Date(), updated_at: new Date(), version: 1,
      bumpVersion: () => {}, toJSON: () => ({}),
    };
    const result = enforceEventSourceAuthority(mockRecord as never);
    expect(result.valid).toBe(false);
  });
});
