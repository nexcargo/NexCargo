// PRE-I-6 WS-02 match persistence (LA directive 2026-11-18, D-M1/D-M2 approved).
// MOCKED unit tests for GET/PATCH /api/marketplace/matches/[id]: the session
// client, repositories and the MOD-002 handoff orchestrator are stubbed. These
// legs verify route orchestration only — they are NOT live RLS or RPC evidence.
// Live session-RLS and direct-RPC verification is recorded separately.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as matchGET, PATCH as matchPATCH } from '@/app/api/marketplace/matches/[id]/route';
import { MatchStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { ValidationError } from '@/shared/errors/app-errors';
import { createClient } from '@/lib/supabase/server';

const SHIPPER_UID = '666ed3aa-204a-45ad-83f5-b9cf0d4d8df8';
const TRANSPORTER_UID = 'e0fe13fd-6606-475f-a945-0a35ad879f27';
const LISTING_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const OFFER_ID = 'cccccccc-0000-4000-8000-000000000002';
const MATCH_ID = 'eeeeeeee-0000-4000-8000-000000000003';
const BOOKING_ID = 'bbbbbbbb-0000-4000-8000-000000000004';

// I-1 §3.6 — database resolvers are the only role source; user_metadata none.
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
  matchById: null as any,
  offer: null as any,
  rejectCalls: [] as any[],
  rejectError: null as Error | null,
}));

