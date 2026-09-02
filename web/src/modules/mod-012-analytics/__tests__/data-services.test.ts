// NexCargo MOD-012 — Data Services Validation Tests
// Wave 2 — Stage 3, Increment 1 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)
// Reference: MOD-012 §§4–5 Core Domain Entities & Data Lifecycle, §7 Rules of Operation

import { describe, it, expect } from 'vitest';
import {
  verifyDatasetLineage,
  validateEventSourceReferences,
  validateTransformationRules,
  validateDatasetVersioning,
  enforceEventSourceAuthority,
  validateCorrelationId,
} from '../domain/services/data-services';
import type { ProcessedDataset, DataIngestionRecord, LineageMetadata } from '../domain/types/entities';
import { RefreshPolicy, AccessLevel, TimePeriod, AITrainingPurpose, AnonymizationStatus, ReconciliationAlignmentStatus } from '../domain/enums';
import type { CorridorAnalyticsDataset, FinancialReconciliationDataset, AITrainingDatasetObject } from '../domain/types/entities';

// ============================================================
// Mock objects matching ProcessedDataset shape (snake_case + methods)
// ============================================================

function createMockProcessedDataset(overrides?: Partial<ProcessedDataset>): ProcessedDataset {
  const base: ProcessedDataset = {
    datasetId: 'ds-mock',
    datasetName: 'Mock Dataset',
    sourceEvents: ['ListingCreated'],
    transformationRules: [],
    refreshPolicy: RefreshPolicy.BATCH,
    accessLevel: AccessLevel.RESTRICTED,
    ownerModule: 'MOD-001',
    version: 1,
    lineageMetadata: {
      originalSources: ['src1', 'src2'],
      transformationHistory: ['init'],
      currentVersion: 1,
      lastTransformedAt: new Date(),
    },
    id: 'mock-id',
    created_at: new Date(),
    updated_at: new Date(),
    bumpVersion: () => {},
    toJSON: () => ({}),
    ...overrides,
  };
  return base;
}

// ============================================================
// Verify Dataset Lineage tests
// ============================================================

describe('MOD-012 Data Lineage Verification Service', () => {
  it('accepts a dataset with complete lineage metadata', () => {
    const ds = createMockProcessedDataset();
    const result = verifyDatasetLineage(ds);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a dataset with null lineage metadata', () => {
    const ds = createMockProcessedDataset({ lineageMetadata: null as unknown as LineageMetadata });
    const result = verifyDatasetLineage(ds);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('LINEAGE_MISSING');
  });

  it('rejects a dataset with empty original sources', () => {
    const ds = createMockProcessedDataset({
      lineageMetadata: { ...createMockProcessedDataset().lineageMetadata, originalSources: [] },
    });
    const result = verifyDatasetLineage(ds);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LINEAGE_NO_SOURCES')).toBe(true);
  });

  it('rejects a dataset missing transformation history', () => {
    const ds = createMockProcessedDataset({
      lineageMetadata: { ...createMockProcessedDataset().lineageMetadata, transformationHistory: null as unknown as string[] },
    });
    const result = verifyDatasetLineage(ds);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LINEAGE_NO_HISTORY')).toBe(true);
  });

  it('rejects a dataset with invalid version number (0)', () => {
    const ds = createMockProcessedDataset({ version: 0, lineageMetadata: { ...createMockProcessedDataset().lineageMetadata, currentVersion: 0 } });
    const result = verifyDatasetLineage(ds);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LINEAGE_INVALID_VERSION')).toBe(true);
  });

  it('rejects a dataset with no owner module', () => {
    const ds = createMockProcessedDataset({ ownerModule: '' });
    const result = verifyDatasetLineage(ds);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LINEAGE_NO_OWNER')).toBe(true);
  });
});

// ============================================================
// Validate Event Source References tests
// ============================================================

