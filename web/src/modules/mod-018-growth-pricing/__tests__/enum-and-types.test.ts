// NexCargo MOD-018 — Enum & Type Definition Tests
// Wave 3 — Increment 3 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
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
} from '../domain/types/entities';
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
} from '../domain/enums';

const now = new Date('2026-08-31T10:00:00Z');

// ============================================================
// Enum value tests
// ============================================================

describe('MOD-018 PricingModelStatus enum', () => {
  it('contains all statuses', () => {
    expect(PricingModelStatus.ACTIVE).toBe('ACTIVE');
    expect(PricingModelStatus.DEPRECATED).toBe('DEPRECATED');
  });
});

describe('MOD-018 IncentiveType enum', () => {
  it('contains all incentive types', () => {
    expect(IncentiveType.BONUS).toBe('BONUS');
    expect(IncentiveType.PRIORITY).toBe('PRIORITY');
    expect(IncentiveType.DISCOUNT).toBe('DISCOUNT');
    expect(IncentiveType.REWARD).toBe('REWARD');
    expect(IncentiveType.LOYALTY).toBe('LOYALTY');
  });
});

describe('MOD-018 IncentiveStatus enum', () => {
  it('contains all statuses', () => {
    expect(IncentiveStatus.ACTIVE).toBe('ACTIVE');
    expect(IncentiveStatus.INACTIVE).toBe('INACTIVE');
  });
});

describe('MOD-018 MarketSignalType enum', () => {
  it('contains all signal types', () => {
    expect(MarketSignalType.DEMAND_SPIKE).toBe('DEMAND_SPIKE');
    expect(MarketSignalType.SUPPLY_SHORTAGE).toBe('SUPPLY_SHORTAGE');
    expect(MarketSignalType.IMBALANCE).toBe('IMBALANCE');
    expect(MarketSignalType.PRICE_TREND).toBe('PRICE_TREND');
    expect(MarketSignalType.CORRIDOR_UNDERPERFORMANCE).toBe('CORRIDOR_UNDERPERFORMANCE');
  });
});

describe('MOD-018 RecommendationType enum', () => {
  it('contains all recommendation types', () => {
    expect(RecommendationType.PRICING).toBe('PRICING');
    expect(RecommendationType.INCENTIVE).toBe('INCENTIVE');
    expect(RecommendationType.ALLOCATION).toBe('ALLOCATION');
    expect(RecommendationType.PROMOTIONAL).toBe('PROMOTIONAL');
  });
});

describe('MOD-018 Campaign enums', () => {
  it('contains campaign types', () => {
    expect(CampaignType.DISCOUNT).toBe('DISCOUNT');
    expect(CampaignType.BONUS).toBe('BONUS');
    expect(CampaignType.AWARENESS).toBe('AWARENESS');
    expect(CampaignType.LOYALTY).toBe('LOYALTY');
  });

  it('contains campaign statuses', () => {
    expect(CampaignStatus.DRAFT).toBe('DRAFT');
    expect(CampaignStatus.ACTIVE).toBe('ACTIVE');
    expect(CampaignStatus.COMPLETED).toBe('COMPLETED');
    expect(CampaignStatus.CANCELLED).toBe('CANCELLED');
  });
});

describe('MOD-018 Fee enums', () => {
  it('contains fee types', () => {
    expect(FeeType.PLATFORM_COMMISSION).toBe('PLATFORM_COMMISSION');
    expect(FeeType.SERVICE_FEE).toBe('SERVICE_FEE');
    expect(FeeType.CORRIDOR_FEE).toBe('CORRIDOR_FEE');
  });

  it('contains fee bases', () => {
    expect(FeeBasis.PERCENTAGE).toBe('PERCENTAGE');
    expect(FeeBasis.FIXED).toBe('FIXED');
  });

  it('contains fee statuses', () => {
    expect(FeeStatus.ACTIVE).toBe('ACTIVE');
    expect(FeeStatus.DEPRECATED).toBe('DEPRECATED');
  });
});

describe('MOD-018 Experiment enums', () => {
  it('contains experiment types', () => {
    expect(ExperimentType.PRICING).toBe('PRICING');
    expect(ExperimentType.INCENTIVE).toBe('INCENTIVE');
    expect(ExperimentType.UI).toBe('UI');
    expect(ExperimentType.ALGORITHM).toBe('ALGORITHM');
  });

  it('contains experiment statuses', () => {
    expect(ExperimentStatus.DRAFT).toBe('DRAFT');
    expect(ExperimentStatus.ACTIVE).toBe('ACTIVE');
    expect(ExperimentStatus.COMPLETED).toBe('COMPLETED');
    expect(ExperimentStatus.ABORTED).toBe('ABORTED');
  });
});

describe('MOD-018 RetentionRiskLevel enum', () => {
  it('contains all risk levels', () => {
    expect(RetentionRiskLevel.LOW).toBe('LOW');
    expect(RetentionRiskLevel.MEDIUM).toBe('MEDIUM');
    expect(RetentionRiskLevel.HIGH).toBe('HIGH');
  });
});

describe('MOD-018 ForecastType enum', () => {
  it('contains all forecast types', () => {
    expect(ForecastType.CORRIDOR).toBe('CORRIDOR');
    expect(ForecastType.CARGO_TYPE).toBe('CARGO_TYPE');
    expect(ForecastType.SEASONAL).toBe('SEASONAL');
  });
});

// ============================================================
// BC Contract Interface Tests
// ============================================================

describe('MOD-018 BC Contract Interface Integrity', () => {
  it('can import bc-contract module without circular dependency errors', async () => {
    const mod = await import('../domain/types/bc-contract');
    expect(mod).toBeDefined();
  });
});
