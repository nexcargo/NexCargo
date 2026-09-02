// NexCargo MOD-018 — Marketplace Growth & Pricing Module BC Coordination Interfaces
// Wave 3 — Increment 3 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)
// Reference: MOD-018 §§8 Events and Integration Boundaries, §7 Rules of Operation, D-MOD016-001
//
// Key BC coupling points:
// - MOD-018 consumes from MOD-001, MOD-003, MOD-005, MOD-006, MOD-007, MOD-009(provisional),
//   MOD-012, MOD-014, MOD-016(consumer-side stubs), MOD-017
// - MOD-016 notification surfaces consumed via consumer-side design-time stubs (D-MOD016-001)
// - MOD-018 output signals consumed by MOD-001, MOD-003, MOD-006, MOD-012, MOD-014, MOD-017

// ============================================================
// CONSUMER-SIDE DESIGN-TIME STUBS FOR MOD-016
// Per D-MOD016-001: Contract interfaces defined as local type definitions consuming
// MOD-016 conceptually without importing actual MOD-016 implementation types.
// Pattern follows D-S2B-002 provisional-assumption approach.
// ============================================================

/**
 * MOD-016 Notification Channel Stub — conceptual interface representing MOD-016 channels.
 * DESIGN-TIME STUB ONLY. Does not import any MOD-016 types.
 */
export interface NotificationChannelStub {
  /** Channel identifier */
  channelId: string;
  /** Whether this channel is configured and active */
  isActive: boolean;
  /** Last successful delivery timestamp */
  lastDeliveryTime?: Date;
}

/**
 * MOD-016 Notification Template Stub — conceptual template definition from MOD-016.
 */
export interface NotificationTemplateStub {
  /** Template identifier */
  templateId: string;
  /** Template title format string */
  titleFormat: string;
  /** Template body format string */
  bodyFormat: string;
  /** Supported channels */
  supportedChannels: string[];
  /** Default priority */
  defaultPriority: string;
}

// ============================================================
// UPSTREAM CONSUMPTION INTERFACES — INPUTS TO MOD-018 FROM DEPENDENT MODULES
// ============================================================

/**
 * MarketplaceActivityFeed — primary data source from MOD-001 marketplace layer.
 * Provides listing/offer/match activity data for commercial signal generation.
 * Pattern follows established feed consumption conventions.
 */
