// NexCargo MOD-018 — Marketplace Growth & Pricing Module Domain Types
// Wave 3 — Increment 3 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)
// Reference: MOD-018 §4 Core Domain Entities (§§4.1–§4.9), §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO price execution, incentive enforcement, or financial modification (§7.1, §7.9)
// - All outputs are non-binding recommendations only (§7.2)
// - Market neutrality required — no favoring specific users/fleets (§7.4)
// - All commercial signals must originate from real system data (§7.5)

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type {
  PricingModelStatus,
  IncentiveType,
  IncentiveStatus,
  MarketSignalType,
  RecommendationType,
  CampaignType,
  CampaignStatus,
  FeeType,
  FeeBasis,
  FeeStatus,
  ExperimentType,
  ExperimentStatus,
  RetentionRiskLevel,
  ForecastType,
} from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Structured factor definition for pricing model variable factors per MOD-018 §4.1 */
export interface PriceFactorDefinition {
  /** Factor identifier */
  factorId: string;
  /** Factor name (supply, demand, fuel, congestion, etc.) */
  factorName: string;
  /** Weight multiplier for this factor */
  weightMultiplier: number;
  /** Data source module providing this factor's values */
  dataSourceModule: string;
  /** Whether this factor is currently active in calculations */
  isActive: boolean;
}

/** Regulatory and business limit constraint per MOD-018 §4.1 */
export interface PricingConstraint {
  /** Constraint identifier */
  constraintId: string;
  /** Type of constraint (minimum, maximum, corridor-specific, regulatory) */
  constraintType: string;
  /** Minimum allowed value */
  minValue?: number;
  /** Maximum allowed value */
  maxValue?: number;
  /** Applicable corridor or region */
  applicableRegion?: string;
}

/** Eligibility condition for incentive rules per MOD-018 §4.2 */
export interface EligibilityCondition {
  /** Condition identifier */
  conditionId: string;
  /** Condition field being evaluated */
  targetField: string;
  /** Comparison operator (GTEQ, LTEQ, EQUALS, IN_LIST, etc.) */
  operator: string;
  /** Expected value(s) */
  expectedValue: unknown | unknown[];
}

/** Trigger definition for incentive activation per MOD-018 §4.2 */
export interface TriggerDefinition {
  /** Trigger identifier */
  triggerId: string;
  /** Event that triggers the incentive */
  triggerEvent: string;
  /** Source module generating the event */
  triggerSource: string;
  /** Conditions under which the trigger fires */
  conditions: EligibilityCondition[];
}

/** Value structure defining how an incentive reward is calculated per MOD-018 §4.2 */
export interface RewardValueStructure {
  /** Value type (PERCENTAGE, FIXED_AMOUNT, MULTIPLIER, BONUS_POINTS) */
  valueType: string;
  /** Base value */
  baseValue: number;
  /** Currency code if applicable */
  currency?: string;
  /** Cap on maximum reward value */
  maxRewardValue?: number;
}

/** Supporting signal references for optimization recommendations per MOD-018 §4.4 */
export interface SignalReference {
  /** Source signal identifier */
  signalId: string;
  /** Signal type */
  signalType: string;
  /** Contribution weight to this recommendation */
  contributionWeight: number;
}

/** Measurability rules for promotional campaigns per MOD-018 §4.5 */
export interface MeasurabilityRule {
  /** Rule identifier */
  ruleId: string;
  /** Metric being measured */
  metricType: string;
  /** Measurement period */
  measurementPeriod: string;
  /** Success threshold */
  successThreshold: number;
}

/** Control group criteria for A/B experiments per MOD-018 §4.7 */
export interface GroupCriteria {
  /** User/segment identifier pattern */
  segmentPattern: string;
  /** Inclusion/exclusion filter expressions */
  filters: Record<string, unknown>;
  /** Minimum sample size required */
  minSampleSize: number;
}

/** Success metric reference for A/B experiments per MOD-018 §4.7 */
export interface SuccessMetric {
  /** Metric identifier */
  metricId: string;
  /** Metric name */
  metricName: string;
  /** Baseline value before experiment */
  baselineValue: number;
  /** Target improvement percentage */
  targetImprovementPercent: number;
}

/** Basis input reference for demand forecast per MOD-018 §4.9 */
export interface ForecastInputReference {
  /** Source module producing the input data */
  sourceModule: string;
  /** Data entity type referenced */
  entityType: string;
  /** Time period covered */
  timePeriod: string;
}

