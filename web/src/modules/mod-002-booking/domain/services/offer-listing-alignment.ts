// NexCargo MOD-002 — Offer/Listing Alignment Validator
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Increment: MOD-002 Increment 1 (Phase 1 — Core Contract Formation)
// Reference: MOD-002 §3.5 (Offer-Listing Alignment Verification), §7.4 (Alignment Rule)
//
// The Alignment Rule states:
// - Offer declared weight/volume must meet listing requirements
// - Vehicle type must match cargo type
// - No external fleet queries — transporter declaration is binding commercial commitment

import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Input types (represent data received from MOD-001 at booking time)
// ============================================================

/** Data extracted from a ShipmentListing for alignment checking */
export interface ListingRequirements {
  requiredWeightKg: number;
  requiredVolumeM3?: number;
  acceptedVehicleTypes: string[];
}

/** Data extracted from a TransportOffer for alignment checking */
export interface OfferDetails {
  declaredWeightKg: number;
  declaredVolumeM3?: number;
  vehicleType: string;
}

/** Result of an alignment check */
export interface AlignmentResult {
  isAligned: boolean;
  weightCheck: WeightCheckResult;
  volumeCheck: VolumeCheckResult | null;
  vehicleTypeCheck: VehicleTypeCheckResult;
  details: string[];
}

/** Weight comparison result */
export interface WeightCheckResult {
  passes: boolean;
  listingRequired: number;
  offerDeclared: number;
  variancePercentage: number;
}

/** Volume comparison result */
export interface VolumeCheckResult {
  passes: boolean;
  listingRequired: number;
  offerDeclared: number;
  variancePercentage: number;
}

/** Vehicle type compatibility result */
export interface VehicleTypeCheckResult {
  passes: boolean;
  listingAcceptedTypes: string[];
  offerVehicleType: string;
}

// ============================================================
// validateOfferListingAlignment — core alignment rule implementation
// Per MOD-002 §7.4 Alignment Rule
// ============================================================

export function validateOfferListingAlignment(
  listingRequirements: ListingRequirements,
  offerDetails: OfferDetails,
): AlignmentResult {
  const details: string[] = [];
  let isAligned = true;

  // Weight check — offer must be >= listing requirement
  const weightResult = performWeightCheck(listingRequirements, offerDetails);
  if (!weightResult.passes) {
    isAligned = false;
    details.push(`Weight mismatch: offer declares ${offerDetails.declaredWeightKg}kg but listing requires at least ${listingRequirements.requiredWeightKg}kg`);
  }

  // Volume check — only if listing has a volume requirement
  let volumeResult: VolumeCheckResult | null = null;
  if (listingRequirements.requiredVolumeM3 !== undefined && listingRequirements.requiredVolumeM3 > 0) {
    volumeResult = performVolumeCheck(listingRequirements, offerDetails);
    if (!volumeResult.passes) {
      isAligned = false;
      details.push(`Volume mismatch: offer declares ${offerDetails.declaredVolumeM3}m³ but listing requires at least ${listingRequirements.requiredVolumeM3}m³`);
    }
  }

  // Vehicle type check — offer's vehicle must be in listing's accepted types
  const vehicleResult = performVehicleTypeCheck(listingRequirements, offerDetails);
  if (!vehicleResult.passes) {
    isAligned = false;
    details.push(`Vehicle type mismatch: offer uses '${offerDetails.vehicleType}' but listing accepts [${listingRequirements.acceptedVehicleTypes.join(', ')}]`);
  }

  return {
    isAligned,
    weightCheck: weightResult,
    volumeCheck: volumeResult,
    vehicleTypeCheck: vehicleResult,
    details,
  };
}

// ============================================================
// Internal helpers (pure calculations, no side effects)
// ============================================================

function performWeightCheck(listing: ListingRequirements, offer: OfferDetails): WeightCheckResult {
  const passes = offer.declaredWeightKg >= listing.requiredWeightKg;
  const variancePercentage = listing.requiredWeightKg > 0
    ? ((offer.declaredWeightKg - listing.requiredWeightKg) / listing.requiredWeightKg) * 100
    : 100;

  return {
    passes,
    listingRequired: listing.requiredWeightKg,
    offerDeclared: offer.declaredWeightKg,
    variancePercentage,
  };
}

function performVolumeCheck(listing: ListingRequirements, offer: OfferDetails): VolumeCheckResult {
  const listingVol = listing.requiredVolumeM3!;
  const offerVol = offer.declaredVolumeM3!;
  const passes = offerVol >= listingVol;
  const variancePercentage = listingVol > 0
    ? ((offerVol - listingVol) / listingVol) * 100
    : 100;

  return {
    passes,
    listingRequired: listingVol,
    offerDeclared: offerVol,
    variancePercentage,
  };
}

function performVehicleTypeCheck(listing: ListingRequirements, offer: OfferDetails): VehicleTypeCheckResult {
  const passes = listing.acceptedVehicleTypes.includes(offer.vehicleType);

  return {
    passes,
    listingAcceptedTypes: [...listing.acceptedVehicleTypes],
    offerVehicleType: offer.vehicleType,
  };
}

// ============================================================
// assertAlignment — throws ValidationError if not aligned
// Use this when a hard gate is required (e.g., before creating Booking)
// ============================================================

export function assertAlignment(
  listingRequirements: ListingRequirements,
  offerDetails: OfferDetails,
): void {
  const result = validateOfferListingAlignment(listingRequirements, offerDetails);
  if (!result.isAligned) {
    throw new ValidationError('Offer does not pass alignment checks against listing requirements', {
      details: result.details,
      weightCheck: result.weightCheck,
      volumeCheck: result.volumeCheck,
      vehicleTypeCheck: result.vehicleTypeCheck,
    });
  }
}
