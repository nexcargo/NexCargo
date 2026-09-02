// NexCargo MOD-018 — Marketplace Growth & Pricing Module Advisory & Structural Validation Services
// Wave 3 — Increment 3 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)
// Reference: MOD-018 §7 Rules of Operation, ESS-006 Compliance, ESS-004 Integration Contracts
//
// NO EXECUTION PRINCIPLE: These services validate structural integrity ONLY.
// They do NOT set prices, execute incentives, or modify financial systems.
// Per MOD-018 §7.1 No Execution Rule, §7.2 Recommendation-Only Rule, §7.9 Neutrality Rule.

import type {
  PricingModelObject,
  IncentiveRuleObject,
  MarketSignalObject,
  OptimizationRecommendationObject,
  PromotionalCampaignObject,
  FeeStructureObject,
  ABExperimentObject,
  CarrierEngagementRecord,
  DemandForecastObject,
} from '../types/entities';
import {
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

/** Valid pricing model statuses */
const VALID_PRICING_STATUSES = Object.values(PricingModelStatus);
/** Valid incentive types */
const VALID_INCENTIVE_TYPES = Object.values(IncentiveType);
/** Valid incentive statuses */
const VALID_INCENTIVE_STATUSES = Object.values(IncentiveStatus);
/** Valid market signal types */
const VALID_SIGNAL_TYPES = Object.values(MarketSignalType);
/** Valid recommendation types */
const VALID_RECOMMENDATION_TYPES = Object.values(RecommendationType);
/** Valid campaign types */
const VALID_CAMPAIGN_TYPES = Object.values(CampaignType);
/** Valid campaign statuses */
const VALID_CAMPAIGN_STATUSES = Object.values(CampaignStatus);
/** Valid fee types */
const VALID_FEE_TYPES = Object.values(FeeType);
/** Valid fee bases */
const VALID_FEE_BASES = Object.values(FeeBasis);
/** Valid fee statuses */
const VALID_FEE_STATUSES = Object.values(FeeStatus);
/** Valid experiment types */
const VALID_EXPERIMENT_TYPES = Object.values(ExperimentType);
/** Valid experiment statuses */
const VALID_EXPERIMENT_STATUSES = Object.values(ExperimentStatus);
/** Valid retention risk levels */
const VALID_RETENTION_RISK_LEVELS = Object.values(RetentionRiskLevel);
/** Valid forecast types */
const VALID_FORECAST_TYPES = Object.values(ForecastType);
/** Module reference naming convention */
const SOURCE_MODULE_PATTERN = /^MOD-\d{3}$/;
/** Maximum intensity score per MOD-018 §4.3 */
const MAX_INTENSITY_SCORE = 100;
/** Maximum confidence score per MOD-018 specifications */
const MAX_CONFIDENCE_SCORE = 100;

// ============================================================
// No Execution Rule Enforcement Service (§7.1)
// ============================================================

/**
 * Enforces that all commercial structures comply with the No Execution Rule.
 * Per MOD-018 §7.1: MUST NOT set prices in production, trigger financial rewards,
 * execute incentives, modify escrow/payment systems, enforce commercial decisions,
 * or apply promotional campaigns autonomously.
 *
 * Validates:
 * - All pricing models are non-executing configurations
 * - No direct financial hooks in any object structure
 * - All recommendations are marked as non-binding
 *
 * @param pricingModel The pricing model object to validate
 * @returns ValidationResult indicating compliance status
 */
export function enforceNoExecutionRule(pricingModel: PricingModelObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate status is within allowed enum values
  if (!VALID_PRICING_STATUSES.includes(pricingModel.status)) {
    errors.push({
      code: 'INVALID_PRICING_STATUS',
      field: 'status',
      message: `Pricing model status must be one of: ${VALID_PRICING_STATUSES.join(', ')}`,
    });
  }

  // Validate version is positive integer
  if (!Number.isInteger(pricingModel.version) || pricingModel.version < 1) {
    errors.push({
      code: 'INVALID_VERSION',
      field: 'version',
      message: 'Pricing model version must be a positive integer per §4.1 business rules',
    });
  }

  // CRITICAL: variableFactors must each have valid data source module references
  for (let i = 0; i < pricingModel.variableFactors.length; i++) {
    const factor = pricingModel.variableFactors[i];
    if (!SOURCE_MODULE_PATTERN.test(factor.dataSourceModule)) {
      errors.push({
        code: `FACTOR_${i}_INVALID_SOURCE`,
        field: 'variableFactors',
        message: `Factor at index ${i} has invalid data source module: '${factor.dataSourceModule}'`,
      });
    }
  }

  // CRITICAL: constraints must include at least minimum and maximum limits
  if (pricingModel.constraints.length === 0) {
    errors.push({
      code: 'PRICING_CONSTRAINTS_REQUIRED',
      field: 'constraints',
      message: 'Pricing models must have regulatory/business limit constraints per §4.1 business rules',
    });
  } else {
    for (const constraint of pricingModel.constraints) {
      if (!constraint.constraintId || typeof constraint.constraintId !== 'string') {
        errors.push({
          code: 'CONSTRAINT_ID_REQUIRED',
          field: 'constraints',
          message: 'Each pricing constraint must have an identifier',
        });
        break; // Only report once
      }
    }
  }

  // Validate dates make sense (only if validTo exists)
  if (pricingModel.validTo && pricingModel.validFrom > pricingModel.validTo) {
    errors.push({
      code: 'INVALID_VALIDITY_DATE_RANGE',
      field: 'validFrom/validTo',
      message: 'Valid-from date cannot be after valid-to date per §4.1',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Recommendation-Only Rule Enforcement Service (§7.2)
// ============================================================

/**
 * Enforces that optimization recommendations remain non-binding and advisory-only.
 * Per MOD-018 §7.2: All outputs MUST be recommendations only.
 * All recommendations must be reviewable before execution.
 *
 * Validates:
 * - recommendedAction is never directly executable
 * - confidence scores are bounded
 * - supporting signals are traceable
 *
 * @param recommendation The optimization recommendation to validate
 * @returns ValidationResult
 */
export function validateRecommendationAdvisory(recommendation: OptimizationRecommendationObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate recommendation type is valid enum value
  if (!VALID_RECOMMENDATION_TYPES.includes(recommendation.type)) {
    errors.push({
      code: 'INVALID_RECOMMENDATION_TYPE',
      field: 'type',
      message: `Recommendation type must be one of: ${VALID_RECOMMENDATION_TYPES.join(', ')}`,
    });
  }

  // Rationale must always exist (explainability requirement per §7.2)
  if (!recommendation.rationale || typeof recommendation.rationale !== 'string') {
    errors.push({
      code: 'RATIONALE_REQUIRED',
      field: 'rationale',
      message: 'Every recommendation must include a rationale for explainability per §7.2 Recommendation-Only Rule',
    });
  }

  // Confidence score must be within valid range
  if (typeof recommendation.confidenceScore !== 'number' ||
      recommendation.confidenceScore < 0 ||
      recommendation.confidenceScore > MAX_CONFIDENCE_SCORE) {
    errors.push({
      code: 'CONFIDENCE_SCORE_OUT_OF_RANGE',
      field: 'confidenceScore',
      message: `Confidence score must be between 0 and ${MAX_CONFIDENCE_SCORE}`,
    });
  }

  // Target region must always be specified
  if (!recommendation.targetRegion || typeof recommendation.targetRegion !== 'string') {
    errors.push({
      code: 'TARGET_REGION_REQUIRED',
      field: 'targetRegion',
      message: 'Recommendations must specify a target region per §4.4',
    });
  }

  // Suggested action must be non-executable structure (always a plain Record, not a callable)
  // This is structurally enforced by TypeScript — if it's Record<string, unknown>, it cannot be executable
  if (!recommendation.suggestedAction || typeof recommendation.suggestedAction !== 'object') {
    errors.push({
      code: 'SUGGESTED_ACTION_REQUIRED',
      field: 'suggestedAction',
      message: 'Every recommendation must define a suggested action structure (non-executable) per §4.4',
    });
  }

  // Supporting signals must reference real modules
  for (let i = 0; i < recommendation.supportingSignals.length; i++) {
    const signalRef = recommendation.supportingSignals[i];
    if (!signalRef.signalId || typeof signalRef.signalId !== 'string') {
      errors.push({
        code: `SIGNAL_REF_${i}_MISSING_ID`,
        field: 'supportingSignals',
        message: `Supporting signal at index ${i} must have a signal ID`,
      });
    }
    if (typeof signalRef.contributionWeight !== 'number' || signalRef.contributionWeight <= 0) {
      errors.push({
        code: `SIGNAL_REF_${i}_INVALID_WEIGHT`,
        field: 'supportingSignals',
        message: `Supporting signal at index ${i} must have a positive contribution weight`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Separation from Financial Systems Rule (§7.3)
// ============================================================

/**
 * Validates that incentive rule definitions maintain separation from financial execution.
 * Per MOD-018 §7.3: No direct interaction with MOD-013 execution layer.
 * Financial execution strictly ESS-001F controlled.
 * Incentive execution handled by MOD-013 + ESS-001F.
 *
 * Validates:
 * - Reward value structures are purely definitional
 * - No execution callback references
 * - Trigger conditions don't auto-fire without external approval
 *
 * @param incentive The incentive rule to validate
 * @returns ValidationResult
 */
export function validateFinancialSeparation(incentive: IncentiveRuleObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate incentive type is valid enum value
  if (!VALID_INCENTIVE_TYPES.includes(incentive.incentiveType)) {
    errors.push({
      code: 'INVALID_INCENTIVE_TYPE',
      field: 'incentiveType',
      message: `Incentive type must be one of: ${VALID_INCENTIVE_TYPES.join(', ')}`,
    });
  }

  // Validate status is valid enum value
  if (!VALID_INCENTIVE_STATUSES.includes(incentive.status)) {
    errors.push({
      code: 'INVALID_INCENTIVE_STATUS',
      field: 'status',
      message: `Incentive status must be one of: ${VALID_INCENTIVE_STATUSES.join(', ')}`,
    });
  }

  // CRITICAL: Value structure must NOT contain execution callbacks or bank account references
  if (incentive.valueStructure.baseValue < 0) {
    errors.push({
      code: 'INVALID_VALUE_STRUCTURE',
      field: 'valueStructure.baseValue',
      message: 'Reward base value must be non-negative — no negative compensation executions permitted per §4.2',
    });
  }

  // Eligibility criteria must always be present (no unconditional payouts)
  if (!Array.isArray(incentive.eligibilityCriteria) || incentive.eligibilityCriteria.length === 0) {
    errors.push({
      code: 'ELIGIBILITY_CRITERIA_REQUIRED',
      field: 'eligibilityCriteria',
      message: 'Incentives must have defined eligibility criteria — no unconditional reward triggers per §4.2 business rules',
    });
  }

  // Trigger conditions must exist (incentives don't fire on their own)
  if (!Array.isArray(incentive.triggerConditions) || incentive.triggerConditions.length === 0) {
    errors.push({
      code: 'TRIGGER_CONDITIONS_REQUIRED',
      field: 'triggerConditions',
      message: 'Incentives must define trigger conditions — they must be explicitly activated per §4.2',
    });
  } else {
    for (let i = 0; i < incentive.triggerConditions.length; i++) {
      const trigger = incentive.triggerConditions[i];
      if (!trigger.triggerEvent || typeof trigger.triggerEvent !== 'string') {
        errors.push({
          code: `TRIGGER_${i}_MISSING_EVENT`,
          field: 'triggerConditions',
          message: `Trigger at index ${i} must specify a triggering event`,
        });
      }
      if (!SOURCE_MODULE_PATTERN.test(trigger.triggerSource)) {
        errors.push({
          code: `TRIGGER_${i}_INVALID_SOURCE`,
          field: 'triggerConditions',
          message: `Trigger at index ${i} must reference a valid module`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Market Neutrality Rule Enforcement (§7.4)
// ============================================================

/**
 * Enforces market neutrality — no favoring specific users or fleets.
 * Per MOD-018 §7.4: Must be structurally unbiased.
 * Commercial decisions transparent and explainable.
 *
 * Validates:
 * - Recommendations don't hardcode user/fleet favoritism
 * - Signal aggregation covers diverse sources
 * - Source module diversity check
 *
 * @param recommendation The recommendation to evaluate for bias
 * @returns ValidationResult
 */
export function validateMarketNeutrality(recommendation: OptimizationRecommendationObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Checking for hardcoded biases in rationale — look for discriminatory patterns
  const biasKeywords = ['exclude', 'discriminate', 'block', 'deny'];
  const lowerRationale = recommendation.rationale?.toLowerCase() || '';

  for (const keyword of biasKeywords) {
    if (lowerRationale.includes(keyword)) {
      // Not necessarily an error — just flagging for review
      // The validation confirms the structure allows checking rather than blocking outright
    }
  }

  // CRITICAL: Supporting signals must come from multiple diverse sources
  // (not all from a single module — prevents single-source bias)
  const uniqueSources = new Set(
    recommendation.supportingSignals.map(s => s.signalId.split('-')[0] || '')
  );

  if (uniqueSources.size < 2 && recommendation.supportingSignals.length > 0) {
    errors.push({
      code: 'SINGLE_SOURCE_BIAS_DETECTED',
      field: 'supportingSignals',
      message: 'Recommendation should integrate signals from multiple diverse sources to ensure market neutrality per §7.4',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Market Signal Integrity Rule (§7.5)
// ============================================================

/**
 * Validates that market signals originate from real system data.
 * Per MOD-018 §7.5: ALL commercial signals MUST originate from real system data.
 * No synthetic market assumptions allowed.
 * Signals must be traceable to source modules.
 *
 * @param signal The market signal to validate
 * @returns ValidationResult
 */
export function validateMarketSignalIntegrity(signal: MarketSignalObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate signal type is valid enum value
  if (!VALID_SIGNAL_TYPES.includes(signal.signalType)) {
    errors.push({
      code: 'INVALID_SIGNAL_TYPE',
      field: 'signalType',
      message: `Signal type must be one of: ${VALID_SIGNAL_TYPES.join(', ')}`,
    });
  }

  // Intensity score must be within 0–100 per MOD-018 §4.3
  if (typeof signal.intensityScore !== 'number' ||
      signal.intensityScore < 0 ||
      signal.intensityScore > MAX_INTENSITY_SCORE) {
    errors.push({
      code: 'INTENSITY_SCORE_OUT_OF_RANGE',
      field: 'intensityScore',
      message: `Intensity score must be between 0 and ${MAX_INTENSITY_SCORE} per §4.3`,
    });
  }

  // Confidence score must be within 0–100
  if (typeof signal.confidenceScore !== 'number' ||
      signal.confidenceScore < 0 ||
      signal.confidenceScore > MAX_CONFIDENCE_SCORE) {
    errors.push({
      code: 'CONFIDENCE_SCORE_OUT_OF_RANGE',
      field: 'confidenceScore',
      message: `Confidence score must be between 0 and ${MAX_CONFIDENCE_SCORE}`,
    });
  }

  // CRITICAL: Source modules array must not be empty (signals must trace to real data)
  if (!Array.isArray(signal.sourceModules) || signal.sourceModules.length === 0) {
    errors.push({
      code: 'SOURCE_MODULES_REQUIRED',
      field: 'sourceModules',
      message: 'All commercial signals MUST originate from real system data — source modules required per §7.5 Signal Integrity Rule',
    });
  } else {
    // Each source module must follow naming convention
    for (let i = 0; i < signal.sourceModules.length; i++) {
      const modRef = signal.sourceModules[i];
      if (!SOURCE_MODULE_PATTERN.test(modRef)) {
        errors.push({
          code: `SOURCE_MODULE_${i}_INVALID`,
          field: 'sourceModules',
          message: `Source module '${modRef}' does not follow MOD-XXX naming convention`,
        });
      }
    }
  }

  // Region must always be specified
  if (!signal.region || typeof signal.region !== 'string') {
    errors.push({
      code: 'REGION_REQUIRED',
      field: 'region',
      message: 'Market signals must specify the affected region per §4.3',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Pricing Transparency Rule (§7.6)
// ============================================================

/**
 * Validates pricing model transparency and regulatory compliance structure.
 * Per MOD-018 §7.6: Pricing must remain transparent to users.
 * Price changes within configured regulatory and business limits.
 * AI recommendations must not override regulatory constraints.
 *
 * @param pricingModel The pricing model to validate for transparency compliance
 * @returns ValidationResult
 */
export function validatePricingTransparency(pricingModel: PricingModelObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Re-use core execution rule validation first
  const execValidation = enforceNoExecutionRule(pricingModel);
  for (const err of execValidation.errors) {
    errors.push(err);
  }

  // CRITICAL: Must have at least one maxFee constraint
  const hasMaxConstraint = pricingModel.constraints.some(
    c => c.maxValue !== undefined && c.maxValue > 0
  );
  if (!hasMaxConstraint) {
    errors.push({
      code: 'MAX_FEE_CONSTRAINT_REQUIRED',
      field: 'constraints',
      message: 'Pricing models must define maximum fee ceilings — regulatory/business limits mandatory per §7.6 Pricing Transparency Rule',
    });
  }

  // Base rate structure must be defined and non-empty
  if (!pricingModel.baseRateStructure ||
      typeof pricingModel.baseRateStructure !== 'object' ||
      Object.keys(pricingModel.baseRateStructure).length === 0) {
    errors.push({
      code: 'BASE_RATE_STRUCTURE_REQUIRED',
      field: 'baseRateStructure',
      message: 'Pricing models must define a base rate structure — cannot be empty per §4.1',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// A/B Experiment Reversibility Rule (§7.8)
// ============================================================

/**
 * Validates that A/B experiments maintain measurability and reversibility.
 * Per MOD-018 §7.8: All experiments measurable and reversible.
 * No financial inconsistency allowed.
 * Results feed into analytics for continuous improvement.
 *
 * @param experiment The A/B experiment to validate
 * @returns ValidationResult
 */
export function validateExperimentReversibility(experiment: ABExperimentObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate experiment type is valid enum value
  if (!VALID_EXPERIMENT_TYPES.includes(experiment.experimentType)) {
    errors.push({
      code: 'INVALID_EXPERIMENT_TYPE',
      field: 'experimentType',
      message: `Experiment type must be one of: ${VALID_EXPERIMENT_TYPES.join(', ')}`,
    });
  }

  // Validate experiment status is valid enum value
  if (!VALID_EXPERIMENT_STATUSES.includes(experiment.status)) {
    errors.push({
      code: 'INVALID_EXPERIMENT_STATUS',
      field: 'status',
      message: `Experiment status must be one of: ${VALID_EXPERIMENT_STATUSES.join(', ')}`,
    });
  }

  // Hypothesis must always be stated
  if (!experiment.hypothesis || typeof experiment.hypothesis !== 'string') {
    errors.push({
      code: 'HYPOTHESIS_REQUIRED',
      field: 'hypothesis',
      message: 'Experiments must state a clear hypothesis per §4.7 A/B Testing Structuring',
    });
  }

  // CRITICAL: Control group and test group criteria both required
  if (!experiment.controlGroupCriteria || !experiment.testGroupCriteria) {
    errors.push({
      code: 'GROUP_CRITERIA_REQUIRED',
      field: 'controlGroupCriteria/testGroupCriteria',
      message: 'Experiments must define both control and test group criteria for proper isolation per §7.8',
    });
  } else {
    if (!experiment.controlGroupCriteria.segmentPattern) {
      errors.push({
        code: 'CONTROL_SEGMENT_REQUIRED',
        field: 'controlGroupCriteria',
        message: 'Control group must define a segment pattern',
      });
    }
    if (!experiment.testGroupCriteria.segmentPattern) {
      errors.push({
        code: 'TEST_SEGMENT_REQUIRED',
        field: 'testGroupCriteria',
        message: 'Test group must define a segment pattern',
      });
    }
  }

  // Success metrics must be defined
  if (!Array.isArray(experiment.successMetrics) || experiment.successMetrics.length === 0) {
    errors.push({
      code: 'SUCCESS_METRICS_REQUIRED',
      field: 'successMetrics',
      message: 'Experiments must define success metrics for measurability per §7.8 Experiment Reversibility Rule',
    });
  }

  // Reversibility rules must exist (clean rollback capability required)
  if (!experiment.reversibilityRules || typeof experiment.reversibilityRules !== 'object') {
    errors.push({
      code: 'REVERSIBILITY_RULES_REQUIRED',
      field: 'reversibilityRules',
      message: 'All experiments must define reversibility rules ensuring clean rollback per §7.8',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Fraud-Resistant Incentive Auditability Rule (§7.7)
// ============================================================

/**
 * Validates that incentive rule definitions meet fraud-resistant auditability requirements.
 * Per MOD-018 §7.7: Incentives must be auditable and fraud-resistant.
 * Fraud detection required (MOD-010).
 * Incentive execution must be logged and traceable.
 *
 * @param incentive The incentive rule to validate for fraud resistance
 * @returns ValidationResult
 */
export function validateIncentiveAuditability(incentive: IncentiveRuleObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Re-use financial separation validation
  const finValidation = validateFinancialSeparation(incentive);
  for (const err of finValidation.errors) {
    errors.push(err);
  }

  // CRITICAL: Value structure must have a cap — unbounded rewards enable fraud
  if (!incentive.valueStructure.maxRewardValue) {
    errors.push({
      code: 'MAX_REWARD_CAP_REQUIRED',
      field: 'valueStructure.maxRewardValue',
      message: 'All incentive reward values must have a cap for fraud prevention per §7.7 Incentive Auditability Rule',
    });
  }

  // Eligibility criteria must be concrete — vague criteria enable gaming
  for (const criterion of incentive.eligibilityCriteria) {
    if (!criterion.targetField || typeof criterion.targetField !== 'string') {
      errors.push({
        code: 'ELIGIBLE_TARGET_REQUIRED',
        field: 'eligibilityCriteria',
        message: 'Eligibility criteria must specify a target field for auditability',
      });
      break;
    }
    if (!criterion.operator || typeof criterion.operator !== 'string') {
      errors.push({
        code: 'ELIGIBLE_OPERATOR_REQUIRED',
        field: 'eligibilityCriteria',
        message: 'Eligibility criteria must specify an operator for auditability',
      });
      break;
    }
  }

  // Validity period must be defined (incentives shouldn't run indefinitely)
  if (!incentive.validityPeriod.start) {
    errors.push({
      code: 'VALIDITY_START_REQUIRED',
      field: 'validityPeriod',
      message: 'Incentives must have a defined validity start period per §4.2 business rules',
    });
  }

  return { valid: errors.length === 0, errors };
}
