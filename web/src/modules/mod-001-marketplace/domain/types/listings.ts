// NexCargo MOD-001 ShipmentListing Type Definition
// Authorized by HAO-WAVE1-001 — Wave 1 Increment 1: Domain Foundations
// Per MOD-001 §5.1 and §3.2 state machine

import { BaseEntity } from '@/shared/base-classes/base-entity';
import { ListingStatus, PricingModel, CargoType } from '../enums';
import { VehicleType } from '@/shared/types/enums';

/**
 * Geo-location point with coordinates and address.
 * Used for origin and destination of a shipment listing.
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  province?: string;
  country?: string;
}

/**
 * Time window for shipment pickup and delivery.
 * Per MOD-001 §5.1 validation: must have valid start and end.
 */
export interface TimeWindow {
  earliestPickup: string; // ISO 8601
  latestDelivery: string; // ISO 8601
}

/**
 * Shipment Listing — demand side entity representing a shipper's transport request.
 * 
 * State machine (MOD-001 §3.2):
 *   DRAFT → PUBLISHED → EXPIRED | CANCELLED | BOOKED → COMPLETED
 * 
 * Validation constraints (MOD-001 §5.1):
 *   - Cannot be published without: origin, destination, cargoType, and at least one of weight or volume
 *   - timeWindow must have a valid start and end
 *   - Duplicate listings (same shipper, same route, overlapping time window) flagged for review
 */
export interface ShipmentListing extends BaseEntity {
  /** Unique identifier for this listing */
  listingId: string;

  /** Shipper who created the listing (maps to user ID) */
  shipperId: string;

  /** Origin location with geo-coordinates and address */
  origin: GeoLocation;

  /** Destination location with geo-coordinates and address */
  destination: GeoLocation;

  /** Type of cargo being shipped */
  cargoType: CargoType;

  /** Weight in kilograms */
  weightKg: number;

  /** Volume in cubic metres (optional per §5.1) */
  volumeM3?: number;

  /** Pickup and delivery time window */
  timeWindow: TimeWindow;

  /** Pricing model for this listing */
  pricingModel: PricingModel;

  /** Current state of the listing */
  status: ListingStatus;

  /** When the listing was first published (null while DRAFT) */
  publishedAt?: string; // ISO 8601

  /** Optional title for the listing */
  title?: string;

  /** Optional description of the shipment requirements */
  description?: string;

  /** Reference to any advisory quote generated for this listing */
  associatedQuoteId?: string;

  /** Transporter vehicle types acceptable for this cargo */
  acceptedVehicleTypes: VehicleType[];
}
