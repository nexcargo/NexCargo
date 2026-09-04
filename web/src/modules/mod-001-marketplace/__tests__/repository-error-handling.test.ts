import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

/** Build a mock INSERT chain: from().insert().select().single() → error or success */
function insertChain(error?: Record<string, string>, data?: Record<string, unknown>) {
  const result = error ? { error, data: null } : { data: data ?? {}, error: null };
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(result),
    }),
  };
}

/** Build a SELECT chain for getById: from().select().eq().eq().single() */
function getChain(error?: Record<string, string>, data?: unknown) {
  const innerResult = error ? { error, data: null } : { data: data ?? null, error: null };
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(innerResult),
      }),
    }),
  };
}

/** Build a SELECT chain for listPublished/listByListing: from().select().eq().eq() */
function listChain(error?: Record<string, string>, data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(error ? { error, data: [] } : { data, error: null }),
    }),
  };
}

/** Build a chain for update/delete: from().update().eq().eq() or from().delete().eq().eq() */
function updateChain(error?: Record<string, string>) {
  const innerResult = error ? { error, data: null } : { data: [], error: null };
  return {
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(innerResult),
    }),
  };
}

describe('C1 Repository Error Handling — No Fake Success', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('ListingsRepository', () => {
    it('create() throws on DB failure, never returns fake success', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => insertChain({ message: 'duplicate key', code: '23505' })),
      } as any);
      const repo = new ListingsRepository();
      await expect(
        repo.create({ shipperId:'u1', title:'T', description:'', originGeo:{}, destinationGeo:{},
          originAddress:'A', destinationAddress:'B', cargoType:'GENERAL', weightKg:100, volumeM3:null,
          timeWindow:{ earliestPickup:'2026-01-01Z', latestDelivery:'2026-01-02Z' }, pricingModel:'FIXED' }),
      ).rejects.toThrow('Failed to create listing');
    });

    it('listPublished() throws on DB failure, never returns empty array silently', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => listChain({ message: 'permission denied', code: '42501' })),
      } as any);
      await expect(new ListingsRepository().listPublished()).rejects.toThrow('Failed to list listings');
    });

    it('getById() returns null only for PGRST116, throws for other errors', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => getChain({ message: 'timeout', code: '500' })),
      } as any);
      await expect(new ListingsRepository().getById('x')).rejects.toThrow('Failed to get listing');

      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => getChain({ code: 'PGRST116' })),
      } as any);
      expect(await new ListingsRepository().getById('x')).toBeNull();
    });

    it('updateStatus() throws on DB failure', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => updateChain({ message: 'constraint violation' })),
      } as any);
      await expect(new ListingsRepository().updateStatus('id','PUBLISHED')).rejects.toThrow('Failed to update listing status');
    });
  });

  describe('OffersRepository', () => {
    it('create() throws on DB failure', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => insertChain({ message: 'FK violation', code: '23503' })),
      } as any);
      await expect(
        new OffersRepository().create({ transporterId:'t1', listingId:'l1', priceProposal:5000,
          availabilityWindow:{}, vehicleType:'TRUCK', declaredCapacity:{maxWeightKg:20000} }),
      ).rejects.toThrow('Failed to create offer');
    });

    it('listByListing() throws on DB failure', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => listChain({ message: 'relation missing' })),
      } as any);
      await expect(new OffersRepository().listByListing('x')).rejects.toThrow('Failed to list offers');
    });

    it('updateStatus() throws on DB failure', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => updateChain({ message: 'row locked' })),
      } as any);
      await expect(new OffersRepository().updateStatus('id','ACCEPTED')).rejects.toThrow('Failed to update offer status');
    });

    it('getById() null-for-PGRST116-only', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => getChain({ code: 'PGRST116' })),
      } as any);
      expect(await new OffersRepository().getById('x')).toBeNull();

      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => getChain({ message: 'timeout' })),
      } as any);
      await expect(new OffersRepository().getById('x')).rejects.toThrow('Failed to get offer');
    });
  });

  describe('Auth Module Export Check', () => {
    it('createClient function exists', () => {
      expect(typeof createClient).toBe('function');
    });
  });
});
