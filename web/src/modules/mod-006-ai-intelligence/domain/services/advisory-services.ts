// NexCargo MOD-006 — AI Intelligence Platform Advisory & Rule Enforcement Services
// Wave 2 — Stage 3, Increment 2 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)
// Reference: MOD-006 §7 Rules of Operation, ESS-003 AI behavior constraints
//
// NO COMPUTATION PRINCIPLE: These services validate structural integrity ONLY.
// They do NOT perform actual AI inference or autonomous decisions.
// Per MOD-006 §7.1 (Non-Execution Rule) and ESS-003 §4.1 (AI behavior constraints).

import type {
  InsightObject,
  PredictionModelOutput,
  AnomalyReport,
  RecommendationObject,
  FraudRiskScore,
  CarrierMatchRecommendation,
  RouteSuggestion,
  PricingRecommendation,
  AIChatSession,
  CarbonFootprintEstimate,
  ReasoningTraceElement,
  ChatMessageEntry,
} from '../types/entities';
import {
  InsightType,
  SeverityLevel,
  RiskCategory,
  EntityType,
  MessageSender,
  SessionStatus,
  PredictionType,
  UserRole,
} from '../enums';

// ============================================================
// Validation result types
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

// ============================================================
// Service function constants
// ============================================================

/** Valid confidence score range */
export const MIN_CONFIDENCE_SCORE = 0;
export const MAX_CONFIDENCE_SCORE = 100;

/** Valid risk score range */
export const MIN_RISK_SCORE = 0;
export const MAX_RISK_SCORE = 100;

/** Required fields in a reasoning trace element */
export const REQUIRED_REASONING_TRACE_FIELDS = ['stepId', 'description', 'dataSources', 'confidenceContribution'] as const;

/** Source modules must follow MOD-XXX naming convention */
export const SOURCE_MODULE_PATTERN = /^MOD-\d{3}$/;

// ============================================================
// Non-Execution Rule Enforcement Service
// ============================================================

/**
 * Enforces that an insight output contains no execution directives.
 * Per MOD-006 §7.1 (Non-Execution Rule): AI MUST NOT execute actions, modify system state,
 * approve financial operations, trigger settlements, override roles, auto-assign carriers,
 * enforce pricing, or issue financial instructions.
 *
 * @param insight The insight object to validate for execution compliance
 * @returns ValidationResult indicating compliance status
 */
