// NexCargo MOD-013 — Financial Flow State Machine Tests
// Wave 2 — Phase 2A, Increment 2 — Authorized per HAO-MOD013-INC2
// Reference: MOD-013 §5.5 (Financial Flow State Machine), §7.3 (Escrow Immutability Rule)

import { describe, it, expect } from 'vitest';
import {
  validateFinancialTransition,
  applyFinancialTransition,
  isFinancialTerminal,
} from '@/modules/mod-013-financial-infrastructure/domain/services/financial-state-machine';
import { EscrowState } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

describe('MOD-013 Financial Flow State Machine — Valid Transitions', () => {
  describe('PENDING_CREATION → FUNDS_INITIATED', () => {
    it('allows PENDING_CREATION to FUNDS_INITIATED transition', () => {
      expect(() => validateFinancialTransition(EscrowState.PENDING_CREATION, EscrowState.FUNDS_INITIATED)).not.toThrow();
      const result = applyFinancialTransition(EscrowState.PENDING_CREATION, EscrowState.FUNDS_INITIATED);
      expect(result).toBe(EscrowState.FUNDS_INITIATED);
    });

    it('rejects PENDING_CREATION to ESCROW_CLOSED (must go through full lifecycle)', () => {
      expect(() => validateFinancialTransition(EscrowState.PENDING_CREATION, EscrowState.ESCROW_CLOSED))
        .toThrow(ValidationError);
    });
  });

  describe('FUNDS_INITIATED → FUNDS_LOCKED', () => {
    it('allows FUNDS_INITIATED to FUNDS_LOCKED transition', () => {
      expect(() => validateFinancialTransition(EscrowState.FUNDS_INITIATED, EscrowState.FUNDS_LOCKED)).not.toThrow();
      const result = applyFinancialTransition(EscrowState.FUNDS_INITIATED, EscrowState.FUNDS_LOCKED);
      expect(result).toBe(EscrowState.FUNDS_LOCKED);
    });

    it('rejects FUNDS_INITIATED directly to RELEASE (must lock first)', () => {
      expect(() => validateFinancialTransition(EscrowState.FUNDS_INITIATED, EscrowState.PARTIAL_RELEASE))
        .toThrow(ValidationError);
    });
  });

  describe('FUNDS_LOCKED → PARTIAL_RELEASE | FINAL_RELEASE | DISPUTE_HOLD', () => {
    it('allows FUNDS_LOCKED to PARTIAL_RELEASE', () => {
      expect(() => validateFinancialTransition(EscrowState.FUNDS_LOCKED, EscrowState.PARTIAL_RELEASE)).not.toThrow();
      expect(applyFinancialTransition(EscrowState.FUNDS_LOCKED, EscrowState.PARTIAL_RELEASE)).toBe(EscrowState.PARTIAL_RELEASE);
    });

    it('allows FUNDS_LOCKED to FINAL_RELEASE', () => {
      expect(() => validateFinancialTransition(EscrowState.FUNDS_LOCKED, EscrowState.FINAL_RELEASE)).not.toThrow();
      expect(applyFinancialTransition(EscrowState.FUNDS_LOCKED, EscrowState.FINAL_RELEASE)).toBe(EscrowState.FINAL_RELEASE);
    });

    it('allows FUNDS_LOCKED to DISPUTE_HOLD', () => {
      expect(() => validateFinancialTransition(EscrowState.FUNDS_LOCKED, EscrowState.DISPUTE_HOLD)).not.toThrow();
      expect(applyFinancialTransition(EscrowState.FUNDS_LOCKED, EscrowState.DISPUTE_HOLD)).toBe(EscrowState.DISPUTE_HOLD);
    });

    it('rejects FUNDS_LOCKED directly to CLOSED (skip intermediate releases)', () => {
      expect(() => validateFinancialTransition(EscrowState.FUNDS_LOCKED, EscrowState.ESCROW_CLOSED))
        .toThrow(ValidationError);
    });
  });

  describe('PARTIAL_RELEASE → FINAL_RELEASE', () => {
    it('allows PARTIAL_RELEASE to FINAL_RELEASE (remaining amount released)', () => {
      expect(() => validateFinancialTransition(EscrowState.PARTIAL_RELEASE, EscrowState.FINAL_RELEASE)).not.toThrow();
      const result = applyFinancialTransition(EscrowState.PARTIAL_RELEASE, EscrowState.FINAL_RELEASE);
      expect(result).toBe(EscrowState.FINAL_RELEASE);
    });

    it('rejects PARTIAL_RELEASE going back to LOCKED (cannot undo release)', () => {
      expect(() => validateFinancialTransition(EscrowState.PARTIAL_RELEASE, EscrowState.FUNDS_LOCKED))
        .toThrow(ValidationError);
    });
  });

  describe('FINAL_RELEASE → ESCROW_CLOSED', () => {
    it('allows FINAL_RELEASE to ESCROW_CLOSED', () => {
      expect(() => validateFinancialTransition(EscrowState.FINAL_RELEASE, EscrowState.ESCROW_CLOSED)).not.toThrow();
      const result = applyFinancialTransition(EscrowState.FINAL_RELEASE, EscrowState.ESCROW_CLOSED);
      expect(result).toBe(EscrowState.ESCROW_CLOSED);
    });
  });

  describe('DISPUTE_HOLD → resolution paths', () => {
    it('allows DISPUTE_HOLD to PARTIAL_RELEASE (partial dispute resolution)', () => {
      expect(() => validateFinancialTransition(EscrowState.DISPUTE_HOLD, EscrowState.PARTIAL_RELEASE)).not.toThrow();
    });

    it('allows DISPUTE_HOLD to FINAL_RELEASE (full refund after dispute)', () => {
      expect(() => validateFinancialTransition(EscrowState.DISPUTE_HOLD, EscrowState.FINAL_RELEASE)).not.toThrow();
    });

    it('rejects DISPUTE_HOLD going back to LOCKED (cannot undo hold)', () => {
      expect(() => validateFinancialTransition(EscrowState.DISPUTE_HOLD, EscrowState.FUNDS_LOCKED))
        .toThrow(ValidationError);
    });
  });

  describe('No skip-ahead allowed from INITIATED', () => {
    it('rejects FUNDS_INITIATED to DISPUTE_HOLD (must lock first)', () => {
      expect(() => validateFinancialTransition(EscrowState.FUNDS_INITIATED, EscrowState.DISPUTE_HOLD))
        .toThrow(ValidationError);
    });
  });
});

