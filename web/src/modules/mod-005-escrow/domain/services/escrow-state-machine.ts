// NexCargo MOD-005 — Escrow State Machine
// Wave 2 — Phase 2A, Increment 1 — Authorized per HAO-MOD005-INC1
// Reference: MOD-005 §4.1 (Escrow Account), §5.1 (Escrow Lifecycle Model)
//
// Escrow lifecycle per MOD-005 §5.1:
//   PENDING_CREATION → FUNDS_INITIATED → FUNDS_LOCKED → [DisputeHold] → PARTIAL_RELEASE | FINAL_RELEASE → ESCROW_CLOSED

import { EscrowState } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Valid transition map — single source of truth per MOD-005 §5.1
// ============================================================

const VALID_TRANSITIONS: Record<EscrowState, EscrowState[]> = {
  [EscrowState.PENDING_CREATION]: [EscrowState.FUNDS_INITIATED],
  [EscrowState.FUNDS_INITIATED]: [EscrowState.FUNDS_LOCKED],
  [EscrowState.FUNDS_LOCKED]: [EscrowState.PARTIAL_RELEASE, EscrowState.FINAL_RELEASE, EscrowState.DISPUTE_HOLD],
  [EscrowState.PARTIAL_RELEASE]: [EscrowState.FINAL_RELEASE],
  [EscrowState.FINAL_RELEASE]: [EscrowState.ESCROW_CLOSED],
  [EscrowState.DISPUTE_HOLD]: [EscrowState.PARTIAL_RELEASE, EscrowState.FINAL_RELEASE],
  [EscrowState.ESCROW_CLOSED]: [],
};

// ============================================================
// Helper: get allowed transitions for a given status
// ============================================================

function getAllowedTransitions(status: EscrowState): EscrowState[] {
  return [...VALID_TRANSITIONS[status]];
}

// ============================================================
// validateEscrowTransition — throws ValidationError if invalid
// Per MOD-005 §7.3: "Escrow state transitions MUST be triggered by events"
// No manual or implicit state transitions are allowed.
// ============================================================

export function validateEscrowTransition(
  currentStatus: EscrowState,
  targetStatus: EscrowState,
): void {
  const allowed = getAllowedTransitions(currentStatus);

  if (!allowed.includes(targetStatus)) {
    throw new ValidationError(`Invalid escrow transition: ${currentStatus} → ${targetStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`, {
      currentStatus,
      targetStatus,
      allowedTransitions: allowed,
    });
  }
}

// ============================================================
// applyEscrowTransition — returns validated new state (advisory-only, no persistence)
// ============================================================

export function applyEscrowTransition(
  currentStatus: EscrowState,
  targetStatus: EscrowState,
): EscrowState {
  validateEscrowTransition(currentStatus, targetStatus);
  return targetStatus;
}

// ============================================================
// isEscrowTerminal — returns true if no further transitions allowed
// Terminal states: ESCROW_CLOSED
// ============================================================

export function isEscrowTerminal(status: EscrowState): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}
