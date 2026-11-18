// PRE-I-6 WS-02 match persistence (LA directive 2026-11-18, D-M1/D-M2 approved).
// MOCKED unit tests: the session client and the three repositories are stubbed.
// These legs verify route orchestration only — they are NOT live RLS evidence.
// Live session-RLS verification is recorded separately in the WS-02 report.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as matchesGET, POST as matchesPOST } from '@/app/api/marketplace/matches/route';
import { MatchStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { createClient } from '@/lib/supabase/server';

const SHIPPER_UID = '666ed3aa-204a-45ad-83f5-b9cf0d4d8df8';
const OTHER_SHIPPER_UID = '99999999-9999-4999-8999-999999999999';
const TRANSPORTER_UID = 'e0fe13fd-6606-475f-a945-0a35ad879f27';
const LISTING_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const OFFER_ID = 'cccccccc-0000-4000-8000-000000000002';
const MATCH_ID = 'eeeeeeee-0000-4000-8000-000000000003';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper: mock client. I-1 §3.6 — the database resolvers are the only role source;
// effective_marketplace_role() supplies the marketplace classification and user_metadata none.
function makeMock(user: any, marketplace: string | null = 'SHIPPER') {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn(async (fn: string) =>
      fn === 'effective_marketplace_role'
        ? { data: marketplace, error: null }
        : { data: null, error: null },
    ),
  } as any;
}

const repo = vi.hoisted(() => ({
  listing: null as any,
  offer: null as any,
  byListing: [] as any[],
  byOffer: [] as any[],
  created: null as any,
  createCalls: [] as any[],
  createError: null as Error | null,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => makeMock(null)), // default: unauthenticated
}));
vi.mock('@/infrastructure/repositories/listings-repository', () => ({
  ListingsRepository: class { async getById() { return repo.listing; } },
}));
vi.mock('@/infrastructure/repositories/offers-repository', () => ({
  OffersRepository: class { async getById() { return repo.offer; } },
}));
vi.mock('@/infrastructure/repositories/matches-repository', () => ({
  MatchesRepository: class {
    async create(params: any) {
      repo.createCalls.push(params);
      if (repo.createError) throw repo.createError;
      return repo.created;
    }
    async getById() { return null; }
    async findByListing() { return repo.byListing; }
    async findByOffer() { return repo.byOffer; }
    async reject() { /* not exercised by the collection route */ }
  },
}));

