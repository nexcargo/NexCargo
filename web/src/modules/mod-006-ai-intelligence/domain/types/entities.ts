// NexCargo MOD-006 — AI Intelligence Platform Module Domain Types
// Wave 2 — Stage 3, Increment 2 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)
// Reference: MOD-006 §4 Core Domain Entities (§§4.1–§4.10), §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO actual AI inference or autonomous decision execution
// - All structures are design-time specification artifacts only
// - Every output requires reasoning trace + confidence score (MOD-006 §7.4)
// - Advisory outputs only; AI MUST NOT execute actions (MOD-006 §7.1)

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type { InsightType, PredictionType, AnomalyType, SeverityLevel, RecommendationType, EntityType, RiskCategory, UserRole, SessionStatus, MessageSender } from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Structured JSON payload for intelligence analysis output per MOD-006 §4.1 */
export interface IntelligencePayload {
  /** Arbitrary structured JSON analysis result */
  [key: string]: unknown;
}

/** Reasoning trace element — required for every AI output per MOD-006 §7.4 */
export interface ReasoningTraceElement {
  /** Step identifier in the reasoning chain */
  stepId: string;
  /** Human-readable reasoning description */
  description: string;
  /** Data sources cited for this step */
  dataSources: string[];
  /** Confidence contribution of this step (0–100) */
  confidenceContribution: number;
}

/** Contributing factor for fraud risk scoring per MOD-006 §4.5 */
export interface RiskFactor {
  /** Factor name/description */
  name: string;
  /** Weight applied to this factor */
  weight: number;
  /** Raw value that triggered the factor */
  rawValue: unknown;
  /** Direction of influence: INCREASES_RISK | DECREASES_RISK | NEUTRAL */
  direction: 'INCREASES_RISK' | 'DECREASES_RISK' | 'NEUTRAL';
}

/** Ranked carrier entry within a match recommendation per MOD-006 §4.6 */
export interface RankedCarrierEntry {
  /** Transporter identifier reference */
  transporterId: string;
  /** Match score 0–100 */
  matchScore: number;
  /** Individual factor scores contributing to match */
  matchFactors: { name: string; score: number }[];
}

/** Alternative recommendation entry per MOD-006 §4.4 */
export interface AlternativeRecommendation {
  /** Alternative suggestion description */
  description: string;
  /** Relative priority vs primary recommendation */
  priority: number;
  /** Trade-offs and considerations */
  tradeOffs: string[];
}

/** Chat message entry per MOD-006 §4.9 */
export interface ChatMessageEntry {
  /** Unique message identifier */
  messageId: string;
  /** Sender of the message */
  sender: MessageSender;
  /** Message content */
  content: string;
  /** Timestamp of the message */
  timestamp: Date;
  /** Optional context reference (shipment ID, contract ID, etc.) */
  context?: Record<string, string>;
}

/** Corridor boundary reference for pricing per MOD-006 §4.8 */
export interface CorridorBoundaryReference {
  /** Corridor identifier */
  corridorId: string;
  /** Minimum allowed price */
  minPrice: number;
  /** Maximum allowed price */
  maxPrice: number;
  /** Currency code */
  currency: string;
}

/** Market factors influencing pricing per MOD-006 §4.8 */
export interface MarketFactors {
  /** Supply-demand balance indicator (-1 to +1) */
  supplyDemandBalance: number;
  /** Route complexity factor (1–10) */
  routeComplexity: number;
  /** Fuel cost adjustment factor */
  fuelCostAdjustment: number;
  /** Seasonal demand multiplier */
  seasonalMultiplier: number;
}

/** Border crossing detail per MOD-006 §4.7 */
export interface BorderCrossingDetail {
  /** Border post identifier */
  borderPostId: string;
  /** Estimated delay in minutes */
  estimatedDelayMinutes: number;
  /** Required documentation */
  requiredDocuments: string[];
}

/** GLEC/IPCC methodology reference for carbon calculation per MOD-006 §4.10 */
export interface CarbonCalculationMethodology {
  /** Standard/method used (e.g., "GLEC v2", "IPCC 2023") */
  standard: string;
  /** Version of the standard */
  version: string;
  /** Emission factor reference table */
  emissionFactors: Record<string, number>;
}

// ============================================================
// Entity types (extend BaseEntity with snake_case fields)
// Per BaseEntity: id, created_at, updated_at, version, bumpVersion(), toJSON()
// ============================================================

/**
 * Insight Object — generated analytical output.
 * Per MOD-006 §4.1
 * Every insight MUST include reasoning trace, confidence score, and data sources per §7.4.
 */
