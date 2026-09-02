// NexCargo MOD-006 — Advisory Service Validation Tests
// Wave 2 — Stage 3, Increment 2 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import type {
  InsightObject,
  PredictionModelOutput,
  RecommendationObject,
  FraudRiskScore,
  AIChatSession,
  PricingRecommendation,
} from '../domain/types/entities';
import {
  enforceNoExecutionRule,
  validateAdvisoryOnly,
  validateDeterministicPrediction,
  validateExplanationTraces,
  validateFraudRiskScoring,
  validateChatSession,
  validatePricingBoundaries,
} from '../domain/services/advisory-services';
import {
  InsightType,
  SeverityLevel,
  PredictionType,
  RecommendationType,
  EntityType,
  RiskCategory,
  UserRole,
  SessionStatus,
} from '../domain/enums';

const mockTrace = [
  { stepId: 's1', description: 'Test reasoning', dataSources: ['src1'], confidenceContribution: 50 },
];
const now = new Date('2026-08-31T10:00:00Z');

function makeInsight(o?: Partial<InsightObject>): InsightObject {
  return { insightId: 'i1', insightType: InsightType.PREDICTION, sourceModules: ['MOD-001'], confidenceScore: 85, generatedAt: now, payload: {}, severityLevel: SeverityLevel.MEDIUM, explanationTrace: mockTrace, id: 'm1', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}), ...o };
}
function makePrediction(o?: Partial<PredictionModelOutput>): PredictionModelOutput {
  return { predictionId: 'p1', predictionType: PredictionType.ETA, inputDatasetReference: 'ds-1', predictedOutcome: {}, probabilityScore: 78, timeHorizon: '24h', confidenceScore: 82, explanationTrace: mockTrace, id: 'm2', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}), ...o };
}
function makeRecommendation(o?: Partial<RecommendationObject>): RecommendationObject {
  return { recommendationId: 'r1', contextModule: 'MOD-001', recommendationType: RecommendationType.CARRIER_MATCH, suggestedAction: 'Consider verified transporter', expectedImpact: 'Improved quality', confidenceScore: 75, alternatives: [{ description: 'Alt A', priority: 2, tradeOffs: ['slow'] }], explanationTrace: mockTrace, id: 'm3', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}), ...o };
}
function makeFraudRisk(o?: Partial<FraudRiskScore>): FraudRiskScore {
  return { riskId: 'fr1', entityType: EntityType.USER, entityId: 'u1', riskScore: 65, riskCategory: RiskCategory.HIGH, reasonCodes: ['high_value'], factors: [{ name: 'age', weight: 0.3, rawValue: 5, direction: 'INCREASES_RISK' }], generatedAt: now, explanationTrace: mockTrace, id: 'm4', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}), ...o };
}
function makeChatSession(o?: Partial<AIChatSession>): AIChatSession {
  return { sessionId: 'cs1', userId: 'u1', userRole: UserRole.SHIPPER, messages: [{ messageId: 'msg1', sender: 'USER' as never, content: 'Hi', timestamp: now, context: undefined }], sessionStatus: SessionStatus.ACTIVE, id: 'm5', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}), ...o };
}
function makePricing(o?: Partial<PricingRecommendation>): PricingRecommendation {
  return { pricingId: 'pr1', listingId: 'l1', suggestedPriceMin: 1000, suggestedPriceMax: 1500, confidenceScore: 80, marketFactors: { supplyDemandBalance: 0.3, routeComplexity: 5, fuelCostAdjustment: 1.05, seasonalMultiplier: 1.1 }, corridorBoundaryReference: { corridorId: 'MZ-MW', minPrice: 800, maxPrice: 2000, currency: 'USD' }, generatedAt: now, explanationTrace: mockTrace, id: 'm6', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}), ...o };
}

