// NexCargo MOD-001 — Offers API Route (Collection)
// C1 Closure Hardened: Mandatory auth, no header fallback.
// Per MOD-001 §5.2 (TransportOffer)

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { OffersRepository, OfferApiShape } from '@/infrastructure/repositories/offers-repository';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

/**
 * GET /api/marketplace/offers
 */
export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory session identity
    await assertApiAuthorization(request, 'offers', 'read');

    const url = new URL(request.url);
    const listingId = url.searchParams.get('listingId');

    const repository = new OffersRepository();
    let offers: OfferApiShape[] = [];
    if (listingId) {
      offers = await repository.listByListing(listingId);
    }

    recordMarketplaceMetric('offers.listed', offers.length, 'count', { source: 'api' });

    return NextResponse.json(wrapInContractFramework(offers, correlationId), {
      status: 200,
      headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
    });
  } catch (_error) {
    return NextResponse.json(wrapInContractFramework(null, correlationId), { status: 500, headers: { 'x-correlation-id': correlationId } });
  }
}

/**
 * POST /api/marketplace/offers
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory session identity
    const authCtx = await assertApiAuthorization(request, 'offers', 'create');

    const body = await request.json();
    const requiredFields = ['listingId', 'priceProposal', 'availabilityWindow', 'vehicleType', 'declaredCapacity'];
    for (const field of requiredFields) {
      if (!(field in body)) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    const repository = new OffersRepository();
    const offer = await repository.create({
      transporterId: authCtx.userId,
      listingId: body.listingId,
      priceProposal: body.priceProposal,
      availabilityWindow: body.availabilityWindow,
      vehicleType: body.vehicleType,
      declaredCapacity: body.declaredCapacity,
      notes: body.notes,
      correlationId,
    });

    recordMarketplaceMetric('offers.created', 1, 'count', { vehicleType: body.vehicleType });

    return NextResponse.json(wrapInContractFramework(offer, correlationId), {
      status: 201,
      headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), { status: 400, headers: { 'x-correlation-id': correlationId } });
    }
    return NextResponse.json(wrapInContractFramework(null, correlationId), { status: 500, headers: { 'x-correlation-id': correlationId } });
  }
}
