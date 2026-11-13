// NexCargo MOD-001 — Advisory Quotes API Route
// Authorized by HAO-WAVE1-004/005 — Wave 1 Increment 4 + 5
// Per MOD-001 §5.4 (AdvisoryQuote)
// 
// GET    /api/marketplace/quotes     — List advisory quotes for a listing
// POST   /api/marketplace/quotes     — Generate advisory quote

import { NextRequest, NextResponse } from 'next/server';
import { CargoType } from '@/modules/mod-001-marketplace/domain/enums';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import {
  createAdvisoryQuote,
} from '@/modules/mod-001-marketplace/application/use-cases/marketplace-use-cases';

/**
 * GET /api/marketplace/quotes
 * Returns advisory quotes for a specific listing.
 */
export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // F-I2-01: the role comes from the session plus the database resolvers, never from a header.
    await assertApiAuthorization(request, 'quotes', 'read');

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
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized: valid session required' }, correlationId),
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
 * POST /api/marketplace/quotes
 * Generates an advisory price quote for a listing using corridor-based pricing.
 * Advisory-only: does NOT auto-confirm or trigger financial actions.
 * Per MOD-001 §5.4 — non-binding price range suggestion.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // F-I2-01: identity and role come from the session and the database resolvers. The guard runs
    // before the body is read, so an unauthorized caller learns nothing from request processing.
    await assertApiAuthorization(request, 'quotes', 'create');

    const body = await request.json();

    // Required fields per MOD-001 §5.4
    if (!body.listingId) {
      throw new ValidationError('listingId is required');
    }
    if (!body.cargoType) {
      throw new ValidationError('cargoType is required');
    }
    if (!body.weightKg || body.weightKg <= 0) {
      throw new ValidationError('Valid weightKg (>0) is required');
    }
    if (!body.timeWindow?.earliestPickup || !body.timeWindow?.latestDelivery) {
      throw new ValidationError('Time window (earliestPickup + latestDelivery) is required');
    }

    // Generate advisory quote using domain service via application use case
    const quote = createAdvisoryQuote({
      listingId: body.listingId,
      cargoType: body.cargoType as CargoType,
      weightKg: body.weightKg,
      volumeM3: body.volumeM3,
      timeWindow: body.timeWindow,
      pricingModel: body.pricingModel,
      comparablePrices: body.comparableOffers?.map((o: { priceProposal: number }) => o.priceProposal),
    });

    recordMarketplaceMetric('quotes.generated', 1, 'count', { 
      cargoType: String(body.cargoType),
      listingId: body.listingId,
    });

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
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized: valid session required' }, correlationId),
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
