// NexCargo MOD-018 — Advisory Services Tests
// Wave 3 — Increment 3 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import type { PricingModelObject, IncentiveRuleObject, MarketSignalObject, OptimizationRecommendationObject, ABExperimentObject } from '../domain/types/entities';
import { PricingModelStatus, RecommendationType, IncentiveType, IncentiveStatus, MarketSignalType, ExperimentType, ExperimentStatus } from '../domain/enums';
import { enforceNoExecutionRule, validateRecommendationAdvisory, validateFinancialSeparation, validateMarketNeutrality, validateMarketSignalIntegrity, validatePricingTransparency, validateExperimentReversibility, validateIncentiveAuditability } from '../domain/services/advisory-services';

const now = new Date('2026-08-31T10:00:00Z');

function stubEntity() {
  return { id: 'stub', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) };
}

function buildValidPricingModel(): PricingModelObject {
  return { ...stubEntity(), pricingModelId: 'PRM-001', region: 'maputo-corridor', corridorId: 'corridor-001', cargoType: 'CONTAINER', baseRateStructure: { baseRatePerKm: 15, currency: 'MZN' }, variableFactors: [{ factorId: 'f1', factorName: 'fuel', weightMultiplier: 1.2, dataSourceModule: 'MOD-012', isActive: true }], constraints: [{ constraintId: 'c1', constraintType: 'MAX_FEE', maxValue: 1000 }], status: PricingModelStatus.ACTIVE, version: 1, validFrom: now };
}

function buildValidRecommendation(): OptimizationRecommendationObject {
  return { ...stubEntity(), recommendationId: 'REC-001', type: RecommendationType.PRICING, rationale: 'Supply shortage detected on Maputo-Corridor.', supportingSignals: [{ signalId: 'alpha-001', signalType: 'SUPPLY_SHORTAGE', contributionWeight: 0.7 }, { signalId: 'beta-002', signalType: 'DEMAND_SPIKE', contributionWeight: 0.3 }], confidenceScore: 78, targetRegion: 'maputo-corridor', targetCorridor: 'corridor-001', suggestedAction: { actionType: 'ADJUST_RATE_CAP', maxRateAdjustmentPercent: 10 }, generatedAt: now, validUntil: new Date('2026-09-30T23:59:59Z') };
}

function buildValidIncentive(): IncentiveRuleObject {
  return { ...stubEntity(), incentiveId: 'INC-001', incentiveType: IncentiveType.BONUS, eligibilityCriteria: [{ conditionId: 'ec1', targetField: 'acceptanceRate', operator: 'GTEQ', expectedValue: 0.8 }], triggerConditions: [{ triggerId: 'tc1', triggerEvent: 'LOAD_COMPLETED', triggerSource: 'MOD-003', conditions: [] }], valueStructure: { valueType: 'PERCENTAGE', baseValue: 5, maxRewardValue: 1000 }, validityPeriod: { start: now }, region: 'maputo-corridor', status: IncentiveStatus.ACTIVE };
}

function buildValidMarketSignal(): MarketSignalObject {
  return { ...stubEntity(), signalId: 'SIG-001', signalType: MarketSignalType.DEMAND_SPIKE, sourceModules: ['MOD-001', 'MOD-003'], intensityScore: 72, confidenceScore: 85, timestamp: now, region: 'maputo-corridor', corridorId: 'corridor-001', metadata: {} };
}

function buildValidExperiment(): ABExperimentObject {
  return { ...stubEntity(), experimentId: 'EXP-001', experimentName: 'Dynamic Pricing A/B Test', experimentType: ExperimentType.PRICING, controlGroupCriteria: { segmentPattern: 'GROUP_A', filters: {}, minSampleSize: 100 }, testGroupCriteria: { segmentPattern: 'GROUP_B', filters: {}, minSampleSize: 100 }, variables: { priceAdjustmentFactor: 1.1 }, startDate: now, endDate: new Date('2026-10-31T23:59:59Z'), status: ExperimentStatus.ACTIVE, hypothesis: 'A small price adjustment increases matching rate by 5%.', successMetrics: [{ metricId: 'm1', metricName: 'matching_rate', baselineValue: 0.65, targetImprovementPercent: 5 }], reversibilityRules: { rollbackTrigger: 'FINANCIAL_INCONSISTENCY', automaticRollback: true } };
}