export interface InsightObject extends BaseEntity {
  /** Unique identifier for this insight */
  insightId: string;
  /** Classification: PREDICTION | ANOMALY | RECOMMENDATION | RISK_SCORE | FORECAST */
  insightType: InsightType;
  /** Source modules referenced in generating this insight */
  sourceModules: string[];
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Timestamp of insight generation */
  generatedAt: Date;
  /** Structured analysis output payload */
  payload: IntelligencePayload;
  /** Severity classification */
  severityLevel: SeverityLevel;
  /** Structured reasoning trace (required for all outputs per §7.4) */
  explanationTrace: ReasoningTraceElement[];
}

/**
 * Prediction Model Output — forecasted system behavior structure.
 * Per MOD-006 §4.2
 * Predictions must be reproducible given identical inputs (determinism rule §7.3).
 */
export interface PredictionModelOutput extends BaseEntity {
  /** Unique identifier for this prediction */
  predictionId: string;
  /** Type: ETA | DELAY_PROBABILITY | DEMAND_FORECAST | CAPACITY_FORECAST */
  predictionType: PredictionType;
  /** Reference to input dataset used (from MOD-012) */
  inputDatasetReference: string;
  /** The predicted outcome value/description */
  predictedOutcome: unknown;
  /** Probability/score associated with this prediction (0–100) */
  probabilityScore: number;
  /** Time horizon covered by this prediction */
  timeHorizon: string;
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Explanation trace for transparency */
  explanationTrace: ReasoningTraceElement[];
}

/**
 * Anomaly Report — detected irregular system behavior structure.
 * Per MOD-006 §4.3
 * Anomaly detection is advisory only; does not trigger autonomous enforcement.
 */
export interface AnomalyReport extends BaseEntity {
  /** Unique identifier for this anomaly report */
  anomalyId: string;
  /** Type: ROUTE_DEVIATION | TIMING_ANOMALY | PAYMENT_PATTERN | DOCUMENT_IRREGULARITY | BEHAVIORAL */
  anomalyType: AnomalyType;
  /** Module where the anomaly was detected */
  affectedModule: string;
  /** Detection method or algorithm reference */
  detectionMethod: string;
  /** Severity of the detected anomaly */
  severity: SeverityLevel;
  /** References to evidence supporting the detection */
  evidenceReferences: string[];
  /** Risk score 0–100 */
  riskScore: number;
  /** Explanation trace documenting how the anomaly was identified */
  explanationTrace: ReasoningTraceElement[];
}

/**
 * Recommendation Object — AI advisory output structure.
 * Per MOD-006 §4.4
 * Recommendations are non-executable descriptions requiring human approval.
 * Must include confidence score and reasoning trace per §7.4.
 */
export interface RecommendationObject extends BaseEntity {
  /** Unique identifier for this recommendation */
  recommendationId: string;
  /** Module context this recommendation applies to */
  contextModule: string;
  /** Type: CARRIER_MATCH | ROUTE_OPTIMIZATION | PRICING | DISPATCH | RISK_MITIGATION */
  recommendationType: RecommendationType;
  /** Non-executable suggested action description */
  suggestedAction: string;
  /** Expected impact if the recommendation is adopted */
  expectedImpact: string;
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Optional ranked alternative suggestions */
  alternatives: AlternativeRecommendation[];
  /** Explanation trace for transparency */
  explanationTrace: ReasoningTraceElement[];
}

/**
 * Fraud Risk Score — risk assessment structure for user/shipment/payment/contract.
 * Per MOD-006 §4.5
 * Fraud score is advisory, not final enforcement. High-risk cases flagged for moderator review.
 * Cannot block users automatically unless policy rules apply externally.
 * All risk outputs are logged for audit.
 */
export interface FraudRiskScore extends BaseEntity {
  /** Unique identifier for this risk assessment */
  riskId: string;
  /** Entity being assessed: USER | SHIPMENT | PAYMENT | CONTRACT */
  entityType: EntityType;
  /** Identifier of the assessed entity */
  entityId: string;
  /** Overall risk score 0–100 */
  riskScore: number;
  /** Risk category based on score thresholds */
  riskCategory: RiskCategory;
  /** Structured reason codes explaining the score */
  reasonCodes: string[];
  /** Contributing factors with weights */
  factors: RiskFactor[];
  /** Timestamp of risk assessment generation */
  generatedAt: Date;
  /** Explanation trace documenting how the risk was computed */
  explanationTrace: ReasoningTraceElement[];
}

