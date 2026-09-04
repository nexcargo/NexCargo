import { NextRequest, NextResponse } from 'next/server';
import { ListingStatus, CargoType, PricingModel } from '@/modules/mod-001-marketplace/domain/enums';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

/**
 * GET /api/marketplace/listings
 * Requires authenticated session + READ permission on listings.
 */
export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory auth — no session → 401 immediately. No x-user-role fallback. No default roles.
    await assertApiAuthorization(request, 'listings', 'read');

    // List published listings via repository
    const repository = new ListingsRepository();
    const publishedListings = await repository.listPublished();

    recordMarketplaceMetric('listings.listed', publishedListings.length, 'count', { source: 'api' });

    return NextResponse.json(
      wrapInContractFramework(publishedListings, correlationId),
      { status: 200, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), { status: 400, headers: { 'x-correlation-id': correlationId } });
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(wrapInContractFramework({ error: 'Unauthorized: valid session required' }, correlationId), { status: 401, headers: { 'x-correlation-id': correlationId } });
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), { status: 403, headers: { 'x-correlation-id': correlationId } });
    }
    return NextResponse.json(wrapInContractFramework(null, correlationId), { status: 500, headers: { 'x-correlation-id': correlationId } });
  }
}

/**
 * POST /api/marketplace/listings
 * Requires authenticated session + CREATE permission on listings.
 * Shipper identity derived from Supabase Auth session only.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory auth — identity from session, NOT from x-user-role or body field.
    const authCtx = await assertApiAuthorization(request, 'listings', 'create');

    // Parse and validate request body
    const body = await request.json();

    // Required fields per MOD-001 §5.1
    const requiredFields = ['origin', 'destination', 'cargoType', 'weightKg', 'timeWindow'];
    for (const field of requiredFields) {
      if (!(field in body)) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    if (!body.origin?.latitude || !body.origin?.longitude || !body.origin?.address) {
      throw new ValidationError('Origin must include latitude, longitude, and address');
    }
    if (!body.destination?.latitude || !body.destination?.longitude || !body.destination?.address) {
      throw new ValidationError('Destination must include latitude, longitude, and address');
    }
    if (!body.timeWindow?.earliestPickup || !body.timeWindow?.latestDelivery) {
      throw new ValidationError('Time window must include earliestPickup and latestDelivery');
    }

    // C1: Persist using authCtx.userId from Supabase session (authoritative)
    const repository = new ListingsRepository();
    const listing = await repository.create({
      shipperId: authCtx.userId,
      title: body.title ?? '',
      description: body.description ?? '',
      originGeo: body.origin,
      destinationGeo: body.destination,
      originAddress: body.origin.address,
      destinationAddress: body.destination.address,
      cargoType: body.cargoType,
      weightKg: body.weightKg,
      volumeM3: body.volumeM3 ?? null,
      timeWindow: body.timeWindow,
      pricingModel: body.pricingModel ?? 'FIXED',
      correlationId,
    });

    recordMarketplaceMetric('listings.created', 1, 'count', { cargoType: body.cargoType });

    return NextResponse.json(
      wrapInContractFramework(listing, correlationId),
      { status: 201, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), { status: 400, headers: { 'x-correlation-id': correlationId } });
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(wrapInContractFramework({ error: 'Unauthorized: valid session required' }, correlationId), { status: 401, headers: { 'x-correlation-id': correlationId } });
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), { status: 403, headers: { 'x-correlation-id': correlationId } });
    }
    return NextResponse.json(wrapInContractFramework(null, correlationId), { status: 500, headers: { 'x-correlation-id': correlationId } });
  }
}
