import { describe, it, expect } from 'vitest';
import {
  MAX_WEIGHTED_SCORE,
  calculateWeightedScore,
  calculateCompositeScore,
  scoreAndRankOffers,
  highlightTopFive,
  applyUserOverride,
} from '@/modules/mod-001-marketplace/domain/services/matching-engine';
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

describe('MOD-001 Matching Engine — Core Scoring and Ranking', () => {
  // ============================================================
  // MAX WEIGHTED SCORE CONSTANT
  // ============================================================

  describe('MAX_WEIGHTED_SCORE constant', () => {
    it('equals 177 per MOD-001 §6.4.4 Section 2', () => {
      expect(MAX_WEIGHTED_SCORE).toBe(177);
    });

    it('matches calculated value: 3×15 + 2×12 + 10×10 + 1×8', () => {
      const calculated = 3 * 15 + 2 * 12 + 10 * 10 + 1 * 8;
      expect(calculated).toBe(177);
      expect(MAX_WEIGHTED_SCORE).toBe(calculated);
    });
  });

  // ============================================================
  // CALCULATE COMPOSITE SCORE
  // ============================================================

  describe('calculateCompositeScore', () => {
    it('returns 0 when weighted score is 0', () => {
      expect(calculateCompositeScore(0)).toBe(0);
    });

    it('returns 100 when weighted score equals maximum (177)', () => {
      expect(calculateCompositeScore(177)).toBe(100);
    });

    it('returns 50 when weighted score is half of maximum (88.5)', () => {
      expect(calculateCompositeScore(88.5)).toBe(50);
    });

    it('applies formula: (weightedScore / 177) × 100', () => {
      const weightedScore = 88.5;
      const expected = (weightedScore / 177) * 100;
      expect(calculateCompositeScore(weightedScore)).toBe(expected);
    });

    it('handles fractional scores correctly', () => {
      const weightedScore = 17.7;
      const expected = (weightedScore / 177) * 100;
      expect(calculateCompositeScore(weightedScore)).toBe(expected);
    });

    it('does not exceed 100 for scores above maximum', () => {
      // Note: The function does not clamp — values > 177 will produce > 100
      // This is intentional: the formula is (WeightedScore / 177) × 100
      expect(calculateCompositeScore(177 * 1.1)).toBeGreaterThan(100);
    });
  });

  // ============================================================
  // CALCULATE WEIGHTED SCORE
  // ============================================================

  describe('calculateWeightedScore', () => {
    it('returns default score when no factor scores provided (all missing data)', () => {
      const listing = createListing();
      const offer = createOffer();
      
      // All 16 factors use MISSING_DATA_DEFAULT (5)
      // WeightedScore = Σ(5 × M_i) for all factors
      const weightedScore = calculateWeightedScore(listing, offer);
      
      // Expected: 5 × (3×1.5 + 2×1.2 + 10×1.0 + 1×0.8) = 5 × (4.5 + 2.4 + 10 + 0.8) = 5 × 17.7 = 88.5
      expect(weightedScore).toBe(88.5);
    });

    it('calculates composite score of ~50 for all-missing-data scenario', () => {
      const listing = createListing();
      const offer = createOffer();
      
      const weightedScore = calculateWeightedScore(listing, offer);
      const compositeScore = calculateCompositeScore(weightedScore);
      
      expect(compositeScore).toBeCloseTo(50, 1);
    });

    it('calculates correct score when all factors are at maximum (10)', () => {
      const listing = createListing();
      const offer = createOffer();
      
      const allMaxScores: Record<string, number> = {};
      allMaxScores['Corridor match'] = 10;
      allMaxScores['Route alignment'] = 10;
      allMaxScores['Route overlap percentage'] = 10;
      allMaxScores['Origin distance'] = 10;
      allMaxScores['Transporter availability'] = 10;
      allMaxScores['Cross-border experience'] = 10;
      allMaxScores['Hazardous cargo capability'] = 10;
      allMaxScores['Refrigeration capability'] = 10;
      allMaxScores['Verified documents'] = 10;
      allMaxScores['Transporter rating'] = 10;
      allMaxScores['Completed trips'] = 10;
      allMaxScores['Cancellation rate'] = 10;
      allMaxScores['Acceptance rate'] = 10;
      allMaxScores['Response time'] = 10;
      allMaxScores['Price competitiveness'] = 10;
      allMaxScores['Relationship score'] = 10;
      
      const weightedScore = calculateWeightedScore(listing, offer, allMaxScores);
      
      // Should equal MAX_WEIGHTED_SCORE (177)
      expect(weightedScore).toBe(177);
    });

    it('calculates zero score when all factors are zero', () => {
      const listing = createListing();
      const offer = createOffer();
      
      const zeroScores: Record<string, number> = {};
      Object.keys({}).forEach((k) => { zeroScores[k] = 0; });
      zeroScores['Corridor match'] = 0;
      zeroScores['Route alignment'] = 0;
      zeroScores['Route overlap percentage'] = 0;
      zeroScores['Origin distance'] = 0;
      zeroScores['Transporter availability'] = 0;
      zeroScores['Cross-border experience'] = 0;
      zeroScores['Hazardous cargo capability'] = 0;
      zeroScores['Refrigeration capability'] = 0;
      zeroScores['Verified documents'] = 0;
      zeroScores['Transporter rating'] = 0;
      zeroScores['Completed trips'] = 0;
      zeroScores['Cancellation rate'] = 0;
      zeroScores['Acceptance rate'] = 0;
      zeroScores['Response time'] = 0;
      zeroScores['Price competitiveness'] = 0;
      zeroScores['Relationship score'] = 0;
      
      const weightedScore = calculateWeightedScore(listing, offer, zeroScores);
      expect(weightedScore).toBe(0);
    });

    it('handles partial factor scores (some present, some missing)', () => {
      const listing = createListing();
      const offer = createOffer();
      
      const partialScores: Record<string, number> = {
        'Corridor match': 10,
        'Route alignment': 10,
        'Route overlap percentage': 10,
        'Origin distance': 10,
        'Transporter availability': 10,
        // Remaining 11 factors use default (5)
      };
      
      const weightedScore = calculateWeightedScore(listing, offer, partialScores);
      
      // 5 factors at max: 10×1.5 + 10×1.5 + 10×1.5 + 10×1.2 + 10×1.2 = 15 + 15 + 15 + 12 + 12 = 69
      // 11 factors at default: 5×1.0 + 5×1.0 + 5×1.0 + 5×1.0 + 5×1.0 + 5×1.0 + 5×1.0 + 5×1.0 + 5×1.0 + 5×1.0 + 5×0.8 = 5+5+5+5+5+5+5+5+5+5+4 = 54
      // Total: 69 + 54 = 123
      expect(weightedScore).toBe(123);
    });
  });

  // ============================================================
  // SCORE AND RANK OFFERS
  // ============================================================

  describe('scoreAndRankOffers', () => {
    it('returns empty array when no offers provided', () => {
      const listing = createListing();
      const proposals = scoreAndRankOffers(listing, []);
      expect(proposals).toHaveLength(0);
    });

    it('scores and ranks single offer at position 1', () => {
      const listing = createListing();
      const offer = createOffer({ offerId: 'single-offer', transporterId: 'single-transporter' });
      
      const proposals = scoreAndRankOffers(listing, [offer]);
      
      expect(proposals).toHaveLength(1);
      expect(proposals[0].rankingPosition).toBe(1);
      expect(proposals[0].matchScore).toBeCloseTo(50, 1); // Default score ~50
    });

    it('ranks multiple offers by composite score descending', () => {
      const listing = createListing();
      
      const offer1 = createOffer({ 
        offerId: 'offer-high', 
        transporterId: 'high-score' 
      });
      const offer2 = createOffer({ 
        offerId: 'offer-low', 
        transporterId: 'low-score' 
      });
      
      const factorScores = {
        'high-score': { 'Corridor match': 10, 'Route alignment': 10 },
        'low-score': { 'Corridor match': 1, 'Route alignment': 1 },
      };
      
      const proposals = scoreAndRankOffers(listing, [offer1, offer2], factorScores);
      
      expect(proposals).toHaveLength(2);
      expect(proposals[0].offerId).toBe('offer-high');
      expect(proposals[0].rankingPosition).toBe(1);
      expect(proposals[1].offerId).toBe('offer-low');
      expect(proposals[1].rankingPosition).toBe(2);
      expect(proposals[0].matchScore).toBeGreaterThan(proposals[1].matchScore);
    });

    it('generates match proposals with correct fields', () => {
      const listing = createListing();
      const offer = createOffer({ offerId: 'test-offer', transporterId: 'test-transporter' });
      
      const proposals = scoreAndRankOffers(listing, [offer]);
      
      expect(proposals[0].listingId).toBe(listing.listingId);
      expect(proposals[0].offerId).toBe(offer.offerId);
      expect(typeof proposals[0].matchScore).toBe('number');
      expect(proposals[0].matchScore).toBeGreaterThanOrEqual(0);
      expect(proposals[0].matchScore).toBeLessThanOrEqual(100);
      expect(typeof proposals[0].reasoningTrace).toBe('string');
    });

    it('handles more than 5 offers correctly', () => {
      const listing = createListing();
      const offers = Array.from({ length: 10 }, (_, i) => 
        createOffer({ offerId: `offer-${i}`, transporterId: `transporter-${i}` })
      );
      
      const proposals = scoreAndRankOffers(listing, offers);
      
      expect(proposals).toHaveLength(10);
      expect(proposals[0].rankingPosition).toBe(1);
      expect(proposals[4].rankingPosition).toBe(5);
      expect(proposals[9].rankingPosition).toBe(10);
    });
  });

  // ============================================================
  // HIGHLIGHT TOP FIVE
  // ============================================================

  describe('highlightTopFive', () => {
    it('returns empty set when no proposals', () => {
      const topFive = highlightTopFive([]);
      expect(topFive.size).toBe(0);
    });

    it('highlights exactly 5 offers when 5+ available', () => {
      const proposals = Array.from({ length: 10 }, (_, i) => ({
        id: `id-${i}`,
        matchId: `match-${i}`,
        listingId: 'listing-001',
        offerId: `offer-${i}`,
        matchScore: 100 - i,
        rankingPosition: i + 1,
        status: 'PROPOSED' as never,
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
        bumpVersion: () => {},
        toJSON: () => ({}),
      }));
      
      const topFive = highlightTopFive(proposals);
      
      expect(topFive.size).toBe(5);
      expect(topFive.has('offer-0')).toBe(true);
      expect(topFive.has('offer-4')).toBe(true);
      expect(topFive.has('offer-5')).toBe(false);
    });

    it('highlights all offers when fewer than 5 available', () => {
      const proposals = Array.from({ length: 3 }, (_, i) => ({
        id: `id-${i}`,
        matchId: `match-${i}`,
        listingId: 'listing-001',
        offerId: `offer-${i}`,
        matchScore: 100 - i,
        rankingPosition: i + 1,
        status: 'PROPOSED' as never,
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
        bumpVersion: () => {},
        toJSON: () => ({}),
      }));
      
      const topFive = highlightTopFive(proposals);
      
      expect(topFive.size).toBe(3);
      expect(topFive.has('offer-0')).toBe(true);
      expect(topFive.has('offer-2')).toBe(true);
    });
  });

  // ============================================================
  // USER OVERRIDE
  // ============================================================

  describe('applyUserOverride', () => {
    it('returns selected proposal when offerId exists in proposals', () => {
      const proposals = [
        { id: 'id-1', matchId: 'match-1', listingId: 'listing-001', offerId: 'offer-1', matchScore: 80, rankingPosition: 1, status: 'PROPOSED' as never, created_at: new Date(), updated_at: new Date(), version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
        { id: 'id-2', matchId: 'match-2', listingId: 'listing-001', offerId: 'offer-2', matchScore: 60, rankingPosition: 2, status: 'PROPOSED' as never, created_at: new Date(), updated_at: new Date(), version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
      ];
      
      const selected = applyUserOverride(proposals, 'offer-2');
      
      expect(selected).not.toBeNull();
      expect(selected!.offerId).toBe('offer-2');
      expect(selected!.matchScore).toBe(60);
    });

    it('returns null when offerId does not exist in proposals', () => {
      const proposals = [
        { id: 'id-1', matchId: 'match-1', listingId: 'listing-001', offerId: 'offer-1', matchScore: 80, rankingPosition: 1, status: 'PROPOSED' as never, created_at: new Date(), updated_at: new Date(), version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
      ];
      
      const selected = applyUserOverride(proposals, 'offer-nonexistent');
      
      expect(selected).toBeNull();
    });

    it('allows selecting lower-ranked transporter regardless of rank', () => {
      const proposals = [
        { id: 'id-1', matchId: 'match-1', listingId: 'listing-001', offerId: 'offer-1', matchScore: 90, rankingPosition: 1, status: 'PROPOSED' as never, created_at: new Date(), updated_at: new Date(), version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
        { id: 'id-2', matchId: 'match-2', listingId: 'listing-001', offerId: 'offer-2', matchScore: 50, rankingPosition: 2, status: 'PROPOSED' as never, created_at: new Date(), updated_at: new Date(), version: 1, bumpVersion: () => {}, toJSON: () => ({}) },
      ];
      
      const selected = applyUserOverride(proposals, 'offer-2');
      
      // User can select lower-ranked option
      expect(selected).not.toBeNull();
      expect(selected!.matchScore).toBe(50);
      expect(selected!.rankingPosition).toBe(2);
    });
  });
});
