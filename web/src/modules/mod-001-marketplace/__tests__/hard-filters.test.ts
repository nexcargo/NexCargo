import { describe, it, expect } from 'vitest';
import {
  filterVehicleCargoMatch,
  filterWeightCapacity,
  filterVolumeCapacity,
  filterPickupAvailability,
  filterDeliveryDeadline,
  filterAccountActive,
  filterLicencesValid,
  runHardFilters,
} from '@/modules/mod-001-marketplace/domain/services/hard-filters';
import { CargoType } from '@/modules/mod-001-marketplace/domain/enums';
import { VehicleType } from '@/shared/types/enums';
import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
import type { TransportOffer } from '@/modules/mod-001-marketplace/domain/types/offers';
import { ListingStatus, PricingModel } from '@/modules/mod-001-marketplace/domain/enums';

// Helper to create a minimal valid listing
function createListing(overrides: Partial<ShipmentListing> = {}): ShipmentListing {
  return {
    id: 'test-id',
    listingId: 'listing-001',
    shipperId: 'shipper-001',
    origin: { latitude: -25.9692, longitude: 32.5855, address: 'Maputo Port' },
    destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
    cargoType: CargoType.GENERAL,
    weightKg: 10000,
    volumeM3: 50,
    timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
    pricingModel: PricingModel.FIXED,
    status: ListingStatus.PUBLISHED,
    acceptedVehicleTypes: [VehicleType.HEAVY_TRUCK],
    created_at: new Date(),
    updated_at: new Date(),
    version: 1,
    bumpVersion: () => {},
    toJSON: () => ({}),
    ...overrides,
  };
}

// Helper to create a minimal valid offer
function createOffer(overrides: Partial<TransportOffer> = {}): TransportOffer {
  return {
    id: 'test-offer-id',
    offerId: 'offer-001',
    transporterId: 'transporter-001',
    listingId: 'listing-001',
    priceProposal: 5000,
    availabilityWindow: {
      earliestPickup: '2026-09-01T08:00:00Z',
      latestPickup: '2026-09-02T08:00:00Z',
      estimatedDelivery: '2026-09-05T18:00:00Z',
    },
    vehicleType: VehicleType.HEAVY_TRUCK,
    declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 100 },
    status: 'SUBMITTED' as never,
    created_at: new Date(),
    updated_at: new Date(),
    version: 1,
    bumpVersion: () => {},
    toJSON: () => ({}),
    ...overrides,
  };
}

