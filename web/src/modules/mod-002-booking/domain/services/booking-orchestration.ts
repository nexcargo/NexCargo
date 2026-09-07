// NexCargo MOD-002 — Booking Orchestration Service
// C2-Increment 003: Marketplace → Booking handoff orchestration
// Authorized by HAO C2-003 Authorization (2026-09-07)
//
// Orchestrates the alignment-first atomic handoff from Marketplace match acceptance
// to Booking creation via PostgreSQL stored procedure RPC.

import { ValidationError } from '@/shared/errors/app-errors';
import { validateOfferListingAlignment, ListingRequirements, OfferDetails } from './offer-listing-alignment';
import { createClient } from '@/lib/supabase/server';

export interface HandoffResult {
  bookingId: string;
  status: string;
  matchId: string;
  listingId: string;
  success: boolean;
}

export interface HandoffContext {
  userId: string;
  email: string;
  role: string | null;
  listingId: string;
  offerId: string;
  transporterId: string;
  shipperId: string;
  correlationId?: string;
}

export interface AlignmentError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

/**
 * Execute the full C2 Marketplace → Booking handoff.
 * 
 * Flow:
 * 1. Extract listing/offer data snapshots via Supabase client
 * 2. Run offer-listing alignment validation (pre-acceptance gate)
 * 3. On alignment failure: abort, zero state changes
 * 4. On alignment success: call PostgreSQL atomic handoff RPC
 *    - Match PROPOSED → ACCEPTED
 *    - Listing PUBLISHED → BOOKED  
 *    - Booking created with status ALIGNMENT_CHECKED
 *    - All three as one indivisible unit
 *
 * @param context - Authorised context extracted from authenticated request
 * @returns HandoffResult with booking identity and status
 */
export async function executeMOD002Handoff(context: HandoffContext): Promise<HandoffResult> {
  // Phase 0: Validate required context
  if (!context.userId || !context.listingId || !context.offerId) {
    throw new ValidationError('Handoff context requires userId, listingId, and offerId', {
      missingFields: Object.entries(context).filter(([_, v]) => !v).map(([k]) => k),
    });
  }

  // Phase 1: Extract live data snapshots for alignment validation
  const supabase = await createClient();

  const [listingResult, offerResult] = await Promise.all([
    supabase.from('marketplace_schema.listings').select('*').eq('id', context.listingId).single(),
    supabase.from('marketplace_schema.offers').select('*').eq('id', context.offerId).single(),
  ]);

  if (listingResult.error) {
    throw new ValidationError(`Handoff failed: ${listingResult.error.message}`, {
      code: 'HANDOFF_LISTING_NOT_FOUND',
      listingId: context.listingId,
    });
  }

  if (offerResult.error) {
    throw new ValidationError(`Handoff failed: ${offerResult.error.message}`, {
      code: 'HANDOFF_OFFER_NOT_FOUND',
      offerId: context.offerId,
    });
  }

  const listingData = listingResult.data;
  const offerData = offerResult.data;

  // Map raw DB data to structured alignment validator interfaces
  const listingReqs: ListingRequirements = {
    requiredWeightKg: listingData.weight_kg as number ?? 0,
    requiredVolumeM3: listingData.volume_m3 as number | undefined,
    acceptedVehicleTypes: (listingData.accepted_vehicle_types as string[]) ?? listingData.accepted_vehicle_types ?? [],
  };

  const offerDets: OfferDetails = {
    declaredWeightKg: (offerData.declared_capacity as Record<string, unknown>)?.weightKg as number ?? offerData.declared_weight_kg as number ?? 0,
    declaredVolumeM3: (offerData.declared_capacity as Record<string, unknown>)?.volumeM3 as number | undefined ?? offerData.declared_volume_m3 as number | undefined,
    vehicleType: offerData.vehicle_type as string ?? offerData.vehicleType as string ?? '',
  };

  // Phase 2: Pre-acceptance alignment validation
  try {
    validateOfferListingAlignment(listingReqs, offerDets);
  } catch (validationError) {
    let message: string;
    let details: Record<string, unknown>;

    if (validationError instanceof ValidationError) {
      message = validationError.message;
      details = validationError.details ?? {};
    } else {
      message = validationError instanceof Error ? `Handoff failed: ${validationError.message}` : 'Alignment validation failed';
      details = {};
    }

    throw new ValidationError(message, {
      code: 'ALIGNMENT_FAILED',
      details,
      listingId: context.listingId,
      offerId: context.offerId,
    });
  }

  // Phase 3: Atomic database handoff via PostgreSQL stored procedure
  const rpcParams = {
    p_match_id: context.listingId,
    p_listing_id: context.listingId,
    p_offer_id: context.offerId,
    p_shipper_id: context.shipperId,
    p_transporter_id: context.transporterId,
  };

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'marketplace_book_handoff',
    rpcParams,
  );

  if (rpcError) {
    throw new ValidationError(`Handoff failed: ${rpcError.message}`, {
      code: 'HANDOFF_RPC_ERROR',
      rpcError: rpcError.message,
      listingId: context.listingId,
      offerId: context.offerId,
    });
  }

  if (!rpcResult) {
    throw new ValidationError('Handoff returned no result', {
      code: 'HANDOFF_NO_RESULT',
      listingId: context.listingId,
      offerId: context.offerId,
    });
  }

  return rpcResult as unknown as HandoffResult;
}
