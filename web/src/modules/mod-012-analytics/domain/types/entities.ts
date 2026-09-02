// NexCargo MOD-012 — Data Platform Analytics & BI Layer Domain Types
// Wave 2 — Stage 3, Increment 1 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)
// Reference: MOD-012 §4 Core Domain Entities (4.1–4.7), §5 Data Lifecycle, §7 Rules of Operation
//
// D-S3-001 condition applied: corridorId is string type (provisional design-time assumption)
// for the MOD-012 ↔ MOD-009 bidirectional BC coupling, following D-S2B-002 pattern from Stage 2B.
// No actual analytics computation; all structures are design-time definitions only.

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type { SourceModule, AccessLevel, AggregationLevel, InsightType, TimePeriod, AITrainingPurpose, AnonymizationStatus, ReconciliationAlignmentStatus, RefreshPolicy } from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Structured JSON payload envelope for raw event ingestion per MOD-012 §4.1 */
export interface EventPayloadEnvelope {
  /** Arbitrary structured JSON payload */
  [key: string]: unknown;
}

/** Transformation rules definition (logical only, not executable) per MOD-012 §4.2 */
export interface TransformationRulesDefinition {
  /** Rule identifier */
  ruleId: string;
  /** Human-readable description */
  description: string;
  /** Transformation type: NORMALIZE / AGGREGATE / FILTER / ENRICH / DERIVE */
  transformationType: string;
  /** Source fields */
  sourceFields: string[];
  /** Target fields */
  targetFields: string[];
}

/** Traceability metadata for dataset lineage per MOD-012 §4.2, §5.4 */
export interface LineageMetadata {
  /** Original event sources */
  originalSources: string[];
  /** Transformation history log */
  transformationHistory: string[];
  /** Current version number */
  currentVersion: number;
  /** Last transformed at timestamp */
  lastTransformedAt: Date;
}

/** KPI calculation definition (logical only, NOT executable per MOD-012 §7.1) per MOD-012 §4.3 */
export interface KPICalculationDefinition {
  /** Description of the calculation logic (non-executable) */
  formulaDescription: string;
  /** Required input datasets */
  requiredInputs: string[];
  /** Output field specification */
  outputField: string;
}

/** Seasonal pattern structure for corridor analytics per MOD-012 §4.5 */
export interface SeasonalPatternData {
  /** Month or period identifier */
  period: number;
  /** Observed value trend */
  trendValue: number;
  /** Deviation from mean */
  deviation: number;
}

/** Carrier performance metric structure per MOD-012 §4.5 */
export interface CarrierPerformanceMetric {
  /** Carrier identifier reference */
  carrierId: string;
  /** On-time delivery rate percentage */
  onTimeRate: number;
  /** Average transit time deviation */
  avgTransitDeviation: number;
  /** Customer satisfaction score */
  satisfactionScore: number;
}

/** Congestion metrics structure per MOD-012 §4.5 */
export interface CongestionMetrics {
  /** Average delay in minutes */
  averageDelayMinutes: number;
  /** Peak congestion hours */
  peakHours: number[];
  /** Historical congestion frequency */
  congestionFrequency: number;
}

/** Currency conversion metadata per MOD-012 §4.6 */
export interface ExchangeRateMetadata {
  /** Source currency code */
  fromCurrency: string;
  /** Target currency code */
  toCurrency: string;
  /** Applied exchange rate */
  appliedRate: number;
  /** Rate source reference */
  rateSource: string;
  /** Applied timestamp */
  appliedAt: Date;
}

/** Validation metrics structure for AI training datasets per MOD-012 §4.7 */
export interface TrainingValidationMetrics {
  /** Accuracy score */
  accuracy: number;
  /** Precision score */
  precision: number;
  /** Recall score */
  recall: number;
  /** F1 score */
  f1Score: number;
}

/** Report data structure for BI output per MOD-012 §4.3, §5.3 */
export interface ReportDataStructure {
  /** Report title */
  title: string;
  /** Report type: OPERATIONAL / FINANCIAL / COMPLIANCE / EXECUTIVE / CORRIDOR / RISK */
  reportType: string;
  /** Target audience role */
  targetRole: string;
  /** Data fields included */
  fields: string[];
  /** Sort order specification */
  sortOrder?: string;
  /** Filter criteria */
  filters?: Record<string, unknown>;
}

// ============================================================
// Entity types (extend BaseEntity with snake_case fields)
// Per BaseEntity: id, created_at, updated_at, version, bumpVersion(), toJSON()
// ============================================================

/**
 * Data Ingestion Record — raw system event ingestion unit.
 * Per MOD-012 §4.1
 * All system data MUST originate from immutable event streams.
 * Raw event data MUST never be modified.
 */
export interface DataIngestionRecord extends BaseEntity {
  /** Unique identifier for this ingestion record */
  eventId: string;
  /** Type/category of the ingested event */
  eventType: string;
  /** Source module identifier that generated this event */
  sourceModule: SourceModule;
  /** Timestamp of event occurrence */
  timestamp: Date;
  /** Structured JSON payload containing event data */
  payload: EventPayloadEnvelope;
  /** Correlation ID linking related events across modules */
  correlationId: string;
  /** Schema version used for this event */
  schemaVersion: string;
}

/**
 * Processed Dataset Object — structured analytical grouping.
 * Per MOD-012 §4.2
 * Every dataset MUST preserve origin traceability.
 * Transformations MUST be documented, not assumed.
 * Data transformations must be versioned.
 */
