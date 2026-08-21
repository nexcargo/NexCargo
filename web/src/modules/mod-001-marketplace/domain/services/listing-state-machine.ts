// NexCargo MOD-001 Listing State Machine
// Authorized by HAO-WAVE1-002 — Wave 1 Increment 2: State Machines and Business Logic
// Per MOD-001 §3.2 state machine
//   DRAFT → PUBLISHED → EXPIRED | CANCELLED | BOOKED → COMPLETED

import { ListingStatus } from '../enums';
import { ValidationError } from '@/shared/errors/app-errors';

/** Valid state transitions for ShipmentListing per MOD-001 §3.2 */
const VALID_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  [ListingStatus.DRAFT]: [ListingStatus.PUBLISHED],
  [ListingStatus.PUBLISHED]: [ListingStatus.EXPIRED, ListingStatus.CANCELLED, ListingStatus.BOOKED],
  [ListingStatus.EXPIRED]: [],
  [ListingStatus.CANCELLED]: [],
  [ListingStatus.BOOKED]: [ListingStatus.COMPLETED],
  [ListingStatus.COMPLETED]: [],
};

/**
 * Validate whether a state transition is permitted for a listing.
 * 
 * @param currentStatus - Current status of the listing
 * @param targetStatus - Desired new status
 * @throws ValidationError if transition is invalid
 */
export function validateListingTransition(currentStatus: ListingStatus, targetStatus: ListingStatus): void {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];

  if (!allowedTransitions) {
    throw new ValidationError(
      `Unknown listing status: ${currentStatus}`,
      { currentStatus },
    );
  }

  if (!allowedTransitions.includes(targetStatus)) {
    throw new ValidationError(
      `Invalid listing state transition from ${currentStatus} to ${targetStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`,
      { currentStatus, targetStatus, allowedTransitions },
    );
  }
}

/**
 * Execute a listing state transition. Returns the new status after validation.
 * This is an advisory-only function — it does NOT persist state or emit events.
 * Persistence and event emission are handled by the application layer.
 * 
 * @param currentStatus - Current status of the listing
 * @param targetStatus - Desired new status
 * @returns The validated new status
 */
export function applyListingTransition(currentStatus: ListingStatus, targetStatus: ListingStatus): ListingStatus {
  validateListingTransition(currentStatus, targetStatus);
  return targetStatus;
}

/**
 * Check if a listing is in a terminal state (no further transitions allowed).
 * Terminal states: EXPIRED, CANCELLED, COMPLETED
 * 
 * @param status - Current listing status
 * @returns true if the listing cannot transition further
 */
export function isListingTerminal(status: ListingStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0 && !VALID_TRANSITIONS[status]?.includes(status);
}
