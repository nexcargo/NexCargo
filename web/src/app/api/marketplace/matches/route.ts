// NexCargo MOD-001 — Match Proposals API Route (Collection)
// Authorized by HAO-WAVE1-005 — Wave 1 Increment 5: Match Proposals & Quote Generation
// Per MOD-001 §5.3 (Match Proposal) + §6 (Matching Engine)
// 
// GET    /api/marketplace/matches          — List match proposals for a listing
// POST   /api/marketplace/matches          — Create match proposal(s) from matching engine

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { validateRBAC } from '../rbac-middleware';
import {
  createMatchProposal,
  buildListingForQuote,
} from '@/modules/mod-001-marketplace/application/use-cases/marketplace-use-cases';

/**
 * GET /api/marketplace/matches
 * Returns all match proposals for a specific listing.
 */
export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const role = request.headers.get('x-user-role') || 'SHIPPER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'matching', 'read');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Extract listingId from query params
    const url = new URL(request.url);
    const listingId = url.searchParams.get('listingId');
    if (!listingId) {
      throw new ValidationError('listingId query parameter is required');
    }

    // Return stub match proposals data (actual DB query in later increment)
    const matches: Array<{
      matchId: string;
      offerId: string;
      matchScore: number;
      rankingPosition: number;
      isRecommended: boolean;
    }> = [];

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
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}

/**
 * POST /api/marketplace/matches
 * Creates a match proposal from matching engine results.
 * Advisory-only: does NOT auto-select or auto-book.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const body = await request.json();
    const role = request.headers.get('x-user-role') || 'SHIPPER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'matching', 'execute');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Required fields per MOD-001 §5.3
    if (!body.listingId) {
      throw new ValidationError('listingId is required');
    }
    if (!body.offerId) {
      throw new ValidationError('offerId is required');
    }
    if (typeof body.matchScore !== 'number' || body.matchScore < 0 || body.matchScore > 100) {
      throw new ValidationError('matchScore must be a number between 0 and 100');
    }
    if (!body.rankingPosition || body.rankingPosition < 1) {
      throw new ValidationError('rankingPosition must be >= 1');
    }

    // Use application-layer use case for validation and orchestration
    const matchData = createMatchProposal({
      listingId: body.listingId,
      offerId: body.offerId,
      matchScore: body.matchScore,
      rankingPosition: body.rankingPosition,
      reasoningTrace: body.reasoningTrace,
    });

    recordMarketplaceMetric('matches.created', 1, 'count', { listingId: body.listingId });

    return NextResponse.json(
      wrapInContractFramework(matchData, correlationId),
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
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
