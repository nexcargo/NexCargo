// NexCargo MOD-001 Offer State Machine
// Authorized by HAO-WAVE1-002 — Wave 1 Increment 2: State Machines and Business Logic
// Per MOD-001 §3.2 state machine
//   SUBMITTED ↔ WITHDRAWN | ACCEPTED | REJECTED | EXPIRED
// Constraint: An offer cannot be modified after submission (only withdrawn)
// Constraint: A listing can have exactly one accepted offer at any time

import { OfferStatus } from '../enums';
import { ValidationError } from '@/shared/errors/app-errors';

/** Valid state transitions for TransportOffer per MOD-001 §3.2 */
const VALID_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  [OfferStatus.SUBMITTED]: [OfferStatus.WITHDRAWN, OfferStatus.ACCEPTED, OfferStatus.REJECTED, OfferStatus.EXPIRED],
  [OfferStatus.WITHDRAWN]: [OfferStatus.SUBMITTED],
  [OfferStatus.ACCEPTED]: [],
  [OfferStatus.REJECTED]: [],
  [OfferStatus.EXPIRED]: [],
};

/**
 * Validate whether a state transition is permitted for an offer.
 * 
 * @param currentStatus - Current status of the offer
 * @param targetStatus - Desired new status
 * @throws ValidationError if transition is invalid
 */
export function validateOfferTransition(currentStatus: OfferStatus, targetStatus: OfferStatus): void {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];

  if (!allowedTransitions) {
    throw new ValidationError(
      `Unknown offer status: ${currentStatus}`,
      { currentStatus },
    );
  }

  if (!allowedTransitions.includes(targetStatus)) {
    throw new ValidationError(
      `Invalid offer state transition from ${currentStatus} to ${targetStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`,
      { currentStatus, targetStatus, allowedTransitions },
    );
  }
}

/**
 * Execute an offer state transition. Returns the new status after validation.
 * This is an advisory-only function — it does NOT persist state or emit events.
 * Persistence and event emission are handled by the application layer.
 * 
 * @param currentStatus - Current status of the offer
 * @param targetStatus - Desired new status
 * @returns The validated new status
 */
export function applyOfferTransition(currentStatus: OfferStatus, targetStatus: OfferStatus): OfferStatus {
  validateOfferTransition(currentStatus, targetStatus);
  return targetStatus;
}

/**
 * Check if an offer is in a terminal state (no further transitions allowed).
 * Terminal states: ACCEPTED, REJECTED, EXPIRED
 * Non-terminal states: SUBMITTED, WITHDRAWN
 * 
 * @param status - Current offer status
 * @returns true if the offer cannot transition further
 */
export function isOfferTerminal(status: OfferStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}
