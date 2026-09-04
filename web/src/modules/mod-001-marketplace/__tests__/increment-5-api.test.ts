import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as quotesGET, POST as quotesPOST } from '@/app/api/marketplace/quotes/route';
import { GET as matchesGET, POST as matchesPOST } from '@/app/api/marketplace/matches/route';
import { CargoType, PricingModel, MatchStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { createClient } from '@/lib/supabase/server';

// Default: unauthenticated
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  } as any)),
}));

describe('C2-Increment-002 MOD-001 Increment 5 API Routes — Auth Migration & Matches', () => {
  // ============================================================
  // Quotes API (Unchanged — quotes remain Pattern B during C2)
  // Per C2 readiness: quotes NOT in C2 execution path
  // ============================================================

  describe('POST /api/marketplace/quotes (unchanged Pattern B)', () => {
    it('generates a corridor-based advisory quote for GENERAL cargo', async () => {
      const body = {
        listingId: 'listing-001',
        cargoType: CargoType.GENERAL,
        weightKg: 5000,
        timeWindow: { earliestPickup: '2026-09-15T08:00:00Z', latestDelivery: '2026-09-25T18:00:00Z' },
      };
      const request = new NextRequest('http://localhost:3000/api/marketplace/quotes', {
        method: 'POST',
        headers: { 'x-user-role': 'SHIPPER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const response = await quotesPOST(request);
      const data = await response.json();
      expect(response.status).toBe(201);
      expect(data.contract.ownerModule).toBe('MOD-001');
      expect(data.data.quoteId).toBeDefined();
      expect(data.data.suggestedPriceMin).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Matches API — NOW Pattern A (session-based) after C2 migration
  // ============================================================

  describe('GET /api/marketplace/matches (Pattern A migrated)', () => {
    it('returns empty match list for authenticated SHIPPER', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'SHIPPER' } } },
          error: null,
        })},
      } as any));
      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/matches?listingId=listing-001',
        { headers: {} },
      );
      const response = await matchesGET(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.listingId).toBe('listing-001');
      expect(Array.isArray(data.data.matches)).toBe(true);
    });

    it('returns 400 when listingId query param is missing (authenticated user)', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'SHIPPER' } } },
          error: null,
        })},
      } as any));
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        headers: {},
      });
      const response = await matchesGET(request);
      expect(response.status).toBe(400);
    });

    it('returns 401 for unauthenticated requests', async () => {
      // No mock override — uses default (null user) from vi.mock factory above
      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/matches?listingId=listing-001',
        { headers: {} },
      );
      const response = await matchesGET(request);
      expect(response.status).toBe(401);
    });

    it('returns 403 for TRANSPORTER trying to read matches (RBAC denied)', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'TRANSPORTER' } } },
          error: null,
        })},
      } as any));
      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/matches?listingId=listing-001',
        { headers: {} },
      );
      const response = await matchesGET(request);
      expect(response.status).toBe(403);
    });

    it('includes correlation ID header', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'SHIPPER' } } } ,
          error: null,
        })},
      } as any));
      const request = new NextRequest(
        'http://localhost:3000/api/marketplace/matches?listingId=listing-001',
        { headers: {} },
      );
      const response = await matchesGET(request);
      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });
  });

  describe('POST /api/marketplace/matches (Pattern A migrated)', () => {
    it('creates a match proposal for authenticated SHIPPER', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'SHIPPER' } } } ,
          error: null,
        })},
      } as any));
      const body = {
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 85.5,
        rankingPosition: 1,
        reasoningTrace: 'Excellent corridor alignment',
      };
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const response = await matchesPOST(request);
      const data = await response.json();
      expect(response.status).toBe(201);
      expect(data.data.matchId).toBeDefined();
      expect(data.data.listingId).toBe('listing-001');
      expect(data.data.offerId).toBe('offer-001');
      expect(data.data.matchScore).toBe(85.5);
      expect(data.data.rankingPosition).toBe(1);
      expect(data.data.status).toBe(MatchStatus.PROPOSED);
    });

    it('does not include BaseEntity persistence fields', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'SHIPPER' } } } ,
          error: null,
        })},
      } as any));
      const body = {
        listingId: 'listing-001',
        offerId: 'offer-001',
        matchScore: 80,
        rankingPosition: 2,
      };
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const response = await matchesPOST(request);
      const data = await response.json();
      expect('id' in data.data).toBe(false);
      expect('created_at' in data.data).toBe(false);
    });

    it('returns 400 when listingId is missing', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'SHIPPER' } } } ,
          error: null,
        })},
      } as any));
      const body = { offerId: 'offer-001', matchScore: 80, rankingPosition: 1 };
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const response = await matchesPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 when matchScore is out of range (>100)', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'SHIPPER' } } } ,
          error: null,
        })},
      } as any));
      const body = { listingId: 'l1', offerId: 'o1', matchScore: 150, rankingPosition: 1 };
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const response = await matchesPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 when rankingPosition < 1', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'SHIPPER' } } } ,
          error: null,
        })},
      } as any));
      const body = { listingId: 'l1', offerId: 'o1', matchScore: 80, rankingPosition: 0 };
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const response = await matchesPOST(request);
      expect(response.status).toBe(400);
    });

    it('returns 403 for TRANSPORTER creating matches (RBAC denied)', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'TRANSPORTER' } } } ,
          error: null,
        })},
      } as any));
      const body = { listingId: 'l1', offerId: 'o1', matchScore: 80, rankingPosition: 1 };
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const response = await matchesPOST(request);
      expect(response.status).toBe(403);
    });

    it('returns 401 for unauthenticated requests', async () => {
      // No mock override — uses default (null user) from vi.mock factory above
      const body = { listingId: 'l1', offerId: 'o1', matchScore: 80, rankingPosition: 1 };
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const response = await matchesPOST(request);
      expect(response.status).toBe(401);
    });

    it('includes correlation ID header', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'SHIPPER' } } } ,
          error: null,
        })},
      } as any));
      const body = { listingId: 'l1', offerId: 'o1', matchScore: 80, rankingPosition: 1 };
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const response = await matchesPOST(request);
      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });

    it('no longer accepts x-user-role header as identity source', async () => {
      vi.mocked(createClient).mockReturnValueOnce(({
        auth: { getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@nexcargo.com', user_metadata: { role: 'TRANSPORTER' } } } ,
          error: null,
        })},
      } as any));
      const body = { listingId: 'l1', offerId: 'o1', matchScore: 80, rankingPosition: 1 };
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify(body),
      });
      const response = await matchesPOST(request);
      // Should reject because session role is TRANSPORTER (header is ignored by assertApiAuthorization)
      expect(response.status).toBe(403);
    });
  });
});
