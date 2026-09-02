// NexCargo MOD-006 — AI Intelligence Platform BC Coordination Interfaces
// Wave 2 — Stage 3, Increment 2 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)
// Reference: MOD-006 §§8–9 Events and Integration Boundaries, MOD-012 §7.5 AI Data Isolation Rule
//
// Key BC coupling: MOD-006 consumes data from MOD-012 (data provider).
// MOD-012 defines data structure; MOD-006 consumes it but does not define it.

import type { ProcessedDataset, CorridorAnalyticsDataset } from '@/modules/mod-012-analytics/domain/types/entities';
import type { InsightType, PredictionType, AnomalyType, RecommendationType, RiskCategory } from '../enums';

/** Module source identifier reference (convention: "MOD-XXX") */
type SourceModuleRef = string;

// ============================================================
// Signals PRODUCED by MOD-006 → consumed by downstream modules
// Per MOD-006 §8 declared event model (specification only)
// ============================================================

/**
 * Insight Generated Signal — emitted when an intelligence insight is produced.
 * Consumed by: MOD-001 (marketplace intelligence), MOD-002 (contract risk), MOD-012 (BI aggregation)
 * Per MOD-006 §8: InsightGenerated event
 */
export interface InsightGeneratedSignal {
  /** Unique insight identifier */
  insightId: string;
  /** Insight type classification */
  insightType: InsightType;
  /** Modules referenced in generating this insight */
  sourceModules: string[];
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Severity level */
  severityLevel: string;
  /** Timestamp of generation */
  timestamp: Date;
}

/**
 * Prediction Computed Signal — emitted when a prediction model produces output.
 * Consumed by: MOD-003 (ETA/delay signals), MOD-012 (analytics aggregation)
 * Per MOD-006 §8: PredictionComputed event
 */
