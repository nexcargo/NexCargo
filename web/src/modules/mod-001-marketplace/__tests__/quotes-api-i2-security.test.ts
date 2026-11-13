// NexCargo — I-2 F-I2-01 Regression Tests: /api/marketplace/quotes authorization
// The quotes endpoint previously took the caller's role from the x-user-role request header and
// defaulted it to SHIPPER, so any client could assert SUPER_ADMIN. These tests pin the corrected
// behavior: identity from the Supabase session, role from the database resolvers only, and a
// missing or unresolvable authority denied rather than defaulted.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { CargoType } from '@/modules/mod-001-marketplace/domain/enums';
import * as serverModule from '@/lib/supabase/server';

const mockUser = {
  id: 'quote-user-001',
  email: 'quote-shipper@example.com',
  user_metadata: { tenantId: 'tenant-001' },
};

// effective_user_role() -> platform tier, effective_marketplace_role() -> SHIPPER/TRANSPORTER.
function resolvers(marketplace: string | null = 'SHIPPER', platform: string | null = null) {
  return vi.fn(async (fn: string) =>
    fn === 'effective_marketplace_role'
      ? { data: marketplace, error: null }
      : { data: platform, error: null },
  );
}

function noRoleResolved() {
  return vi.fn(async () => ({ data: null, error: null }));
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    rpc: vi.fn(async () => ({ data: null, error: new Error('RPC unavailable') })),
  }) as any),
}));

const validQuoteBody = {
  listingId: 'listing-001',
  cargoType: CargoType.GENERAL,
  weightKg: 5000,
  timeWindow: { earliestPickup: '2026-09-15T08:00:00Z', latestDelivery: '2026-09-25T18:00:00Z' },
};

function clientWith(session: unknown, rpc: ReturnType<typeof resolvers>) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: session }, error: null }) },
    rpc,
  } as any;
}

let quotesGET: typeof import('@/app/api/marketplace/quotes/route').GET;
let quotesPOST: typeof import('@/app/api/marketplace/quotes/route').POST;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(serverModule.createClient).mockReturnValue(
    clientWith(mockUser, resolvers('SHIPPER')),
  );
  const mod = await import('@/app/api/marketplace/quotes/route');
  quotesGET = mod.GET;
  quotesPOST = mod.POST;
});

describe('MOD-001 Quotes API — I-2 authorization (F-I2-01)', () => {
  describe('GET /api/marketplace/quotes', () => {
    it('returns 401 with no session even when the header asserts SUPER_ADMIN', async () => {
      vi.mocked(serverModule.createClient).mockReturnValue(clientWith(null, noRoleResolved()));

      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/quotes?listingId=listing-001',
        { headers: { 'x-user-role': 'SUPER_ADMIN' } },
      );
      const response = await quotesGET(request);
      expect(response.status).toBe(401);
    });

    it('returns 200 for an authorized SHIPPER session', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/quotes?listingId=listing-001',
      );
      const response = await quotesGET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('x-correlation-id')).toBeDefined();
      expect(payload.contract.ownerModule).toBe('MOD-001');
      expect(payload.data.listingId).toBe('listing-001');
    });

    it('returns 400 for an authorized caller that omits listingId', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes');
      const response = await quotesGET(request);
      expect(response.status).toBe(400);
    });

    it('denies a TRANSPORTER session that forges an authorized header role', async () => {
      vi.mocked(serverModule.createClient).mockReturnValue(clientWith(mockUser, resolvers('TRANSPORTER')));

      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/quotes?listingId=listing-001',
        { headers: { 'x-user-role': 'SUPER_ADMIN' } },
      );
      const response = await quotesGET(request);
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(String(payload.data?.error ?? payload.error)).toContain("Role 'TRANSPORTER'");
    });

    it('denies when no database role resolves, whatever the header claims', async () => {
      vi.mocked(serverModule.createClient).mockReturnValue(clientWith(mockUser, noRoleResolved()));

      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/quotes?listingId=listing-001',
        { headers: { 'x-user-role': 'ADMIN' } },
      );
      const response = await quotesGET(request);
      expect(response.status).toBe(403);
    });

    it('authorizes a platform tier resolved from app.platform_roles', async () => {
      vi.mocked(serverModule.createClient).mockReturnValue(
        clientWith(mockUser, resolvers(null, 'ADMIN')),
      );

      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/quotes?listingId=listing-001',
      );
      const response = await quotesGET(request);
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/marketplace/quotes', () => {
    it('returns 401 with no session and does not process the body', async () => {
      vi.mocked(serverModule.createClient).mockReturnValue(clientWith(null, noRoleResolved()));

      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(validQuoteBody),
      });
      const response = await quotesPOST(request);
      expect(response.status).toBe(401);
    });

    it('returns 201 for an authorized SHIPPER session', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validQuoteBody),
      });
      const response = await quotesPOST(request);

      expect(response.status).toBe(201);
      const payload = await response.json();
      expect(payload.data.listingId).toBe('listing-001');
    });

    it('returns 400 for an authorized caller with an incomplete body', async () => {
      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: 'listing-001' }),
      });
      const response = await quotesPOST(request);
      expect(response.status).toBe(400);
    });

    it('denies a TRANSPORTER session that forges an authorized header role', async () => {
      vi.mocked(serverModule.createClient).mockReturnValue(clientWith(mockUser, resolvers('TRANSPORTER')));

      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SUPER_ADMIN', 'Content-Type': 'application/json' },
        body: JSON.stringify(validQuoteBody),
      });
      const response = await quotesPOST(request);
      expect(response.status).toBe(403);
    });

    it('denies MODERATOR create even though MODERATOR may read quotes', async () => {
      vi.mocked(serverModule.createClient).mockReturnValue(clientWith(mockUser, resolvers('SHIPPER', 'MODERATOR')));

      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validQuoteBody),
      });
      const response = await quotesPOST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('the route no longer reads authority from a header', () => {
    it('produces the same decision for a forged header as for no header at all', async () => {
      vi.mocked(serverModule.createClient).mockReturnValue(clientWith(mockUser, resolvers('TRANSPORTER')));

      const withoutHeader = await quotesGET(
        new NextRequest('http://localhost:3000/api/marketplace/quotes?listingId=listing-001'),
      );
      const withForgedHeader = await quotesGET(
        new NextRequest('http://localhost:3000/api/marketplace/quotes?listingId=listing-001', {
          headers: { 'x-user-role': 'SUPER_ADMIN' },
        }),
      );

      expect(withoutHeader.status).toBe(withForgedHeader.status);
      expect(withForgedHeader.status).toBe(403);
    });
  });
});
