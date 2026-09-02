// NexCargo MOD-012 — Data Platform Analytics & BI Layer Validation Services
// Wave 2 — Stage 3, Increment 1 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)
// Reference: MOD-012 §§4–5 Core Domain Entities & Data Lifecycle, §7 Rules of Operation
//
// NO COMPUTATION PRINCIPLE: These services validate structural integrity ONLY.
// They do NOT perform actual analytics computation, KPI calculation, or BI processing.
// Per MOD-012 §7.1 (No Computation Rule) and ESS-009 §2.4 (No Computation Principle).

import type { ProcessedDataset, DataIngestionRecord, AITrainingDatasetObject, CorridorAnalyticsDataset, FinancialReconciliationDataset } from '../types/entities';
import { AccessLevel, AITrainingPurpose, AnonymizationStatus, ReconciliationAlignmentStatus, TimePeriod } from '../enums';
import type { LineageMetadata } from '../types/entities';

// ============================================================
// Validation result types
// ============================================================

/** Result of a validation service operation */
export interface ValidationResult {
  /** Whether all checks passed */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
}

/** Single validation error */
export interface ValidationError {
  /** Error code identifier */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Field that triggered the error (if applicable) */
  field?: string;
}

// ============================================================
// Service function constants
// ============================================================

/** Valid refresh policy values */
export const VALID_REFRESH_POLICIES = ['REAL_TIME', 'BATCH', 'MANUAL'] as const;

/** Minimum required fields in lineage metadata */
export const REQUIRED_LINEAGE_FIELDS = ['originalSources', 'transformationHistory', 'currentVersion', 'lastTransformedAt'] as const;

/** Required fields for AI training dataset */
export const REQUIRED_AI_TRAINING_FIELDS = ['datasetName', 'purpose', 'sourceDataReferences', 'anonymizationStatus', 'version', 'trainingStartDate', 'trainingEndDate'] as const;

/** Source module prefix convention */
export const SOURCE_MODULE_PREFIX_REGEX = /^MOD-\d{3}$/;

// ============================================================
// Data Lineage Verification Service
// ============================================================

/**
 * Verifies that a processed dataset has complete lineage metadata per MOD-012 §5.4.
 * Every dataset MUST trace back to a source event, include module origin,
 * include transformation history, and maintain immutability of raw source.
 *
 * @param dataset The processed dataset to validate lineage for
 * @returns ValidationResult indicating completeness of lineage metadata
 */
