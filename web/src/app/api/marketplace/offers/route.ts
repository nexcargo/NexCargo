// NexCargo MOD-001 — Offers API Route (Collection)
// C1 Closure Hardened: Mandatory auth, no header fallback.
// Per MOD-001 §5.2 (TransportOffer)

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { OffersRepository, OfferApiShape } from '@/infrastructure/repositories/offers-repository';
import { assertApiAuthorization, authDenialResponse } from '@/lib/supabase/api-auth';

function denialOrServerError(error: unknown, correlationId: string): NextResponse {
  const denial = authDenialResponse(error);
  if (denial) return denial;
  if (error instanceof ValidationError) {
    return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), { status: 400, headers: { 'x-correlation-id': correlationId } });
  }
  if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
    return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), { status: 403, headers: { 'x-correlation-id': correlationId } });
  }
  return NextResponse.json(wrapInContractFramework(null, correlationId), { status: 500, headers: { 'x-correlation-id': correlationId } });
}

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
  } catch (error) {
    return denialOrServerError(error, correlationId);
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

    // F-I5-01: the generic offers:create matrix also lists SHIPPER, and it cannot be narrowed there
    // without breaking the Shipper's quotation read on the same resource. The effective marketplace
    // membership already resolved by assertApiAuthorization is the authority for creation.
    if (authCtx.marketplaceRole !== 'TRANSPORTER') {
      throw new Error('FORBIDDEN: Offer creation requires effective TRANSPORTER marketplace membership.');
    }

    const body = await request.json();

    // F-I5-01: an offer may only ever be created for the caller's own authorized identity. A body that
    // names another Transporter is refused rather than silently rewritten to the session user.
    if (body.transporterId !== undefined && body.transporterId !== authCtx.userId) {
      throw new Error('FORBIDDEN: An offer may only be submitted for the authenticated Transporter.');
    }

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
    return denialOrServerError(error, correlationId);
  }
}
