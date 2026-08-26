// NexCargo MOD-002 — Contract State Machine Tests
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Increment: MOD-002 Increment 1 (Phase 1 — Core Contract Formation)
// Reference: MOD-002 §4.2, §5.2 (Contract Lifecycle States), §7.7 (Neutrality Rule)
// Authority: Uses local ContractStatus enum from entities.ts matching MOD-002 spec.

import { describe, it, expect } from 'vitest';
import {
  validateContractTransition,
  applyContractTransition,
  isContractTerminal,
  canTerminateContract,
  runContractLifecycleChain,
} from '@/modules/mod-002-booking/domain/services/contract-state-machine';
import { ContractStatus } from '@/modules/mod-002-booking/domain/types/entities';
import { ValidationError } from '@/shared/errors/app-errors';

describe('MOD-002 Contract State Machine — Valid Transitions', () => {
  describe('DRAFT → PENDING_APPROVAL', () => {
    it('allows DRAFT to PENDING_APPROVAL transition', () => {
      expect(() => validateContractTransition(ContractStatus.DRAFT, ContractStatus.PENDING_APPROVAL)).not.toThrow();
      const result = applyContractTransition(ContractStatus.DRAFT, ContractStatus.PENDING_APPROVAL);
      expect(result).toBe(ContractStatus.PENDING_APPROVAL);
    });

    it('rejects DRAFT directly to ACTIVE (skips review)', () => {
      expect(() => validateContractTransition(ContractStatus.DRAFT, ContractStatus.ACTIVE))
        .toThrow(ValidationError);
    });

    it('rejects DRAFT to SIGNED (uses PENDING_APPROVAL first)', () => {
      expect(() => validateContractTransition(ContractStatus.DRAFT, ContractStatus.COMPLETED))
        .toThrow(ValidationError);
    });
  });

  describe('PENDING_APPROVAL → ACTIVE or back to DRAFT', () => {
    it('allows PENDING_APPROVAL to ACTIVE transition', () => {
      expect(() => validateContractTransition(ContractStatus.PENDING_APPROVAL, ContractStatus.ACTIVE)).not.toThrow();
      const result = applyContractTransition(ContractStatus.PENDING_APPROVAL, ContractStatus.ACTIVE);
      expect(result).toBe(ContractStatus.ACTIVE);
    });

    it('allows PENDING_APPROVAL back to DRAFT (review loop for revision)', () => {
      expect(() => validateContractTransition(ContractStatus.PENDING_APPROVAL, ContractStatus.DRAFT)).not.toThrow();
      const result = applyContractTransition(ContractStatus.PENDING_APPROVAL, ContractStatus.DRAFT);
      expect(result).toBe(ContractStatus.DRAFT);
    });

    it('rejects PENDING_APPROVAL to COMPLETED (must pass through ACTIVE)', () => {
      expect(() => validateContractTransition(ContractStatus.PENDING_APPROVAL, ContractStatus.COMPLETED))
        .toThrow(ValidationError);
    });
  });

  describe('ACTIVE → AMENDED | SUSPENDED | TERMINATED', () => {
    it('allows ACTIVE to AMENDED transition', () => {
      expect(() => validateContractTransition(ContractStatus.ACTIVE, ContractStatus.AMENDED)).not.toThrow();
      const result = applyContractTransition(ContractStatus.ACTIVE, ContractStatus.AMENDED);
      expect(result).toBe(ContractStatus.AMENDED);
    });

    it('allows ACTIVE to SUSPENDED transition', () => {
      expect(() => validateContractTransition(ContractStatus.ACTIVE, ContractStatus.SUSPENDED)).not.toThrow();
      const result = applyContractTransition(ContractStatus.ACTIVE, ContractStatus.SUSPENDED);
      expect(result).toBe(ContractStatus.SUSPENDED);
    });

    it('allows ACTIVE to TERMINATED transition', () => {
      expect(() => validateContractTransition(ContractStatus.ACTIVE, ContractStatus.TERMINATED)).not.toThrow();
      const result = applyContractTransition(ContractStatus.ACTIVE, ContractStatus.TERMINATED);
      expect(result).toBe(ContractStatus.TERMINATED);
    });

    it('rejects ACTIVE to COMPLETED (must go through amendment/suspension/termination)', () => {
      expect(() => validateContractTransition(ContractStatus.ACTIVE, ContractStatus.COMPLETED))
        .toThrow(ValidationError);
    });
  });

  describe('AMENDED → ACTIVE or TERMINATED', () => {
    it('allows AMENDED back to ACTIVE (amended contract becomes active)', () => {
      expect(() => validateContractTransition(ContractStatus.AMENDED, ContractStatus.ACTIVE)).not.toThrow();
      const result = applyContractTransition(ContractStatus.AMENDED, ContractStatus.ACTIVE);
      expect(result).toBe(ContractStatus.ACTIVE);
    });

    it('allows AMENDED to TERMINATED', () => {
      expect(() => validateContractTransition(ContractStatus.AMENDED, ContractStatus.TERMINATED)).not.toThrow();
    });

    it('rejects AMENDED to COMPLETED directly', () => {
      expect(() => validateContractTransition(ContractStatus.AMENDED, ContractStatus.COMPLETED))
        .toThrow(ValidationError);
    });
  });

  describe('SUSPENDED → ACTIVE or TERMINATED', () => {
    it('allows SUSPENDED to ACTIVE (resumption after suspension lifted)', () => {
      expect(() => validateContractTransition(ContractStatus.SUSPENDED, ContractStatus.ACTIVE)).not.toThrow();
      const result = applyContractTransition(ContractStatus.SUSPENDED, ContractStatus.ACTIVE);
      expect(result).toBe(ContractStatus.ACTIVE);
    });

    it('allows SUSPENDED to TERMINATED (termination during suspension)', () => {
      expect(() => validateContractTransition(ContractStatus.SUSPENDED, ContractStatus.TERMINATED)).not.toThrow();
    });
  });
});