export interface ProcessedDataset extends BaseEntity {
  /** Unique identifier for this dataset */
  datasetId: string;
  /** Human-readable dataset name */
  datasetName: string;
  /** Array of event type references that feed into this dataset */
  sourceEvents: string[];
  /** Transformation rules defining how raw data becomes this dataset */
  transformationRules: TransformationRulesDefinition[];
  /** How often the dataset is refreshed: REAL_TIME | BATCH | MANUAL */
  refreshPolicy: RefreshPolicy;
  /** Access control level for consumers */
  accessLevel: AccessLevel;
  /** Owning module identifier */
  ownerModule: SourceModule;
  /** Version number (incremented on each transformation change) */
  version: number;
  /** Origin traceability information */
  lineageMetadata: LineageMetadata;
}

/**
 * KPI Definition Object — structured business metric definition (structural only).
 * Per MOD-012 §4.3
 * KPIs are defined structurally, NOT computed at runtime (violates No Computation Rule §7.1).
 * KPI definitions must reference source datasets.
 * KPI definitions must specify aggregation level.
 */
export interface KPIDefinition extends BaseEntity {
  /** Unique identifier for this KPI definition */
  kpiId: string;
  /** Display name of the KPI */
  kpiName: string;
  /** Human-readable description of what this KPI measures */
  description: string;
  /** Array of dataset references that serve as KPI inputs */
  sourceDatasets: string[];
  /** Logical calculation definition (NOT executable; descriptive only) */
  calculationDefinition: KPICalculationDefinition;
  /** Scope level for aggregation: GLOBAL | REGIONAL | USER | SHIPMENT | CORRIDOR */
  aggregationLevel: AggregationLevel;
  /** How frequently the KPI is refreshed */
  refreshInterval: string;
  /** Owning module identifier */
  ownerModule: SourceModule;
}

/**
 * Insight Object — derived intelligence output (definition-only, not computed).
 * Per MOD-012 §4.4
 * Represents the STRUCTURE of derived intelligence. Actual insight generation is performed by MOD-006.
 * GeneratedByModule typically points to MOD-006.
 */
export interface InsightOutput extends BaseEntity {
  /** Unique identifier for this insight */
  insightId: string;
  /** Classification: TREND | ANOMALY | PREDICTION | OPTIMIZATION */
  insightType: InsightType;
  /** References to source datasets used to generate this insight */
  sourceDataReferences: string[];
  /** Confidence level (0–100 scale) */
  confidenceLevel: number;
  /** Module that generated this insight (typically MOD-006) */
  generatedByModule: SourceModule;
  /** Timestamp of insight generation */
  timestamp: Date;
}

/**
 * Corridor Analytics Dataset — structured corridor-level analytics structure.
 * Per MOD-012 §4.5
 * Corridor data is a primary analytics dimension.
 * Must integrate with MOD-009 corridor definitions.
 * AI uses this data for predictions (MOD-006).
 *
 * D-S3-001 CONDITION: corridorId is string type (provisional design-time assumption
 * pending MOD-009 implementation and reconciling BC review), following D-S2B-002 pattern.
 */
export interface CorridorAnalyticsDataset extends BaseEntity {
  /** Unique identifier for this corridor analytics record */
  corridorAnalyticsId: string;
  /** Reference to corridor definition (string type per D-S3-001 provisional assumption) */
  corridorId: string;
  /** Time period granularity covered by this analytics record */
  timePeriod: TimePeriod;
  /** Average transit time in hours */
  averageTransitTime: number;
  /** Distribution of border crossing delays (structured JSON) */
  borderDelayDistribution: Record<string, unknown>;
  /** Average transportation cost */
  averageCost: number;
  /** Seasonal pattern analysis data */
  seasonalPattern: SeasonalPatternData[];
  /** Carrier performance metrics along this corridor */
  carrierPerformance: CarrierPerformanceMetric[];
  /** Congestion pattern metrics */
  congestionData: CongestionMetrics;
  /** Timestamp when this analytics record was generated */
  generatedAt: Date;
}

/**
 * Financial Reconciliation Dataset — financial analytics and reconciliation structure.
 * Per MOD-012 §4.6
 * Must reconcile escrow transactions with shipment completion.
 * Financial data must be auditable.
 * Multi-currency normalisation is required.
 */
export interface FinancialReconciliationDataset extends BaseEntity {
  /** Unique identifier for this reconciliation record */
  reconciliationDatasetId: string;
  /** Reference to the escrow account (MOD-005) */
  escrowId: string;
  /** Associated shipment identifier (MOD-003) */
  shipmentId: string;
  /** Transaction amount */
  transactionAmount: number;
  /** Settlement currency code */
  settlementCurrency: string;
  /** Exchange rate applied if multi-currency normalization needed */
  conversionRateApplied?: ExchangeRateMetadata;
  /** Status of the associated escrow */
  escrowStatus: string;
  /** Alignment status between recorded and expected amounts */
  reconciliationAlignmentStatus: ReconciliationAlignmentStatus;
  /** Timestamp when this record was generated */
  generatedAt: Date;
}

/**
 * AI Training Dataset Object — structured data prepared for AI model training.
 * Per MOD-012 §4.7
 * Only validated data is used for training.
 * Data must be anonymised where required.
 * Versioning of datasets is required.
 * Feedback loops from AI performance are included.
 */
export interface AITrainingDatasetObject extends BaseEntity {
  /** Unique identifier for this training dataset */
  trainingDatasetId: string;
  /** Descriptive dataset name */
  datasetName: string;
  /** Purpose classification for the training dataset */
  purpose: AITrainingPurpose;
  /** References to source datasets used to build this training set */
  sourceDataReferences: string[];
  /** Anonymization status of the dataset */
  anonymizationStatus: AnonymizationStatus;
  /** Version number */
  version: number;
  /** Start date of training data collection */
  trainingStartDate: Date;
  /** End date of training data collection */
  trainingEndDate: Date;
  /** Model performance validation metrics from feedback loops */
  validationMetrics?: TrainingValidationMetrics;
}