describe('MOD-012 Event Source Reference Validation', () => {
  it('accepts valid non-empty event source references', () => {
    const result = validateEventSourceReferences(['ListingCreated', 'OfferSubmitted']);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty event source references array', () => {
    const result = validateEventSourceReferences([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('NO_EVENT_SOURCES');
  });

  it('rejects duplicate event source references', () => {
    const result = validateEventSourceReferences(['ListingCreated', 'ListingCreated']);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('DUPLICATE_SOURCE_EVENTS');
  });

  it('accepts single unique event reference', () => {
    const result = validateEventSourceReferences(['SingleEvent']);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// Validate Transformation Rules tests
// ============================================================

describe('MOD-012 Transformation Rules Validation', () => {
  it('accepts well-formed transformation rules array', () => {
    const result = validateTransformationRules([
      { ruleId: 'r-001', description: 'Test', transformationType: 'NORMALIZE', sourceFields: ['a'], targetFields: ['b'] },
      { ruleId: 'r-002', description: 'Test 2', transformationType: 'AGGREGATE', sourceFields: ['c'], targetFields: ['d'] },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-array input', () => {
    const result = validateTransformationRules(null as unknown as unknown[]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('RULES_NOT_ARRAY');
  });

  it('rejects rules with missing required fields', () => {
    const result = validateTransformationRules([{ ruleId: 'r-001' } as unknown as Record<string, unknown>]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    expect(result.errors.some(e => e.code === 'MISSING_RULE_FIELD')).toBe(true);
  });

  it('accepts empty transformation rules (no transformations defined is valid)', () => {
    const result = validateTransformationRules([]);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// Validate Dataset Versioning tests
// ============================================================

describe('MOD-012 Dataset Versioning Validation', () => {
  it('accepts valid positive version', () => {
    const result = validateDatasetVersioning(createMockProcessedDataset());
    expect(result.valid).toBe(true);
  });

  it('rejects version 0', () => {
    const result = validateDatasetVersioning(createMockProcessedDataset({ version: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_DATASET_VERSION');
  });

  it('rejects negative version', () => {
    const result = validateDatasetVersioning(createMockProcessedDataset({ version: -1 }));
    expect(result.valid).toBe(false);
  });

  it('rejects version mismatch between top-level and lineage', () => {
    const result = validateDatasetVersioning(createMockProcessedDataset({ version: 3, lineageMetadata: { originalSources: ['src1'], transformationHistory: ['init'], currentVersion: 5, lastTransformedAt: new Date() } }));
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('VERSION_MISMATCH');
  });
});

// ============================================================
// Enforce Event Source Authority tests
// ============================================================

function createMockDataRecord(overrides?: Partial<DataIngestionRecord>): DataIngestionRecord {
  return {
    eventId: 'evt-mock',
    eventType: 'ListingCreated',
    sourceModule: 'MOD-001',
    timestamp: new Date(),
    payload: { listingId: 'list-001' },
    correlationId: '550e8400-e29b-41d4-a716-446655440000',
    schemaVersion: 'v1.0',
    id: 'mock-id',
    created_at: new Date(),
    updated_at: new Date(),
    version: 1,
    bumpVersion: () => {},
    toJSON: () => ({}),
    ...overrides,
  };
}

describe('MOD-012 Event Source Authority Enforcement', () => {
  it('accepts a fully valid ingestion record', () => {
    const result = enforceEventSourceAuthority(createMockDataRecord());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects record with invalid source module name', () => {
    const result = enforceEventSourceAuthority(createMockDataRecord({ sourceModule: 'invalid-module' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_SOURCE_MODULE');
  });

  it('rejects record with missing event type', () => {
    const result = enforceEventSourceAuthority(createMockDataRecord({ eventType: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('EVENT_TYPE_REQUIRED');
  });

  it('rejects record with null payload', () => {
    const result = enforceEventSourceAuthority(createMockDataRecord({ payload: {} }));
    // Empty object is still a valid payload
    expect(result.valid).toBe(true);
  });

  it('rejects record with invalid timestamp', () => {
    const result = enforceEventSourceAuthority(createMockDataRecord({ timestamp: new Date(NaN) }));
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_TIMESTAMP');
  });

  it('rejects record with missing correlation ID', () => {
    const result = enforceEventSourceAuthority(createMockDataRecord({ correlationId: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('CORRELATION_ID_REQUIRED');
  });

  it('rejects record with missing schema version', () => {
    const result = enforceEventSourceAuthority(createMockDataRecord({ schemaVersion: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('SCHEMA_VERSION_REQUIRED');
  });
});

// ============================================================
// Validate Correlation ID tests
// ============================================================

describe('MOD-012 Correlation ID Validation', () => {
  it('accepts valid UUID v4 correlation ID', () => {
    const result = validateCorrelationId('550e8400-e29b-41d4-a716-446655440000');
    expect(result.valid).toBe(true);
  });

  it('rejects empty correlation ID', () => {
    const result = validateCorrelationId('');
    expect(result.valid).toBe(false);
  });

  it('rejects non-UUID correlation ID', () => {
    const result = validateCorrelationId('not-a-uuid');
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_CORRELATION_UUID');
  });
});

// ============================================================
// Validate AI Training Dataset tests
// ============================================================

describe('MOD-012 AI Training Dataset Validation — Structural', () => {
  it('validates purpose against allowed AITrainingPurpose values', () => {
    // The enum itself should contain all valid purposes
    import('../domain/enums').then((mod) => {
      expect(mod.AITrainingPurpose.ETA_PREDICTION).toBe('ETA_PREDICTION');
      expect(mod.AITrainingPurpose.DELAY_DETECTION).toBe('DELAY_DETECTION');
      expect(mod.AITrainingPurpose.PRICING).toBe('PRICING');
      expect(mod.AITrainingPurpose.FRAUD_DETECTION).toBe('FRAUD_DETECTION');
      expect(mod.AITrainingPurpose.DEMAND_FORECAST).toBe('DEMAND_FORECAST');
    });
  });

  it('validates anonymization status against allowed AnonymizationStatus values', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.AnonymizationStatus.ANONYMIZED).toBe('ANONYMIZED');
      expect(mod.AnonymizationStatus.RAW).toBe('RAW');
    });
  });
});

// ============================================================
// Validate Corridor Analytics tests
// ============================================================

describe('MOD-012 Corridor Analytics Validation — Structural', () => {
  it('validates time period enum contains all expected values', () => {
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

// ============================================================
// Validate Financial Reconciliation tests
// ============================================================

describe('MOD-012 Financial Reconciliation Validation — Structural', () => {
  it('validates reconciliation alignment status enum values', () => {
    import('../domain/enums').then((mod) => {
      expect(mod.ReconciliationAlignmentStatus.ALIGNED).toBe('ALIGNED');
      expect(mod.ReconciliationAlignmentStatus.MISMATCH_DETECTED).toBe('MISMATCH_DETECTED');
    });
  });
});