/**
 * Carrier Match Recommendation — ranked list of transporters for a shipment.
 * Per MOD-006 §4.6
 * AI does NOT auto-assign carriers. Recommendations require user approval.
 * Verified carriers are prioritized. Poor performers are downranked.
 * Outputs are reproducible given identical inputs (determinism rule).
 */
export interface CarrierMatchRecommendation extends BaseEntity {
  /** Unique identifier for this match recommendation */
  matchId: string;
  /** Listing/shipment reference for which carriers are recommended */
  listingId: string;
  /** Rank-caried carrier entries ordered by best match first */
  rankedCarriers: RankedCarrierEntry[];
  /** Confidence in the matching quality 0–100 */
  confidenceScore: number;
  /** Structured reasoning trace summarizing why carriers were ranked */
  explanationSummary: ReasoningTraceElement[];
}

/**
 * Route Suggestion — optimized route recommendation structure.
 * Per MOD-006 §4.7
 * Represents an optimized route recommendation (not execution).
 * Must respect legal road networks, consider border delays, factor fuel efficiency.
 */
export interface RouteSuggestion extends BaseEntity {
  /** Unique identifier for this route suggestion */
  routeId: string;
  /** Shipment this route applies to */
  shipmentId: string;
  /** Origin location */
  origin: string;
  /** Destination location */
  destination: string;
  /** Optional intermediate stops */
  waypoints: string[];
  /** Estimated total distance in km */
  estimatedDistance: number;
  /** Estimated total duration in hours */
  estimatedDuration: number;
  /** Fuel efficiency estimate in liters per 100km or equivalent */
  fuelEfficiencyEstimate: number;
  /** Border crossings with estimated delays */
  borderCrossings: BorderCrossingDetail[];
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Ranked alternative routes */
  alternatives: AlternativeRecommendation[];
  /** Explanation trace for the route optimization */
  explanationTrace: ReasoningTraceElement[];
}

/**
 * Pricing Recommendation — AI-generated advisory price range structure.
 * Per MOD-006 §4.8
 * Pricing is advisory only. Final pricing controlled by marketplace negotiation (MOD-001) or contract (MOD-002).
 * Prices must remain within configured corridor boundaries.
 * Must avoid predatory or unfair pricing patterns.
 */
export interface PricingRecommendation extends BaseEntity {
  /** Unique identifier for this pricing recommendation */
  pricingId: string;
  /** Listing reference for which pricing is recommended */
  listingId: string;
  /** Suggested minimum price */
  suggestedPriceMin: number;
  /** Suggested maximum price */
  suggestedPriceMax: number;
  /** Confidence score 0–100 */
  confidenceScore: number;
  /** Market factors that influenced this recommendation */
  marketFactors: MarketFactors;
  /** Configured corridor pricing limits for validation */
  corridorBoundaryReference: CorridorBoundaryReference;
  /** Timestamp when this pricing was generated */
  generatedAt: Date;
  /** Explanation trace documenting pricing logic */
  explanationTrace: ReasoningTraceElement[];
}

/**
 * AI Chat Assistant Session — conversational interaction structure.
 * Per MOD-006 §4.9
 * Can provide guidance/status/recommendations but MUST NOT execute financial/contractual actions.
 * Must use only verified platform data. Responses consistent with system state.
 */
export interface AIChatSession extends BaseEntity {
  /** Unique session identifier */
  sessionId: string;
  /** User initiating the chat */
  userId: string;
  /** User role for access control and context */
  userRole: UserRole;
  /** Message history array */
  messages: ChatMessageEntry[];
  /** Current session status */
  sessionStatus: SessionStatus;
  /** Context reference to related shipment/contract/entity */
  context?: Record<string, string>;
}

/**
 * Carbon Footprint Estimate — CO₂ emissions calculation structure.
 * Per MOD-006 §4.10
 * Results informational only. Calculations consistent and reproducible.
 */
export interface CarbonFootprintEstimate extends BaseEntity {
  /** Unique identifier for this estimate */
  estimateId: string;
  /** Associated shipment */
  shipmentId: string;
  /** Distance traveled in kilometers */
  distance: number;
  /** Cargo weight in kilograms */
  cargoWeight: number;
  /** Vehicle type affecting emissions */
  vehicleType: string;
  /** Estimated CO₂ equivalent in kg */
  estimatedCO2e: number;
  /** Methodology standard used for calculation */
  calculationMethod: CarbonCalculationMethodology;
  /** Timestamp of estimation */
  generatedAt: Date;
}
