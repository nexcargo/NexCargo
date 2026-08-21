import { describe, it, expect } from 'vitest';
import {
  ListingStatus,
  OfferStatus,
  MatchStatus,
  PricingModel,
  CargoType,
} from '@/modules/mod-001-marketplace/domain/enums';

describe('MOD-001 Marketplace Domain Enums', () => {
  describe('ListingStatus', () => {
    it('contains DRAFT state', () => {
      expect(ListingStatus.DRAFT).toBe('DRAFT');
    });

    it('contains PUBLISHED state', () => {
      expect(ListingStatus.PUBLISHED).toBe('PUBLISHED');
    });

    it('contains EXPIRED state', () => {
      expect(ListingStatus.EXPIRED).toBe('EXPIRED');
    });

    it('contains CANCELLED state', () => {
      expect(ListingStatus.CANCELLED).toBe('CANCELLED');
    });

    it('contains BOOKED state', () => {
      expect(ListingStatus.BOOKED).toBe('BOOKED');
    });

    it('contains COMPLETED state', () => {
      expect(ListingStatus.COMPLETED).toBe('COMPLETED');
    });

    it('has exactly 6 states per MOD-001 §3.2', () => {
      const values = Object.values(ListingStatus);
      expect(values).toHaveLength(6);
    });
  });

  describe('OfferStatus', () => {
    it('contains SUBMITTED state', () => {
      expect(OfferStatus.SUBMITTED).toBe('SUBMITTED');
    });

    it('contains WITHDRAWN state', () => {
      expect(OfferStatus.WITHDRAWN).toBe('WITHDRAWN');
    });

    it('contains ACCEPTED state', () => {
      expect(OfferStatus.ACCEPTED).toBe('ACCEPTED');
    });

    it('contains REJECTED state', () => {
      expect(OfferStatus.REJECTED).toBe('REJECTED');
    });

    it('contains EXPIRED state', () => {
      expect(OfferStatus.EXPIRED).toBe('EXPIRED');
    });

    it('has exactly 5 states per MOD-001 §3.2', () => {
      const values = Object.values(OfferStatus);
      expect(values).toHaveLength(5);
    });
  });

  describe('MatchStatus', () => {
    it('contains PROPOSED state', () => {
      expect(MatchStatus.PROPOSED).toBe('PROPOSED');
    });

    it('contains ACCEPTED state', () => {
      expect(MatchStatus.ACCEPTED).toBe('ACCEPTED');
    });

    it('contains REJECTED state', () => {
      expect(MatchStatus.REJECTED).toBe('REJECTED');
    });

    it('has exactly 3 states per MOD-001 §3.2', () => {
      const values = Object.values(MatchStatus);
      expect(values).toHaveLength(3);
    });
  });

  describe('PricingModel', () => {
    it('contains FIXED model', () => {
      expect(PricingModel.FIXED).toBe('FIXED');
    });

    it('contains AUCTION model', () => {
      expect(PricingModel.AUCTION).toBe('AUCTION');
    });

    it('contains NEGOTIATED model', () => {
      expect(PricingModel.NEGOTIATED).toBe('NEGOTIATED');
    });

    it('has exactly 3 models per MOD-001 §5.1', () => {
      const values = Object.values(PricingModel);
      expect(values).toHaveLength(3);
    });
  });

  describe('CargoType', () => {
    it('contains GENERAL cargo type', () => {
      expect(CargoType.GENERAL).toBe('GENERAL');
    });

    it('contains REFRIGERATED cargo type', () => {
      expect(CargoType.REFRIGERATED).toBe('REFRIGERATED');
    });

    it('contains HAZARDOUS cargo type', () => {
      expect(CargoType.HAZARDOUS).toBe('HAZARDOUS');
    });

    it('contains OVERSIZED cargo type', () => {
      expect(CargoType.OVERSIZED).toBe('OVERSIZED');
    });

    it('contains LIQUID_BULK cargo type', () => {
      expect(CargoType.LIQUID_BULK).toBe('LIQUID_BULK');
    });

    it('contains GRAIN_BULK cargo type', () => {
      expect(CargoType.GRAIN_BULK).toBe('GRAIN_BULK');
    });

    it('contains CONSTRUCTION cargo type', () => {
      expect(CargoType.CONSTRUCTION).toBe('CONSTRUCTION');
    });

    it('contains PERISHABLE cargo type', () => {
      expect(CargoType.PERISHABLE).toBe('PERISHABLE');
    });

    it('contains EQUIPMENT cargo type', () => {
      expect(CargoType.EQUIPMENT).toBe('EQUIPMENT');
    });

    it('contains OTHER cargo type', () => {
      expect(CargoType.OTHER).toBe('OTHER');
    });

    it('has exactly 10 cargo types', () => {
      const values = Object.values(CargoType);
      expect(values).toHaveLength(10);
    });
  });
});