const handoff = vi.hoisted(() => ({
  calls: [] as any[],
  result: null as any,
  error: null as Error | null,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => makeMock(null)), // default: unauthenticated
}));
vi.mock('@/infrastructure/repositories/matches-repository', () => ({
  MatchesRepository: class {
    async getById() { return repo.matchById; }
    async reject(id: string, version: number) {
      repo.rejectCalls.push({ id, version });
      if (repo.rejectError) throw repo.rejectError;
    }
  },
}));
vi.mock('@/infrastructure/repositories/offers-repository', () => ({
  OffersRepository: class { async getById() { return repo.offer; } },
}));
vi.mock('@/modules/mod-002-booking/domain/services/booking-orchestration', () => ({
  executeMOD002Handoff: vi.fn(async (ctx: any) => {
    handoff.calls.push(ctx);
    if (handoff.error) throw handoff.error;
    return handoff.result;
  }),
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

function patchRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000/api/marketplace/matches/${MATCH_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const params = (id: string = MATCH_ID) => ({ params: Promise.resolve({ id }) });
const asShipper = () => vi.mocked(createClient).mockReturnValue(makeMock({ id: SHIPPER_UID, email: 'shipper@nexcargo.test' }));

describe('PRE-I-6 WS-02 MOD-001 Match Item API — persisted accept/reject (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue(makeMock(null));
    repo.matchById = makeMatch();
    repo.offer = { offerId: OFFER_ID, listingId: LISTING_ID, transporterId: TRANSPORTER_UID, status: 'SUBMITTED' };
    repo.rejectCalls = [];
    repo.rejectError = null;
    handoff.calls = [];
    handoff.result = { bookingId: BOOKING_ID, status: 'ALIGNMENT_CHECKED', matchId: MATCH_ID, listingId: LISTING_ID, success: true };
    handoff.error = null;
  });

  // ============================================================
  // GET /api/marketplace/matches/[id]
  // ============================================================

  describe('GET', () => {
    it('returns the persisted match for an authenticated SHIPPER', async () => {
      asShipper();
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches/${MATCH_ID}`, { headers: {} });
      const response = await matchGET(request, params());
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.matchId).toBe(MATCH_ID);
      expect(data.data.listingId).toBe(LISTING_ID);
      expect(data.data.status).toBe(MatchStatus.PROPOSED);
      expect(data.data.version).toBe(1);
    });

    it('returns 404 when RLS hides the record (nonexistent or foreign)', async () => {
      asShipper();
      repo.matchById = null;
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches/${MATCH_ID}`, { headers: {} });
      const response = await matchGET(request, params());
      expect(response.status).toBe(404);
    });

    it('returns 404 for a non-persisted advisory id (non-UUID)', async () => {
      asShipper();
      const request = new NextRequest('http://localhost:3000/api/marketplace/matches/match-abc123', { headers: {} });
      const response = await matchGET(request, params('match-abc123'));
      expect(response.status).toBe(404);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches/${MATCH_ID}`, { headers: {} });
      const response = await matchGET(request, params());
      expect(response.status).toBe(401);
    });

    it('returns 403 for TRANSPORTER (RBAC denied)', async () => {
      vi.mocked(createClient).mockReturnValue(makeMock({ id: TRANSPORTER_UID, email: 'transporter@nexcargo.test' }, 'TRANSPORTER'));
      const request = new NextRequest(`http://localhost:3000/api/marketplace/matches/${MATCH_ID}`, { headers: {} });
      const response = await matchGET(request, params());
      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // PATCH — accept path (handoff via unchanged RPC orchestrator)
  // ============================================================

  describe('PATCH accept', () => {
    it('accepts a PROPOSED match and confirms the booking handoff', async () => {
      asShipper();
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.matchId).toBe(MATCH_ID);
      expect(data.data.previousStatus).toBe(MatchStatus.PROPOSED);
      expect(data.data.newStatus).toBe(MatchStatus.ACCEPTED);
      expect(data.data.isTerminal).toBe(true);
      expect(data.data.handoffConfirmed).toBe(true);
      expect(data.data.bookingId).toBe(BOOKING_ID);
      expect(data.data.bookingStatus).toBe('ALIGNMENT_CHECKED');
      expect(data.data.successfulHandoff).toBe(true);
    });

    it('derives listingId/offerId/transporterId from persisted rows and shipperId from the session', async () => {
      asShipper();
      await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      expect(handoff.calls).toHaveLength(1);
      expect(handoff.calls[0]).toMatchObject({
        userId: SHIPPER_UID,
        shipperId: SHIPPER_UID,
        matchId: MATCH_ID,
        listingId: LISTING_ID,
        offerId: OFFER_ID,
        transporterId: TRANSPORTER_UID,
      });
    });

    it('ignores a forged transporterId in the body (server-derived from the offer row)', async () => {
      asShipper();
      await matchPATCH(patchRequest({
        action: 'accept',
        currentStatus: MatchStatus.PROPOSED,
        transporterId: '99999999-9999-4999-8999-999999999999',
      }), params());
      expect(handoff.calls[0].transporterId).toBe(TRANSPORTER_UID);
    });

    it('returns 409 when supplied body listingId drifts from the persisted match', async () => {
      asShipper();
      const response = await matchPATCH(patchRequest({
        action: 'accept',
        currentStatus: MatchStatus.PROPOSED,
        listingId: 'bbbbbbbb-0000-4000-8000-000000000009',
      }), params());
      expect(response.status).toBe(409);
      expect(handoff.calls).toHaveLength(0);
    });

    it('returns 409 when supplied body offerId drifts from the persisted match', async () => {
      asShipper();
      const response = await matchPATCH(patchRequest({
        action: 'accept',
        currentStatus: MatchStatus.PROPOSED,
        offerId: 'bbbbbbbb-0000-4000-8000-000000000009',
      }), params());
      expect(response.status).toBe(409);
      expect(handoff.calls).toHaveLength(0);
    });

    it('returns 409 on stale currentStatus (persisted state is authoritative)', async () => {
      asShipper();
      repo.matchById = makeMatch({ status: MatchStatus.ACCEPTED });
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      const data = await response.json();
      expect(response.status).toBe(409);
      expect(data.data.error).toContain('persisted ACCEPTED');
      expect(handoff.calls).toHaveLength(0);
    });

    it('returns 409 when the persisted match is already terminal', async () => {
      asShipper();
      repo.matchById = makeMatch({ status: MatchStatus.REJECTED });
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.REJECTED }), params());
      const data = await response.json();
      expect(response.status).toBe(409);
      expect(data.data.error).toContain('terminal');
      expect(handoff.calls).toHaveLength(0);
    });

    it('returns 404 for a nonexistent match before any transition', async () => {
      asShipper();
      repo.matchById = null;
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(404);
      expect(handoff.calls).toHaveLength(0);
    });

    it('returns 404 for a non-persisted advisory id (non-UUID)', async () => {
      asShipper();
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params('match-abc123'));
      expect(response.status).toBe(404);
      expect(handoff.calls).toHaveLength(0);
    });

    it('returns 400 when currentStatus is missing', async () => {
      asShipper();
      const response = await matchPATCH(patchRequest({ action: 'accept' }), params());
      expect(response.status).toBe(400);
    });

    it('returns 400 for an unknown action', async () => {
      asShipper();
      const response = await matchPATCH(patchRequest({ action: 'book', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(400);
    });

    it('returns 400 when the linked offer is no longer available', async () => {
      asShipper();
      repo.offer = null;
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(400);
      expect(handoff.calls).toHaveLength(0);
    });

    it('maps repeated acceptance (RPC PROPOSED guard) to 409', async () => {
      asShipper();
      handoff.error = new Error(`Match ${MATCH_ID} not found or not in PROPOSED state`);
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(409);
    });

    it('maps concurrent acceptance losing the listing race (PUBLISHED guard) to 409', async () => {
      asShipper();
      handoff.error = new Error(`Listing ${LISTING_ID} not found or not in PUBLISHED state`);
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(409);
    });

    it('maps alignment failure to 400 with zero state changes', async () => {
      asShipper();
      handoff.error = new ValidationError('Offer-listing alignment failed', { code: 'ALIGNMENT_FAILED' });
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(400);
    });

    it('maps a row-level-security refusal during handoff to 403', async () => {
      asShipper();
      handoff.error = new Error('new row violates row-level security policy for table "bookings"');
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(403);
    });

    it('returns 401 for unauthenticated acceptance', async () => {
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(401);
      expect(handoff.calls).toHaveLength(0);
    });

    it('returns 403 for TRANSPORTER acceptance (no invented transporter authority)', async () => {
      vi.mocked(createClient).mockReturnValue(makeMock({ id: TRANSPORTER_UID, email: 'transporter@nexcargo.test' }, 'TRANSPORTER'));
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(403);
      expect(handoff.calls).toHaveLength(0);
    });

    it('ignores forged x-user-role header metadata', async () => {
      vi.mocked(createClient).mockReturnValue(makeMock({ id: TRANSPORTER_UID, email: 'transporter@nexcargo.test' }, 'TRANSPORTER'));
      const response = await matchPATCH(patchRequest({ action: 'accept', currentStatus: MatchStatus.PROPOSED }, { 'x-user-role': 'ADMIN' }), params());
      expect(response.status).toBe(403);
      expect(handoff.calls).toHaveLength(0);
    });
  });

  // ============================================================
  // PATCH — reject path (persisted PROPOSED→REJECTED)
  // ============================================================

  describe('PATCH reject', () => {
    it('persists REJECTED through the repository with the persisted version', async () => {
      asShipper();
      const response = await matchPATCH(patchRequest({ action: 'reject', currentStatus: MatchStatus.PROPOSED }), params());
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.newStatus).toBe(MatchStatus.REJECTED);
      expect(data.data.isTerminal).toBe(true);
      expect(data.data.persisted).toBe(true);
      expect(repo.rejectCalls).toEqual([{ id: MATCH_ID, version: 1 }]);
      expect(handoff.calls).toHaveLength(0);
    });

    it('returns 409 when a concurrent transition already moved the match (reject race)', async () => {
      asShipper();
      repo.rejectError = new Error('MATCH_STATE_CONFLICT: match is no longer PROPOSED');
      const response = await matchPATCH(patchRequest({ action: 'reject', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(409);
    });

    it('maps a row-level-security UPDATE refusal to 403 (unauthorized direct update)', async () => {
      asShipper();
      repo.rejectError = new Error('Failed to reject match: new row violates row-level security policy for table "matches"');
      const response = await matchPATCH(patchRequest({ action: 'reject', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(403);
    });

    it('returns 409 on stale currentStatus for rejection too', async () => {
      asShipper();
      repo.matchById = makeMatch({ status: MatchStatus.REJECTED });
      const response = await matchPATCH(patchRequest({ action: 'reject', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(409);
      expect(repo.rejectCalls).toHaveLength(0);
    });

    it('returns 404 for a nonexistent match', async () => {
      asShipper();
      repo.matchById = null;
      const response = await matchPATCH(patchRequest({ action: 'reject', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(404);
      expect(repo.rejectCalls).toHaveLength(0);
    });

    it('returns 401 for unauthenticated rejection', async () => {
      const response = await matchPATCH(patchRequest({ action: 'reject', currentStatus: MatchStatus.PROPOSED }), params());
      expect(response.status).toBe(401);
      expect(repo.rejectCalls).toHaveLength(0);
    });
  });
});