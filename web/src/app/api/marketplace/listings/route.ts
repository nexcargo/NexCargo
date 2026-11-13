import { NextRequest, NextResponse } from 'next/server';
import { ListingStatus, CargoType, PricingModel } from '@/modules/mod-001-marketplace/domain/enums';
import { validateListingRequiredFields, validateTimeWindow } from '@/modules/mod-001-marketplace/domain/services/listing-validation';
import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
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

    // MOD-001 §5.1 canonical rules, enforced through the domain validators rather than a
    // route-local approximation, so the API and the domain can never disagree.
    // weightKg/volumeM3 stay absent when the caller omitted them: coercing to 0 here would make
    // "at least one of weight or volume" unsatisfiable-by-accident and the validator would pass.
    const candidate = {
      listingId: 'pending',
      shipperId: authCtx.userId,
      origin: body.origin,
      destination: body.destination,
      cargoType: body.cargoType,
      weightKg: body.weightKg == null ? undefined : Number(body.weightKg),
      volumeM3: body.volumeM3 == null ? undefined : Number(body.volumeM3),
      timeWindow: body.timeWindow,
      pricingModel: body.pricingModel ?? 'FIXED',
      status: ListingStatus.DRAFT,
      acceptedVehicleTypes: Array.isArray(body.acceptedVehicleTypes) ? body.acceptedVehicleTypes : [],
    } as unknown as ShipmentListing;

    validateListingRequiredFields(candidate);
    validateTimeWindow(candidate);

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
      weightKg: candidate.weightKg ?? 0,
      volumeM3: candidate.volumeM3 ?? null,
      timeWindow: body.timeWindow,
      pricingModel: body.pricingModel ?? 'FIXED',
      acceptedVehicleTypes: candidate.acceptedVehicleTypes,
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
