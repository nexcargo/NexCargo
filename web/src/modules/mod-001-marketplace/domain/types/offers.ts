// NexCargo MOD-001 TransportOffer Type Definition
// Authorized by HAO-WAVE1-001 — Wave 1 Increment 1: Domain Foundations
// Per MOD-001 §5.2 and §3.2 state machine

import { BaseEntity } from '@/shared/base-classes/base-entity';
import { OfferStatus } from '../enums';
import { VehicleType } from '@/shared/types/enums';

/**
 * Declared capacity that a transporter commits to for an offer.
 * Per MOD-001 §5.2: weight and/or volume commitment.
 */
export interface DeclaredCapacity {
  /** Maximum weight in kilograms the transporter commits to carry */
  maxWeightKg: number;

  /** Maximum volume in cubic metres the transporter commits to carry */
  maxVolumeM3?: number;
}

/**
 * Availability window proposed by the transporter.
 * Per MOD-001 §5.2: the transporter's proposed pickup/delivery timeframe.
 */
export interface AvailabilityWindow {
  earliestPickup: string; // ISO 8601
  latestPickup: string; // ISO 8601
  estimatedDelivery: string; // ISO 8601
}

/**
 * Transport Offer — supply side entity representing a transporter's response to a published listing.
 * 
 * State machine (MOD-001 §3.2):
 *   SUBMITTED ↔ WITHDRAWN | ACCEPTED | REJECTED | EXPIRED
 * 
 * Validation constraints (MOD-001 §5.2):
 *   - An offer cannot be modified after submission (only withdrawn)
 *   - A listing can have exactly one accepted offer at any time
 *   - Expired offers (past their availabilityWindow) are automatically invalidated
 */
export interface TransportOffer extends BaseEntity {
  /** Unique identifier for this offer */
  offerId: string;

  /** Transporter who submitted the offer (maps to user ID) */
  transporterId: string;

  /** The listing this offer responds to */
  listingId: string;

  /** Price proposal for fulfilling the shipment */
  priceProposal: number;

  /** Proposed pickup/delivery timeframe */
  availabilityWindow: AvailabilityWindow;

  /** Vehicle type the transporter will use */
  vehicleType: VehicleType;

  /** Weight and/or volume commitment */
  declaredCapacity: DeclaredCapacity;

  /** Current state of the offer */
  status: OfferStatus;

  /** Optional notes or conditions from the transporter */
  notes?: string;
}
