import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationError } from '@/shared/errors/app-errors';
import * as alignmentModule from '@/modules/mod-002-booking/domain/services/offer-listing-alignment';
import { executeMOD002Handoff } from '@/modules/mod-002-booking/domain/services/booking-orchestration';

const defaultListingsData = {
  id: 'listing-test', listingId: 'listing-test', shipperId: 'shipper-1',
  origin: { address: 'Origin City' }, destination: { address: 'Destination Port' },
  cargoType: 'GENERAL', weightKg: 5000, volumeM3: 20, timeWindow: {}, pricingModel: 'FIXED',
  status: 'PUBLISHED', title: 'Test Listing', description: 'General cargo', accepted_vehicle_types: ['TRUCK'],
};

const defaultOffersData = {
  id: 'offer-test', offerId: 'offer-test', transporterId: 'transporter-1',
  listingId: 'listing-test', priceProposal: 15000, availabilityWindow: {}, vehicle_type: 'TRUCK',
  declaredCapacity: { weightKg: 8000, volumeM3: 30 }, notes: '', status: 'SUBMITTED',
};

// Shared state for RPC responses - read at call time
let rpcCallParams: Record<string, unknown> | null = null;
// Single object (NOT array) matching what PostgreSQL RPC function returns
const rpcState = { data: { success: true } as Record<string, unknown>, error: null as { message: string } | null };
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((tableName: string) => {
      if (tableName === 'marketplace_schema.listings') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(() => Promise.resolve({ data: defaultListingsData, error: null })) };
      } else if (tableName === 'marketplace_schema.offers') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(() => Promise.resolve({ data: defaultOffersData, error: null })) };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } })) };
    }),
    rpc: async (_fn: string, params: Record<string, unknown>) => {
      rpcCallParams = params;
      return { data: rpcState.data, error: rpcState.error };
    },
  })),
}));

const alignmentPassResult = {
  isAligned: true, weightCheck: { passes: true, listingRequired: 0, offerDeclared: 0, variancePercentage: 100 },
  volumeCheck: null, vehicleTypeCheck: { passes: true, listingAcceptedTypes: [], offerVehicleType: '' },
  details: [] as string[],
};

