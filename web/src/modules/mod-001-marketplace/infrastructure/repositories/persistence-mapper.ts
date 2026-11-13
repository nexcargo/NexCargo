// NexCargo MOD-001 — Persistence-to-domain mapper
// Authorized by the I-4 Shipper Dashboard directive §3D: the matching engine must be fed
// authoritative stored data. The repositories return flat API shapes; the domain services
// (hard filters, scoring, validation) take ShipmentListing / TransportOffer. This is the only
// place that bridges the two, so the engine is never handed a hand-built object again.

import { CargoType, ListingStatus, OfferStatus, PricingModel } from '../../domain/enums';
import type { GeoLocation, ShipmentListing, TimeWindow } from '../../domain/types/listings';
import type { AvailabilityWindow, DeclaredCapacity, TransportOffer } from '../../domain/types/offers';
import { VehicleType } from '@/shared/types/enums';
import type { ListingApiShape } from '@/infrastructure/repositories/listings-repository';
import type { OfferApiShape } from '@/infrastructure/repositories/offers-repository';

const CARGO_TYPES = Object.values(CargoType).map(String);
const LISTING_STATUSES = Object.values(ListingStatus).map(String);
const PRICING_MODELS = Object.values(PricingModel).map(String);
const OFFER_STATUSES = Object.values(OfferStatus).map(String);
const VEHICLE_TYPES = Object.values(VehicleType).map(String);

function enumValue(value: unknown, allowed: readonly string[], fallback: string): string {
  const text = String(value ?? '');
  return allowed.includes(text) ? text : fallback;
}

function baseEntity(id: string, createdAt: string, updatedAt: string, row: unknown) {
  return {
    id,
    created_at: new Date(createdAt),
    updated_at: new Date(updatedAt),
    version: 1,
    bumpVersion() {},
    toJSON() {
      return { ...(row as Record<string, unknown>) };
    },
  };
}

function toGeoLocation(value: unknown): GeoLocation {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    address: String(row.address ?? ''),
    city: typeof row.city === 'string' ? row.city : undefined,
    province: typeof row.province === 'string' ? row.province : undefined,
    country: typeof row.country === 'string' ? row.country : undefined,
  };
}

function toTimeWindow(value: unknown): TimeWindow {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    earliestPickup: String(row.earliestPickup ?? ''),
    latestDelivery: String(row.latestDelivery ?? ''),
  };
}

/** Rebuild the domain listing from its stored representation. */
export function toShipmentListing(row: ListingApiShape): ShipmentListing {
  const listing = {
    ...baseEntity(row.listingId, row.createdAt, row.updatedAt, row),
    listingId: row.listingId,
    shipperId: row.shipperId,
    origin: toGeoLocation(row.origin),
    destination: toGeoLocation(row.destination),
    cargoType: enumValue(row.cargoType, CARGO_TYPES, CargoType.GENERAL),
    weightKg: Number(row.weightKg ?? 0),
    volumeM3: row.volumeM3 == null ? undefined : Number(row.volumeM3),
    timeWindow: toTimeWindow(row.timeWindow),
    pricingModel: enumValue(row.pricingModel, PRICING_MODELS, PricingModel.FIXED),
    status: enumValue(row.status, LISTING_STATUSES, ListingStatus.DRAFT),
    publishedAt: row.publishedAt ?? undefined,
    title: row.title || undefined,
    description: row.description || undefined,
    acceptedVehicleTypes: (row.acceptedVehicleTypes ?? []).filter((type) =>
      VEHICLE_TYPES.includes(String(type)),
    ),
  };
  return listing as unknown as ShipmentListing;
}

function toAvailabilityWindow(value: unknown): AvailabilityWindow {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    earliestPickup: String(row.earliestPickup ?? ''),
    latestPickup: String(row.latestPickup ?? ''),
    estimatedDelivery: String(row.estimatedDelivery ?? ''),
  };
}

function toDeclaredCapacity(value: unknown): DeclaredCapacity {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    maxWeightKg: Number(row.maxWeightKg ?? 0),
    maxVolumeM3: row.maxVolumeM3 == null ? undefined : Number(row.maxVolumeM3),
  };
}

/** Rebuild the domain offer from its stored representation. */
export function toTransportOffer(row: OfferApiShape): TransportOffer {
  const offer = {
    ...baseEntity(row.offerId, row.createdAt, row.updatedAt, row),
    offerId: row.offerId,
    transporterId: row.transporterId,
    listingId: row.listingId,
    priceProposal: Number(row.priceProposal ?? 0),
    availabilityWindow: toAvailabilityWindow(row.availabilityWindow),
    vehicleType: enumValue(row.vehicleType, VEHICLE_TYPES, VehicleType.HEAVY_TRUCK),
    declaredCapacity: toDeclaredCapacity(row.declaredCapacity),
    status: enumValue(row.status, OFFER_STATUSES, OfferStatus.SUBMITTED),
    notes: row.notes,
  };
  return offer as unknown as TransportOffer;
}
