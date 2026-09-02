// NexCargo MOD-012 — Data Platform Analytics & BI Layer Module Local Enums
// Wave 2 — Stage 3, Increment 1 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)
// Reference: MOD-012 §§4 Core Domain Entities (4.1–4.7), §5 Data Lifecycle

/** Source module identifier for data ingestion tracking per MOD-012 §3.1 */
export type SourceModule = string;

/** Dataset refresh policy per MOD-012 §4.2 */
export enum RefreshPolicy {
  REAL_TIME = 'REAL_TIME',
  BATCH = 'BATCH',
  MANUAL = 'MANUAL',
}

/** Dataset access level per MOD-012 §4.2 */
export enum AccessLevel {
  PUBLIC = 'PUBLIC',
  RESTRICTED = 'RESTRICTED',
  CONFIDENTIAL = 'CONFIDENTIAL',
}

/** KPI aggregation level per MOD-012 §4.3 */
export enum AggregationLevel {
  GLOBAL = 'GLOBAL',
  REGIONAL = 'REGIONAL',
  USER = 'USER',
  SHIPMENT = 'SHIPMENT',
  CORRIDOR = 'CORRIDOR',
}

/** Insight type produced by analytics consumption layer per MOD-012 §4.4 */
export enum InsightType {
  TREND = 'TREND',
  ANOMALY = 'ANOMALY',
  PREDICTION = 'PREDICTION',
  OPTIMIZATION = 'OPTIMIZATION',
}

/** Corridor analytics time period granularity per MOD-012 §4.5 */
export enum TimePeriod {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

/** AI training dataset purpose per MOD-012 §4.7 */
export enum AITrainingPurpose {
  ETA_PREDICTION = 'ETA_PREDICTION',
  DELAY_DETECTION = 'DELAY_DETECTION',
  PRICING = 'PRICING',
  FRAUD_DETECTION = 'FRAUD_DETECTION',
  DEMAND_FORECAST = 'DEMAND_FORECAST',
}

/** Anonymization status for AI training datasets per MOD-012 §4.7 */
export enum AnonymizationStatus {
  ANONYMIZED = 'ANONYMIZED',
  RAW = 'RAW',
}

/** Financial reconciliation alignment status per MOD-012 §4.6 */
export enum ReconciliationAlignmentStatus {
  ALIGNED = 'ALIGNED',
  MISMATCH_DETECTED = 'MISMATCH_DETECTED',
}
