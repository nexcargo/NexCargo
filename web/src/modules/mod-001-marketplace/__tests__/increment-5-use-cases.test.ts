import { describe, it, expect } from 'vitest';
import {
  createAdvisoryQuote,
  createMatchProposal,
  applyOfferAction,
} from '@/modules/mod-001-marketplace/application/use-cases/marketplace-use-cases';
import { ListingStatus, OfferStatus, CargoType, PricingModel } from '@/modules/mod-001-marketplace/domain/enums';
import { publishListing, isListingPublishable } from '@/modules/mod-001-marketplace/domain/services/listing-publish-service';
import { ValidationError } from '@/shared/errors/app-errors';

describe('MOD-001 Marketplace Use Cases — Wave 1 Increment 5', () => {
  // ============================================================
  // Create Advisory Quote (Application Layer)
  // ============================================================

  describe('createAdvisoryQuote', () => {
    const validParams = {
      listingId: 'listing-001',
      cargoType: CargoType.GENERAL,
      weightKg: 5000,
      volumeM3: 20,
      timeWindow: {
        earliestPickup: '2026-09-15T08:00:00Z',
        latestDelivery: '2026-09-25T18:00:00Z',
      },
    };

    it('creates a quote with all required fields', () => {
      const quote = createAdvisoryQuote(validParams);

      expect(quote.listingId).toBe('listing-001');
      expect(quote.quoteId).toBeDefined();
      expect(quote.suggestedPriceMin).toBeGreaterThan(0);
      expect(quote.suggestedPriceMax).toBeGreaterThan(quote.suggestedPriceMin);
      expect(typeof quote.confidenceScore).toBe('number');
    });

    it('includes listingId set by application layer', () => {
      const quote = createAdvisoryQuote({
        ...validParams,
        listingId: 'listing-specific-id',
      });

      expect(quote.listingId).toBe('listing-specific-id');
    });

    it('uses default FIXED pricing model when not specified', () => {
      const params = {
        ...validParams,
        pricingModel: undefined,
      };

      const quote = createAdvisoryQuote(params);
      
      expect(quote.suggestedPriceMin).toBeGreaterThan(0);
    });

    it('preserves all generated quote properties', () => {
      const quote = createAdvisoryQuote(validParams);

      expect(Object.keys(quote)).toEqual(
        expect.arrayContaining([
          'quoteId',
          'listingId',
          'suggestedPriceMin',
          'suggestedPriceMax',
          'confidenceScore',
          'basis',
        ]),
      );
    });

    it('includes listingId set by application layer', () => {
      const quote = createAdvisoryQuote({
        ...validParams,
        listingId: 'listing-specific-id',
      });

      expect(quote.listingId).toBe('listing-specific-id');
    });

    it('uses default FIXED pricing model when not specified', () => {
      const params = {
        ...validParams,
        pricingModel: undefined,
      };

      const quote = createAdvisoryQuote(params);
      
      expect(quote.suggestedPriceMin).toBeGreaterThan(0);
    });

    it('returns corridor-basis quote without comparable prices', () => {
      const quote = createAdvisoryQuote({
        ...validParams,
        comparablePrices: undefined,
      });

      // Without comparable offers, should use pure corridor pricing basis
      expect(quote.basis).toContain('corridor_pricing');
      expect(quote.suggestedPriceMin).toBeGreaterThan(0);
    });

    it('throws error when listingId is empty', () => {
      expect(() => createAdvisoryQuote({
        ...validParams,
        listingId: '',
      })).toThrow(ValidationError);
    });

    it('throws error when weightKg is invalid', () => {
      expect(() => createAdvisoryQuote({
        ...validParams,
        weightKg: -100,
      })).toThrow(ValidationError);
    });

    it('throws error when time window is incomplete', () => {
      expect(() => createAdvisoryQuote({
        ...validParams,
        timeWindow: { earliestPickup: '2026-09-15T08:00:00Z' } as never,
      })).toThrow(ValidationError);
    });

    it('preserves all generated quote properties', () => {
      const quote = createAdvisoryQuote(validParams);

      expect(Object.keys(quote)).toEqual(
        expect.arrayContaining([
          'quoteId',
          'listingId',
          'suggestedPriceMin',
          'suggestedPriceMax',
          'confidenceScore',
          'basis',
        ]),
      );
    });
  });

  // ============================================================
  // Create Match Proposal (Application Layer)
  // ============================================================

  describe('createMatchProposal', () => {
    const validParams = {
      listingId: 'listing-001',
      offerId: 'offer-001',
      matchScore: 85.5,
      rankingPosition: 1,
    };

    it('creates a match proposal with correct structure', () => {
      const proposal = createMatchProposal(validParams);

      expect(proposal.matchId).toBeDefined();
      expect(proposal.listingId).toBe('listing-001');
      expect(proposal.offerId).toBe('offer-001');
      expect(proposal.matchScore).toBe(85.5);
      expect(proposal.rankingPosition).toBe(1);
      expect(proposal.status).toBe('PROPOSED');
    });

    it('rounds matchScore to 2 decimal places', () => {
      const proposal = createMatchProposal({
        ...validParams,
        matchScore: 85.567,
      });

      expect(proposal.matchScore).toBe(85.57);
    });

    it('includes optional reasoningTrace', () => {
      const proposal = createMatchProposal({
        ...validParams,
        reasoningTrace: 'High corridor match on Maputo-Beira route',
      });

      expect(proposal.reasoningTrace).toBe('High corridor match on Maputo-Beira route');
    });

    it('does not include BaseEntity persistence fields', () => {
      const proposal = createMatchProposal(validParams);

      expect('id' in proposal).toBe(false);
      expect('created_at' in proposal).toBe(false);
      expect('updated_at' in proposal).toBe(false);
      expect('version' in proposal).toBe(false);
    });

    it('sets initial status to PROPOSED', () => {
      const proposal = createMatchProposal(validParams);
      expect(proposal.status).toBe('PROPOSED');
    });

    it('throws error for empty listingId', () => {
      expect(() => createMatchProposal({
        ...validParams,
        listingId: '',
      })).toThrow(ValidationError);
    });

    it('throws error for invalid matchScore (>100)', () => {
      expect(() => createMatchProposal({
        ...validParams,
        matchScore: 150,
      })).toThrow(ValidationError);
    });

    it('throws error for invalid matchScore (<0)', () => {
      expect(() => createMatchProposal({
        ...validParams,
        matchScore: -5,
      })).toThrow(ValidationError);
    });

    it('throws error for rankingPosition < 1', () => {
      expect(() => createMatchProposal({
        ...validParams,
        rankingPosition: 0,
      })).toThrow(ValidationError);
    });
  });

  // ============================================================
  // Apply Offer Action (Accept/Reject)
  // ============================================================

  describe('applyOfferAction', () => {
    it('accepts an offer and returns terminal status', () => {
      const result = applyOfferAction({
        offerId: 'offer-001',
        currentStatus: OfferStatus.SUBMITTED,
        action: 'ACCEPT',
        shipperId: 'shipper-001',
      });

      expect(result.offerId).toBe('offer-001');
      expect(result.previousStatus).toBe(OfferStatus.SUBMITTED);
      expect(result.newStatus).toBe(OfferStatus.ACCEPTED);
      expect(result.acceptedBy).toBe('shipper-001');
      expect(result.isTerminal).toBe(true);
      expect(typeof result.timestamp).toBe('string');
    });

    it('rejects an offer and returns terminal status', () => {
      const result = applyOfferAction({
        offerId: 'offer-002',
        currentStatus: OfferStatus.SUBMITTED,
        action: 'REJECT',
        shipperId: 'shipper-001',
      });

      expect(result.newStatus).toBe(OfferStatus.REJECTED);
      expect(result.rejectedBy).toBe('shipper-001');
      expect(result.isTerminal).toBe(true);
    });

    it('throws error for missing offerId', () => {
      expect(() => applyOfferAction({
        offerId: '',
        currentStatus: OfferStatus.SUBMITTED,
        action: 'ACCEPT',
        shipperId: 'shipper-001',
      })).toThrow(ValidationError);
    });

    it('throws error for missing shipperId', () => {
      expect(() => applyOfferAction({
        offerId: 'offer-001',
        currentStatus: OfferStatus.SUBMITTED,
        action: 'ACCEPT',
        shipperId: '',
      })).toThrow(ValidationError);
    });
  });

  // ============================================================
  // Listing Publish Service
  // ============================================================

  describe('publishListing', () => {
    it('transitions DRAFT to PUBLISHED', () => {
      const result = publishListing(ListingStatus.DRAFT);
      expect(result).toBe(ListingStatus.PUBLISHED);
    });

    it('throws error when listing is already published', () => {
      expect(() => publishListing(ListingStatus.PUBLISHED)).toThrow(ValidationError);
    });

    it('throws error when listing is in a terminal state', () => {
      expect(() => publishListing(ListingStatus.COMPLETED)).toThrow(ValidationError);
    });

    it('throws error when listing is CANCELLED', () => {
      expect(() => publishListing(ListingStatus.CANCELLED)).toThrow(ValidationError);
    });

    it('throws error when listing is EXPIRED', () => {
      expect(() => publishListing(ListingStatus.EXPIRED)).toThrow(ValidationError);
    });

    it('throws error when listing is BOOKED', () => {
      expect(() => publishListing(ListingStatus.BOOKED)).toThrow(ValidationError);
    });
  });

  describe('isListingPublishable', () => {
    it('returns true for DRAFT listings', () => {
      expect(isListingPublishable(ListingStatus.DRAFT)).toBe(true);
    });

    it('returns false for PUBLISHED listings', () => {
      expect(isListingPublishable(ListingStatus.PUBLISHED)).toBe(false);
    });

    it('returns false for terminal states', () => {
      expect(isListingPublishable(ListingStatus.COMPLETED)).toBe(false);
      expect(isListingPublishable(ListingStatus.CANCELLED)).toBe(false);
    });
  });
});
