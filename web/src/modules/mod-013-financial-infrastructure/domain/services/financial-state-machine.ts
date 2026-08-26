// NexCargo MOD-013 — Financial Flow State Machine
// Wave 2 — Phase 2A, Increment 2 — Authorized per HAO-MOD013-INC2
// Reference: MOD-013 §5.5 (Financial Flow State Machine), §7.3 (Escrow Immutability Rule)
//
// Per MOD-013 §7.3: "Escrow states MUST follow strict transitions. No direct state overrides are allowed."
// Financial flows must be event-driven as per §7.3 and §5.2 Event-Driven Financial Flow.

import { EscrowState } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Valid transition map — single source of truth per MOD-013 §5.5
// Mirrors the authorized financial flow state machine:
//   PAYMENT INITIATED → PAYMENT CONFIRMED → ESCROW ACTIVATED → [Partial Release Optional]
//     → DELIVERY CONFIRMED → SETTLEMENT EXECUTED → LEDGER UPDATED → RECONCILIATION
// Dispute path: ESCROW HELD → DISPUTE RAISED → BANK FREEZE → RESOLUTION → RELEASE/REFUND/SPLIT
// ============================================================

const VALID_TRANSITIONS: Record<EscrowState, EscrowState[]> = {
  /** PENDING_CREATION — escrow account being established */
  [EscrowState.PENDING_CREATION]: [EscrowState.FUNDS_INITIATED],
  /** FUNDS_INITIATED — shipper has initiated payment */
  [EscrowState.FUNDS_INITIATED]: [EscrowState.FUNDS_LOCKED],
  /** FUNDS_LOCKED — bank confirms deposit held */
  [EscrowState.FUNDS_LOCKED]: [
    EscrowState.PARTIAL_RELEASE,
    EscrowState.FINAL_RELEASE,
    EscrowState.DISPUTE_HOLD,
  ],
  /** PARTIAL_RELEASE — milestone-based partial release executed */
  [EscrowState.PARTIAL_RELEASE]: [EscrowState.FINAL_RELEASE],
  /** FINAL_RELEASE — all remaining amounts released */
  [EscrowState.FINAL_RELEASE]: [EscrowState.ESCROW_CLOSED],
  /** DISPUTE_HOLD — bank freeze pending resolution */
  [EscrowState.DISPUTE_HOLD]: [
    EscrowState.PARTIAL_RELEASE,
    EscrowState.FINAL_RELEASE,
  ],
  /** ESCROW_CLOSED — final terminal state */
  [EscrowState.ESCROW_CLOSED]: [],
};

// ============================================================
// Helper: get allowed transitions for a given status
// ============================================================

function getAllowedTransitions(status: EscrowState): EscrowState[] {
  return [...VALID_TRANSITIONS[status]];
}

// ============================================================
// validateFinancialTransition — throws ValidationError if invalid
// Per MOD-013 §7.3: no manual or implicit state transitions are allowed.
// All changes must be event-driven from external events (§5.2).
// ============================================================

export function validateFinancialTransition(
  currentStatus: EscrowState,
  targetStatus: EscrowState,
): void {
  const allowed = getAllowedTransitions(currentStatus);

  if (!allowed.includes(targetStatus)) {
    throw new ValidationError(`Invalid financial transition: ${currentStatus} → ${targetStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`, {
      currentStatus,
      targetStatus,
      allowedTransitions: allowed,
    });
  }
}

// ============================================================
// applyFinancialTransition — returns validated new state (advisory-only, no persistence)
// Per MOD-013 §5.4: "MOD-013 defines structure; ESS-001F defines execution rules; banks execute actual fund movement."
// This validates that the proposed transition is authorized but does NOT persist it.
// ============================================================

export function applyFinancialTransition(
  currentStatus: EscrowState,
  targetStatus: EscrowState,
): EscrowState {
  validateFinancialTransition(currentStatus, targetStatus);
  return targetStatus;
}

// ============================================================
// isFinancialTerminal — returns true if no further transitions allowed
// Terminal states: ESCROW_CLOSED only.
// PER MOD-013 §7.3: Escrow states MUST follow strict transitions with no overrides.
// ============================================================

export function isFinancialTerminal(status: EscrowState): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}
