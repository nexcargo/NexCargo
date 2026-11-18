// NexCargo MOD-001 — Match Proposals API Route (Collection)
// PRE-I-6 WS-02 match persistence (LA directive 2026-11-18, D-M1/D-M2 approved):
// POST records the Shipper's selection as a persisted PROPOSED match (MOD-001
// §6.9 "Match is recorded when the shipper selects a transporter") and returns
// the database UUID. GET reads persisted records under session RLS.
//
// GET    /api/marketplace/matches          — List persisted matches for a listing
// POST   /api/marketplace/matches          — Record a match proposal (Shipper selection)

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { MatchesRepository } from '@/infrastructure/repositories/matches-repository';
import { ListingStatus, OfferStatus, MatchStatus } from '@/modules/mod-001-marketplace/domain/enums';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/marketplace/matches
 * Persisted matches for a listing owned by the calling Shipper. Non-owned or
 * nonexistent listings answer 404 so foreign match metadata is never disclosed.
 */
export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const authCtx = await assertApiAuthorization(request, 'matching', 'read');

    const url = new URL(request.url);
    const listingId = url.searchParams.get('listingId');
    if (!listingId) {
      throw new ValidationError('listingId query parameter is required');
    }
    if (!UUID_PATTERN.test(listingId)) {
      throw new ValidationError('listingId must be a UUID');
    }

    const listingsRepository = new ListingsRepository();
    const listing = await listingsRepository.getById(listingId);
    if (!listing || listing.shipperId !== authCtx.userId) {
      return NextResponse.json(
        wrapInContractFramework({ error: `Listing ${listingId} not found` }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const matchesRepository = new MatchesRepository();
    const matches = (await matchesRepository.findByListing(listingId)).map(m => m.toApiShape());

    recordMarketplaceMetric('matches.listed', matches.length, 'count', { listingId });

    return NextResponse.json(
      wrapInContractFramework({ listingId, matches }, correlationId),
      {
        status: 200,
        headers: {
          'x-correlation-id': correlationId,
          'x-trace-id': context.traceId ?? '',
        },
      },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized' }, correlationId),
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}

/**
 * POST /api/marketplace/matches
 * Records the Shipper's selection of a Transporter's offer as a PROPOSED match.
 * Identity comes from the session; listing ownership, PUBLISHED state, offer
 * linkage and SUBMITTED state are re-verified from stored rows (migration 069's
 * INSERT policy enforces the same conditions in the database). Recording is not
 * acceptance: no booking is created here and the AI engine stays advisory.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const body = await request.json();

    const authCtx = await assertApiAuthorization(request, 'matching', 'execute');

    // Required fields per MOD-001 §5.3
    if (!body.listingId) {
      throw new ValidationError('listingId is required');
    }
    if (!body.offerId) {
      throw new ValidationError('offerId is required');
    }
    if (!UUID_PATTERN.test(String(body.listingId)) || !UUID_PATTERN.test(String(body.offerId))) {
      throw new ValidationError('listingId and offerId must be UUIDs');
    }
    if (typeof body.matchScore !== 'number' || body.matchScore < 0 || body.matchScore > 100) {
      throw new ValidationError('matchScore must be a number between 0 and 100');
    }
    if (!body.rankingPosition || body.rankingPosition < 1) {
      throw new ValidationError('rankingPosition must be >= 1');
    }

    const listingsRepository = new ListingsRepository();
    const listing = await listingsRepository.getById(String(body.listingId));
    if (!listing) {
      return NextResponse.json(
        wrapInContractFramework({ error: `Listing ${body.listingId} not found` }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (listing.shipperId !== authCtx.userId) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'FORBIDDEN: listing belongs to another shipper' }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (listing.status !== ListingStatus.PUBLISHED) {
      throw new ValidationError(`Only PUBLISHED listings can be matched, got "${listing.status}"`);
    }

    const offersRepository = new OffersRepository();
    const offer = await offersRepository.getById(String(body.offerId));
    if (!offer) {
      return NextResponse.json(
        wrapInContractFramework({ error: `Offer ${body.offerId} not found` }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (offer.listingId !== listing.listingId) {
      throw new ValidationError('offerId does not belong to the given listing');
    }
    if (offer.status !== OfferStatus.SUBMITTED) {
      throw new ValidationError(`Only SUBMITTED offers can be matched, got "${offer.status}"`);
    }

    const matchesRepository = new MatchesRepository();

    // D-M4 (deferred index): app-level idempotency — re-selecting the same offer
    // returns the existing PROPOSED record instead of creating a duplicate.
    const existing = (await matchesRepository.findByOffer(offer.offerId))
      .find(m => m.listingId === listing.listingId && m.status === MatchStatus.PROPOSED);
    if (existing) {
      recordMarketplaceMetric('matches.reused', 1, 'count', { listingId: listing.listingId });
      return NextResponse.json(
        wrapInContractFramework({ ...existing.toApiShape(), idempotent: true }, correlationId),
        { status: 200, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
      );
    }

    const entity = await matchesRepository.create({
      listingId: listing.listingId,
      offerId: offer.offerId,
      matchScore: Math.round(body.matchScore * 100) / 100,
      rankingPosition: body.rankingPosition,
      reasoningTrace: typeof body.reasoningTrace === 'string' ? body.reasoningTrace : undefined,
      createdBy: authCtx.userId,
      correlationId,
    });

    recordMarketplaceMetric('matches.created', 1, 'count', { listingId: listing.listingId });

    return NextResponse.json(
      wrapInContractFramework(entity.toApiShape(), correlationId),
      {
        status: 201,
        headers: {
          'x-correlation-id': correlationId,
          'x-trace-id': context.traceId ?? '',
        },
      },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized' }, correlationId),
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message.includes('row-level security')) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'FORBIDDEN: match recording denied by row-level security' }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