export interface PredictionComputedSignal {
  /** Prediction identifier */
  predictionId: string;
  /** Prediction type */
  predictionType: PredictionType;
  /** Dataset reference used as input */
  inputDatasetReference: string;
  /** Predicted outcome description */
  predictedOutcome: unknown;
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Anomaly Detected Signal — emitted when irregular behavior is detected.
 * Consumed by: MOD-003 (delay prediction), MOD-005 (fraud detection alerts), MOD-010 (compliance flags)
 * Per MOD-006 §8: AnomalyDetected event
 */
export interface AnomalyDetectedSignal {
  /** Anomaly report identifier */
  anomalyId: string;
  /** Anomaly type */
  anomalyType: AnomalyType;
  /** Module where anomaly was detected */
  affectedModule: string;
  /** Risk score 0–100 */
  riskScore: number;
  /** Severity classification */
  severity: string;
  /** Evidence references */
  evidenceReferences: string[];
  /** Timestamp */
  timestamp: Date;
}

/**
 * Recommendation Issued Signal — emitted when an advisory recommendation is generated.
 * Consumed by: MOD-001 (matching/tuning), MOD-002 (risk assessment), MOD-018 (commercial optimization)
 * Per MOD-006 §8: RecommendationIssued event
 */
export interface RecommendationIssuedSignal {
  /** Recommendation identifier */
  recommendationId: string;
  /** Type of recommendation */
  recommendationType: RecommendationType;
  /** Context module */
  contextModule: string;
  /** Summary of suggested action */
  suggestedActionSummary: string;
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Fraud Risk Updated Signal — emitted when a fraud risk score changes.
 * Consumed by: MOD-005 (fraud alerts), MOD-010 (compliance monitoring)
 * Per MOD-006 §8: FraudRiskUpdated event
 */
export interface FraudRiskUpdatedSignal {
  /** Risk assessment identifier */
  riskId: string;
  /** Entity type assessed */
  entityType: string;
  /** Entity identifier */
  entityId: string;
  /** Updated risk score */
  riskScore: number;
  /** Risk category */
  riskCategory: RiskCategory;
  /** Reason codes for the risk assessment */
  reasonCodes: string[];
  /** Timestamp */
  timestamp: Date;
}

/**
 * Route Suggestion Signal — emits route optimization suggestions.
 * Consumed by: MOD-003 (tracking/ETA updates), MOD-012 (analytics)
 * Per MOD-006 §8: RouteSuggestionGenerated event
 */
export interface RouteSuggestionSignal {
  /** Route suggestion identifier */
  routeId: string;
  /** Associated shipment */
  shipmentId: string;
  /** Origin and destination */
  origin: string;
  destination: string;
  /** Estimated duration in hours */
  estimatedDuration: number;
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Chat Interaction Logged Signal — logs conversational interaction data.
 * Consumed by: MOD-012 (analytics/aggregation), MOD-016 (notification triggers)
 * Per MOD-006 §8: ChatInteractionLogged event
 */
export interface ChatInteractionLoggedSignal {
  /** Session identifier */
  sessionId: string;
  /** User ID */
  userId: string;
  /** User role */
  userRole: string;
  /** Message count in session */
  messageCount: number;
  /** Session duration in minutes */
  durationMinutes: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Carbon Estimate Calculated Signal — emits environmental intelligence.
 * Consumed by: MOD-012 (analytics), MOD-017 (observability)
 * Per MOD-006 §8: CarbonEstimateCalculated event
 */
export interface CarbonEstimateCalculatedSignal {
  /** Estimate identifier */
  estimateId: string;
  /** Associated shipment */
  shipmentId: string;
  /** Estimated CO₂ equivalent in kg */
  estimatedCO2e: number;
  /** Distance in km */
  distance: number;
  /** Methodology standard */
  methodology: string;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================
// Requests/Interfaces CONSUMED by MOD-006 from upstream modules
// ============================================================

/**
 * Analytics Dataset Request Interface — primary interface through which MOD-006
 * requests structured analytics datasets from MOD-012.
 * Per MOD-012 §7.5 AI Data Isolation Rule: "MOD-006 consumes data but does not define structure"
 * This is the complementary half of the MOD-012 ↔ MOD-006 BC coupling.
 */
export interface AnalyticsDatasetRequest {
  /** Required dataset identifier */
  datasetId: string;
  /** Required fields from the dataset */
  requiredFields: string[];
  /** Time range filter for data query */
  timeRangeStart?: Date;
  /** Time range end filter */
  timeRangeEnd?: Date;
  /** Minimum confidence threshold for filtering results */
  minConfidenceThreshold?: number;
  /** Specific AI analysis purpose */
  analysisPurpose: string;
  /** Execute the request and return the dataset response */
  execute(): DatasetResponseEnvelope;
}

/**
 * Dataset Response Envelope — standardized response wrapper from MOD-012.
 */
export interface DatasetResponseEnvelope {
  /** Dataset identifier */
  datasetId: string;
  /** Dataset name */
  datasetName: string;
  /** Dataset version */
  version: number;
  /** Structured data rows (no computation performed here) */
  dataStructure: Record<string, unknown>[];
  /** Metadata about the response */
  metadata: {
    recordCount: number;
    refreshPolicy: string;
    lineageSummary: string;
  };
}

/**
 * Corridor Intelligence Feed Interface — consumes corridor-level analytics from MOD-012
 * for route optimization and demand forecasting models.
 * Per MOD-012 CorridorAnalyticsReport → MOD-006
 */
export interface CorridorIntelligenceFeed {
  /** Corridor identifier */
  corridorId: string;
  /** Average transit time characteristics */
  averageTransitTime: number;
  /** Border delay distribution summary */
  borderDelayDistribution: Record<string, unknown>;
  /** Seasonal pattern indicators */
  seasonalPattern: Record<string, unknown>;
  /** Whether this corridor data is approved for AI consumption */
  aiReady: boolean;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Market Activity Feed Interface — consumes marketplace intelligence from MOD-001
 * for pricing recommendations and matching contexts.
 * Per MOD-006 §9: consumes listing/offer data, pricing context
 */
export interface MarketIntelligenceFeed {
  /** Listing or offer identifier */
  entityId: string;
  /** Entity type */
  entityType: 'LISTING' | 'OFFER' | 'MATCH';
  /** Current status */
  status: string;
  /** Price information if applicable */
  price?: number;
  /** Currency code */
  currency?: string;
  /** Cargo type compatibility */
  cargoType?: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * Tracking Anomaly Feed Interface — consumes tracking data from MOD-003
 * for ETA predictions and delay detection signals.
 * Per MOD-006 §9: tracking anomaly detection (ETA, delay, route deviations)
 */
export interface TrackingAnomalyFeed {
  /** Shipment identifier */
  shipmentId: string;
  /** Current tracking status */
  currentStatus: string;
  /** Latest GPS position coordinates */
  locationLat?: number;
  /** Latest GPS longitude */
  locationLon?: number;
  /** Estimated time of arrival */
  eta?: Date;
  /** Delay reason if any */
  delayReason?: string;
  /** Expected vs actual progress delta */
  progressDelta?: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * Financial Risk Signal Feed Interface — consumes financial signals from MOD-005/MOD-013
 * for fraud detection and escrow irregularity analysis.
 * Per MOD-006 §9: financial risk signals (fraud detection, escrow irregularities)
 */
export interface FinancialRiskSignalFeed {
  /** Transaction or escrow identifier */
  entityId: string;
  /** Entity type: ESCROW | PAYMENT | SETTLEMENT */
  entityType: 'ESCROW' | 'PAYMENT' | 'SETTLEMENT';
  /** Status of the entity */
  status: string;
  /** Amount involved */
  amount?: number;
  /** Currency code */
  currency?: string;
  /** Irregularity flag */
  irregularityFlag?: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * Compliance Audit Log Feed Interface — consumes compliance events from MOD-010
 * for fraud scoring and audit logging.
 * Per MOD-006 §9: security and compliance (fraud scoring, audit logging)
 */
export interface ComplianceAuditFeed {
  /** Event identifier */
  eventId: string;
  /** Event type */
  eventType: string;
  /** Severity level */
  severity: string;
  /** Descriptive message */
  message: string;
  /** Actor involved */
  actorId: string;
  /** Timestamp */
  feedTimestamp: Date;
}