// ============================================================
// No Execution Rule tests (§7.1)
// ============================================================

describe('enforceNoExecutionRule — MOD-018 §7.1', () => {
  it('validates a proper pricing model', () => {
    const result = enforceNoExecutionRule(buildValidPricingModel());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects pricing model with invalid status', () => {
    const p = buildValidPricingModel();
    (p as any).status = 'INVALID_STATUS';
    const result = enforceNoExecutionRule(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_PRICING_STATUS')).toBe(true);
  });

  it('rejects pricing model with no constraints', () => {
    const p = buildValidPricingModel();
    p.constraints = [];
    const result = enforceNoExecutionRule(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'PRICING_CONSTRAINTS_REQUIRED')).toBe(true);
  });

  it('rejects pricing model with invalid source module in factors', () => {
    const p = buildValidPricingModel();
    p.variableFactors[0].dataSourceModule = 'INVALID_MODULE';
    const result = enforceNoExecutionRule(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code.includes('FACTOR_0_INVALID_SOURCE'))).toBe(true);
  });
});

// ============================================================
// Recommendation Advisory tests (§7.2)
// ============================================================

describe('validateRecommendationAdvisory — MOD-018 §7.2', () => {
  it('validates a proper recommendation', () => {
    const result = validateRecommendationAdvisory(buildValidRecommendation());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects recommendation without rationale', () => {
    const r = buildValidRecommendation();
    r.rationale = '';
    const result = validateRecommendationAdvisory(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'RATIONALE_REQUIRED')).toBe(true);
  });

  it('rejects recommendation with out-of-range confidence score', () => {
    const r = buildValidRecommendation();
    r.confidenceScore = 150;
    const result = validateRecommendationAdvisory(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CONFIDENCE_SCORE_OUT_OF_RANGE')).toBe(true);
  });

  it('rejects recommendation without target region', () => {
    const r = buildValidRecommendation();
    r.targetRegion = '';
    const result = validateRecommendationAdvisory(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'TARGET_REGION_REQUIRED')).toBe(true);
  });

  it('rejects recommendation with missing suggested action', () => {
    const r = buildValidRecommendation();
    r.suggestedAction = undefined as never;
    const result = validateRecommendationAdvisory(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SUGGESTED_ACTION_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Financial Separation tests (§7.3)
// ============================================================

describe('validateFinancialSeparation — MOD-018 §7.3', () => {
  it('validates a proper incentive rule', () => {
    const result = validateFinancialSeparation(buildValidIncentive());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects incentive with negative reward value', () => {
    const i = buildValidIncentive();
    i.valueStructure.baseValue = -10;
    const result = validateFinancialSeparation(i);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_VALUE_STRUCTURE')).toBe(true);
  });

  it('rejects incentive without eligibility criteria', () => {
    const i = buildValidIncentive();
    i.eligibilityCriteria = [];
    const result = validateFinancialSeparation(i);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ELIGIBILITY_CRITERIA_REQUIRED')).toBe(true);
  });

  it('rejects incentive without trigger conditions', () => {
    const i = buildValidIncentive();
    i.triggerConditions = [];
    const result = validateFinancialSeparation(i);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'TRIGGER_CONDITIONS_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Market Neutrality tests (§7.4)
// ============================================================

describe('validateMarketNeutrality — MOD-018 §7.4', () => {
  it('validates a diverse-source recommendation', () => {
    const result = validateMarketNeutrality(buildValidRecommendation());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags single-source bias when all signals are similar', () => {
    const r = buildValidRecommendation();
    // Set both signals with SAME prefix pattern (simulating single source)
    r.supportingSignals = [
      { signalId: 'sig-a', signalType: 'PRICE_TREND', contributionWeight: 0.5 },
      { signalId: 'sig-b', signalType: 'SUPPLY_SHORTAGE', contributionWeight: 0.5 },
    ];
    // The split check uses substring before first '-', so 'sig' for both -> triggers single-source flag
    const result = validateMarketNeutrality(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SINGLE_SOURCE_BIAS_DETECTED')).toBe(true);
  });
});

// ============================================================
// Market Signal Integrity tests (§7.5)
// ============================================================

describe('validateMarketSignalIntegrity — MOD-018 §7.5', () => {
  it('validates a proper market signal', () => {
    const result = validateMarketSignalIntegrity(buildValidMarketSignal());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects signal with out-of-range intensity score', () => {
    const s = buildValidMarketSignal();
    s.intensityScore = 150;
    const result = validateMarketSignalIntegrity(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INTENSITY_SCORE_OUT_OF_RANGE')).toBe(true);
  });

  it('rejects signal with no source modules (synthetic data detection)', () => {
    const s = buildValidMarketSignal();
    s.sourceModules = [];
    const result = validateMarketSignalIntegrity(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SOURCE_MODULES_REQUIRED')).toBe(true);
  });

  it('rejects signal with invalid source module name', () => {
    const s = buildValidMarketSignal();
    s.sourceModules = ['INVALID_MOD'];
    const result = validateMarketSignalIntegrity(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SOURCE_MODULE_0_INVALID')).toBe(true);
  });

  it('rejects signal without region', () => {
    const s = buildValidMarketSignal();
    s.region = '';
    const result = validateMarketSignalIntegrity(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'REGION_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Pricing Transparency tests (§7.6)
// ============================================================

describe('validatePricingTransparency — MOD-018 §7.6', () => {
  it('validates a transparent pricing model with max fee', () => {
    const result = validatePricingTransparency(buildValidPricingModel());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects pricing model without max fee constraint', () => {
    const p = buildValidPricingModel();
    p.constraints = [{ constraintId: 'c1', constraintType: 'MIN_FEE', minValue: 0 }];
    const result = validatePricingTransparency(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MAX_FEE_CONSTRAINT_REQUIRED')).toBe(true);
  });

  it('rejects pricing model with empty base rate structure', () => {
    const p = buildValidPricingModel();
    p.baseRateStructure = {} as never;
    const result = validatePricingTransparency(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BASE_RATE_STRUCTURE_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Experiment Reversibility tests (§7.8)
// ============================================================

describe('validateExperimentReversibility — MOD-018 §7.8', () => {
  it('validates a proper A/B experiment', () => {
    const result = validateExperimentReversibility(buildValidExperiment());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects experiment without hypothesis', () => {
    const e = buildValidExperiment();
    e.hypothesis = '';
    const result = validateExperimentReversibility(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'HYPOTHESIS_REQUIRED')).toBe(true);
  });

  it('rejects experiment without group criteria', () => {
    const e = buildValidExperiment();
    e.controlGroupCriteria = undefined as never;
    const result = validateExperimentReversibility(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'GROUP_CRITERIA_REQUIRED')).toBe(true);
  });

  it('rejects experiment without success metrics', () => {
    const e = buildValidExperiment();
    e.successMetrics = [];
    const result = validateExperimentReversibility(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SUCCESS_METRICS_REQUIRED')).toBe(true);
  });

  it('rejects experiment without reversibility rules', () => {
    const e = buildValidExperiment();
    e.reversibilityRules = null as never;
    const result = validateExperimentReversibility(e);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'REVERSIBILITY_RULES_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Incentive Auditability tests (§7.7)
// ============================================================

describe('validateIncentiveAuditability — MOD-018 §7.7', () => {
  it('validates an audit-friendly incentive', () => {
    const result = validateIncentiveAuditability(buildValidIncentive());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects incentive without reward cap (fraud prevention)', () => {
    const i = buildValidIncentive();
    delete (i as any).valueStructure.maxRewardValue;
    const result = validateIncentiveAuditability(i);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MAX_REWARD_CAP_REQUIRED')).toBe(true);
  });
});
