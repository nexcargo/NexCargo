import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as alignmentModule from '@/modules/mod-002-booking/domain/services/offer-listing-alignment';
import type { BookingApiShape } from '@/infrastructure/repositories/bookings-repository';

const alignmentPassResult = {
  isAligned: true,
  weightCheck: { passes: true, listingRequired: 0, offerDeclared: 0, variancePercentage: 100 },
  volumeCheck: null,
  vehicleTypeCheck: { passes: true, listingAcceptedTypes: [], offerVehicleType: '' },
  details: [] as string[],
};

// Mock alignment validator at module level (hoists alongside other mocks)
vi.spyOn(alignmentModule, 'validateOfferListingAlignment').mockImplementation(
  (_listing, _offer) => alignmentPassResult,
);

// Use vi.doMock so it takes effect during beforeEach, not module load
let handler: typeof import('@/app/api/booking/route').POST;

describe('MOD-002 POST /bookings — DEC-001 Integrity Controls', () => {
  const mockCreateFn = vi.fn().mockResolvedValue({} as BookingApiShape);

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset alignment to pass-by-default
    vi.spyOn(alignmentModule, 'validateOfferListingAlignment').mockImplementation(
      (_listing, _offer) => alignmentPassResult,
    );
    
    // Set up Supabase mock inline
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(() => ({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'valid' }, error: null }),
        }),
        rpc: vi.fn(),
      })),
    }));
    
    // Mock auth
    vi.doMock('@/lib/supabase/api-auth', () => ({
      assertApiAuthorization: vi.fn().mockResolvedValue({ userId: 'shipper-user-1', email: 'shipper@test.com', role: 'SHIPPER' }),
    }));
    
    // Mock repo
    vi.doMock('@/infrastructure/repositories/bookings-repository', () => ({
      BookingsRepository: vi.fn(() => ({ create: mockCreateFn })),
    }));
    
    // Dynamic import picks up all doMock() replacements
    const mod = await import('@/app/api/booking/route');
    handler = mod.POST;
  });

  function makeRequest(body: Record<string, unknown>, overrideShipperId?: string): NextRequest {
    const shipperId = overrideShipperId ?? 'shipper-user-1';
    return new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, shipperId }),
    });
  }

  describe('Field validation preserved', () => {
    it('rejects missing required fields', async () => {
      const response = await handler(makeRequest({
        bookingId: 'BKG-001',
        selectedOfferId: 'offer-123',
        originAddress: 'Origin City',
        destinationAddress: 'Destination Port',
        cargoDescription: 'General cargo',
        cargoType: 'GENERAL',
        weightKg: 5000,
        offerPrice: 15000,
        vehicleType: 'TRUCK',
      }));

      expect(response.status).toBe(400);
    });

    it('rejects when shipper ID does not match session user', async () => {
      vi.doMock('@/lib/supabase/api-auth', () => ({
        assertApiAuthorization: vi.fn().mockResolvedValueOnce({
          userId: 'different-user',
          email: 'diff@test.com',
          role: 'SHIPPER',
        }),
      }));

      const response = await handler(makeRequest({
        bookingId: 'BKG-001',
        listingId: 'listing-1',
        selectedOfferId: 'offer-123',
        originAddress: 'Origin City',
        destinationAddress: 'Destination Port',
        cargoDescription: 'General cargo',
        cargoType: 'GENERAL',
        weightKg: 5000,
        offerPrice: 15000,
        vehicleType: 'TRUCK',
      }, 'shipper-different'));

      expect(response.status).toBe(400);
    });

    it('rejects invalid weight values', async () => {
      const response = await handler(makeRequest({
        bookingId: 'BKG-001',
        listingId: 'listing-1',
        selectedOfferId: 'offer-123',
        originAddress: 'Origin City',
        destinationAddress: 'Destination Port',
        cargoDescription: 'General cargo',
        cargoType: 'GENERAL',
        weightKg: -100,
        offerPrice: 15000,
        vehicleType: 'TRUCK',
      }));

      expect(response.status).toBe(400);
    });
  });
});
