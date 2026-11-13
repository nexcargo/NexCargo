// NexCargo MOD-001 — Matching API Route
// Authorized by HAO-WAVE1-004 — Wave 1 Increment 4: API Endpoints & Integration Wiring
// Per MOD-001 §6 (Matching Engine) + §6.5 (Ranking Algorithm)
// 
// POST   /api/marketplace/matching     — Run matching engine for a listing
// C1 Hardened: Uses session-based authentication (Pattern A), NOT x-user-role header (Pattern B).

import { NextRequest, NextResponse } from 'next/server';
import { runHardFilters } from '@/modules/mod-001-marketplace/domain/services/hard-filters';
import { scoreAndRankOffers, highlightTopFive, applyUserOverride } from '@/modules/mod-001-marketplace/domain/services/matching-engine';
import { determineRelaxationStrategy, generateNoMatchExplanation } from '@/modules/mod-001-marketplace/domain/services/no-match-relaxation';
import { ListingStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { toShipmentListing, toTransportOffer } from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { validateRBAC } from '../rbac-middleware';
import { assertApiAuthorization, getApiAuthContext } from '@/lib/supabase/api-auth';

const PLATFORM_ROLES = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * POST /api/marketplace/matching
 * Runs the matching engine for a given listing.
 * Advisory-only: returns ranked recommendations; does NOT auto-select or auto-book.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  // C1 Hardened: Authenticate via Supabase session (Pattern A). No x-user-role header fallback.
  const authCtx = await getApiAuthContext(request);
  if (!authCtx) {
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 401, headers: { 'x-correlation-id': correlationId } },
    );
  }

  try {
    // Use role from session (null = unassigned/onboarding state per HAO PE-H04)
    if (!authCtx.role) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    
    const rbacResult = await validateRBAC(authCtx.role, 'matching', 'execute');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const body = await request.json();

    // Required fields
    if (!body.listingId) {
      throw new ValidationError('listingId is required');
    }

    // I-4 §3D: the engine runs on authoritative stored data, never on a caller-supplied listing.
    const listingsRepository = new ListingsRepository();
    const storedListing = await listingsRepository.getById(String(body.listingId));
    if (!storedListing) {
      return NextResponse.json(
        wrapInContractFramework({ error: `Listing ${body.listingId} not found` }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Ownership: a marketplace member may only run matching against their own listing.
    const isPlatform = !!authCtx.platformRole && PLATFORM_ROLES.includes(authCtx.platformRole);
    if (!isPlatform && storedListing.shipperId !== authCtx.userId) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'FORBIDDEN: listing belongs to another shipper' }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // MOD-001 §5.3:421-425 — a match proposal is generated only for PUBLISHED listings.
    if (storedListing.status !== ListingStatus.PUBLISHED) {
      throw new ValidationError(`Only PUBLISHED listings can be matched, got "${storedListing.status}"`);
    }

    const listing = toShipmentListing(storedListing);

    const offersRepository = new OffersRepository();
    const storedOffers = await offersRepository.listByListing(listing.listingId);
    const offers = storedOffers.map(toTransportOffer);

    // Step 1: Apply hard filters (§6.4.1)
    const filteredOffers = runHardFilters(listing, offers);

    // Record metric
    recordMarketplaceMetric('matching.run', 1, 'count', { 
      totalOffers: String(offers.length), 
      filteredOffers: String(filteredOffers.length) 
    });

    // Step 2: If no matches after hard filters, apply relaxation strategy (§6.8)
    if (filteredOffers.length === 0) {
      const relaxationResult = determineRelaxationStrategy(listing, offers);
      
      return NextResponse.json(
        wrapInContractFramework({
          listingId: listing.listingId,
          matches: [],
          matchCount: 0,
          topFive: [],
          relaxed: true,
          suggestion: relaxationResult.suggestion,
          stepsApplied: relaxationResult.stepsApplied,
        }, correlationId),
        {
          status: 200,
          headers: {
            'x-correlation-id': correlationId,
            'x-trace-id': context.traceId ?? '',
          },
        },
      );
    }

    // Step 3: Score and rank filtered offers (§6.4.4, §6.5)
    const proposals = scoreAndRankOffers(listing, filteredOffers);

    // Step 4: Highlight top 5 as "Recommended" (§6.5 Step 4)
    const topFive = highlightTopFive(proposals);

    // Build response
    const responseMatches = proposals.map((p) => ({
      matchId: p.matchId,
      offerId: p.offerId,
      matchScore: p.matchScore,
      rankingPosition: p.rankingPosition,
      isRecommended: topFive.has(p.offerId),
    }));

    return NextResponse.json(
      wrapInContractFramework({
        listingId: listing.listingId,
        matches: responseMatches,
        matchCount: proposals.length,
        topFive: Array.from(topFive),
        relaxed: false,
      }, correlationId),
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
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
