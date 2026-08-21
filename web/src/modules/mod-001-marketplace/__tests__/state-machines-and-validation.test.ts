import { describe, it, expect } from 'vitest';
import {
  validateListingTransition,
  applyListingTransition,
  isListingTerminal,
} from '@/modules/mod-001-marketplace/domain/services/listing-state-machine';
import { ListingStatus, PricingModel, CargoType } from '@/modules/mod-001-marketplace/domain/enums';
import { VehicleType } from '@/shared/types/enums';
import {
  validateOfferTransition,
  applyOfferTransition,
  isOfferTerminal,
} from '@/modules/mod-001-marketplace/domain/services/offer-state-machine';
import { OfferStatus } from '@/modules/mod-001-marketplace/domain/enums';
import {
  validateMatchTransition,
  applyMatchTransition,
  isMatchTerminal,
} from '@/modules/mod-001-marketplace/domain/services/match-state-machine';
import { MatchStatus } from '@/modules/mod-001-marketplace/domain/enums';
import {
  validateListingRequiredFields,
  validateTimeWindow,
  findDuplicateListings,
} from '@/modules/mod-001-marketplace/domain/services/listing-validation';
import { ValidationError } from '@/shared/errors/app-errors';
import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';

// Helper to create a minimal valid listing for testing
function createListing(overrides: Partial<ShipmentListing> = {}): ShipmentListing {
  const listing: ShipmentListing = {
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
    status: ListingStatus.DRAFT,
    acceptedVehicleTypes: [VehicleType.HEAVY_TRUCK],
    created_at: new Date(),
    updated_at: new Date(),
    version: 1,
    bumpVersion: () => {},
    toJSON: () => ({}),
    ...overrides,
  };
  return listing;
}