describe('MOD-002 Contract State Machine — Terminal States', () => {
  it('COMPLETED has no outgoing transitions', () => {
    expect(() => validateContractTransition(ContractStatus.COMPLETED, ContractStatus.TERMINATED))
      .toThrow(ValidationError);
  });

  it('TERMINATED has no outgoing transitions', () => {
    expect(() => validateContractTransition(ContractStatus.TERMINATED, ContractStatus.COMPLETED))
      .toThrow(ValidationError);
  });

  it('no terminal state allows self-transition', () => {
    expect(() => validateContractTransition(ContractStatus.COMPLETED, ContractStatus.COMPLETED))
      .toThrow(ValidationError);
    expect(() => validateContractTransition(ContractStatus.TERMINATED, ContractStatus.TERMINATED))
      .toThrow(ValidationError);
  });
});

describe('MOD-002 Contract State Machine — Terminal Detection', () => {
  it('isContractTerminal returns true for COMPLETED', () => {
    expect(isContractTerminal(ContractStatus.COMPLETED)).toBe(true);
  });

  it('isContractTerminal returns true for TERMINATED', () => {
    expect(isContractTerminal(ContractStatus.TERMINATED)).toBe(true);
  });

  it('isContractTerminal returns false for non-terminal states', () => {
    expect(isContractTerminal(ContractStatus.DRAFT)).toBe(false);
    expect(isContractTerminal(ContractStatus.PENDING_APPROVAL)).toBe(false);
    expect(isContractTerminal(ContractStatus.ACTIVE)).toBe(false);
    expect(isContractTerminal(ContractStatus.AMENDED)).toBe(false);
    expect(isContractTerminal(ContractStatus.SUSPENDED)).toBe(false);
  });
});

describe('MOD-002 Contract State Machine — Termination Gate', () => {
  it('canTerminateContract allows termination from all non-terminal states', () => {
    const nonTerminals: ContractStatus[] = [
      ContractStatus.DRAFT,
      ContractStatus.PENDING_APPROVAL,
      ContractStatus.ACTIVE,
      ContractStatus.AMENDED,
      ContractStatus.SUSPENDED,
    ];
    for (const status of nonTerminals) {
      expect(canTerminateContract(status)).toBe(true);
    }
  });

  it('canTerminateContract blocks termination from terminal states', () => {
    expect(canTerminateContract(ContractStatus.COMPLETED)).toBe(false);
    expect(canTerminateContract(ContractStatus.TERMINATED)).toBe(false);
  });
});

describe('MOD-002 Contract State Machine — Full Lifecycle Chain', () => {
  it('runs through the primary path: DRAFT → PENDING_APPROVAL → ACTIVE', () => {
    const chain = runContractLifecycleChain();
    expect(chain).toHaveLength(3);
    expect(chain[0]).toBe(ContractStatus.DRAFT);
    expect(chain[1]).toBe(ContractStatus.PENDING_APPROVAL);
    expect(chain[2]).toBe(ContractStatus.ACTIVE);
  });

  it('path ends at a non-terminal state (COMPLETED requires DeliveryConfirmed from MOD-003)', () => {
    const chain = runContractLifecycleChain();
    // Per MOD-002 §4.2: "The contract cannot reach COMPLETED until MOD‑003 emits a DeliveryConfirmed event"
    // The lifecycle helper stops at ACTIVE because COMPLETED is triggered externally
    expect(isContractTerminal(chain[chain.length - 1])).toBe(false);
  });

  it('supports amendment cycle: DRAFT → PENDING_APPROVAL → ACTIVE → AMENDED → ACTIVE', () => {
    let status: ContractStatus = ContractStatus.DRAFT;
    status = applyContractTransition(status, ContractStatus.PENDING_APPROVAL);
    status = applyContractTransition(status, ContractStatus.ACTIVE);
    status = applyContractTransition(status, ContractStatus.AMENDED);
    status = applyContractTransition(status, ContractStatus.ACTIVE); // amended returns to active
    expect(status).toBe(ContractStatus.ACTIVE);
  });
});

describe('MOD-002 Contract State Machine — Error Messages', () => {
  it('includes current and target status in error details', () => {
    try {
      validateContractTransition(ContractStatus.DRAFT, ContractStatus.ACTIVE);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.details).toEqual(expect.objectContaining({
          currentStatus: ContractStatus.DRAFT,
          targetStatus: ContractStatus.ACTIVE,
          allowedTransitions: [ContractStatus.PENDING_APPROVAL],
        }));
      }
    }
  });

  it('lists allowed transitions in error message when none exist (terminal)', () => {
    try {
      validateContractTransition(ContractStatus.COMPLETED, ContractStatus.TERMINATED);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.message).toContain('none (terminal state)');
      }
    }
  });
});
