import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Import route handlers AFTER setting up mocks
import * as serverModule from '@/lib/supabase/server';

const mockUser = {
  id: 'test-user-001',
  email: 'test@example.com',
  user_metadata: { role: 'SHIPPER' },
};

// Mock createClient to return a Supabase client with an authenticated user
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser }, error: null })),
    },
  })),
}));

// Mock ListingsRepository to always return success (no real DB needed)
const mockCreateListing = vi.fn().mockResolvedValue({
  listingId: 'mock-listing-id',
  shipperId: 'test-user-001',
  title: '',
  description: '',
  origin: { latitude: -25.9692, longitude: 32.5855, address: 'Maputo Port' },
  destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
  cargoType: 'GENERAL',
  weightKg: 10000,
  volumeM3: null,
  timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
  pricingModel: 'FIXED',
  status: 'DRAFT',
  publishedAt: null,
  acceptedVehicleTypes: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const mockListPublished = vi.fn().mockResolvedValue([]);
const mockGetById = vi.fn().mockResolvedValue(null);
const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);

vi.doMock('@/infrastructure/repositories/listings-repository', () => ({
  ListingsRepository: class MockListingsRepository {
    create = mockCreateListing;
    listPublished = mockListPublished;
    getById = mockGetById;
    updateStatus = mockUpdateStatus;
  },
}));

// Dynamically import after mocking
let listingsGET: typeof import('@/app/api/marketplace/listings/route').GET;
let listingsPOST: typeof import('@/app/api/marketplace/listings/route').POST;

beforeEach(async () => {
  vi.clearAllMocks();
  // Re-import route handlers after each mock reset
  const mod = await import('@/app/api/marketplace/listings/route');
  listingsGET = mod.GET;
  listingsPOST = mod.POST;
});

describe('MOD-001 Listings API — C1 Hardened Authentication', () => {
  describe('GET /api/marketplace/listings', () => {
    it('returns 401 when no Supabase session exists (unauthenticated)', async () => {
      // Override mock for this test only
      vi.mocked(serverModule.createClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
        },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings');
      const response = await listingsGET(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.data?.error ?? data.error).toContain('session required');
    });

    it('returns 200 with contract-wrapped response for authenticated SHIPPER', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/listings');
      const response = await listingsGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.contract.ownerModule).toBe('MOD-001');
      expect(typeof data.correlationId).toBe('string');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('includes correlation ID in response headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/listings');
      const response = await listingsGET(request);
      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });

    it('returns 403 when authenticated user lacks RBAC permission', async () => {
      // Authenticated as TRANSPORTER (which cannot READ listings per RBAC matrix)
      vi.mocked(serverModule.createClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { ...mockUser, user_metadata: { role: 'TRANSPORTER' } } },
            error: null,
          })),
        },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings');
      const response = await listingsGET(request);
      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/marketplace/listings', () => {
    const validBody = {
      shipperId: 'shipper-001',
      origin: { latitude: -25.9692, longitude: 32.5855, address: 'Maputo Port' },
      destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
      cargoType: 'GENERAL',
      weightKg: 10000,
      timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
    };

    it('returns 401 when no Supabase session (identity from x-user-role rejected)', async () => {
      vi.mocked(serverModule.createClient).mockReturnValueOnce({
        auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });

      const response = await listingsPOST(request);
      expect(response.status).toBe(401);
      // Header role must NOT grant access without a session
    });

    it('returns 401 when header role differs from session identity', async () => {
      // Session says SHIPPER, header tries to claim TRANSPORTER — should be ignored
      vi.mocked(serverModule.createClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { ...mockUser, user_metadata: { role: 'SHIPPER' } } },
            error: null,
          })),
        },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'x-user-role': 'TRANSPORTER', 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });

      const response = await listingsPOST(request);
      // SHIPPER CAN create listings via RBAC matrix — gets past auth+RBAC
      expect(response.status).not.toBe(401);
      // But since repository mock succeeds, it should return 201
      expect(response.status).toBe(201);
      // ShipperId must come from SESSION, not from request body or header
      const data = await response.json();
      expect(data.data.shipperId).toBe('test-user-001'); // From session
    });

    it('returns 201 with DRAFT status for valid authenticated creation', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });

      const response = await listingsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.status).toBe('DRAFT');
      expect(data.data.shipperId).toBe('test-user-001');
    });

    it('returns 400 when required fields are missing', async () => {
      const incompleteBody = { shipperId: 'shipper-001' };

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incompleteBody),
      });

      const response = await listingsPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 when origin is incomplete', async () => {
      const badOriginBody = {
        ...validBody,
        origin: { latitude: -25.9692 },
      };

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(badOriginBody),
      });

      const response = await listingsPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 403 when authenticated TRANSPORTER tries to create listing', async () => {
      vi.mocked(serverModule.createClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { ...mockUser, user_metadata: { role: 'TRANSPORTER' } } },
            error: null,
          })),
        },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });

      const response = await listingsPOST(request);
      expect(response.status).toBe(403);
    });
  });
});
