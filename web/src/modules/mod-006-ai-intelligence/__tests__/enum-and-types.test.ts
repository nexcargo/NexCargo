// NexCargo MOD-006 — Enum & Type Definition Tests
// Wave 2 — Stage 3, Increment 2 — Authorized per HAO-STAGE3-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import {
  InsightType,
  PredictionType,
  AnomalyType,
  SeverityLevel,
  RecommendationType,
  EntityType,
  RiskCategory,
  UserRole,
  SessionStatus,
  MessageSender,
} from '../domain/enums';

describe('MOD-006 InsightType enum', () => {
  it('contains all required insight types', () => {
    expect(InsightType.PREDICTION).toBe('PREDICTION');
    expect(InsightType.ANOMALY).toBe('ANOMALY');
    expect(InsightType.RECOMMENDATION).toBe('RECOMMENDATION');
    expect(InsightType.RISK_SCORE).toBe('RISK_SCORE');
    expect(InsightType.FORECAST).toBe('FORECAST');
  });
});

describe('MOD-006 PredictionType enum', () => {
  it('contains all prediction subtypes', () => {
    expect(PredictionType.ETA).toBe('ETA');
    expect(PredictionType.DELAY_PROBABILITY).toBe('DELAY_PROBABILITY');
    expect(PredictionType.DEMAND_FORECAST).toBe('DEMAND_FORECAST');
    expect(PredictionType.CAPACITY_FORECAST).toBe('CAPACITY_FORECAST');
  });
});

describe('MOD-006 AnomalyType enum', () => {
  it('contains all anomaly subtypes', () => {
    expect(AnomalyType.ROUTE_DEVIATION).toBe('ROUTE_DEVIATION');
    expect(AnomalyType.TIMING_ANOMALY).toBe('TIMING_ANOMALY');
    expect(AnomalyType.PAYMENT_PATTERN).toBe('PAYMENT_PATTERN');
    expect(AnomalyType.DOCUMENT_IRREGULARITY).toBe('DOCUMENT_IRREGULARITY');
    expect(AnomalyType.BEHAVIORAL).toBe('BEHAVIORAL');
  });
});

describe('MOD-006 SeverityLevel enum', () => {
  it('contains all severity levels', () => {
    expect(SeverityLevel.LOW).toBe('LOW');
    expect(SeverityLevel.MEDIUM).toBe('MEDIUM');
    expect(SeverityLevel.HIGH).toBe('HIGH');
    expect(SeverityLevel.CRITICAL).toBe('CRITICAL');
  });
});

describe('MOD-006 RecommendationType enum', () => {
  it('contains all recommendation types', () => {
    expect(RecommendationType.CARRIER_MATCH).toBe('CARRIER_MATCH');
    expect(RecommendationType.ROUTE_OPTIMIZATION).toBe('ROUTE_OPTIMIZATION');
    expect(RecommendationType.PRICING).toBe('PRICING');
    expect(RecommendationType.DISPATCH).toBe('DISPATCH');
    expect(RecommendationType.RISK_MITIGATION).toBe('RISK_MITIGATION');
  });
});

describe('MOD-006 EntityType enum', () => {
  it('contains all fraud risk entity types', () => {
    expect(EntityType.USER).toBe('USER');
    expect(EntityType.SHIPMENT).toBe('SHIPMENT');
    expect(EntityType.PAYMENT).toBe('PAYMENT');
    expect(EntityType.CONTRACT).toBe('CONTRACT');
  });
});

describe('MOD-006 RiskCategory enum', () => {
  it('contains all risk categories', () => {
    expect(RiskCategory.LOW).toBe('LOW');
    expect(RiskCategory.MEDIUM).toBe('MEDIUM');
    expect(RiskCategory.HIGH).toBe('HIGH');
    expect(RiskCategory.CRITICAL).toBe('CRITICAL');
  });
});

describe('MOD-006 UserRole enum', () => {
  it('contains all user roles', () => {
    expect(UserRole.SHIPPER).toBe('SHIPPER');
    expect(UserRole.TRANSPORTER).toBe('TRANSPORTER');
    expect(UserRole.DRIVER).toBe('DRIVER');
    expect(UserRole.MODERATOR).toBe('MODERATOR');
    expect(UserRole.ADMIN).toBe('ADMIN');
  });
});

describe('MOD-006 SessionStatus enum', () => {
  it('contains session statuses', () => {
    expect(SessionStatus.ACTIVE).toBe('ACTIVE');
    expect(SessionStatus.CLOSED).toBe('CLOSED');
  });
});

describe('MOD-006 MessageSender enum', () => {
  it('contains message senders', () => {
    expect(MessageSender.USER).toBe('USER');
    expect(MessageSender.AI).toBe('AI');
  });
});

// ============================================================
// BC Contract Interface Tests
// ============================================================

describe('MOD-006 BC Contract Interface Integrity', () => {
  it('bc-contract module loads without circular dependency errors', async () => {
    const mod = await import('../domain/types/bc-contract');
    // Interfaces are compile-time only; loading succeeds means no structural issues
    expect(mod).toBeDefined();
  });
});
