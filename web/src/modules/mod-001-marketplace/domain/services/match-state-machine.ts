// NexCargo MOD-001 MatchProposal State Machine
// Authorized by HAO-WAVE1-002 — Wave 1 Increment 2: State Machines and Business Logic
// Per MOD-001 §3.2 state machine
//   PROPOSED → ACCEPTED | REJECTED
// Acceptance rule (MOD-001 §5.3):
//   - A match proposal is generated only for PUBLISHED listings
//   - The shipper explicitly accepts a proposal, which transitions the listing to BOOKED
//     and triggers handoff to MOD-002 (Booking & Contract Management)

import { MatchStatus } from '../enums';
import { ValidationError } from '@/shared/errors/app-errors';

/** Valid state transitions for MatchProposal per MOD-001 §3.2 */
const VALID_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  [MatchStatus.PROPOSED]: [MatchStatus.ACCEPTED, MatchStatus.REJECTED],
  [MatchStatus.ACCEPTED]: [],
  [MatchStatus.REJECTED]: [],
};

/**
 * Validate whether a state transition is permitted for a match proposal.
 * 
 * @param currentStatus - Current status of the match proposal
 * @param targetStatus - Desired new status
 * @throws ValidationError if transition is invalid
 */
export function validateMatchTransition(currentStatus: MatchStatus, targetStatus: MatchStatus): void {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];

  if (!allowedTransitions) {
    throw new ValidationError(
      `Unknown match status: ${currentStatus}`,
      { currentStatus },
    );
  }

  if (!allowedTransitions.includes(targetStatus)) {
    throw new ValidationError(
      `Invalid match state transition from ${currentStatus} to ${targetStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`,
      { currentStatus, targetStatus, allowedTransitions },
    );
  }
}

/**
 * Execute a match proposal state transition. Returns the new status after validation.
 * This is an advisory-only function — it does NOT persist state or emit events.
 * Persistence and event emission are handled by the application layer.
 * 
 * @param currentStatus - Current status of the match proposal
 * @param targetStatus - Desired new status
 * @returns The validated new status
 */
export function applyMatchTransition(currentStatus: MatchStatus, targetStatus: MatchStatus): MatchStatus {
  validateMatchTransition(currentStatus, targetStatus);
  return targetStatus;
}

/**
 * Check if a match proposal is in a terminal state (no further transitions allowed).
 * Terminal states: ACCEPTED, REJECTED
 * Non-terminal states: PROPOSED
 * 
 * @param status - Current match status
 * @returns true if the match cannot transition further
 */
export function isMatchTerminal(status: MatchStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}
