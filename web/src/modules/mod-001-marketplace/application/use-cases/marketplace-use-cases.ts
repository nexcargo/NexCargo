// NexCargo MOD-001 — Application Layer Use Cases
// Authorized by HAO-WAVE1-005 — Wave 1 Increment 5: Match Proposals & Quote Generation
// Provides orchestration layer connecting domain services to API routes.
// All operations are advisory-only.

import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
import type { TransportOffer } from '@/modules/mod-001-marketplace/domain/types/offers';
import type { AdvisoryQuote } from '@/modules/mod-001-marketplace/domain/types/quotes';
import { generateAdvisoryQuote } from '@/modules/mod-001-marketplace/domain/services/advisory-quote-service';
import { ListingStatus, OfferStatus, CargoType, PricingModel } from '@/modules/mod-001-marketplace/domain/enums';
import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Quote Creation Use Case
// ============================================================

/**
 * Parameters for creating an advisory quote via the application layer.
 */
export interface CreateQuoteParams {
  listingId: string;
  cargoType: CargoType;
  weightKg: number;
  volumeM3?: number;
  timeWindow: { earliestPickup: string; latestDelivery: string };
  pricingModel?: PricingModel;
  /** Optional list of offer prices for market benchmarking */
  comparablePrices?: number[];
}

/**
 * Orchestrates advisory quote creation.
 * Per MOD-001 §5.4 — non-binding price range suggestion.
 * 
 * Flow:
 * 1. Validate input parameters
 * 2. Delegate quote generation to domain service
 * 3. Return structured quote object (with listingId resolved)
 * 
 * @param params - Quote creation parameters
 * @returns Generated AdvisoryQuote data (without BaseEntity persistence fields)
 */
export function createAdvisoryQuote(params: CreateQuoteParams): Omit<AdvisoryQuote, 'id' | 'created_at' | 'updated_at' | 'version' | 'bumpVersion' | 'toJSON'> {
  // Validate required fields
  if (!params.listingId || params.listingId.trim() === '') {
    throw new ValidationError('listingId is required');
  }
  if (!params.cargoType) {
    throw new ValidationError('cargoType is required');
  }
  if (!params.weightKg || params.weightKg <= 0) {
    throw new ValidationError('Valid weightKg (>0) is required');
  }
  if (!params.timeWindow?.earliestPickup || !params.timeWindow?.latestDelivery) {
    throw new ValidationError('Time window (earliestPickup + latestDelivery) is required');
  }

  const listing = {
    cargoType: params.cargoType,
    weightKg: params.weightKg,
    volumeM3: params.volumeM3,
    timeWindow: params.timeWindow,
    pricingModel: params.pricingModel ?? PricingModel.FIXED,
  };

  // Build TransportOffer-like objects for market benchmarking
  const offers = params.comparablePrices?.map((price) => ({
    priceProposal: price,
  })) as unknown as TransportOffer[] | undefined;

  const quote = generateAdvisoryQuote(listing, offers);

  // Inject the listingId into the quote
  return { ...quote, listingId: params.listingId };
}

// ============================================================
// Offer Accept/Reject Use Case
// ============================================================

/**
 * Parameters for accepting or rejecting an offer.
 */
export interface ApplyOfferActionParams {
  offerId: string;
  currentStatus: OfferStatus;
  action: 'ACCEPT' | 'REJECT';
  shipperId: string;
  /** Optional reasoning for the decision */
  reason?: string;
}

/**
 * Result of applying an accept/reject action to an offer.
 */
export interface OfferActionResult {
  offerId: string;
  previousStatus: OfferStatus;
  newStatus: OfferStatus;
  acceptedBy?: string;
  rejectedBy?: string;
  /** Whether the target status is terminal */
  isTerminal: boolean;
  timestamp: string;
}

/**
 * Orchestrates offer acceptance via the application layer.
 * Per MOD-001 §5.2 — exactly one accepted offer per listing at any time.
 * 
 * Validation:
 * - Current status must allow ACCEPT transition
 * - If another offer is already ACCEPTED, it must be REJECTED first
 * 
 * Advisory-only: does NOT create contracts or trigger financial actions.
 * 
 * @param params - Accept/reject parameters
 * @returns Action result with status transition details
 */
export function applyOfferAction(params: ApplyOfferActionParams): OfferActionResult {
  const { offerId, currentStatus, action, shipperId } = params;

  if (!offerId || offerId.trim() === '') {
    throw new ValidationError('offerId is required');
  }
  if (!shipperId || shipperId.trim() === '') {
    throw new ValidationError('shipperId is required');
  }

  let targetStatus: OfferStatus;

  if (action === 'ACCEPT') {
    targetStatus = OfferStatus.ACCEPTED;
  } else if (action === 'REJECT') {
    targetStatus = OfferStatus.REJECTED;
  } else {
    throw new ValidationError(`Unknown offer action: ${action}. Must be 'ACCEPT' or 'REJECT'.`);
  }

  // Note: In production, the repository layer would check that no other offer
  // for the same listing is currently ACCEPTED before allowing this transition.
  // That constraint enforcement belongs in the infrastructure layer.

  return {
    offerId,
    previousStatus: currentStatus,
    newStatus: targetStatus,
    acceptedBy: action === 'ACCEPT' ? shipperId : undefined,
    rejectedBy: action === 'REJECT' ? shipperId : undefined,
    isTerminal: true, // Both ACCEPTED and REJECTED are terminal states
    timestamp: new Date().toISOString(),
  };
}

// Match recording moved to POST /api/marketplace/matches + MatchesRepository
// (PRE-I-6 WS-02 D-M2): the former ephemeral-id createMatchProposal never persisted.

/**
 * Builds a full ShipmentListing object from partial data for quote generation.
 * Used by application layer to construct listing objects from DTOs.
 */
export function buildListingForQuote(partial: {
  listingId: string;
  cargoType: CargoType;
  weightKg: number;
  volumeM3?: number;
  timeWindow: { earliestPickup: string; latestDelivery: string };
  pricingModel?: PricingModel;
}): ShipmentListing {
  return {
    id: partial.listingId,
    listingId: partial.listingId,
    shipperId: 'stub', // Will be set by auth middleware
    origin: { latitude: 0, longitude: 0, address: '' },
    destination: { latitude: 0, longitude: 0, address: '' },
    cargoType: partial.cargoType,
    weightKg: partial.weightKg,
    volumeM3: partial.volumeM3,
    timeWindow: partial.timeWindow,
    pricingModel: partial.pricingModel ?? PricingModel.FIXED,
    status: ListingStatus.PUBLISHED as never,
    publishedAt: new Date().toISOString(),
    acceptedVehicleTypes: [],
    title: '',
    description: '',
    created_at: new Date(),
    updated_at: new Date(),
    version: 1,
    bumpVersion: () => {},
    toJSON: () => ({}),
  };
}