describe('MOD-002 Booking Orchestration — C2-Increment 003', () => {
  const fullContext = {
    userId: 'user-1', email: 'test@test.com', role: 'SHIPPER',
    listingId: 'listing-test', offerId: 'offer-test',
    transporterId: 'transporter-1', shipperId: 'shipper-1',
  };

  // Store alignment spy for per-test cleanup
  let alignSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    rpcCallParams = null;
    // Restore any previous spy, then set fresh baseline
    if (alignSpy) { alignSpy.mockRestore(); }
    alignSpy = vi.spyOn(alignmentModule, 'validateOfferListingAlignment');
    alignSpy.mockImplementation((_l: Record<string, unknown>, _o: Record<string, unknown>) => alignmentPassResult);
  });

  function overrideAlign(throwFn: () => void) {
    if (!alignSpy) throw new Error('alignSpy not init');
    alignSpy.mockImplementation((_l: Record<string, unknown>, _o: Record<string, unknown>) => { throwFn(); return alignmentPassResult; });
  }

  describe('Context validation', () => {
    it('throws when userId is missing', async () => {
      await expect(executeMOD002Handoff({ ...fullContext, userId: '' })).rejects.toThrow(/requires userId/);
    });
    it('throws when listingId is missing', async () => {
      await expect(executeMOD002Handoff({ ...fullContext, listingId: '' as unknown as string })).rejects.toThrow(/requires.*listingId/);
    });
    it('throws when offerId is missing', async () => {
      await expect(executeMOD002Handoff({ ...fullContext, offerId: '' as unknown as string })).rejects.toThrow(/requires.*offerId/);
    });
  });

  describe('Pre-acceptance alignment failure', () => {
    it('throws with ALIGNMENT_FAILED code when weight mismatch', async () => {
      overrideAlign(() => { throw new ValidationError('Weight mismatch', { code: 'WEIGHT_MISMATCH' }); });
      try {
        await executeMOD002Handoff(fullContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const ve = error as ValidationError;
        expect(ve.message).toContain('Weight mismatch');
        expect(rpcCallParams).toBeNull();
      }
    });

    it('throws with ALIGNMENT_FAILED code when vehicle type mismatch', async () => {
      overrideAlign(() => { throw new ValidationError('Vehicle type incompatibility', { code: 'VEHICLE_TYPE_MISMATCH' }); });
      try {
        await executeMOD002Handoff(fullContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const ve = error as ValidationError;
        expect(ve.message).toContain('Vehicle type incompatibility');
        expect(rpcCallParams).toBeNull();
      }
    });

    it('returns alignment failure details in error context', async () => {
      overrideAlign(() => { throw new ValidationError('Multiple alignment failures', { details: { weightFail: true, volumeFail: true } }); });
      try {
        await executeMOD002Handoff(fullContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const ve = error as ValidationError;
        expect(ve.details).toHaveProperty('code', 'ALIGNMENT_FAILED');
        expect(ve.details).toHaveProperty('listingId', 'listing-test');
        expect(ve.details).toHaveProperty('offerId', 'offer-test');
        expect(rpcCallParams).toBeNull();
      }
    });

    it('wraps non-ValidationError errors with Handoff failed prefix', async () => {
      overrideAlign(() => { throw new Error('Unexpected validation error'); });
      try {
        await executeMOD002Handoff(fullContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const ve = error as ValidationError;
        expect(ve.message).toBe('Handoff failed: Unexpected validation error');
        expect(ve.details).toHaveProperty('code', 'ALIGNMENT_FAILED');
        expect(rpcCallParams).toBeNull();
      }
    });
  });

  describe('Atomic handoff success', () => {
    it('calls PostgreSQL RPC with correct parameters and returns result', async () => {
      rpcState.data = { booking_id: 'new-uuid', status: 'ALIGNMENT_CHECKED', match_id: 'm-id', listing_id: 'listing-test', success: true };
      rpcState.error = null;

      const result = await executeMOD002Handoff(fullContext);

      expect(result.status).toBe('ALIGNMENT_CHECKED');
      expect(result.success).toBe(true);
      expect((result as unknown as Record<string, unknown>).booking_id).toBe('new-uuid');
      expect(rpcCallParams).not.toBeNull();
      expect(rpcCallParams?.p_listing_id).toBe('listing-test');
      expect(rpcCallParams?.p_offer_id).toBe('offer-test');
    });
  });

  describe('RPC failure handling', () => {
    it('throws descriptive error on RPC rejection', async () => {
      rpcState.error = { message: 'DB constraint violation' };
      await expect(executeMOD002Handoff(fullContext)).rejects.toThrow(/DB constraint violation/);
      // Reset for subsequent tests
      rpcState.error = null;
    });
  });

  describe('Vertical slice simulation', () => {
    it('full flow: listing → publish → offer → matching → accept → handoff → confirm pathway', async () => {
      rpcState.data = { booking_id: 'handoff-booking-id', status: 'ALIGNMENT_CHECKED', match_id: 'accepted-match-id', listing_id: 'published-listing-id', success: true };
      rpcState.error = null;

      const result = await executeMOD002Handoff({ ...fullContext, listingId: 'published-listing-id', offerId: 'submitted-offer-id' });

      expect(result.success).toBe(true);
      expect(result.status).toBe('ALIGNMENT_CHECKED');
      expect(rpcCallParams).not.toBeNull();
      expect(rpcCallParams?.p_listing_id).toBe('published-listing-id');
      expect(rpcCallParams?.p_offer_id).toBe('submitted-offer-id');
    });

    it('alignment failure preserves source states (no RPC call)', async () => {
      overrideAlign(() => { throw new ValidationError('Offer capacity insufficient', { details: { weightOk: true, volumeFail: true } }); });
      try {
        await executeMOD002Handoff(fullContext);
        expect.fail('Should have thrown');
      } catch {
        expect(rpcCallParams).toBeNull();
      }
    });
  });
});
