// NexCargo C4-III — Dispute Hold Service (Financial Protection)
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-005 §4.4 (DisputeRecord), §5.1 (Escrow Lifecycle Model with DISPUTE_HOLD path)
//            ESS-001F §5.3 (Escrow Rules — partial releases only at milestones)
//            C4 Readiness AC-008 (Dispute triggers hold)
// Scope: Minimal dispute/hold signal interface. Does NOT own MOD-015 dispute workflow.
//        Only handles: enter HOLD → accept resolution → enforce release transition.

import { EscrowState } from '@/shared/types/enums';
import { validateEscrowTransition } from '@/modules/mod-005-escrow/domain/services/escrow-state-machine';
import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Types
// ============================================================

export interface DisputeHoldSignal {
  escrowId: string;
  reason: string;
}

export interface DisputeResolutionOutcome {
  escrowId: string;
  outcome: 'RELEASE_TO_TRANSPORTER' | 'REFUND_TO_SHIPPER' | 'SPLIT_SETTLEMENT';
}

/** Resolution outcome maps to target escrow state */
const OUTCOME_TO_STATE: Record<string, EscrowState> = {
  RELEASE_TO_TRANSPORTER: EscrowState.FINAL_RELEASE,
  REFUND_TO_SHIPPER: EscrowState.PARTIAL_RELEASE,
  SPLIT_SETTLEMENT: EscrowState.PARTIAL_RELEASE,
};

// ============================================================
// triggerDisputeHold — Enters DISPUTE_HOLD from FUNDS_LOCKED
// ============================================================

/**
 * Validates and prepares DISPUTE_HOLD transition.
 * Does NOT persist — caller must use repository to apply.
 */
export function prepareDisputeHold(signal: DisputeHoldSignal): void {
  // Validate inputs
  if (!signal.escrowId || signal.escrowId.trim() === '') {
    throw new ValidationError('escrowId is required for dispute hold');
  }
  if (!signal.reason || signal.reason.length < 3) {
    throw new ValidationError('reason must be at least 3 characters');
  }

  // Verify source state can transition to DISPUTE_HOLD per MOD-005 §5.1
  try {
    validateEscrowTransition(EscrowState.FUNDS_LOCKED, EscrowState.DISPUTE_HOLD);
  } catch (e) {
    throw new ValidationError(
      `Cannot transition FUNDS_LOCKED → DISPUTE_HOLD: ${e instanceof Error ? e.message : 'state machine rejected'}`,
    );
  }
}

// ============================================================
// processDisputeResolution — Accepts external resolution outcome
// ============================================================

/**
 * Validates and prepares state transition from DISPUTE_HOLD to permitted final states.
 * Does NOT persist — caller must use repository to apply.
 * Per C4 lifecycle diagram: "DISPUTE_HOLD → PARTIAL_RELEASE/FINAL_RELEASE"
 */
export function prepareDisputeResolution(outcome: DisputeResolutionOutcome): void {
  // Validate outcome value
  const validOutcomes = ['RELEASE_TO_TRANSPORTER', 'REFUND_TO_SHIPPER', 'SPLIT_SETTLEMENT'];
  if (!validOutcomes.includes(outcome.outcome)) {
    throw new ValidationError(
      `Invalid outcome: ${outcome.outcome}. Allowed: ${validOutcomes.join(', ')}`,
    );
  }

  if (!outcome.escrowId || outcome.escrowId.trim() === '') {
    throw new ValidationError('escrowId is required for dispute resolution');
  }

  const targetState = OUTCOME_TO_STATE[outcome.outcome];

  // Verify DISPUTE_HOLD → target state is valid per MOD-005 §5.1
  try {
    validateEscrowTransition(EscrowState.DISPUTE_HOLD, targetState);
  } catch (e) {
    throw new ValidationError(
      `Cannot transition DISPUTE_HOLD → ${targetState}: ${e instanceof Error ? e.message : 'state machine rejected'}`,
    );
  }
}