describe('MOD-001 Wave 1 Increment 2 — State Machines and Business Logic', () => {
  // ============================================================
  // LISTING STATE MACHINE
  // ============================================================

  describe('Listing State Machine', () => {
    it('allows DRAFT → PUBLISHED transition', () => {
      expect(() => validateListingTransition(ListingStatus.DRAFT, ListingStatus.PUBLISHED)).not.toThrow();
      expect(applyListingTransition(ListingStatus.DRAFT, ListingStatus.PUBLISHED)).toBe(ListingStatus.PUBLISHED);
    });

    it('allows PUBLISHED → EXPIRED transition', () => {
      expect(() => validateListingTransition(ListingStatus.PUBLISHED, ListingStatus.EXPIRED)).not.toThrow();
      expect(applyListingTransition(ListingStatus.PUBLISHED, ListingStatus.EXPIRED)).toBe(ListingStatus.EXPIRED);
    });

    it('allows PUBLISHED → CANCELLED transition', () => {
      expect(() => validateListingTransition(ListingStatus.PUBLISHED, ListingStatus.CANCELLED)).not.toThrow();
      expect(applyListingTransition(ListingStatus.PUBLISHED, ListingStatus.CANCELLED)).toBe(ListingStatus.CANCELLED);
    });

    it('allows PUBLISHED → BOOKED transition', () => {
      expect(() => validateListingTransition(ListingStatus.PUBLISHED, ListingStatus.BOOKED)).not.toThrow();
      expect(applyListingTransition(ListingStatus.PUBLISHED, ListingStatus.BOOKED)).toBe(ListingStatus.BOOKED);
    });

    it('allows BOOKED → COMPLETED transition', () => {
      expect(() => validateListingTransition(ListingStatus.BOOKED, ListingStatus.COMPLETED)).not.toThrow();
      expect(applyListingTransition(ListingStatus.BOOKED, ListingStatus.COMPLETED)).toBe(ListingStatus.COMPLETED);
    });

    it('rejects DRAFT → PUBLISHED then → BOOKED (must go through PUBLISHED first)', () => {
      expect(() => validateListingTransition(ListingStatus.PUBLISHED, ListingStatus.BOOKED)).not.toThrow();
      expect(() => validateListingTransition(ListingStatus.DRAFT, ListingStatus.BOOKED)).toThrow(ValidationError);
    });

    it('rejects invalid transitions: DRAFT → EXPIRED', () => {
      expect(() => validateListingTransition(ListingStatus.DRAFT, ListingStatus.EXPIRED)).toThrow(ValidationError);
    });

    it('rejects invalid transitions: DRAFT → BOOKED', () => {
      expect(() => validateListingTransition(ListingStatus.DRAFT, ListingStatus.BOOKED)).toThrow(ValidationError);
    });

    it('rejects invalid transitions: PUBLISHED → DRAFT', () => {
      expect(() => validateListingTransition(ListingStatus.PUBLISHED, ListingStatus.DRAFT)).toThrow(ValidationError);
    });

    it('rejects invalid transitions: COMPLETED → anything', () => {
      expect(() => validateListingTransition(ListingStatus.COMPLETED, ListingStatus.PUBLISHED)).toThrow(ValidationError);
      expect(() => validateListingTransition(ListingStatus.COMPLETED, ListingStatus.BOOKED)).toThrow(ValidationError);
    });

    it('rejects invalid transitions: EXPIRED → anything', () => {
      expect(() => validateListingTransition(ListingStatus.EXPIRED, ListingStatus.PUBLISHED)).toThrow(ValidationError);
    });

    it('rejects invalid transitions: CANCELLED → anything', () => {
      expect(() => validateListingTransition(ListingStatus.CANCELLED, ListingStatus.PUBLISHED)).toThrow(ValidationError);
    });

    it('identifies terminal states correctly', () => {
      expect(isListingTerminal(ListingStatus.EXPIRED)).toBe(true);
      expect(isListingTerminal(ListingStatus.CANCELLED)).toBe(true);
      expect(isListingTerminal(ListingStatus.COMPLETED)).toBe(true);
    });

    it('identifies non-terminal states correctly', () => {
      expect(isListingTerminal(ListingStatus.DRAFT)).toBe(false);
      expect(isListingTerminal(ListingStatus.PUBLISHED)).toBe(false);
      expect(isListingTerminal(ListingStatus.BOOKED)).toBe(false);
    });

    it('supports full lifecycle chain: DRAFT → PUBLISHED → BOOKED → COMPLETED', () => {
      let status = ListingStatus.DRAFT;
      status = applyListingTransition(status, ListingStatus.PUBLISHED);
      expect(status).toBe(ListingStatus.PUBLISHED);
      status = applyListingTransition(status, ListingStatus.BOOKED);
      expect(status).toBe(ListingStatus.BOOKED);
      status = applyListingTransition(status, ListingStatus.COMPLETED);
      expect(status).toBe(ListingStatus.COMPLETED);
    });

    it('supports alternative path: DRAFT → PUBLISHED → EXPIRED', () => {
      let status = ListingStatus.DRAFT;
      status = applyListingTransition(status, ListingStatus.PUBLISHED);
      status = applyListingTransition(status, ListingStatus.EXPIRED);
      expect(status).toBe(ListingStatus.EXPIRED);
    });
  });

  // ============================================================
  // OFFER STATE MACHINE
  // ============================================================

  describe('Offer State Machine', () => {
    it('allows SUBMITTED → WITHDRAWN transition', () => {
      expect(() => validateOfferTransition(OfferStatus.SUBMITTED, OfferStatus.WITHDRAWN)).not.toThrow();
      expect(applyOfferTransition(OfferStatus.SUBMITTED, OfferStatus.WITHDRAWN)).toBe(OfferStatus.WITHDRAWN);
    });

    it('allows SUBMITTED → ACCEPTED transition', () => {
      expect(() => validateOfferTransition(OfferStatus.SUBMITTED, OfferStatus.ACCEPTED)).not.toThrow();
      expect(applyOfferTransition(OfferStatus.SUBMITTED, OfferStatus.ACCEPTED)).toBe(OfferStatus.ACCEPTED);
    });

    it('allows SUBMITTED → REJECTED transition', () => {
      expect(() => validateOfferTransition(OfferStatus.SUBMITTED, OfferStatus.REJECTED)).not.toThrow();
      expect(applyOfferTransition(OfferStatus.SUBMITTED, OfferStatus.REJECTED)).toBe(OfferStatus.REJECTED);
    });

    it('allows SUBMITTED → EXPIRED transition', () => {
      expect(() => validateOfferTransition(OfferStatus.SUBMITTED, OfferStatus.EXPIRED)).not.toThrow();
      expect(applyOfferTransition(OfferStatus.SUBMITTED, OfferStatus.EXPIRED)).toBe(OfferStatus.EXPIRED);
    });

    it('allows WITHDRAWN → SUBMITTED re-submission', () => {
      expect(() => validateOfferTransition(OfferStatus.WITHDRAWN, OfferStatus.SUBMITTED)).not.toThrow();
      expect(applyOfferTransition(OfferStatus.WITHDRAWN, OfferStatus.SUBMITTED)).toBe(OfferStatus.SUBMITTED);
    });

    it('rejects WITHDRAWN → ACCEPTED (withdrawn offers cannot be directly accepted)', () => {
      expect(() => validateOfferTransition(OfferStatus.WITHDRAWN, OfferStatus.ACCEPTED)).toThrow(ValidationError);
    });

    it('rejects ACCEPTED → any other state', () => {
      expect(() => validateOfferTransition(OfferStatus.ACCEPTED, OfferStatus.WITHDRAWN)).toThrow(ValidationError);
      expect(() => validateOfferTransition(OfferStatus.ACCEPTED, OfferStatus.SUBMITTED)).toThrow(ValidationError);
    });

    it('rejects REJECTED → any other state', () => {
      expect(() => validateOfferTransition(OfferStatus.REJECTED, OfferStatus.SUBMITTED)).toThrow(ValidationError);
    });

    it('rejects EXPIRED → any other state', () => {
      expect(() => validateOfferTransition(OfferStatus.EXPIRED, OfferStatus.SUBMITTED)).toThrow(ValidationError);
    });

    it('identifies terminal states correctly', () => {
      expect(isOfferTerminal(OfferStatus.ACCEPTED)).toBe(true);
      expect(isOfferTerminal(OfferStatus.REJECTED)).toBe(true);
      expect(isOfferTerminal(OfferStatus.EXPIRED)).toBe(true);
    });

    it('identifies non-terminal states correctly', () => {
      expect(isOfferTerminal(OfferStatus.SUBMITTED)).toBe(false);
      expect(isOfferTerminal(OfferStatus.WITHDRAWN)).toBe(false);
    });
  });

  // ============================================================
  // MATCH PROPOSAL STATE MACHINE
  // ============================================================

  describe('Match Proposal State Machine', () => {
    it('allows PROPOSED → ACCEPTED transition', () => {
      expect(() => validateMatchTransition(MatchStatus.PROPOSED, MatchStatus.ACCEPTED)).not.toThrow();
      expect(applyMatchTransition(MatchStatus.PROPOSED, MatchStatus.ACCEPTED)).toBe(MatchStatus.ACCEPTED);
    });

    it('allows PROPOSED → REJECTED transition', () => {
      expect(() => validateMatchTransition(MatchStatus.PROPOSED, MatchStatus.REJECTED)).not.toThrow();
      expect(applyMatchTransition(MatchStatus.PROPOSED, MatchStatus.REJECTED)).toBe(MatchStatus.REJECTED);
    });

    it('rejects PROPOSED → PROPOSED (no-op transition)', () => {
      expect(() => validateMatchTransition(MatchStatus.PROPOSED, MatchStatus.PROPOSED)).toThrow(ValidationError);
    });

    it('rejects ACCEPTED → any other state', () => {
      expect(() => validateMatchTransition(MatchStatus.ACCEPTED, MatchStatus.PROPOSED)).toThrow(ValidationError);
    });

    it('rejects REJECTED → any other state', () => {
      expect(() => validateMatchTransition(MatchStatus.REJECTED, MatchStatus.PROPOSED)).toThrow(ValidationError);
    });

    it('identifies terminal states correctly', () => {
      expect(isMatchTerminal(MatchStatus.ACCEPTED)).toBe(true);
      expect(isMatchTerminal(MatchStatus.REJECTED)).toBe(true);
    });

    it('identifies non-terminal states correctly', () => {
      expect(isMatchTerminal(MatchStatus.PROPOSED)).toBe(false);
    });
  });

  // ============================================================
  // LISTING VALIDATION — REQUIRED FIELDS
  // ============================================================

  describe('Listing Validation — Required Fields', () => {
    it('accepts a fully populated listing', () => {
      const listing = createListing();
      expect(() => validateListingRequiredFields(listing)).not.toThrow();
    });

    it('rejects listing with missing origin coordinates', () => {
      const listing = createListing({ origin: { latitude: 0, longitude: 0, address: '' } });
      expect(() => validateListingRequiredFields(listing)).toThrow(ValidationError);
    });

    it('rejects listing with missing destination coordinates', () => {
      const listing = createListing({ destination: { latitude: 0, longitude: 0, address: '' } });
      expect(() => validateListingRequiredFields(listing)).toThrow(ValidationError);
    });

    it('rejects listing without cargoType', () => {
      const listing = createListing({ cargoType: undefined as unknown as CargoType });
      expect(() => validateListingRequiredFields(listing)).toThrow(ValidationError);
    });

    it('rejects listing without weight or volume', () => {
      const listing = createListing({ weightKg: undefined as unknown as number, volumeM3: undefined as unknown as number });
      expect(() => validateListingRequiredFields(listing)).toThrow(ValidationError);
    });

    it('accepts listing with weight but no volume', () => {
      const listing = createListing({ volumeM3: undefined as unknown as number });
      expect(() => validateListingRequiredFields(listing)).not.toThrow();
    });

    it('accepts listing with volume but no weight', () => {
      const listing = createListing({ weightKg: undefined as unknown as number });
      expect(() => validateListingRequiredFields(listing)).not.toThrow();
    });
  });

  // ============================================================
  // LISTING VALIDATION — TIME WINDOW
  // ============================================================

  describe('Listing Validation — Time Window', () => {
    it('accepts a valid time window (pickup before delivery)', () => {
      const listing = createListing();
      expect(() => validateTimeWindow(listing)).not.toThrow();
    });

    it('rejects listing with missing earliestPickup', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '', latestDelivery: '2026-09-05T18:00:00Z' } });
      expect(() => validateTimeWindow(listing)).toThrow(ValidationError);
    });

    it('rejects listing with missing latestDelivery', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '' } });
      expect(() => validateTimeWindow(listing)).toThrow(ValidationError);
    });

    it('rejects listing where pickup equals delivery', () => {
      const sameDate = '2026-09-01T08:00:00Z';
      const listing = createListing({ timeWindow: { earliestPickup: sameDate, latestDelivery: sameDate } });
      expect(() => validateTimeWindow(listing)).toThrow(ValidationError);
    });

    it('rejects listing where pickup is after delivery', () => {
      const listing = createListing({ timeWindow: { earliestPickup: '2026-09-05T18:00:00Z', latestDelivery: '2026-09-01T08:00:00Z' } });
      expect(() => validateTimeWindow(listing)).toThrow(ValidationError);
    });

    it('rejects listing with invalid date format', () => {
      const listing = createListing({ timeWindow: { earliestPickup: 'not-a-date', latestDelivery: '2026-09-05T18:00:00Z' } });
      expect(() => validateTimeWindow(listing)).toThrow(ValidationError);
    });
  });

  // ============================================================
  // LISTING VALIDATION — DUPLICATE DETECTION
  // ============================================================

  describe('Listing Validation — Duplicate Detection', () => {
    it('finds no duplicates when list is empty', () => {
      const candidate = createListing({ listingId: 'candidate-001' });
      const duplicates = findDuplicateListings(candidate, []);
      expect(duplicates).toHaveLength(0);
    });

    it('finds no duplicates when shipper differs', () => {
      const candidate = createListing({ listingId: 'candidate-001', shipperId: 'shipper-A' });
      const existing = createListing({ listingId: 'existing-001', shipperId: 'shipper-B' });
      const duplicates = findDuplicateListings(candidate, [existing]);
      expect(duplicates).toHaveLength(0);
    });

    it('finds no duplicates when route differs', () => {
      const existing = createListing({ listingId: 'existing-001' });
      const candidate = createListing({ listingId: 'candidate-001', origin: { latitude: -25.9692, longitude: 32.5855, address: 'Different Origin' } });
      const duplicates = findDuplicateListings(candidate, [existing]);
      expect(duplicates).toHaveLength(0);
    });

    it('finds no duplicates when time windows do not overlap', () => {
      const candidate = createListing({
        listingId: 'candidate-001',
        timeWindow: { earliestPickup: '2026-10-01T08:00:00Z', latestDelivery: '2026-10-05T18:00:00Z' },
      });
      const existing = createListing({ listingId: 'existing-001' });
      const duplicates = findDuplicateListings(candidate, [existing]);
      expect(duplicates).toHaveLength(0);
    });

    it('detects duplicate listings with same shipper, route, and overlapping time windows', () => {
      const candidate = createListing({ id: 'candidate-id', listingId: 'candidate-001' });
      const existing = createListing({ id: 'existing-id', listingId: 'existing-001', timeWindow: { earliestPickup: '2026-09-03T08:00:00Z', latestDelivery: '2026-09-07T18:00:00Z' } });
      const duplicates = findDuplicateListings(candidate, [existing]);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].listingId).toBe('existing-001');
    });

    it('excludes self-comparison from duplicate detection', () => {
      const listing = createListing({ listingId: 'same-001' });
      const duplicates = findDuplicateListings(listing, [listing]);
      expect(duplicates).toHaveLength(0);
    });

    it('detects multiple duplicates across different listings', () => {
      const candidate = createListing({ id: 'candidate-id', listingId: 'candidate-001' });
      const existing1 = createListing({ id: 'existing1-id', listingId: 'existing-001' });
      const existing2 = createListing({ id: 'existing2-id', listingId: 'existing-002' });
      const duplicates = findDuplicateListings(candidate, [existing1, existing2]);
      expect(duplicates).toHaveLength(2);
    });
  });
});