export interface MarketplaceActivityFeed {
  /** Entity identifier (listing/offer/match) */
  entityId: string;
  /** Entity type classification */
  entityType: 'LISTING' | 'OFFER' | 'MATCH';
  /** Current entity status */
  status: string;
  /** Price information if applicable */
  price?: number;
  /** Currency code */
  currency?: string;
  /** Cargo type */
  cargoType?: string;
  /** Origin location */
  origin?: string;
  /** Destination location */
  destination?: string;
  /** Corridor reference (string-typed, corridor abstraction deferred to Wave 4) */
  corridorId?: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * MarketIntelligenceFeed — AI-generated commercial intelligence from MOD-006.
 * Provides anomaly detection insights and prediction outputs relevant to market optimization.
 */
export interface MarketIntelligenceFeed {
  /** Insight or prediction identifier from MOD-006 */
  insightId: string;
  /** Type: PREDICTION / ANOMALY / RECOMMENDATION / RISK_SCORE */
  insightType: string;
  /** Confidence score (0–100) */
  confidenceScore: number;
  /** Severity or risk category */
  severityLevel: string;
  /** Structured reasoning trace for transparency */
  explanationTrace: Record<string, unknown>;
  /** Target entity this insight applies to */
  targetEntity?: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * ShipmentPerformanceFeed — shipment lifecycle efficiency data from MOD-003 tracking.
 * Provides route efficiency and operational performance signals for optimization modeling.
 */
export interface ShipmentPerformanceFeed {
  /** Shipment identifier */
  shipmentId: string;
  /** Current tracking status */
  currentStatus: string;
  /** Route efficiency percentage (based on planned vs actual route) */
  routeEfficiencyPercent: number;
  /** Average delay in minutes */
  averageDelayMinutes: number;
  /** POD submission status */
  podSubmitted: boolean;
  /** Corridor identifier (provisional string-typed per D-S2B-002 precedent) */
  corridorId?: string;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * FleetUtilizationFeed — fleet capacity and backhaul availability from MOD-014.
 * Provides asset utilization signals for supply-demand balancing.
 */
export interface FleetUtilizationFeed {
  /** Asset or vehicle identifier */
  assetId: string;
  /** Fleet utilization percentage */
  utilizationPercent: number;
  /** Available capacity indicator */
  availableCapacity: boolean;
  /** Backhaul opportunity flag */
  hasBackhaulOpportunity: boolean;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * AnalyticsDatasetFeed — structured analytics data from MOD-012 BI layer.
 * Provides pre-aggregated metrics for pricing and incentive modeling inputs.
 * Pattern follows MOD-006 → MOD-012 DatasetGenerationSignal consumption model.
 */
export interface AnalyticsDatasetFeed {
  /** Dataset identifier from MOD-012 */
  datasetId: string;
  /** Source module that produced this dataset */
  sourceModule: string;
  /** Aggregation period */
  aggregationPeriod: string;
  /** Metric key-value pairs */
  metrics: Record<string, number>;
  /** Data freshness indicator */
  isFresh: boolean;
  /** Timestamp */
  feedTimestamp: Date;
}

/**
 * SystemPerformanceSignal — observability correlation data from MOD-017.
 * Provides system-level performance indicators affecting commercial operations.
 */
export interface SystemPerformanceSignal {
  /** Signal identifier */
  signalId: string;
  /** Performance metric name */
  metricName: string;
  /** Current value */
  currentValue: number;
  /** Trend direction (UP, DOWN, STABLE) */
  trend: string;
  /** Timestamp */
  signalTimestamp: Date;
}

// ============================================================
// DOWNSTREAM OUTPUT SIGNALS — PRODUCED BY MOD-018 → CONSUMED BY OTHER MODULES
// ============================================================

/**
 * RecommendationIssuedSignal — commercial recommendation emitted for downstream modules.
 * Consumed by: MOD-001 (marketplace adjustments, execution elsewhere),
 *              MOD-006 (AI optimization feedback loop)
 * Pattern follows established signal-to-module convention.
 */
export interface RecommendationIssuedSignal {
  /** Recommendation identifier */
  recommendationId: string;
  /** Type of recommendation issued */
  recommendationType: string;
  /** Target region or corridor */
  targetRegion: string;
  /** Confidence score of the recommendation */
  confidenceScore: number;
  /** Summary of suggested action */
  suggestedActionSummary: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * MarketSignalDetectedSignal — emitted when a significant market condition is detected.
 * Consumed by: MOD-001 (marketplace awareness), MOD-006 (anomaly correlation),
 *              MOD-012 (analytics storage), MOD-017 (observability monitoring)
 */
export interface MarketSignalDetectedSignal {
  /** Signal identifier */
  signalId: string;
  /** Signal type */
  signalType: string;
  /** Intensity score (0–100) */
  intensityScore: number;
  /** Region affected */
  region: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * PricingModelUpdatedSignal — structural-only update notification when a pricing model changes.
 * Consumed by: MOD-001 (marketplace pricing display), MOD-012 (trend analytics)
 */
export interface PricingModelUpdatedSignal {
  /** Pricing model identifier */
  pricingModelId: string;
  /** New status */
  newStatus: string;
  /** Region or corridor updated */
  region: string;
  /** Version number after update */
  version: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * IncentiveRuleGeneratedSignal — emitted when a new incentive rule is defined.
 * Consumed by: MOD-012 (incentive analytics), MOD-016 (campaign notifications), MOD-017 (monitoring)
 */
export interface IncentiveRuleGeneratedSignal {
  /** Incentive rule identifier */
  incentiveId: string;
  /** Incentive type */
  incentiveType: string;
  /** Applicable region */
  region: string;
  /** Current status */
  status: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * PromotionalCampaignCreatedSignal — emitted when a new promotional campaign starts.
 * Consumed by: MOD-016 (campaign notifications), MOD-012 (campaign measurement), MOD-017 (monitoring)
 */
export interface PromotionalCampaignCreatedSignal {
  /** Campaign identifier */
  campaignId: string;
  /** Campaign name */
  campaignName: string;
  /** Campaign type */
  campaignType: string;
  /** Target audience scope */
  targetScope: string;
  /** Start date */
  startDate: Date;
  /** Timestamp */
  timestamp: Date;
}

/**
 * FeeStructureUpdatedSignal — structural update notification for fee configurations.
 * Consumed by: MOD-012 (fee analytics), MOD-017 (monitoring)
 */
export interface FeeStructureUpdatedSignal {
  /** Fee structure identifier */
  feeStructureId: string;
  /** Fee type */
  feeType: string;
  /** Region affected */
  region: string;
  /** New fee value */
  feeValue: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * ExperimentCreatedSignal — emitted when an A/B experiment begins.
 * Consumed by: MOD-012 (experiment measurement), MOD-017 (experiment monitoring)
 */
export interface ExperimentCreatedSignal {
  /** Experiment identifier */
  experimentId: string;
  /** Experiment type */
  experimentType: string;
  /** Hypothesis being tested */
  hypothesis: string;
  /** Status */
  status: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * CarrierEngagementUpdatedSignal — emitted when carrier engagement metrics change.
 * Consumed by: MOD-012 (retention analytics), MOD-016 (engagement notifications)
 */
export interface CarrierEngagementUpdatedSignal {
  /** Engagement record identifier */
  engagementId: string;
  /** Carrier identifier */
  carrierId: string;
  /** Current engagement score */
  engagementScore: number;
  /** Retention risk level */
  retentionRiskLevel: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * DemandForecastGeneratedSignal — emitted when a demand forecast is produced.
 * Consumed by: MOD-012 (forecast analytics), MOD-006 (AI model training data)
 */
export interface DemandForecastGeneratedSignal {
  /** Forecast identifier */
  forecastId: string;
  /** Forecast type */
  forecastType: string;
  /** Region covered */
  region: string;
  /** Forecasted demand volume */
  forecastedDemand: number;
  /** Confidence score */
  confidenceScore: number;
  /** Timestamp */
  timestamp: Date;
}