export function verifyDatasetLineage(dataset: ProcessedDataset): ValidationResult {
  const errors: ValidationError[] = [];

  // Check lineage metadata exists and is not null/undefined
  if (!dataset.lineageMetadata || typeof dataset.lineageMetadata !== 'object') {
    return {
      valid: false,
      errors: [{ code: 'LINEAGE_MISSING', message: 'ProcessedDataset requires non-null lineageMetadata object' }],
    };
  }

  const meta = dataset.lineageMetadata;

  // Verify original sources array is present and non-empty
  if (!Array.isArray(meta.originalSources) || meta.originalSources.length === 0) {
    errors.push({
      code: 'LINEAGE_NO_SOURCES',
      field: 'lineageMetadata.originalSources',
      message: 'Every dataset MUST trace back to at least one source event (MOD-012 §5.4)',
    });
  }

  // Verify transformation history is documented
  if (!Array.isArray(meta.transformationHistory)) {
    errors.push({
      code: 'LINEAGE_NO_HISTORY',
      field: 'lineageMetadata.transformationHistory',
      message: 'Transformation history must be documented, not assumed (MOD-012 §5.4)',
    });
  }

  // Verify version tracking
  if (typeof meta.currentVersion !== 'number' || meta.currentVersion < 1) {
    errors.push({
      code: 'LINEAGE_INVALID_VERSION',
      field: 'lineageMetadata.currentVersion',
      message: 'Dataset must have a valid positive version number (MOD-012 §4.2)',
    });
  }

  // Verify timestamp exists
  if (!(meta.lastTransformedAt instanceof Date) || isNaN(meta.lastTransformedAt.getTime())) {
    errors.push({
      code: 'LINEAGE_NO_TIMESTAMP',
      field: 'lineageMetadata.lastTransformedAt',
      message: 'Last transformed timestamp is required for lineage tracking',
    });
  }

  // Verify ownerModule is defined
  if (!dataset.ownerModule) {
    errors.push({
      code: 'LINEAGE_NO_OWNER',
      field: 'ownerModule',
      message: 'Every dataset must have an owning module per ESS-009 §3.1 (Single Source of Truth)',
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates that all source events referenced by a dataset use valid event types.
 * This is a structural validation — no runtime event lookup is performed.
 *
 * @param sourceEvents Array of event type references
 * @returns ValidationResult
 */
export function validateEventSourceReferences(sourceEvents: string[]): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(sourceEvents) || sourceEvents.length === 0) {
    errors.push({
      code: 'NO_EVENT_SOURCES',
      field: 'sourceEvents',
      message: 'Dataset must reference at least one source event type (MOD-012 §4.2)',
    });
    return { valid: false, errors };
  }

  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const eventRef of sourceEvents) {
    if (seen.has(eventRef)) {
      duplicates.add(eventRef);
    }
    seen.add(eventRef);
  }

  if (duplicates.size > 0) {
    errors.push({
      code: 'DUPLICATE_SOURCE_EVENTS',
      field: 'sourceEvents',
      message: `Duplicate event references found: ${[...duplicates].join(', ')}`,
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Dataset Versioning Validation Service
// ============================================================

/**
 * Validates transformation rules definition structure per MOD-012 §4.2.
 * Checks that transformation rules are properly structured with required fields.
 *
 * @param rules Array of transformation rule definitions
 * @returns ValidationResult
 */
export function validateTransformationRules(rules: unknown[]): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(rules)) {
    return {
      valid: false,
      errors: [{ code: 'RULES_NOT_ARRAY', field: 'transformationRules', message: 'Transformation rules must be an array' }],
    };
  }

  const requiredRuleFields = ['ruleId', 'description', 'transformationType', 'sourceFields', 'targetFields'];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i] as Record<string, unknown>;
    if (typeof rule !== 'object' || rule === null) {
      errors.push({
        code: 'INVALID_RULE_OBJECT',
        field: `transformationRules[${i}]`,
        message: `Transformation rule at index ${i} must be an object`,
      });
      continue;
    }

    for (const field of requiredRuleFields) {
      if (!(field in rule)) {
        errors.push({
          code: 'MISSING_RULE_FIELD',
          field: `transformationRules[${i}].${field}`,
          message: `Required field '${field}' missing from transformation rule at index ${i}`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Verifies that a dataset's version number is consistent and positive.
 * Per MOD-012 §4.2: Data transformations must be versioned.
 *
 * @param dataset The processed dataset to validate versioning for
 * @returns ValidationResult
 */
export function validateDatasetVersioning(dataset: ProcessedDataset): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof dataset.version !== 'number' || dataset.version < 1) {
    errors.push({
      code: 'INVALID_DATASET_VERSION',
      field: 'version',
      message: 'Dataset version must be a positive integer (MOD-012 §4.2)',
    });
  }

  // Version consistency: version in metadata should match top-level version
  if (dataset.lineageMetadata && dataset.lineageMetadata.currentVersion !== dataset.version) {
    errors.push({
      code: 'VERSION_MISMATCH',
      field: 'version',
      message: `Dataset version (${dataset.version}) does not match lineage version (${dataset.lineageMetadata.currentVersion})`,
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Event Source Authority Enforcement Service
// ============================================================

/**
 * Enforces that data ingestion records originate from valid source modules.
 * Per MOD-012 §7.2 (Event Source Authority Rule): ALL data MUST originate from events.
 * No manual or ad-hoc data injection is allowed.
 * Event integrity overrides all derived datasets.
 *
 * @param record The data ingestion record to validate
 * @returns ValidationResult
 */
export function enforceEventSourceAuthority(record: DataIngestionRecord): ValidationResult {
  const errors: ValidationError[] = [];

  // Verify source module follows naming convention
  if (!SOURCE_MODULE_PREFIX_REGEX.test(record.sourceModule)) {
    errors.push({
      code: 'INVALID_SOURCE_MODULE',
      field: 'sourceModule',
      message: `Source module '${record.sourceModule}' does not follow MOD-XXX naming convention`,
    });
  }

  // Verify event type is present
  if (!record.eventType || typeof record.eventType !== 'string') {
    errors.push({
      code: 'EVENT_TYPE_REQUIRED',
      field: 'eventType',
      message: 'Every ingestion record must have a non-empty eventType string (MOD-012 §4.1)',
    });
  }

  // Verify payload is present (structured JSON)
  if (record.payload === null || record.payload === undefined) {
    errors.push({
      code: 'PAYLOAD_REQUIRED',
      field: 'payload',
      message: 'All system data MUST originate from immutable event streams — payload cannot be null (MOD-012 §4.1)',
    });
  }

  // Verify timestamp is valid
  if (!(record.timestamp instanceof Date) || isNaN(record.timestamp.getTime())) {
    errors.push({
      code: 'INVALID_TIMESTAMP',
      field: 'timestamp',
      message: 'Event timestamp must be a valid Date object',
    });
  }

  // Verify correlation ID is present for cross-module tracking
  if (!record.correlationId || typeof record.correlationId !== 'string') {
    errors.push({
      code: 'CORRELATION_ID_REQUIRED',
      field: 'correlationId',
      message: 'Correlation ID is required for cross-module event tracing (ESS-009 §5)',
    });
  }

  // Verify schema version is present
  if (!record.schemaVersion || typeof record.schemaVersion !== 'string') {
    errors.push({
      code: 'SCHEMA_VERSION_REQUIRED',
      field: 'schemaVersion',
      message: 'Schema version is required for event format tracking',
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates that a record's correlation ID matches the expected format.
 * Used to ensure cross-module event continuity.
 *
 * @param correlationId The correlation ID to validate
 * @returns ValidationResult
 */
export function validateCorrelationId(correlationId: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!correlationId || typeof correlationId !== 'string') {
    return {
      valid: false,
      errors: [{ code: 'EMPTY_CORRELATION_ID', field: 'correlationId', message: 'Correlation ID must be a non-empty string' }],
    };
  }

  // Basic UUID v4 pattern check (8-4-4-4-12 hex digits)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(correlationId)) {
    errors.push({
      code: 'INVALID_CORRELATION_UUID',
      field: 'correlationId',
      message: 'Correlation ID must be a valid UUID v4 format',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Entity-Specific Validation Services
// ============================================================

/**
 * Validates AI training dataset requirements per MOD-012 §4.7.
 * Only validated data is used for training. Data must be anonymised where required.
 */
export function validateAITrainingDataset(dataset: AITrainingDatasetObject): ValidationResult {
  const errors: ValidationError[] = [];

  if (!dataset.datasetName || typeof dataset.datasetName !== 'string') {
    errors.push({ code: 'NAME_REQUIRED', field: 'datasetName', message: 'AI training dataset must have a name' });
  }

  if (!Object.values(AITrainingPurpose).includes(dataset.purpose)) {
    errors.push({ code: 'INVALID_PURPOSE', field: 'purpose', message: 'Purpose must be one of: ETA_PREDICTION, DELAY_DETECTION, PRICING, FRAUD_DETECTION, DEMAND_FORECAST' });
  }

  if (!Array.isArray(dataset.sourceDataReferences) || dataset.sourceDataReferences.length === 0) {
    errors.push({ code: 'SOURCES_REQUIRED', field: 'sourceDataReferences', message: 'Training dataset must reference at least one source dataset' });
  }

  if (!Object.values(AnonymizationStatus).includes(dataset.anonymizationStatus)) {
    errors.push({ code: 'INVALID_ANONYMIZATION', field: 'anonymizationStatus', message: 'Anonymization status must be ANONYMIZED or RAW' });
  }

  if (typeof dataset.version !== 'number' || dataset.version < 1) {
    errors.push({ code: 'INVALID_VERSION', field: 'version', message: 'Training dataset version must be a positive integer' });
  }

  if (!(dataset.trainingStartDate instanceof Date) || !(dataset.trainingEndDate instanceof Date)) {
    errors.push({ code: 'DATE_RANGE_REQUIRED', field: 'trainingStartDate/trainingEndDate', message: 'Training date range is required' });
  } else if (dataset.trainingStartDate >= dataset.trainingEndDate) {
    errors.push({ code: 'INVALID_DATE_RANGE', field: 'trainingStartDate/trainingEndDate', message: 'Start date must be before end date' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates corridor analytics dataset structure per MOD-012 §4.5.
 */
export function validateCorridorAnalytics(dataset: CorridorAnalyticsDataset): ValidationResult {
  const errors: ValidationError[] = [];

  if (!dataset.corridorId || typeof dataset.corridorId !== 'string') {
    errors.push({ code: 'CORRIDOR_ID_REQUIRED', field: 'corridorId', message: 'Corridor ID is required (references MOD-009 corridor definition)' });
  }

  if (!Object.values(TimePeriod).includes(dataset.timePeriod)) {
    errors.push({ code: 'INVALID_TIME_PERIOD', field: 'timePeriod', message: 'Time period must be one of: HOURLY, DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY' });
  }

  if (typeof dataset.averageTransitTime !== 'number' || dataset.averageTransitTime < 0) {
    errors.push({ code: 'INVALID_TRANSIT_TIME', field: 'averageTransitTime', message: 'Average transit time must be a non-negative number' });
  }

  if (typeof dataset.averageCost !== 'number' || dataset.averageCost < 0) {
    errors.push({ code: 'INVALID_COST', field: 'averageCost', message: 'Average cost must be a non-negative number' });
  }

  if (!(dataset.generatedAt instanceof Date) || isNaN(dataset.generatedAt.getTime())) {
    errors.push({ code: 'GENERATED_AT_REQUIRED', field: 'generatedAt', message: 'Generated timestamp is required' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates financial reconciliation dataset structure per MOD-012 §4.6.
 * Must reconcile escrow transactions with shipment completion.
 * Multi-currency normalisation is required.
 */
export function validateFinancialReconciliation(dataset: FinancialReconciliationDataset): ValidationResult {
  const errors: ValidationError[] = [];

  if (!dataset.escrowId || typeof dataset.escrowId !== 'string') {
    errors.push({ code: 'ESCROW_ID_REQUIRED', field: 'escrowId', message: 'Escrow ID reference (MOD-005) is required' });
  }

  if (!dataset.shipmentId || typeof dataset.shipmentId !== 'string') {
    errors.push({ code: 'SHIPMENT_ID_REQUIRED', field: 'shipmentId', message: 'Shipment ID reference (MOD-003) is required' });
  }

  if (typeof dataset.transactionAmount !== 'number') {
    errors.push({ code: 'AMOUNT_REQUIRED', field: 'transactionAmount', message: 'Transaction amount is required' });
  }

  if (!dataset.settlementCurrency || typeof dataset.settlementCurrency !== 'string') {
    errors.push({ code: 'CURRENCY_REQUIRED', field: 'settlementCurrency', message: 'Settlement currency code is required' });
  }

  if (!Object.values(ReconciliationAlignmentStatus).includes(dataset.reconciliationAlignmentStatus)) {
    errors.push({ code: 'INVALID_RECONCILIATION_STATUS', field: 'reconciliationAlignmentStatus', message: 'Alignment status must be ALIGNED or MISMATCH_DETECTED' });
  }

  if (!(dataset.generatedAt instanceof Date) || isNaN(dataset.generatedAt.getTime())) {
    errors.push({ code: 'GENERATED_AT_REQUIRED', field: 'generatedAt', message: 'Generated timestamp is required' });
  }

  return { valid: errors.length === 0, errors };
}
