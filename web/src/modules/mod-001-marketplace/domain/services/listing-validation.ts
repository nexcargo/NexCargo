// NexCargo MOD-001 Listing Validation Service
// Authorized by HAO-WAVE1-002 — Wave 1 Increment 2: State Machines and Business Logic
// Per MOD-001 §5.1 validation constraints

import { ShipmentListing } from '../types/listings';
import { ValidationError } from '@/shared/errors/app-errors';

/**
 * Validate required fields for a shipment listing publication.
 * 
 * Per MOD-001 §5.1:
 *   - Cannot be published without: origin, destination, cargoType,
 *     and at least one of weight or volume
 * 
 * @param listing - The listing to validate
 * @throws ValidationError if any required field is missing or invalid
 */
export function validateListingRequiredFields(listing: ShipmentListing): void {
  const errors: string[] = [];

  // Origin must have coordinates and address
  if (!listing.origin || !listing.origin.latitude || !listing.origin.longitude || !listing.origin.address) {
    errors.push('Origin must include latitude, longitude, and address');
  }

  // Destination must have coordinates and address
  if (!listing.destination || !listing.destination.latitude || !listing.destination.longitude || !listing.destination.address) {
    errors.push('Destination must include latitude, longitude, and address');
  }

  // Cargo type is required
  if (!listing.cargoType) {
    errors.push('Cargo type is required for publication');
  }

  // At least one of weight or volume is required
  if (listing.weightKg == null && listing.weightKg !== 0) {
    if (listing.volumeM3 == null && listing.volumeM3 !== 0) {
      errors.push('At least one of weight or volume must be specified');
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Listing validation failed: ${errors.join('; ')}`,
      { listingId: listing.listingId, errors },
    );
  }
}

/**
 * Validate time window constraints.
 * 
 * Per MOD-001 §5.1: timeWindow must have a valid start and end.
 * earliestPickup must be before latestDelivery.
 * 
 * @param listing - The listing with time window to validate
 * @throws ValidationError if time window is invalid
 */
export function validateTimeWindow(listing: ShipmentListing): void {
  if (!listing.timeWindow || !listing.timeWindow.earliestPickup || !listing.timeWindow.latestDelivery) {
    throw new ValidationError(
      'Time window must include both earliestPickup and latestDelivery',
      { listingId: listing.listingId },
    );
  }

  const pickupDate = new Date(listing.timeWindow.earliestPickup);
  const deliveryDate = new Date(listing.timeWindow.latestDelivery);

  if (isNaN(pickupDate.getTime())) {
    throw new ValidationError(
      'Time window earliestPickup is not a valid date',
      { listingId: listing.listingId, earliestPickup: listing.timeWindow.earliestPickup },
    );
  }

  if (isNaN(deliveryDate.getTime())) {
    throw new ValidationError(
      'Time window latestDelivery is not a valid date',
      { listingId: listing.listingId, latestDelivery: listing.timeWindow.latestDelivery },
    );
  }

  if (pickupDate >= deliveryDate) {
    throw new ValidationError(
      'Time window earliestPickup must be before latestDelivery',
      { listingId: listing.listingId, earliestPickup: listing.timeWindow.earliestPickup, latestDelivery: listing.timeWindow.latestDelivery },
    );
  }
}

/**
 * Check if two listings are potential duplicates.
 * 
 * Per MOD-001 §5.1: Duplicate listings (same shipper, same route,
 * overlapping time window) are flagged for review.
 * 
 * A duplicate is identified when ALL of the following match:
 *   - Same shipper ID
 *   - Same origin address (string comparison)
 *   - Same destination address (string comparison)
 *   - Overlapping time windows (earliestPickup < other.latestDelivery AND latestDelivery > other.earliestPickup)
 * 
 * @param candidate - The listing being checked
 * @param existingListings - List of existing listings to compare against
 * @returns Array of potentially duplicate listings found
 */
export function findDuplicateListings(candidate: ShipmentListing, existingListings: ShipmentListing[]): ShipmentListing[] {
  return existingListings.filter((existing) => {
    // Skip self-comparison
    if (existing.id === candidate.id || existing.listingId === candidate.listingId) {
      return false;
    }

    // Same shipper
    if (existing.shipperId !== candidate.shipperId) {
      return false;
    }

    // Same route (origin and destination addresses)
    if (existing.origin.address !== candidate.origin.address) {
      return false;
    }
    if (existing.destination.address !== candidate.destination.address) {
      return false;
    }

    // Overlapping time windows
    const candidateStart = new Date(candidate.timeWindow.earliestPickup).getTime();
    const candidateEnd = new Date(candidate.timeWindow.latestDelivery).getTime();
    const existingStart = new Date(existing.timeWindow.earliestPickup).getTime();
    const existingEnd = new Date(existing.timeWindow.latestDelivery).getTime();

    return candidateStart < existingEnd && candidateEnd > existingStart;
  });
}
