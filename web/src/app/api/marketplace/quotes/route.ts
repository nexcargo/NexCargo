// NexCargo MOD-001 — Advisory Quotes API Route
// Authorized by HAO-WAVE1-004 — Wave 1 Increment 4: API Endpoints & Integration Wiring
// Per MOD-001 §5.4 (AdvisoryQuote)
// 
// GET    /api/marketplace/quotes     — List advisory quotes for a listing
// POST   /api/marketplace/quotes     — Generate advisory quote

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { validateRBAC } from '../rbac-middleware';

/**
 * GET /api/marketplace/quotes
 * Returns advisory quotes for a specific listing.
 */
export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const role = request.headers.get('x-user-role') || 'SHIPPER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'quotes', 'read');
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

    // Return stub quotes data (actual DB query in later increment)
    const quotes: unknown[] = [];

    recordMarketplaceMetric('quotes.listed', quotes.length, 'count');

    return NextResponse.json(
      wrapInContractFramework({ listingId, quotes }, correlationId),
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
 * POST /api/marketplace/quotes
 * Generates an advisory price quote for a listing.
 * Advisory-only: does NOT auto-confirm or trigger financial actions.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const body = await request.json();
    const role = request.headers.get('x-user-role') || 'SHIPPER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'quotes', 'create');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Required fields per MOD-001 §5.4
    if (!body.listingId) {
      throw new ValidationError('listingId is required');
    }

    // Generate advisory quote (stub — actual AI-EPRS integration in later increment)
    // Per MOD-001 §5.4: non-binding price range suggestion
    const quote = {
      quoteId: 'stub-quote-id',
      listingId: body.listingId,
      suggestedPriceMin: 5000,
      suggestedPriceMax: 8000,
      confidenceScore: 75,
      basis: 'corridor_data_and_historical_pricing',
    };

    recordMarketplaceMetric('quotes.generated', 1, 'count');

    return NextResponse.json(
      wrapInContractFramework(quote, correlationId),
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
