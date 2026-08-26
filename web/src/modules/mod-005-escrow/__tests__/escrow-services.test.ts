// NexCargo MOD-005 â€” Escrow Domain Services Tests
// Wave 2 â€” Phase 2A, Increment 1 â€” Authorized per HAO-MOD005-INC1
// Reference: MOD-005 Â§6 (Responsibilities)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePaymentIntent,
  checkIdempotencyKey,
  registerIdempotencyKey,
  validateSettlementRequest,
  validateDisputeCreation,
  compareStates,
  calculateDerivedBalance,
} from '@/modules/mod-005-escrow/domain/services/escrow-services';
import { ValidationError } from '@/shared/errors/app-errors';
import { CurrencyCode } from '@/shared/types/enums';

beforeEach(() => {
  // Clear idempotency key registry between tests
  (globalThis as any).__processedKeys__ = new Map();
});

// ============================================================
// Payment Intent Service Tests
// Per MOD-005 Â§6.4 â€” Payment Method Orchestration
// ============================================================

describe('MOD-005 Payment Intent Validation', () => {
  it('accepts valid payment intent creation input', () => {
    expect(() => validatePaymentIntent({
      escrowId: 'test-escrow-id',
      amount: 1000,
      currency: CurrencyCode.MZN as any,
      paymentMethodType: 'MPESA',
      idempotencyKey: 'key-001',
    })).not.toThrow();
  });

  it('rejects empty escrowId', () => {
    try {
      validatePaymentIntent({
        escrowId: '',
        amount: 1000,
        currency: CurrencyCode.USD as any,
        paymentMethodType: 'CARD',
        idempotencyKey: 'key-002',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects zero or negative amount', () => {
    try {
      validatePaymentIntent({
        escrowId: 'test-escrow-id',
        amount: 0,
        currency: CurrencyCode.USD as any,
        paymentMethodType: 'CARD',
        idempotencyKey: 'key-003',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }

    try {
      validatePaymentIntent({
        escrowId: 'test-escrow-id',
        amount: -100,
        currency: CurrencyCode.USD as any,
        paymentMethodType: 'BANK_TRANSFER',
        idempotencyKey: 'key-004',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects missing idempotencyKey', () => {
    try {
      validatePaymentIntent({
        escrowId: 'test-escrow-id',
        amount: 500,
        currency: CurrencyCode.ZAR as any,
        paymentMethodType: 'PAYPAL',
        idempotencyKey: '',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects invalid payment method type', () => {
    try {
      validatePaymentIntent({
        escrowId: 'test-escrow-id',
        amount: 500,
        currency: CurrencyCode.MZN as any,
        paymentMethodType: 'INVALID_METHOD',
        idempotencyKey: 'key-005',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('accepts all valid payment methods', () => {
    const validMethods = ['MPESA', 'MKESH', 'EMOLA', 'CARD', 'PAYPAL', 'BANK_TRANSFER'];
    for (const method of validMethods) {
      expect(() => validatePaymentIntent({
        escrowId: 'test-escrow',
        amount: 100,
        currency: CurrencyCode.MZN as any,
        paymentMethodType: method,
        idempotencyKey: `key-${method}`,
      })).not.toThrow();
    }
  });
});

describe('MOD-005 Settlement Request Validation', () => {
  it('accepts valid settlement request', () => {
    expect(() => validateSettlementRequest({
      escrowId: 'test-escrow-id',
      releaseAmount: 500,
      milestone: 'DELIVERY_CONFIRMED',
    })).not.toThrow();
  });

  it('rejects missing escrowId', () => {
    try {
      validateSettlementRequest({
        escrowId: '',
        releaseAmount: 500,
        milestone: 'DELIVERY_CONFIRMED',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects zero or negative release amount', () => {
    try {
      validateSettlementRequest({
        escrowId: 'test-escrow',
        releaseAmount: 0,
        milestone: 'POD_APPROVED',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects invalid milestone', () => {
    try {
      validateSettlementRequest({
        escrowId: 'test-escrow',
        releaseAmount: 500,
        milestone: 'INVALID_MILESTONE',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('accepts all valid milestones', () => {
    const validMilestones = ['PICKUP_CONFIRMED', 'BORDER_CROSSING', 'DELIVERY_CONFIRMED', 'POD_APPROVED'];
    for (const milestone of validMilestones) {
      expect(() => validateSettlementRequest({
        escrowId: 'test-escrow',
        releaseAmount: 100,
        milestone,
      })).not.toThrow();
    }
  });
});

// ============================================================
// Dispute Management Tests
// Per MOD-005 Â§6.5 â€” Dispute Management
// ============================================================

describe('MOD-005 Dispute Creation Validation', () => {
  it('accepts valid dispute creation', () => {
    expect(() => validateDisputeCreation({
      escrowId: 'test-escrow-id',
      raisedBy: 'SHIPPER',
      disputeReason: 'Goods not delivered on time and condition was poor',
    })).not.toThrow();
  });

  it('accepts transporter raising dispute', () => {
    expect(() => validateDisputeCreation({
      escrowId: 'test-escrow-id',
      raisedBy: 'TRANSPORTER',
      disputeReason: 'Incorrect delivery location specified by shipper',
    })).not.toThrow();
  });

  it('rejects empty escrowId', () => {
    try {
      validateDisputeCreation({
        escrowId: '',
        raisedBy: 'SHIPPER',
        disputeReason: 'Valid reason that exceeds minimum length requirements',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects invalid raisedBy value', () => {
    try {
      validateDisputeCreation({
        escrowId: 'test-escrow-id',
        raisedBy: 'DRIVER',
        disputeReason: 'Valid reason text with sufficient detail provided',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('rejects too-short dispute reason', () => {
    try {
      validateDisputeCreation({
        escrowId: 'test-escrow-id',
        raisedBy: 'SHIPPER',
        disputeReason: 'Sho',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});

// ============================================================
// Reconciliation Structuring Tests
// Per MOD-005 Â§6.3 â€” Reconciliation Structuring
// ============================================================

describe('MOD-005 State Comparison / Reconciliation', () => {
  it('detects alignment when states match', () => {
    const state = JSON.stringify({ status: 'FUNDS_LOCKED', amount: 1000 });
    const result = compareStates(state, state);
    expect(result.mismatchDetected).toBe(false);
  });

  it('detects mismatch when states differ', () => {
    const internal = JSON.stringify({ status: 'FUNDS_LOCKED', amount: 1000 });
    const external = JSON.stringify({ status: 'FUNDS_LOCKED', amount: 999 });
    const result = compareStates(internal, external);
    expect(result.mismatchDetected).toBe(true);
    expect(result.details).toContain('does not match');
  });

  it('handles unparseable inputs gracefully', () => {
    const result = compareStates('<invalid>', '<also-invalid>');
    expect(result.mismatchDetected).toBe(true);
  });

  it('preserves original state strings in result', () => {
    const internal = JSON.stringify({ status: 'ESCROW_CLOSED' });
    const external = JSON.stringify({ status: 'ESCROW_CLOSED' });
    const result = compareStates(internal, external);
    expect(result.internalState).toBe(internal);
    expect(result.externalState).toBe(external);
  });
});

// ============================================================
// Digital Wallet Balance Calculation Tests
// Per MOD-005 Â§6.6 â€” Digital Wallet Representation
// ============================================================

describe('MOD-005 Derived Balance Calculation', () => {
  it('calculates balance correctly with zero pending amounts', () => {
    const balance = calculateDerivedBalance(1000, 0, 0);
    expect(balance).toBe(1000);
  });

  it('deducts pending payouts', () => {
    const balance = calculateDerivedBalance(1000, 200, 0);
    expect(balance).toBe(800);
  });

  it('adds confirmed incoming transactions', () => {
    const balance = calculateDerivedBalance(500, 0, 300);
    expect(balance).toBe(800);
  });

  it('handles combined scenario', () => {
    const balance = calculateDerivedBalance(1000, 200, 500);
    expect(balance).toBe(1300);
  });
});