describe('MOD-001 Hard Filters — Mandatory (Hard) Filter Predicates', () => {
  // ============================================================
  // FILTER 1: Vehicle Type Matches Cargo Type
  // ============================================================

  describe('Filter 1: Vehicle Cargo Match', () => {
    it('allows GENERAL cargo with HEAVY_TRUCK', () => {
      const listing = createListing({ cargoType: CargoType.GENERAL });
      const offer = createOffer({ vehicleType: VehicleType.HEAVY_TRUCK });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('rejects REFRIGERATED cargo with HEAVY_TRUCK', () => {
      const listing = createListing({ cargoType: CargoType.REFRIGERATED });
      const offer = createOffer({ vehicleType: VehicleType.HEAVY_TRUCK });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(false);
    });

    it('allows REFRIGERATED cargo with REFRIGERATED vehicle', () => {
      const listing = createListing({ cargoType: CargoType.REFRIGERATED });
      const offer = createOffer({ vehicleType: VehicleType.REFRIGERATED });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('rejects HAZARDOUS cargo with HEAVY_TRUCK', () => {
      const listing = createListing({ cargoType: CargoType.HAZARDOUS });
      const offer = createOffer({ vehicleType: VehicleType.HEAVY_TRUCK });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(false);
    });

    it('allows HAZARDOUS cargo with SPECIALISED vehicle', () => {
      const listing = createListing({ cargoType: CargoType.HAZARDOUS });
      const offer = createOffer({ vehicleType: VehicleType.SPECIALISED });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('rejects OVERSIZED cargo with HEAVY_TRUCK', () => {
      const listing = createListing({ cargoType: CargoType.OVERSIZED });
      const offer = createOffer({ vehicleType: VehicleType.HEAVY_TRUCK });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(false);
    });

    it('allows OVERSIZED cargo with SPECIALISED vehicle', () => {
      const listing = createListing({ cargoType: CargoType.OVERSIZED });
      const offer = createOffer({ vehicleType: VehicleType.SPECIALISED });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('rejects LIQUID_BULK cargo with HEAVY_TRUCK', () => {
      const listing = createListing({ cargoType: CargoType.LIQUID_BULK });
      const offer = createOffer({ vehicleType: VehicleType.HEAVY_TRUCK });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(false);
    });

    it('allows LIQUID_BULK cargo with SPECIALISED vehicle', () => {
      const listing = createListing({ cargoType: CargoType.LIQUID_BULK });
      const offer = createOffer({ vehicleType: VehicleType.SPECIALISED });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('rejects CONSTRUCTION cargo with LIGHT_DELIVERY', () => {
      const listing = createListing({ cargoType: CargoType.CONSTRUCTION });
      const offer = createOffer({ vehicleType: VehicleType.LIGHT_DELIVERY });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(false);
    });

    it('allows CONSTRUCTION cargo with HEAVY_TRUCK', () => {
      const listing = createListing({ cargoType: CargoType.CONSTRUCTION });
      const offer = createOffer({ vehicleType: VehicleType.HEAVY_TRUCK });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('allows CONSTRUCTION cargo with TRAILER', () => {
      const listing = createListing({ cargoType: CargoType.CONSTRUCTION });
      const offer = createOffer({ vehicleType: VehicleType.TRAILER });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('rejects PERISHABLE cargo with HEAVY_TRUCK', () => {
      const listing = createListing({ cargoType: CargoType.PERISHABLE });
      const offer = createOffer({ vehicleType: VehicleType.HEAVY_TRUCK });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(false);
    });

    it('allows PERISHABLE cargo with REFRIGERATED vehicle', () => {
      const listing = createListing({ cargoType: CargoType.PERISHABLE });
      const offer = createOffer({ vehicleType: VehicleType.REFRIGERATED });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('allows PERISHABLE cargo with LIGHT_DELIVERY vehicle', () => {
      const listing = createListing({ cargoType: CargoType.PERISHABLE });
      const offer = createOffer({ vehicleType: VehicleType.LIGHT_DELIVERY });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('rejects EQUIPMENT cargo with LIGHT_DELIVERY', () => {
      const listing = createListing({ cargoType: CargoType.EQUIPMENT });
      const offer = createOffer({ vehicleType: VehicleType.LIGHT_DELIVERY });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(false);
    });

    it('allows EQUIPMENT cargo with HEAVY_TRUCK', () => {
      const listing = createListing({ cargoType: CargoType.EQUIPMENT });
      const offer = createOffer({ vehicleType: VehicleType.HEAVY_TRUCK });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });

    it('allows OTHER cargo with any vehicle type', () => {
      const listing = createListing({ cargoType: CargoType.OTHER });
      const offer = createOffer({ vehicleType: VehicleType.LIGHT_DELIVERY });
      expect(filterVehicleCargoMatch(listing, offer)).toBe(true);
    });
  });

  // ============================================================
  // FILTER 2: Weight Capacity
  // ============================================================

  describe('Filter 2: Weight Capacity', () => {
    it('passes when declared capacity >= shipment weight', () => {
      const listing = createListing({ weightKg: 10000 });
      const offer = createOffer({ declaredCapacity: { maxWeightKg: 20000 } });
      expect(filterWeightCapacity(listing, offer)).toBe(true);
    });

    it('fails when declared capacity < shipment weight', () => {
      const listing = createListing({ weightKg: 25000 });
      const offer = createOffer({ declaredCapacity: { maxWeightKg: 20000 } });
      expect(filterWeightCapacity(listing, offer)).toBe(false);
    });

    it('passes when declared capacity equals shipment weight', () => {
      const listing = createListing({ weightKg: 20000 });
      const offer = createOffer({ declaredCapacity: { maxWeightKg: 20000 } });
      expect(filterWeightCapacity(listing, offer)).toBe(true);
    });
  });

  // ============================================================
  // FILTER 3: Volume Capacity
  // ============================================================

  describe('Filter 3: Volume Capacity', () => {
    it('passes when volume is not specified (optional per §5.1)', () => {
      const listing = createListing({ volumeM3: undefined as unknown as number });
      const offer = createOffer();
      expect(filterVolumeCapacity(listing, offer)).toBe(true);
    });

    it('passes when declared volume >= shipment volume', () => {
      const listing = createListing({ volumeM3: 50 });
      const offer = createOffer({ declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 100 } });
      expect(filterVolumeCapacity(listing, offer)).toBe(true);
    });

    it('fails when declared volume < shipment volume', () => {
      const listing = createListing({ volumeM3: 100 });
      const offer = createOffer({ declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 50 } });
      expect(filterVolumeCapacity(listing, offer)).toBe(false);
    });

    it('passes when declared volume equals shipment volume', () => {
      const listing = createListing({ volumeM3: 50 });
      const offer = createOffer({ declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 50 } });
      expect(filterVolumeCapacity(listing, offer)).toBe(true);
    });
  });

  // ============================================================
  // FILTER 4: Pickup Availability
  // ============================================================

  describe('Filter 4: Pickup Availability', () => {
    it('passes when pickup date is within transporter availability', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' } });
      const offer = createOffer({ availabilityWindow: { earliestPickup: '2026-08-30T08:00:00Z', latestPickup: '2026-09-02T08:00:00Z', estimatedDelivery: '2026-09-05T18:00:00Z' } });
      expect(filterPickupAvailability(listing, offer)).toBe(true);
    });

    it('fails when pickup date is after transporter latest pickup', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-09-05T08:00:00Z', latestDelivery: '2026-09-10T18:00:00Z' } });
      const offer = createOffer({ availabilityWindow: { earliestPickup: '2026-08-30T08:00:00Z', latestPickup: '2026-09-02T08:00:00Z', estimatedDelivery: '2026-09-05T18:00:00Z' } });
      expect(filterPickupAvailability(listing, offer)).toBe(false);
    });

    it('passes when pickup date equals transporter latest pickup', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-09-02T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' } });
      const offer = createOffer({ availabilityWindow: { earliestPickup: '2026-08-30T08:00:00Z', latestPickup: '2026-09-02T08:00:00Z', estimatedDelivery: '2026-09-05T18:00:00Z' } });
      expect(filterPickupAvailability(listing, offer)).toBe(true);
    });
  });

  // ============================================================
  // FILTER 5: Delivery Deadline
  // ============================================================

  describe('Filter 5: Delivery Deadline', () => {
    it('passes when transporter can deliver before listing deadline', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-07T18:00:00Z' } });
      const offer = createOffer({ availabilityWindow: { earliestPickup: '2026-08-30T08:00:00Z', latestPickup: '2026-09-02T08:00:00Z', estimatedDelivery: '2026-09-05T18:00:00Z' } });
      expect(filterDeliveryDeadline(listing, offer)).toBe(true);
    });

    it('fails when delivery deadline is before transporter estimated delivery', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-03T18:00:00Z' } });
      const offer = createOffer({ availabilityWindow: { earliestPickup: '2026-08-30T08:00:00Z', latestPickup: '2026-09-02T08:00:00Z', estimatedDelivery: '2026-09-05T18:00:00Z' } });
      expect(filterDeliveryDeadline(listing, offer)).toBe(false);
    });

    it('passes when delivery deadline equals transporter estimated delivery', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' } });
      const offer = createOffer({ availabilityWindow: { earliestPickup: '2026-08-30T08:00:00Z', latestPickup: '2026-09-02T08:00:00Z', estimatedDelivery: '2026-09-05T18:00:00Z' } });
      expect(filterDeliveryDeadline(listing, offer)).toBe(true);
    });
  });

  // ============================================================
  // FILTER 6: Account Active
  // ============================================================

  describe('Filter 6: Account Active', () => {
    it('passes when account is active', () => {
      const offer = createOffer();
      expect(filterAccountActive(offer, true)).toBe(true);
    });

    it('fails when account is suspended', () => {
      const offer = createOffer();
      expect(filterAccountActive(offer, false)).toBe(false);
    });

    it('defaults to active when status not provided', () => {
      const offer = createOffer();
      expect(filterAccountActive(offer)).toBe(true);
    });
  });

  // ============================================================
  // FILTER 7: Licences Valid
  // ============================================================

  describe('Filter 7: Licences Valid', () => {
    it('passes when licences are valid', () => {
      const offer = createOffer();
      expect(filterLicencesValid(offer, true)).toBe(true);
    });

    it('fails when licences are expired', () => {
      const offer = createOffer();
      expect(filterLicencesValid(offer, false)).toBe(false);
    });

    it('defaults to valid when status not provided', () => {
      const offer = createOffer();
      expect(filterLicencesValid(offer)).toBe(true);
    });
  });

  // ============================================================
  // RUN HARD FILTERS (COMBINED)
  // ============================================================

  describe('Run Hard Filters — Combined', () => {
    it('returns offers that pass all filters', () => {
      const listing = createListing({ weightKg: 10000, volumeM3: 50 });
      const offer1 = createOffer({ 
        declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 100 },
        transporterId: 'transporter-active-licensed',
      });
      const offers = [offer1];
      
      const result = runHardFilters(listing, offers, { 'transporter-active-licensed': true }, { 'transporter-active-licensed': true });
      expect(result).toHaveLength(1);
      expect(result[0].offerId).toBe('offer-001');
    });

    it('excludes offers with insufficient weight capacity', () => {
      const listing = createListing({ weightKg: 25000 });
      const offer = createOffer({ declaredCapacity: { maxWeightKg: 20000 } });
      
      const result = runHardFilters(listing, [offer]);
      expect(result).toHaveLength(0);
    });

    it('excludes offers with insufficient volume capacity', () => {
      const listing = createListing({ weightKg: 10000, volumeM3: 100 });
      const offer = createOffer({ declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 50 } });
      
      const result = runHardFilters(listing, [offer]);
      expect(result).toHaveLength(0);
    });

    it('excludes offers with inactive account', () => {
      const listing = createListing();
      const offer = createOffer({ transporterId: 'suspended-transporter' });
      
      const result = runHardFilters(listing, [offer], { 'suspended-transporter': false });
      expect(result).toHaveLength(0);
    });

    it('excludes offers with invalid licences', () => {
      const listing = createListing();
      const offer = createOffer({ transporterId: 'unlicensed-transporter' });
      
      const result = runHardFilters(listing, [offer], undefined, { 'unlicensed-transporter': false });
      expect(result).toHaveLength(0);
    });

    it('excludes offers with incompatible vehicle-cargo match', () => {
      const listing = createListing({ cargoType: CargoType.REFRIGERATED });
      const offer = createOffer({ vehicleType: VehicleType.HEAVY_TRUCK });
      
      const result = runHardFilters(listing, [offer]);
      expect(result).toHaveLength(0);
    });

    it('excludes offers with pickup date outside availability', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-10-01T08:00:00Z', latestDelivery: '2026-10-05T18:00:00Z' } });
      const offer = createOffer({ availabilityWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestPickup: '2026-09-15T08:00:00Z', estimatedDelivery: '2026-09-20T18:00:00Z' } });
      
      const result = runHardFilters(listing, [offer]);
      expect(result).toHaveLength(0);
    });

    it('excludes offers that cannot meet delivery deadline', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-03T18:00:00Z' } });
      const offer = createOffer({ availabilityWindow: { earliestPickup: '2026-08-30T08:00:00Z', latestPickup: '2026-09-02T08:00:00Z', estimatedDelivery: '2026-09-06T18:00:00Z' } });
      
      const result = runHardFilters(listing, [offer]);
      expect(result).toHaveLength(0);
    });

    it('filters multiple offers correctly', () => {
      const listing = createListing({ weightKg: 10000 });
      const goodOffer = createOffer({ 
        id: 'good-id',
        offerId: 'good-offer',
        transporterId: 'good-transporter',
        declaredCapacity: { maxWeightKg: 20000 },
      });
      const badOffer = createOffer({ 
        id: 'bad-id',
        offerId: 'bad-offer',
        transporterId: 'bad-transporter',
        declaredCapacity: { maxWeightKg: 5000 },
      });
      
      const result = runHardFilters(listing, [goodOffer, badOffer]);
      expect(result).toHaveLength(1);
      expect(result[0].offerId).toBe('good-offer');
    });
  });
});