describe('Non-Execution Rule Enforcement', () => {
  it('accepts a fully valid insight', () => { expect(enforceNoExecutionRule(makeInsight()).valid).toBe(true); });
  it('rejects confidence > 100', () => { const r = enforceNoExecutionRule(makeInsight({ confidenceScore: 150 })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_CONFIDENCE_SCORE'); });
  it('rejects invalid severity', () => { const r = enforceNoExecutionRule(makeInsight({ severityLevel: 'BAD' as never })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_SEVERITY_LEVEL'); });
  it('rejects empty source modules', () => { const r = enforceNoExecutionRule(makeInsight({ sourceModules: [] })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('SOURCE_MODULES_REQUIRED'); });
  it('rejects bad source module ref', () => { const r = enforceNoExecutionRule(makeInsight({ sourceModules: ['invalid'] })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_SOURCE_MODULE_REF'); });
});

describe('Advisory-Only Validation', () => {
  it('accepts valid recommendation', () => { expect(validateAdvisoryOnly(makeRecommendation()).valid).toBe(true); });
  it('rejects no confidence', () => { const r = validateAdvisoryOnly(makeRecommendation({ confidenceScore: NaN as never })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_RECOMMENDATION_CONFIDENCE'); });
  it('rejects no action', () => { const r = validateAdvisoryOnly(makeRecommendation({ suggestedAction: '' })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('SUGGESTED_ACTION_REQUIRED'); });
  it('rejects no context', () => { const r = validateAdvisoryOnly(makeRecommendation({ contextModule: '' })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('CONTEXT_MODULE_REQUIRED'); });
});

describe('Deterministic Prediction Validation', () => {
  it('accepts valid prediction', () => { expect(validateDeterministicPrediction(makePrediction()).valid).toBe(true); });
  it('rejects invalid type', () => { const r = validateDeterministicPrediction(makePrediction({ predictionType: 'X' as never })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_PREDICTION_TYPE'); });
  it('rejects confidence > 100', () => { const r = validateDeterministicPrediction(makePrediction({ confidenceScore: 150 })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_PREDICTION_CONFIDENCE'); });
  it('rejects missing dataset ref', () => { const r = validateDeterministicPrediction(makePrediction({ inputDatasetReference: '' })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INPUT_DATASET_REFERENCE_REQUIRED'); });
  it('rejects missing time horizon', () => { const r = validateDeterministicPrediction(makePrediction({ timeHorizon: '' })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('TIME_HORIZON_REQUIRED'); });
});

describe('Explanation Trace Validation', () => {
  it('accepts entities with traces', () => { const r = validateExplanationTraces([makePrediction(), makePrediction()], 'Pred'); expect(r.valid).toBe(true); });
  it('rejects missing confidence', () => { const r = validateExplanationTraces([makePrediction({ confidenceScore: NaN as never })], 'Pred'); expect(r.valid).toBe(false); expect(r.errors.some(e => e.code.includes('NO_CONFIDENCE'))).toBe(true); });
  it('rejects empty trace', () => { const p = makePrediction(); (p.explanationTrace as unknown[]) = []; const r = validateExplanationTraces([p], 'Pred'); expect(r.valid).toBe(false); expect(r.errors.some(e => e.code.includes('MISSING_EXPLANATION_TRACE'))).toBe(true); });
  it('rejects incomplete trace', () => { const p = makePrediction(); (p.explanationTrace as unknown[]) = [{ stepId: 'x' }]; const r = validateExplanationTraces([p], 'Pred'); expect(r.valid).toBe(false); expect(r.errors.some(e => e.code.includes('INCOMPLETE_TRACE'))).toBe(true); });
});

describe('Fraud Risk Scoring Validation', () => {
  it('accepts valid fraud risk', () => { expect(validateFraudRiskScoring(makeFraudRisk()).valid).toBe(true); });
  it('rejects score > 100', () => { const r = validateFraudRiskScoring(makeFraudRisk({ riskScore: 150 })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_FRAUD_RISK_SCORE'); });
  it('rejects bad category', () => { const r = validateFraudRiskScoring(makeFraudRisk({ riskCategory: 'X' as never })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_RISK_CATEGORY'); });
  it('rejects bad entity type', () => { const r = validateFraudRiskScoring(makeFraudRisk({ entityType: 'X' as never })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_ENTITY_TYPE'); });
  it('rejects no entity ID', () => { const r = validateFraudRiskScoring(makeFraudRisk({ entityId: '' })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('ENTITY_ID_REQUIRED'); });
  it('rejects no reason codes', () => { const r = validateFraudRiskScoring(makeFraudRisk({ reasonCodes: [] })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('REASON_CODES_REQUIRED'); });
  it('rejects no factors', () => { const r = validateFraudRiskScoring(makeFraudRisk({ factors: [] })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('FACTORS_REQUIRED'); });
});

describe('Chat Session Validation', () => {
  it('accepts valid session', () => { expect(validateChatSession(makeChatSession()).valid).toBe(true); });
  it('rejects bad role', () => { const r = validateChatSession(makeChatSession({ userRole: 'GUEST' as never })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_USER_ROLE'); });
  it('rejects bad status', () => { const r = validateChatSession(makeChatSession({ sessionStatus: 'PAUSED' as never })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_SESSION_STATUS'); });
  it('rejects no userId', () => { const r = validateChatSession(makeChatSession({ userId: '' })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('USER_ID_REQUIRED'); });
});

describe('Pricing Boundary Validation', () => {
  it('accepts valid pricing', () => { expect(validatePricingBoundaries(makePricing()).valid).toBe(true); });
  it('rejects min > max price', () => { const r = validatePricingBoundaries(makePricing({ suggestedPriceMin: 2000, suggestedPriceMax: 1000 })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('PRICE_ORDER_INVALID'); });
  it('rejects missing corridor ref', () => { const r = validatePricingBoundaries(makePricing({ corridorBoundaryReference: undefined as never })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('CORRIDOR_BOUNDARY_REQUIRED'); });
  it('rejects bad confidence', () => { const r = validatePricingBoundaries(makePricing({ confidenceScore: 150 })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('INVALID_PRICING_CONFIDENCE'); });
  it('rejects missing market factors', () => { const r = validatePricingBoundaries(makePricing({ marketFactors: undefined as never })); expect(r.valid).toBe(false); expect(r.errors[0].code).toBe('MARKET_FACTORS_REQUIRED'); });
});