describe('MOD-013 Financial Flow State Machine — Terminal States', () => {
  it('ESCROW_CLOSED has no outgoing transitions', () => {
    expect(() => validateFinancialTransition(EscrowState.ESCROW_CLOSED, EscrowState.FINAL_RELEASE))
      .toThrow(ValidationError);
    expect(() => validateFinancialTransition(EscrowState.ESCROW_CLOSED, EscrowState.DISPUTE_HOLD))
      .toThrow(ValidationError);
  });

  it('no other state is terminal', () => {
    const nonTerminals = [
      EscrowState.PENDING_CREATION,
      EscrowState.FUNDS_INITIATED,
      EscrowState.FUNDS_LOCKED,
      EscrowState.PARTIAL_RELEASE,
      EscrowState.FINAL_RELEASE,
      EscrowState.DISPUTE_HOLD,
    ];
    for (const status of nonTerminals) {
      expect(isFinancialTerminal(status)).toBe(false);
    }
  });
});

describe('MOD-013 Financial Flow State Machine — Terminal Detection', () => {
  it('isFinancialTerminal returns true only for ESCROW_CLOSED', () => {
    expect(isFinancialTerminal(EscrowState.ESCROW_CLOSED)).toBe(true);
  });

  it('isFinancialTerminal returns false for all non-terminal states', () => {
    expect(isFinancialTerminal(EscrowState.PENDING_CREATION)).toBe(false);
    expect(isFinancialTerminal(EscrowState.FUNDS_LOCKED)).toBe(false);
    expect(isFinancialTerminal(EscrowState.DISPUTE_HOLD)).toBe(false);
  });
});

describe('MOD-013 Financial Flow State Machine — Error Messages', () => {
  it('includes current and target status in error message', () => {
    try {
      validateFinancialTransition(EscrowState.PENDING_CREATION, EscrowState.ESCROW_CLOSED);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect((error as any).details).toEqual(expect.objectContaining({
          currentStatus: EscrowState.PENDING_CREATION,
          targetStatus: EscrowState.ESCROW_CLOSED,
        }));
      }
    }
  });

  it('lists allowed transitions in error details', () => {
    try {
      validateFinancialTransition(EscrowState.FUNDS_INITIATED, EscrowState.ESCROW_CLOSED);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect((error as any).details.allowedTransitions).toContain(EscrowState.FUNDS_LOCKED);
      }
    }
  });
});
