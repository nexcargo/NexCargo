// NexCargo MOD-001 — Matching API Route
// Authorized by HAO-WAVE1-004 — Wave 1 Increment 4: API Endpoints & Integration Wiring
// Per MOD-001 §6 (Matching Engine) + §6.5 (Ranking Algorithm)
// 
// POST   /api/marketplace/matching     — Run matching engine for a listing

import { NextRequest, NextResponse } from 'next/server';
import { runHardFilters } from '@/modules/mod-001-marketplace/domain/services/hard-filters';
import { scoreAndRankOffers, highlightTopFive, applyUserOverride } from '@/modules/mod-001-marketplace/domain/services/matching-engine';
import { determineRelaxationStrategy, generateNoMatchExplanation } from '@/modules/mod-001-marketplace/domain/services/no-match-relaxation';
import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
import type { TransportOffer } from '@/modules/mod-001-marketplace/domain/types/offers';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { validateRBAC } from '../rbac-middleware';

/**
 * POST /api/marketplace/matching
 * Runs the matching engine for a given listing.
 * Advisory-only: returns ranked recommendations; does NOT auto-select or auto-book.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const role = request.headers.get('x-user-role') || 'SHIPPER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'matching', 'execute');
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

    // Parse listing data (stub — actual DB query in later increment)
    const listing = {
      listingId: body.listingId,
      shipperId: body.shipperId || 'unknown',
      origin: { latitude: -25.9692, longitude: 32.5855, address: 'Maputo Port' },
      destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
      cargoType: body.cargoType || 'GENERAL',
      weightKg: body.weightKg || 10000,
      volumeM3: body.volumeM3 || 50,
      timeWindow: body.timeWindow || { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
      acceptedVehicleTypes: body.acceptedVehicleTypes || ['HEAVY_TRUCK'],
      pricingModel: 'FIXED' as never,
      status: 'PUBLISHED' as never,
      id: 'stub-listing-id',
      created_at: new Date(),
      updated_at: new Date(),
      version: 1,
      bumpVersion: () => {},
      toJSON: () => ({}),
    } as ShipmentListing;

    // Parse offer data (stub — actual DB query in later increment)
    const offers = body.offers || [];

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
