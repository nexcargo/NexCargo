import { describe, it, expect } from 'vitest';
import {
  determineRelaxationStrategy,
  generateNoMatchExplanation,
} from '@/modules/mod-001-marketplace/domain/services/no-match-relaxation';
import { ListingStatus, PricingModel, CargoType } from '@/modules/mod-001-marketplace/domain/enums';
import { VehicleType } from '@/shared/types/enums';
import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
import type { TransportOffer } from '@/modules/mod-001-marketplace/domain/types/offers';

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

describe('MOD-001 No-Match Relaxation Strategy', () => {
  // ============================================================
  // DETERMINE RELAXATION STRATEGY
  // ============================================================

  describe('determineRelaxationStrategy', () => {
    it('returns relaxationApplied true when no matches found', () => {
      const listing = createListing();
      const result = determineRelaxationStrategy(listing, []);
      
      expect(result.relaxationApplied).toBe(true);
      expect(result.offerCount).toBe(0);
    });

    it('includes all 6 relaxation steps', () => {
      const listing = createListing();
      const result = determineRelaxationStrategy(listing, []);
      
      expect(result.stepsApplied).toHaveLength(6);
      expect(result.stepsApplied).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('provides user-friendly suggestion message', () => {
      const listing = createListing();
      const result = determineRelaxationStrategy(listing, []);
      
      expect(result.suggestion).toContain('No transporters meet current requirements');
      expect(result.suggestion).toContain('Consider expanding the search radius');
    });

    it('includes step descriptions in suggestion', () => {
      const listing = createListing();
      const result = determineRelaxationStrategy(listing, []);
      
      expect(result.suggestion).toContain('expanding the search radius');
      expect(result.suggestion).toContain('vehicle types');
      expect(result.suggestion).toContain('rating');
      expect(result.suggestion).toContain('corridors');
      expect(result.suggestion).toContain('availability');
      expect(result.suggestion).toContain('manual search');
    });
  });

  // ============================================================
  // GENERATE NO MATCH EXPLANATION
  // ============================================================

  describe('generateNoMatchExplanation', () => {
    it('returns basic explanation when no failures provided', () => {
      const listing = createListing();
      const explanation = generateNoMatchExplanation(listing);
      
      expect(explanation).toContain('No transporters meet your requirements');
      expect(explanation).toContain('Suggestions');
    });

    it('includes failure reasons when provided', () => {
      const listing = createListing();
      const failures = ['Insufficient weight capacity', 'Inactive account'];
      const explanation = generateNoMatchExplanation(listing, failures);
      
      expect(explanation).toContain('Reasons');
      expect(explanation).toContain('Insufficient weight capacity');
      expect(explanation).toContain('Inactive account');
    });

    it('includes standard suggestions', () => {
      const listing = createListing();
      const explanation = generateNoMatchExplanation(listing);
      
      expect(explanation).toContain('Relax vehicle type requirements');
      expect(explanation).toContain('Expand your search radius');
      expect(explanation).toContain('Adjust your time window');
      expect(explanation).toContain('alternative cargo classifications');
    });

    it('provides clear actionable guidance', () => {
      const listing = createListing();
      const explanation = generateNoMatchExplanation(listing);
      
      // Should have multiple suggestion lines
      const suggestionLines = explanation.split('\n').filter((line) => line.includes('•'));
      expect(suggestionLines.length).toBeGreaterThanOrEqual(4);
    });
  });
});
