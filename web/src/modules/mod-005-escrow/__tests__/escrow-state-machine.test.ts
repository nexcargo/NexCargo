// NexCargo MOD-005 â€” Escrow State Machine Tests
// Wave 2 â€” Phase 2A, Increment 1 â€” Authorized per HAO-MOD005-INC1
// Reference: MOD-005 Â§4.1, Â§5.1 (Escrow Lifecycle Model), Â§7.3 (Event Dependency Rule)

import { describe, it, expect } from 'vitest';
import {
  validateEscrowTransition,
  applyEscrowTransition,
  isEscrowTerminal,
} from '@/modules/mod-005-escrow/domain/services/escrow-state-machine';
import { EscrowState } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

describe('MOD-005 Escrow State Machine â€” Valid Transitions', () => {
  describe('PENDING_CREATION â†’ FUNDS_INITIATED', () => {
    it('allows PENDING_CREATION to FUNDS_INITIATED transition', () => {
      expect(() => validateEscrowTransition(EscrowState.PENDING_CREATION, EscrowState.FUNDS_INITIATED)).not.toThrow();
      const result = applyEscrowTransition(EscrowState.PENDING_CREATION, EscrowState.FUNDS_INITIATED);
      expect(result).toBe(EscrowState.FUNDS_INITIATED);
    });

    it('rejects PENDING_CREATION to FUNDS_LOCKED (must go through INITIATED)', () => {
      expect(() => validateEscrowTransition(EscrowState.PENDING_CREATION, EscrowState.FUNDS_LOCKED))
        .toThrow(ValidationError);
    });
  });

  describe('FUNDS_INITIATED â†’ FUNDS_LOCKED', () => {
    it('allows FUNDS_INITIATED to FUNDS_LOCKED transition', () => {
      expect(() => validateEscrowTransition(EscrowState.FUNDS_INITIATED, EscrowState.FUNDS_LOCKED)).not.toThrow();
      const result = applyEscrowTransition(EscrowState.FUNDS_INITIATED, EscrowState.FUNDS_LOCKED);
      expect(result).toBe(EscrowState.FUNDS_LOCKED);
    });

    it('rejects FUNDS_INITIATED to PARTIAL_RELEASE (must lock first)', () => {
      expect(() => validateEscrowTransition(EscrowState.FUNDS_INITIATED, EscrowState.PARTIAL_RELEASE))
        .toThrow(ValidationError);
    });
  });

  describe('FUNDS_LOCKED â†’ PARTIAL_RELEASE | FINAL_RELEASE | DISPUTE_HOLD', () => {
    it('allows FUNDS_LOCKED to PARTIAL_RELEASE', () => {
      expect(() => validateEscrowTransition(EscrowState.FUNDS_LOCKED, EscrowState.PARTIAL_RELEASE)).not.toThrow();
      expect(applyEscrowTransition(EscrowState.FUNDS_LOCKED, EscrowState.PARTIAL_RELEASE)).toBe(EscrowState.PARTIAL_RELEASE);
    });

    it('allows FUNDS_LOCKED to FINAL_RELEASE', () => {
      expect(() => validateEscrowTransition(EscrowState.FUNDS_LOCKED, EscrowState.FINAL_RELEASE)).not.toThrow();
      expect(applyEscrowTransition(EscrowState.FUNDS_LOCKED, EscrowState.FINAL_RELEASE)).toBe(EscrowState.FINAL_RELEASE);
    });

    it('allows FUNDS_LOCKED to DISPUTE_HOLD', () => {
      expect(() => validateEscrowTransition(EscrowState.FUNDS_LOCKED, EscrowState.DISPUTE_HOLD)).not.toThrow();
      expect(applyEscrowTransition(EscrowState.FUNDS_LOCKED, EscrowState.DISPUTE_HOLD)).toBe(EscrowState.DISPUTE_HOLD);
    });

    it('allows FUNDS_LOCKED to ESCROW_CLOSED directly (skip intermediate releases)', () => {
      expect(() => validateEscrowTransition(EscrowState.FUNDS_LOCKED, EscrowState.ESCROW_CLOSED))
        .toThrow(ValidationError);
    });
  });

  describe('PARTIAL_RELEASE â†’ FINAL_RELEASE', () => {
    it('allows PARTIAL_RELEASE to FINAL_RELEASE (remaining amount released)', () => {
      expect(() => validateEscrowTransition(EscrowState.PARTIAL_RELEASE, EscrowState.FINAL_RELEASE)).not.toThrow();
      const result = applyEscrowTransition(EscrowState.PARTIAL_RELEASE, EscrowState.FINAL_RELEASE);
      expect(result).toBe(EscrowState.FINAL_RELEASE);
    });

    it('rejects PARTIAL_RELEASE going back to LOCKED', () => {
      expect(() => validateEscrowTransition(EscrowState.PARTIAL_RELEASE, EscrowState.FUNDS_LOCKED))
        .toThrow(ValidationError);
    });
  });

  describe('FINAL_RELEASE â†’ ESCROW_CLOSED', () => {
    it('allows FINAL_RELEASE to ESCROW_CLOSED', () => {
      expect(() => validateEscrowTransition(EscrowState.FINAL_RELEASE, EscrowState.ESCROW_CLOSED)).not.toThrow();
      const result = applyEscrowTransition(EscrowState.FINAL_RELEASE, EscrowState.ESCROW_CLOSED);
      expect(result).toBe(EscrowState.ESCROW_CLOSED);
    });
  });

  describe('DISPUTE_HOLD â†’ resolution paths', () => {
    it('allows DISPUTE_HOLD to PARTIAL_RELEASE (partial dispute resolution)', () => {
      expect(() => validateEscrowTransition(EscrowState.DISPUTE_HOLD, EscrowState.PARTIAL_RELEASE)).not.toThrow();
    });

    it('allows DISPUTE_HOLD to FINAL_RELEASE (full refund/release after dispute)', () => {
      expect(() => validateEscrowTransition(EscrowState.DISPUTE_HOLD, EscrowState.FINAL_RELEASE)).not.toThrow();
    });

    it('rejects DISPUTE_HOLD going back to LOCKED (cannot undo hold)', () => {
      expect(() => validateEscrowTransition(EscrowState.DISPUTE_HOLD, EscrowState.FUNDS_LOCKED))
        .toThrow(ValidationError);
    });
  });
});