function makeMatch(overrides: Record<string, unknown> = {}) {
  const m = {
    id: MATCH_ID,
    listingId: LISTING_ID,
    offerId: OFFER_ID,
    matchScore: 85.5,
    rankingPosition: 1,
    status: MatchStatus.PROPOSED as string,
    reasoningTrace: undefined as string | undefined,
    version: 1,
    created_at: new Date('2026-11-18T00:00:00Z'),
    updated_at: new Date('2026-11-18T00:00:00Z'),
    ...overrides,
  };
  return {
    ...m,
    toApiShape: () => ({
      matchId: m.id,
      listingId: m.listingId,
      offerId: m.offerId,
      matchScore: m.matchScore,
      rankingPosition: m.rankingPosition,
      status: m.status,
      reasoningTrace: m.reasoningTrace,
      version: m.version,
      createdAt: m.created_at.toISOString(),
      updatedAt: m.updated_at.toISOString(),
    }),
  };
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/marketplace/matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = { listingId: LISTING_ID, offerId: OFFER_ID, matchScore: 85.5, rankingPosition: 1 };
const asShipper = () => vi.mocked(createClient).mockReturnValue(makeMock({ id: SHIPPER_UID, email: 'shipper@nexcargo.test' }));

describe('PRE-I-6 WS-02 MOD-001 Matches Collection API — persisted match recording (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue(makeMock(null));
    repo.listing = { listingId: LISTING_ID, shipperId: SHIPPER_UID, status: 'PUBLISHED' };
    repo.offer = { offerId: OFFER_ID, listingId: LISTING_ID, transporterId: TRANSPORTER_UID, status: 'SUBMITTED' };
    repo.byListing = [];
    repo.byOffer = [];
    repo.created = makeMatch();
    repo.createCalls = [];
    repo.createError = null;
  });

  // ============================================================
  // Matches API — Pattern A (session-based), persisted reads
  // ============================================================

  describe('GET /api/marketplace/matches', () => {
    it('returns persisted matches for the owning authenticated SHIPPER', async () => {
      asShipper();
      repo.byListing = [makeMatch()];
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches?listingId=${LISTING_ID}`, { headers: {} });
      const response = await matchesGET(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.listingId).toBe(LISTING_ID);
      expect(data.data.matches).toHaveLength(1);
      expect(data.data.matches[0].matchId).toBe(MATCH_ID);
      expect(data.data.matches[0].status).toBe(MatchStatus.PROPOSED);
    });

    it('returns an empty list when the owning SHIPPER has no matches', async () => {
      asShipper();
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches?listingId=${LISTING_ID}`, { headers: {} });
      const response = await matchesGET(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.matches).toEqual([]);
    });

    it('returns 400 when listingId query param is missing (authenticated user)', async () => {
      asShipper();
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches', { headers: {} });
      const response = await matchesGET(request);
      expect(response.status).toBe(400);
    });

    it('returns 400 for a non-UUID listingId (advisory/ephemeral ids are not persisted keys)', async () => {
      asShipper();
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches?listingId=listing-001', { headers: {} });
      const response = await matchesGET(request);
      expect(response.status).toBe(400);
    });

    it('returns 404 for a nonexistent listing', async () => {
      asShipper();
      repo.listing = null;
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches?listingId=${LISTING_ID}`, { headers: {} });
      const response = await matchesGET(request);
      expect(response.status).toBe(404);
    });

    it('returns 404 (not 403) for a foreign listing so match metadata is never disclosed', async () => {
      asShipper();
      repo.listing = { listingId: LISTING_ID, shipperId: OTHER_SHIPPER_UID, status: 'PUBLISHED' };
      repo.byListing = [makeMatch()];
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches?listingId=${LISTING_ID}`, { headers: {} });
      const response = await matchesGET(request);
      const data = await response.json();
      expect(response.status).toBe(404);
      expect(data.data.matches).toBeUndefined();
    });

    it('returns 401 for unauthenticated requests', async () => {
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches?listingId=${LISTING_ID}`, { headers: {} });
      const response = await matchesGET(request);
      expect(response.status).toBe(401);
    });

    it('returns 403 for TRANSPORTER trying to read matches (RBAC denied)', async () => {
      vi.mocked(createClient).mockReturnValue(makeMock({ id: TRANSPORTER_UID, email: 'transporter@nexcargo.test' }, 'TRANSPORTER'));
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches?listingId=${LISTING_ID}`, { headers: {} });
      const response = await matchesGET(request);
      expect(response.status).toBe(403);
    });

    it('returns 403 for an authenticated user without any marketplace membership', async () => {
      vi.mocked(createClient).mockReturnValue(makeMock({ id: SHIPPER_UID, email: 'nomember@nexcargo.test' }, null));
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches?listingId=${LISTING_ID}`, { headers: {} });
      const response = await matchesGET(request);
      expect(response.status).toBe(403);
    });

    it('includes correlation ID header', async () => {
      asShipper();
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches?listingId=${LISTING_ID}`, { headers: {} });
      const response = await matchesGET(request);
      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });
  });

  describe('POST /api/marketplace/matches', () => {
    it('persists a PROPOSED match for the owning SHIPPER and returns the database UUID', async () => {
      asShipper();
      const response = await matchesPOST(postRequest({ ...validBody, reasoningTrace: 'Excellent corridor alignment' }));
      const data = await response.json();
      expect(response.status).toBe(201);
      expect(data.data.matchId).toBe(MATCH_ID);
      expect(UUID_RE.test(data.data.matchId)).toBe(true);
      expect(data.data.listingId).toBe(LISTING_ID);
      expect(data.data.offerId).toBe(OFFER_ID);
      expect(data.data.status).toBe(MatchStatus.PROPOSED);
      expect(repo.createCalls).toHaveLength(1);
      expect(repo.createCalls[0].createdBy).toBe(SHIPPER_UID);
      expect(repo.createCalls[0].reasoningTrace).toBe('Excellent corridor alignment');
    });

    it('never returns an ephemeral advisory id (match-... prefix)', async () => {
      asShipper();
      const response = await matchesPOST(postRequest(validBody));
      const data = await response.json();
      expect(data.data.matchId.startsWith('match-')).toBe(false);
      expect(UUID_RE.test(data.data.matchId)).toBe(true);
    });

    it('derives created_by from the session, never from the request body', async () => {
      asShipper();
      await matchesPOST(postRequest({ ...validBody, createdBy: OTHER_SHIPPER_UID, shipperId: OTHER_SHIPPER_UID }));
      expect(repo.createCalls[0].createdBy).toBe(SHIPPER_UID);
    });

    it('rounds matchScore to 2 decimal places before persisting', async () => {
      asShipper();
      await matchesPOST(postRequest({ ...validBody, matchScore: 85.567 }));
      expect(repo.createCalls[0].matchScore).toBe(85.57);
    });

    it('returns the existing PROPOSED record idempotently on re-selection (D-M4 app-level)', async () => {
      asShipper();
      repo.byOffer = [makeMatch()];
      const response = await matchesPOST(postRequest(validBody));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.idempotent).toBe(true);
      expect(data.data.matchId).toBe(MATCH_ID);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('does not reuse a REJECTED match — a new selection creates a new record', async () => {
      asShipper();
      repo.byOffer = [makeMatch({ status: MatchStatus.REJECTED })];
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(201);
      expect(repo.createCalls).toHaveLength(1);
    });

    it('does not reuse a PROPOSED match belonging to a different listing', async () => {
      asShipper();
      repo.byOffer = [makeMatch({ listingId: 'bbbbbbbb-0000-4000-8000-000000000009' })];
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(201);
      expect(repo.createCalls).toHaveLength(1);
    });

    it('returns 400 when listingId is missing', async () => {
      asShipper();
      const response = await matchesPOST(postRequest({ offerId: OFFER_ID, matchScore: 80, rankingPosition: 1 }));
      expect(response.status).toBe(400);
    });

    it('returns 400 when offerId is missing', async () => {
      asShipper();
      const response = await matchesPOST(postRequest({ listingId: LISTING_ID, matchScore: 80, rankingPosition: 1 }));
      expect(response.status).toBe(400);
    });

    it('returns 400 for non-UUID listingId/offerId (non-persisted advisory ids)', async () => {
      asShipper();
      const response = await matchesPOST(postRequest({ ...validBody, listingId: 'listing-001' }));
      expect(response.status).toBe(400);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('returns 400 when matchScore is out of range (>100)', async () => {
      asShipper();
      const response = await matchesPOST(postRequest({ ...validBody, matchScore: 150 }));
      expect(response.status).toBe(400);
    });

    it('returns 400 when matchScore is out of range (<0)', async () => {
      asShipper();
      const response = await matchesPOST(postRequest({ ...validBody, matchScore: -5 }));
      expect(response.status).toBe(400);
    });

    it('returns 400 when rankingPosition < 1', async () => {
      asShipper();
      const response = await matchesPOST(postRequest({ ...validBody, rankingPosition: 0 }));
      expect(response.status).toBe(400);
    });

    it('returns 404 when the listing does not exist', async () => {
      asShipper();
      repo.listing = null;
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(404);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('returns 403 when the listing belongs to another shipper (forged ownership)', async () => {
      asShipper();
      repo.listing = { listingId: LISTING_ID, shipperId: OTHER_SHIPPER_UID, status: 'PUBLISHED' };
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(403);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('returns 400 when the listing is not PUBLISHED', async () => {
      asShipper();
      repo.listing = { listingId: LISTING_ID, shipperId: SHIPPER_UID, status: 'DRAFT' };
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(400);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('returns 404 when the offer does not exist', async () => {
      asShipper();
      repo.offer = null;
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(404);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('returns 400 when the offer belongs to a different listing (mismatched relationship)', async () => {
      asShipper();
      repo.offer = { offerId: OFFER_ID, listingId: 'bbbbbbbb-0000-4000-8000-000000000009', transporterId: TRANSPORTER_UID, status: 'SUBMITTED' };
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(400);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('returns 400 when the offer is not SUBMITTED', async () => {
      asShipper();
      repo.offer = { offerId: OFFER_ID, listingId: LISTING_ID, transporterId: TRANSPORTER_UID, status: 'ACCEPTED' };
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(400);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('maps a database row-level-security INSERT refusal to 403', async () => {
      asShipper();
      repo.createError = new Error('Failed to create match: new row violates row-level security policy for table "matches"');
      const response = await matchesPOST(postRequest(validBody));
      const data = await response.json();
      expect(response.status).toBe(403);
      expect(data.data.error).toContain('row-level security');
    });

    it('returns 403 for TRANSPORTER creating matches (RBAC denied)', async () => {
      vi.mocked(createClient).mockReturnValue(makeMock({ id: TRANSPORTER_UID, email: 'transporter@nexcargo.test' }, 'TRANSPORTER'));
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(403);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const response = await matchesPOST(postRequest(validBody));
      expect(response.status).toBe(401);
      expect(repo.createCalls).toHaveLength(0);
    });

    it('includes correlation ID header', async () => {
      asShipper();
      const response = await matchesPOST(postRequest(validBody));
      expect(response.headers.get('x-correlation-id')).toBeDefined();
    });

    it('no longer accepts x-user-role header as identity source (forged role metadata)', async () => {
      vi.mocked(createClient).mockReturnValue(makeMock({ id: TRANSPORTER_UID, email: 'transporter@nexcargo.test' }, 'TRANSPORTER'));
      const response = await matchesPOST(postRequest(validBody, { 'x-user-role': 'ADMIN' }));
      expect(response.status).toBe(403);
      expect(repo.createCalls).toHaveLength(0);
    });
  });
});
