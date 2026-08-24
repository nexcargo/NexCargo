// NexCargo MOD-001 — Listings Publish Action
// Authorized by HAO-WAVE1-005 — Wave 1 Increment 5: Match Proposals & Quote Generation
// Per MOD-001 §5.1 — Listing transitions DRAFT → PUBLISHED

import { ListingStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { applyListingTransition, isListingTerminal } from '@/modules/mod-001-marketplace/domain/services/listing-state-machine';
import { ValidationError } from '@/shared/errors/app-errors';

/**
 * Transitions a listing from DRAFT to PUBLISHED state.
 * Per MOD-001 §5.1 + §3.2 state machine.
 * 
 * Validation:
 * - Current status must be DRAFT
 * - Target status must be PUBLISHED
 * - Listing must have passed validation (required fields present)
 * 
 * Advisory-only: does NOT auto-book or trigger financial actions.
 * Actual persistence handled by application layer / database layer.
 * 
 * @param currentStatus - Current listing status
 * @returns The validated new status (PUBLISHED)
 * @throws ValidationError if transition is invalid
 */
export function publishListing(currentStatus: ListingStatus): ListingStatus {
  // Only DRAFT listings can be published
  if (currentStatus !== ListingStatus.DRAFT) {
    throw new ValidationError(
      `Cannot publish listing in "${currentStatus}" state. Only DRAFT listings can be published.`,
    );
  }

  // Apply state transition (advisory validation)
  const newStatus = applyListingTransition(ListingStatus.DRAFT, ListingStatus.PUBLISHED);
  
  // Verify we reached PUBLISHED state
  if (newStatus !== ListingStatus.PUBLISHED) {
    throw new ValidationError(`Unexpected state transition result: ${newStatus}`);
  }

  return newStatus;
}

/**
 * Checks whether a listing is currently publishable.
 * A listing is publishable when:
 * - Its status is DRAFT
 * - It is not in a terminal state
 * 
 * @param currentStatus - Current listing status
 * @returns true if the listing can be published
 */
export function isListingPublishable(currentStatus: ListingStatus): boolean {
  return currentStatus === ListingStatus.DRAFT && !isListingTerminal(currentStatus);
}