describe('MOD-005 Escrow State Machine â€” Terminal States', () => {
  it('ESCROW_CLOSED has no outgoing transitions', () => {
    expect(() => validateEscrowTransition(EscrowState.ESCROW_CLOSED, EscrowState.FINAL_RELEASE))
      .toThrow(ValidationError);
    expect(() => validateEscrowTransition(EscrowState.ESCROW_CLOSED, EscrowState.DISPUTE_HOLD))
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
      expect(isEscrowTerminal(status)).toBe(false);
    }
  });
});

describe('MOD-005 Escrow State Machine â€” Terminal Detection', () => {
  it('isEscrowTerminal returns true only for ESCROW_CLOSED', () => {
    expect(isEscrowTerminal(EscrowState.ESCROW_CLOSED)).toBe(true);
  });

  it('isEscrowTerminal returns false for all non-terminal states', () => {
    expect(isEscrowTerminal(EscrowState.PENDING_CREATION)).toBe(false);
    expect(isEscrowTerminal(EscrowState.FUNDS_LOCKED)).toBe(false);
    expect(isEscrowTerminal(EscrowState.DISPUTE_HOLD)).toBe(false);
  });
});

describe('MOD-005 Escrow State Machine â€” Error Messages', () => {
  it('includes current and target status in error message', () => {
    try {
      validateEscrowTransition(EscrowState.PENDING_CREATION, EscrowState.ESCROW_CLOSED);
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
      validateEscrowTransition(EscrowState.FUNDS_INITIATED, EscrowState.ESCROW_CLOSED);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect((error as any).details.allowedTransitions).toContain(EscrowState.FUNDS_LOCKED);
      }
    }
  });
});