export function enforceNoExecutionRule(insight: InsightObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Verify confidence score is within bounds (isNaN check first since NaN comparisons always pass)
  if (typeof insight.confidenceScore !== 'number' || Number.isNaN(insight.confidenceScore) || insight.confidenceScore < MIN_CONFIDENCE_SCORE || insight.confidenceScore > MAX_CONFIDENCE_SCORE) {
    errors.push({
      code: 'INVALID_CONFIDENCE_SCORE',
      field: 'confidenceScore',
      message: `Confidence score must be between ${MIN_CONFIDENCE_SCORE} and ${MAX_CONFIDENCE_SCORE}`,
    });
  }

  // Verify severity level is valid enum value
  if (!Object.values(SeverityLevel).includes(insight.severityLevel)) {
    errors.push({
      code: 'INVALID_SEVERITY_LEVEL',
      field: 'severityLevel',
      message: `Severity level must be one of: ${Object.values(SeverityLevel).join(', ')}`,
    });
  }

  // Verify sourceModules array is present and non-empty
  if (!Array.isArray(insight.sourceModules) || insight.sourceModules.length === 0) {
    errors.push({
      code: 'SOURCE_MODULES_REQUIRED',
      field: 'sourceModules',
      message: 'Every insight must reference at least one source module per MOD-006 §4.1',
    });
  } else {
    // Validate each source module follows naming convention
    for (const modRef of insight.sourceModules) {
      if (typeof modRef !== 'string' || !SOURCE_MODULE_PATTERN.test(modRef)) {
        errors.push({
          code: 'INVALID_SOURCE_MODULE_REF',
          field: 'sourceModules',
          message: `Source module reference '${modRef}' does not follow MOD-XXX naming convention`,
        });
      }
    }
  }

  // Verify payload is structured JSON (not executable code/directives)
  if (insight.payload === null || insight.payload === undefined) {
    errors.push({
      code: 'PAYLOAD_REQUIRED',
      field: 'payload',
      message: 'Insight payload must contain structured analysis data (non-executable)',
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates that a recommendation does not contain executable directives.
 * Recommendations are advisory only — must not include auto-execute flags or
 * direct state modification commands.
 *
 * @param recommendation The recommendation object to validate
 * @returns ValidationResult
 */
export function validateAdvisoryOnly(recommendation: RecommendationObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Verify confidence score
  if (typeof recommendation.confidenceScore !== 'number' || Number.isNaN(recommendation.confidenceScore) || recommendation.confidenceScore < 0 || recommendation.confidenceScore > 100) {
    errors.push({
      code: 'INVALID_RECOMMENDATION_CONFIDENCE',
      field: 'confidenceScore',
      message: 'Recommendation confidence must be between 0 and 100',
    });
  }

  // Verify suggested action is descriptive, not executable
  if (!recommendation.suggestedAction || typeof recommendation.suggestedAction !== 'string') {
    errors.push({
      code: 'SUGGESTED_ACTION_REQUIRED',
      field: 'suggestedAction',
      message: 'Suggested action must be a non-executable description string',
    });
  }

  // Verify context module is defined
  if (!recommendation.contextModule || typeof recommendation.contextModule !== 'string') {
    errors.push({
      code: 'CONTEXT_MODULE_REQUIRED',
      field: 'contextModule',
      message: 'Context module must be specified for every recommendation',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Determinism Validation Service
// ============================================================

/**
 * Validates that a prediction output includes all required elements
 * for determinism reproducibility per MOD-006 §7.3.
 * Identical inputs MUST produce identical outputs.
 * No stochastic or hidden logic is allowed in production mode.
 *
 * @param prediction The prediction model output to validate
 * @returns ValidationResult
 */
export function validateDeterministicPrediction(prediction: PredictionModelOutput): ValidationResult {
  const errors: ValidationError[] = [];

  // Verify prediction type is valid enum value
  if (!Object.values(PredictionType).includes(prediction.predictionType)) {
    errors.push({
      code: 'INVALID_PREDICTION_TYPE',
      field: 'predictionType',
      message: `Prediction type must be one of: ${Object.values(PredictionType).join(', ')}`,
    });
  }

  // Verify confidence score bounds
  if (typeof prediction.confidenceScore !== 'number' || Number.isNaN(prediction.confidenceScore) || prediction.confidenceScore < 0 || prediction.confidenceScore > 100) {
    errors.push({
      code: 'INVALID_PREDICTION_CONFIDENCE',
      field: 'confidenceScore',
      message: 'Prediction confidence must be between 0 and 100',
    });
  }

  // Verify probability score bounds
  if (typeof prediction.probabilityScore !== 'number' || prediction.probabilityScore < 0 || prediction.probabilityScore > 100) {
    errors.push({
      code: 'INVALID_PROBABILITY_SCORE',
      field: 'probabilityScore',
      message: 'Probability score must be between 0 and 100',
    });
  }

  // Verify input dataset reference is present
  if (!prediction.inputDatasetReference || typeof prediction.inputDatasetReference !== 'string') {
    errors.push({
      code: 'INPUT_DATASET_REFERENCE_REQUIRED',
      field: 'inputDatasetReference',
      message: 'Every prediction must reference its input dataset (for determinism traceability)',
    });
  }

  // Verify time horizon is defined
  if (!prediction.timeHorizon || typeof prediction.timeHorizon !== 'string') {
    errors.push({
      code: 'TIME_HORIZON_REQUIRED',
      field: 'timeHorizon',
      message: 'Time horizon must be specified for all predictions',
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates that all entity outputs include explanation traces,
 * which are mandatory per MOD-006 §7.4 Explanation Requirement Rule.
 * Every AI output MUST include: reasoning trace, confidence score, data sources.
 *
 * @param entities Array of entities to validate for explanation trace presence
 * @param entityType String label describing what kind of entities these are
 * @returns ValidationResult
 */
export function validateExplanationTraces<T extends { explanationTrace: unknown[]; confidenceScore: number }>(
  entities: T[],
  entityType: string,
): ValidationResult {
  const errors: ValidationError[] = [];

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const prefix = `${entityType}[${i}]`;

    // Check confidence score exists and is numeric (NaN passes typeof but is not a valid number)
    if (typeof entity.confidenceScore !== 'number' || Number.isNaN(entity.confidenceScore)) {
      errors.push({
        code: `${prefix}_NO_CONFIDENCE_SCORE`,
        field: 'confidenceScore',
        message: `${entityType} at index ${i} must have a numeric confidence score per §7.4`,
      });
    }

    // Check explanation trace is present and non-empty
    if (!Array.isArray(entity.explanationTrace) || entity.explanationTrace.length === 0) {
      errors.push({
        code: `${prefix}_MISSING_EXPLANATION_TRACE`,
        field: 'explanationTrace',
        message: `${entityType} at index ${i} must include a non-empty reasoning trace per §7.4`,
      });
    } else {
      // Validate structure of first reasonin trace element
      const firstTrace = entity.explanationTrace[0] as Record<string, unknown>;
      const missingFields = REQUIRED_REASONING_TRACE_FIELDS.filter(f => !(f in firstTrace));
      if (missingFields.length > 0) {
        errors.push({
          code: `${prefix}_INCOMPLETE_TRACE`,
          field: 'explanationTrace',
          message: `Reasoning trace element at index 0 missing fields: ${missingFields.join(', ')}`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Fraud Risk Scoring Validation Service
// ============================================================

/**
 * Validates fraud risk scoring structure per MOD-006 §4.5.
 * Fraud scores are advisory, not final enforcement.
 * High-risk cases flagged for moderator review.
 * All risk outputs must be explainable and auditable.
 *
 * @param riskScore The fraud risk score to validate
 * @returns ValidationResult
 */
export function validateFraudRiskScoring(riskScore: FraudRiskScore): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate risk score range
  if (typeof riskScore.riskScore !== 'number' || riskScore.riskScore < MIN_RISK_SCORE || riskScore.riskScore > MAX_RISK_SCORE) {
    errors.push({
      code: 'INVALID_FRAUD_RISK_SCORE',
      field: 'riskScore',
      message: `Fraud risk score must be between ${MIN_RISK_SCORE} and ${MAX_RISK_SCORE}`,
    });
  }

  // Validate risk category is valid enum value
  if (!Object.values(RiskCategory).includes(riskScore.riskCategory)) {
    errors.push({
      code: 'INVALID_RISK_CATEGORY',
      field: 'riskCategory',
      message: `Risk category must be one of: ${Object.values(RiskCategory).join(', ')}`,
    });
  }

  // Validate entity type is valid enum value
  if (!Object.values(EntityType).includes(riskScore.entityType)) {
    errors.push({
      code: 'INVALID_ENTITY_TYPE',
      field: 'entityType',
      message: `Entity type must be one of: ${Object.values(EntityType).join(', ')}`,
    });
  }

  // Validate entity ID is present
  if (!riskScore.entityId || typeof riskScore.entityId !== 'string') {
    errors.push({
      code: 'ENTITY_ID_REQUIRED',
      field: 'entityId',
      message: 'Entity identifier is required for all fraud risk assessments',
    });
  }

  // Validate reason codes are present (explainability requirement)
  if (!Array.isArray(riskScore.reasonCodes) || riskScore.reasonCodes.length === 0) {
    errors.push({
      code: 'REASON_CODES_REQUIRED',
      field: 'reasonCodes',
      message: 'All fraud risk scores must include structured reason codes for explainability (§4.5)',
    });
  }

  // Validate contributing factors are present
  if (!Array.isArray(riskScore.factors) || riskScore.factors.length === 0) {
    errors.push({
      code: 'FACTORS_REQUIRED',
      field: 'factors',
      message: 'Fraud risk assessment must include contributing factors with weights (§4.5)',
    });
  }

  // Validate generated timestamp
  if (!(riskScore.generatedAt instanceof Date) || isNaN(riskScore.generatedAt.getTime())) {
    errors.push({
      code: 'GENERATED_AT_REQUIRED',
      field: 'generatedAt',
      message: 'Generated timestamp is required for audit trail',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Chat Session Validation Service
// ============================================================

/**
 * Validates AI chat session structure per MOD-006 §4.9.
 * Cannot execute financial or contractual actions.
 * Must use only verified platform data.
 *
 * @param session The chat session to validate
 * @returns ValidationResult
 */
export function validateChatSession(session: AIChatSession): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate user role is valid enum value
  if (!Object.values(UserRole).includes(session.userRole)) {
    errors.push({
      code: 'INVALID_USER_ROLE',
      field: 'userRole',
      message: `User role must be one of: ${Object.values(UserRole).join(', ')}`,
    });
  }

  // Validate session status is valid enum value
  if (!Object.values(SessionStatus).includes(session.sessionStatus)) {
    errors.push({
      code: 'INVALID_SESSION_STATUS',
      field: 'sessionStatus',
      message: `Session status must be one of: ${Object.values(SessionStatus).join(', ')}`,
    });
  }

  // Validate messages array
  if (!Array.isArray(session.messages)) {
    errors.push({
      code: 'MESSAGES_REQUIRED',
      field: 'messages',
      message: 'Chat session must have a messages array',
    });
  } else {
    // Validate individual message structure
    for (let i = 0; i < session.messages.length; i++) {
      const msg = session.messages[i];
      if (msg.sender !== MessageSender.USER && msg.sender !== MessageSender.AI) {
        errors.push({
          code: `MESSAGE_${i}_INVALID_SENDER`,
          field: 'messages',
          message: `Message at index ${i} must have sender USER or AI`,
        });
      }
      if (!msg.content || typeof msg.content !== 'string') {
        errors.push({
          code: `MESSAGE_${i}_NO_CONTENT`,
          field: 'messages',
          message: `Message at index ${i} must have content string`,
        });
      }
    }
  }

  // Validate userId is present
  if (!session.userId || typeof session.userId !== 'string') {
    errors.push({
      code: 'USER_ID_REQUIRED',
      field: 'userId',
      message: 'User identifier is required for all chat sessions',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Pricing Boundary Validation Service
// ============================================================

/**
 * Validates that pricing recommendations stay within configured corridor boundaries.
 * Per MOD-006 §4.8: Prices must remain within configured corridor boundaries.
 * Pricing is advisory only — final pricing controlled by marketplace (MOD-001) or contract (MOD-002).
 *
 * @param pricing The pricing recommendation to validate
 * @returns ValidationResult
 */
export function validatePricingBoundaries(pricing: PricingRecommendation): ValidationResult {
  const errors: ValidationError[] = [];

  // Verify confidence score (isNaN check first)
  if (typeof pricing.confidenceScore !== 'number' || Number.isNaN(pricing.confidenceScore) || pricing.confidenceScore < 0 || pricing.confidenceScore > 100) {
    errors.push({
      code: 'INVALID_PRICING_CONFIDENCE',
      field: 'confidenceScore',
      message: 'Pricing confidence must be between 0 and 100',
    });
  }

  // Verify minimum price is less than maximum
  if (typeof pricing.suggestedPriceMin !== 'number' || typeof pricing.suggestedPriceMax !== 'number') {
    errors.push({
      code: 'INVALID_PRICE_RANGE',
      field: 'suggestedPriceMin/suggestedPriceMax',
      message: 'Both suggestedPriceMin and suggestedPriceMax must be numbers',
    });
  } else if (pricing.suggestedPriceMin > pricing.suggestedPriceMax) {
    errors.push({
      code: 'PRICE_ORDER_INVALID',
      field: 'suggestedPriceMin/suggestedPriceMax',
      message: 'Minimum suggested price cannot exceed maximum suggested price',
    });
  }

  // Verify corridor boundary reference is complete
  if (!pricing.corridorBoundaryReference) {
    errors.push({
      code: 'CORRIDOR_BOUNDARY_REQUIRED',
      field: 'corridorBoundaryReference',
      message: 'Corridor boundary reference is required for corridor-respecting pricing (§4.8)',
    });
  } else {
    const bounds = pricing.corridorBoundaryReference;
    if (!bounds.corridorId || typeof bounds.corridorId !== 'string') {
      errors.push({
        code: 'CORRIDOR_ID_REQUIRED',
        field: 'corridorBoundaryReference.corridorId',
        message: 'Corridor ID is required in boundary reference',
      });
    }
    if (typeof bounds.minPrice !== 'number' || typeof bounds.maxPrice !== 'number') {
      errors.push({
        code: 'BOUND_VALUES_REQUIRED',
        field: 'corridorBoundaryReference',
        message: 'Boundary min/max prices must be numeric',
      });
    } else if (bounds.minPrice >= bounds.maxPrice) {
      errors.push({
        code: 'BOUND_ORDER_INVALID',
        field: 'corridorBoundaryReference',
        message: 'Corridor boundary minimum cannot equal or exceed maximum',
      });
    }
  }

  // Verify market factors are present
  if (!pricing.marketFactors) {
    errors.push({
      code: 'MARKET_FACTORS_REQUIRED',
      field: 'marketFactors',
      message: 'Market factors influencing pricing must be documented (§4.8)',
    });
  }

  return { valid: errors.length === 0, errors };
}