// ============================================================
// Entity types (extend BaseEntity with snake_case fields)
// Per BaseEntity: id, created_at, updated_at, version, bumpVersion(), toJSON()
// ============================================================

/**
 * Pricing Model Object — pricing configuration structure.
 * Per MOD-018 §4.1
 * Pricing must be corridor-aware.
 * Pricing must remain transparent to users.
 * Price changes within configured regulatory/business limits.
 */
export interface PricingModelObject extends BaseEntity {
  /** Unique identifier for this pricing model */
  pricingModelId: string;
  /** Region or corridor reference */
  region: string;
  /** Corridor identifier (provisional string-typed per D-S2B-002 precedent) */
  corridorId: string;
  /** Cargo type classification */
  cargoType: string;
  /** Base rate structure definition */
  baseRateStructure: Record<string, unknown>;
  /** Variable factors influencing pricing (supply, demand, fuel, congestion) */
  variableFactors: PriceFactorDefinition[];
  /** Regulatory and business limit constraints */
  constraints: PricingConstraint[];
  /** Current status */
  status: PricingModelStatus;
  /** Version number for change tracking */
  version: number;
  /** Validity start date */
  validFrom: Date;
  /** Optional validity end date */
  validTo?: Date;
}

/**
 * Incentive Rule Object — reward structure logic.
 * Per MOD-018 §4.2
 * Incentives configurable per corridor.
 * Fraud detection required (MOD-010).
 * Execution handled by MOD-013 + ESS-001F (not MOD-018).
 */
export interface IncentiveRuleObject extends BaseEntity {
  /** Unique identifier for this incentive rule */
  incentiveId: string;
  /** Type of incentive */
  incentiveType: IncentiveType;
  /** Eligibility conditions for receiving the incentive */
  eligibilityCriteria: EligibilityCondition[];
  /** Trigger definitions activating the incentive */
  triggerConditions: TriggerDefinition[];
  /** Structured reward value definition */
  valueStructure: RewardValueStructure;
  /** Period during which the incentive is valid */
  validityPeriod: { start: Date; end?: Date };
  /** Optional corridor restriction */
  region?: string;
  /** Current status */
  status: IncentiveStatus;
}

/**
 * Market Signal Object — marketplace behavior indicators.
 * Per MOD-018 §4.3
 * ALL commercial signals MUST originate from real system data.
 * No synthetic market assumptions allowed.
 * Signals aggregated from MOD-003, MOD-012, MOD-014, MOD-017, MOD-006.
 */
export interface MarketSignalObject extends BaseEntity {
  /** Unique identifier for this market signal */
  signalId: string;
  /** Type of market signal detected */
  signalType: MarketSignalType;
  /** Modules whose data contributed to this signal */
  sourceModules: string[];
  /** Intensity score (0–100) */
  intensityScore: number;
  /** Confidence in the signal accuracy */
  confidenceScore: number;
  /** Timestamp of detection */
  timestamp: Date;
  /** Region affected */
  region: string;
  /** Optional corridor identifier */
  corridorId: string;
  /** Additional structured context */
  metadata: Record<string, unknown>;
}

/**
 * Optimization Recommendation Object — system-generated commercial recommendation.
 * Per MOD-018 §4.4
 * Outputs MUST be recommendations only — non-binding.
 * No execution hooks into financial systems.
 */
export interface OptimizationRecommendationObject extends BaseEntity {
  /** Unique identifier for this recommendation */
  recommendationId: string;
  /** Type of recommendation */
  type: RecommendationType;
  /** Rationale behind this recommendation */
  rationale: string;
  /** Supporting market signals */
  supportingSignals: SignalReference[];
  /** Confidence score */
  confidenceScore: number;
  /** Target region */
  targetRegion: string;
  /** Optional target corridor */
  targetCorridor: string;
  /** Non-executable suggested action structure */
  suggestedAction: Record<string, unknown>;
  /** When generated */
  generatedAt: Date;
  /** When this recommendation expires/is no longer valid */
  validUntil: Date;
}

/**
 * Promotional Campaign Object — marketing or activation campaign.
 * Per MOD-018 §4.5
 * Campaigns can target corridors, users, or transport types.
 * Must respect notification rules (MOD-016).
 * Must be measurable via analytics (MOD-012).
 */
