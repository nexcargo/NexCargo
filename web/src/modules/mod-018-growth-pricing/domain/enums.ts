// NexCargo MOD-018 — Marketplace Growth & Pricing Module Local Enums
// Wave 3 — Increment 3 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)
// Reference: MOD-018 §§4 Core Domain Entities (§§4.1–§4.9), §5 Optimization Models, §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO price execution or incentive enforcement (§7.1, §7.9)
// - All outputs are non-binding recommendations only (§7.2)
// - All structures are design-time specification artifacts only
// - Market neutrality required — no favoring specific users/fleets (§7.4)

/** Pricing model status per MOD-018 §4.1 */
export enum PricingModelStatus {
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
}

/** Incentive type per MOD-018 §4.2 */
export enum IncentiveType {
  BONUS = 'BONUS',
  PRIORITY = 'PRIORITY',
  DISCOUNT = 'DISCOUNT',
  REWARD = 'REWARD',
  LOYALTY = 'LOYALTY',
}

/** Incentive status per MOD-018 §4.2 */
export enum IncentiveStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/** Market signal type per MOD-018 §4.3 */
export enum MarketSignalType {
  DEMAND_SPIKE = 'DEMAND_SPIKE',
  SUPPLY_SHORTAGE = 'SUPPLY_SHORTAGE',
  IMBALANCE = 'IMBALANCE',
  PRICE_TREND = 'PRICE_TREND',
  CORRIDOR_UNDERPERFORMANCE = 'CORRIDOR_UNDERPERFORMANCE',
}

/** Recommendation type per MOD-018 §4.4 */
export enum RecommendationType {
  PRICING = 'PRICING',
  INCENTIVE = 'INCENTIVE',
  ALLOCATION = 'ALLOCATION',
  PROMOTIONAL = 'PROMOTIONAL',
}

/** Campaign type per MOD-018 §4.5 */
export enum CampaignType {
  DISCOUNT = 'DISCOUNT',
  BONUS = 'BONUS',
  AWARENESS = 'AWARENESS',
  LOYALTY = 'LOYALTY',
}

/** Campaign status per MOD-018 §4.5 */
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Fee type per MOD-018 §4.6 */
export enum FeeType {
  PLATFORM_COMMISSION = 'PLATFORM_COMMISSION',
  SERVICE_FEE = 'SERVICE_FEE',
  CORRIDOR_FEE = 'CORRIDOR_FEE',
}

/** Fee basis for fee structures per MOD-018 §4.6 */
export enum FeeBasis {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

/** Fee status per MOD-018 §4.6 */
export enum FeeStatus {
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
}

/** A/B experiment type per MOD-018 §4.7 */
export enum ExperimentType {
  PRICING = 'PRICING',
  INCENTIVE = 'INCENTIVE',
  UI = 'UI',
  ALGORITHM = 'ALGORITHM',
}

/** A/B experiment status per MOD-018 §4.7 */
export enum ExperimentStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ABORTED = 'ABORTED',
}

/** Carrier retention risk level per MOD-018 §4.8 */
export enum RetentionRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/** Demand forecast type per MOD-018 §4.9 */
export enum ForecastType {
  CORRIDOR = 'CORRIDOR',
  CARGO_TYPE = 'CARGO_TYPE',
  SEASONAL = 'SEASONAL',
}
