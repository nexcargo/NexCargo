import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';

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

/** Build a SELECT chain for getById/getByIdByStatus: from().select().eq().eq().single() */
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

/** Build a SELECT chain for listByShipper/listByTransporter: from().select().eq().eq() */
function listChain(error?: Record<string, string>, data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(error ? { error, data: [] } : { data, error: null }),
    }),
  };
}

/** Build a chain for update/confirm: from().update().eq().eq() */
function updateChain(error?: Record<string, string>) {
  const innerResult = error ? { error, data: null } : { data: [], error: null };
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(innerResult),
    }),
  };
}

describe('C2-Increment-001 BookingsRepository Error Handling — No Fake Success', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('BookingsRepository.create()', () => {
    it('throws on DB failure, never returns fake success', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => insertChain({ message: 'duplicate key', code: '23505' })),
      } as any);
      await expect(
        new BookingsRepository().create({
          bookingId: 'BKG-001', listingId: 'l1', selectedOfferId: 'o1',
          shipperId: 'u1', transporterId: 'u2', status: 'REQUESTED',
          originAddress: 'Maputo', destinationAddress: 'Beira',
          cargoDescription: 'General cargo', cargoType: 'GENERAL', weightKg: 5000,
          offerPrice: 15000, vehicleType: 'TRUCK',
        }),
      ).rejects.toThrow('Failed to create booking');
    });

    it('returns BookingApiShape on success', async () => {
      const mockRow = {
        id: 'b1', booking_id: 'BKG-001', listing_id: 'l1', selected_offer_id: 'o1',
        shipper_id: 'u1', transporter_id: 'u2', status: 'REQUESTED',
        confirmation_timestamp: null, origin_address: 'A', origin_latitude: null, origin_longitude: null,
        destination_address: 'B', destination_latitude: null, destination_longitude: null,
        cargo_description: 'Cargo', cargo_type: 'GENERAL', weight_kg: 100,
        volume_m3: null, special_handling: null, offer_price: 500, vehicle_type: 'TRUCK',
        declared_weight_kg: null, declared_volume_m3: null, currency: 'MZN',
        availability_window_start: null, availability_window_end: null, contract_id: null,
        correlation_id: null, is_deleted: false, version: 1,
        created_at: '2026-09-04T00:00:00Z', updated_at: '2026-09-04T00:00:00Z',
      };
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => insertChain(undefined, mockRow)),
      } as any);
      const result = await new BookingsRepository().create({
        bookingId: 'BKG-001', listingId: 'l1', selectedOfferId: 'o1',
        shipperId: 'u1', transporterId: 'u2', status: 'REQUESTED',
        originAddress: 'A', destinationAddress: 'B',
        cargoDescription: 'Cargo', cargoType: 'GENERAL', weightKg: 100,
        offerPrice: 500, vehicleType: 'TRUCK',
      });
      expect(result.bookingId).toBe('b1');
      expect(result.status).toBe('REQUESTED');
      expect(result.originAddress).toBe('A');
    });

    it('propagates FK violation errors', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => insertChain({ message: 'FK violation', code: '23503' })),
      } as any);
      await expect(
        new BookingsRepository().create({
          bookingId: 'BKG-002', listingId: 'invalid-listing-id', selectedOfferId: 'o1',
          shipperId: 'u1', transporterId: 'u2', status: 'REQUESTED',
          originAddress: 'A', destinationAddress: 'B',
          cargoDescription: 'Cargo', cargoType: 'GENERAL', weightKg: 100,
          offerPrice: 500, vehicleType: 'TRUCK',
        }),
      ).rejects.toThrow(/Failed to create booking|FK violation/i);
    });
  });

  describe('BookingsRepository.getById()', () => {
    it('returns null only for PGRST116', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => getChain({ code: 'PGRST116' })),
      } as any);
      expect(await new BookingsRepository().getById('nonexistent')).toBeNull();
    });

    it('throws for non-PGRST116 errors', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => getChain({ message: 'timeout', code: '500' })),
      } as any);
      await expect(new BookingsRepository().getById('x')).rejects.toThrow('Failed to get booking');
    });
  });

  describe('BookingsRepository.getByIdByStatus()', () => {
    it('returns null only for PGRST116', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => getChain({ code: 'PGRST116' })),
      } as any);
      expect(await new BookingsRepository().getByIdByStatus('BKG-xxx')).toBeNull();
    });

    it('throws for non-PGRST116 errors', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => getChain({ message: 'db error' })),
      } as any);
      await expect(new BookingsRepository().getByIdByStatus('BKG-xxx')).rejects.toThrow('Failed to get booking by ID');
    });
  });

  describe('BookingsRepository.updateStatus()', () => {
    it('throws on DB failure', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => updateChain({ message: 'constraint violation' })),
      } as any);
      await expect(new BookingsRepository().updateStatus('id', 'CONFIRMED'))
        .rejects.toThrow('Failed to update booking status');
    });
  });

  describe('BookingsRepository.confirmBooking()', () => {
    it('throws on DB failure', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => updateChain({ message: 'row locked' })),
      } as any);
      await expect(new BookingsRepository().confirmBooking('id'))
        .rejects.toThrow('Failed to confirm booking');
    });
  });

  describe('BookingsRepository.listByShipper()', () => {
    it('throws on DB failure', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => listChain({ message: 'permission denied' })),
      } as any);
      await expect(new BookingsRepository().listByShipper('shipper-uuid'))
        .rejects.toThrow('Failed to list bookings by shipper');
    });

    it('returns empty array when no bookings found', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => listChain()),
      } as any);
      const result = await new BookingsRepository().listByShipper('shipper-uuid');
      expect(result).toEqual([]);
    });
  });

  describe('BookingsRepository.listByTransporter()', () => {
    it('throws on DB failure', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => listChain({ message: 'relation missing' })),
      } as any);
      await expect(new BookingsRepository().listByTransporter('transporter-uuid'))
        .rejects.toThrow('Failed to list bookings by transporter');
    });

    it('returns empty array when no bookings found', async () => {
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => listChain()),
      } as any);
      const result = await new BookingsRepository().listByTransporter('transporter-uuid');
      expect(result).toEqual([]);
    });
  });

  describe('Auth Module Export Check', () => {
    it('createClient function exists', () => {
      expect(typeof createClient).toBe('function');
    });
  });
});