export interface PromotionalCampaignObject extends BaseEntity {
  /** Unique identifier for this campaign */
  campaignId: string;
  /** Campaign display name */
  campaignName: string;
  /** Type of campaign */
  campaignType: CampaignType;
  /** Target audience segment definition */
  targetAudience: Record<string, unknown>;
  /** Linked incentive IDs */
  incentiveIds: string[];
  /** Campaign start date */
  startDate: Date;
  /** Campaign end date */
  endDate: Date;
  /** Optional budget allocation */
  budget?: number;
  /** Current campaign status */
  status: CampaignStatus;
  /** Measurability rules defining how success is tracked */
  measurabilityRules: MeasurabilityRule[];
  /** When created */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Fee Structure Object — platform fee and commission configuration.
 * Per MOD-018 §4.6
 * Fees can vary by corridor and demand level.
 * Must remain transparent to users.
 * AI may recommend adjustments but does not execute them.
 */
export interface FeeStructureObject extends BaseEntity {
  /** Unique identifier for this fee structure */
  feeStructureId: string;
  /** Type of fee */
  feeType: FeeType;
  /** Region or corridor reference */
  region: string;
  /** Fee calculation basis */
  feeBasis: FeeBasis;
  /** Numeric fee value */
  feeValue: number;
  /** Optional minimum fee floor */
  minFee?: number;
  /** Optional maximum fee ceiling */
  maxFee?: number;
  /** When this fee structure becomes effective */
  effectiveDate: Date;
  /** Current status */
  status: FeeStatus;
}

/**
 * A/B Experiment Object — controlled marketplace experiment.
 * Per MOD-018 §4.7
 * Experiments must be isolated and measurable.
 * No financial inconsistency allowed.
 * Results feed into MOD-012 analytics.
 * All experiments measurable and reversible.
 */
export interface ABExperimentObject extends BaseEntity {
  /** Unique identifier for this experiment */
  experimentId: string;
  /** Experiment display name */
  experimentName: string;
  /** Type of experiment */
  experimentType: ExperimentType;
  /** Criteria for control group assignment */
  controlGroupCriteria: GroupCriteria;
  /** Criteria for test group assignment */
  testGroupCriteria: GroupCriteria;
  /** Structured experimental variables */
  variables: Record<string, unknown>;
  /** Experiment start date */
  startDate: Date;
  /** Experiment end date */
  endDate: Date;
  /** Current experiment status */
  status: ExperimentStatus;
  /** Hypothesis being tested */
  hypothesis: string;
  /** Metrics used to evaluate experiment success */
  successMetrics: SuccessMetric[];
  /** Optional structured results after completion */
  results?: Record<string, unknown>;
  /** Reversibility rules ensuring clean rollback capability */
  reversibilityRules: Record<string, unknown>;
}

/**
 * Carrier Engagement Record — transporter engagement and retention metrics.
 * Per MOD-018 §4.8
 * Tracks engagement metrics per carrier.
 * Triggers personalised incentives.
 * Integrates with MOD-016 notifications.
 */
export interface CarrierEngagementRecord extends BaseEntity {
  /** Unique identifier for this engagement record */
  engagementId: string;
  /** Carrier/transporter identifier */
  carrierId: string;
  /** Overall engagement score (0–100) */
  engagementScore: number;
  /** How frequently the carrier participates */
  participationFrequency: string; // e.g., "DAILY", "WEEKLY", "MONTHLY"
  /** Percentage of loads accepted vs offered */
  loadAcceptanceRate: number;
  /** Current retention risk assessment */
  retentionRiskLevel: RetentionRiskLevel;
  /** Last recorded engagement activity date */
  lastEngagementDate: Date;
  /** Personalized incentives recommended for this carrier */
  personalizedIncentives: string[];
  /** When this record was calculated */
  calculatedAt: Date;
}

/**
 * Demand Forecast Object — predictive logistics demand structure.
 * Per MOD-018 §4.9
 * Integrates with MOD-012 AI models.
 * Forecasts by corridor, season, and cargo type.
 * Influences pricing and incentives structurally (not executed by MOD-018).
 */
export interface DemandForecastObject extends BaseEntity {
  /** Unique identifier for this demand forecast */
  forecastId: string;
  /** Type of forecast being generated */
  forecastType: ForecastType;
  /** Geographic region */
  region: string;
  /** Optional corridor identifier */
  corridorId: string;
  /** Time period the forecast covers */
  timePeriod: string;
  /** Estimated volume of demand (loads/ships) */
  forecastedDemand: number;
  /** Confidence in the forecast */
  confidenceScore: number;
  /** Input data sources feeding this forecast */
  basis: ForecastInputReference[];
  /** When the forecast was generated */
  generatedAt: Date;
}
