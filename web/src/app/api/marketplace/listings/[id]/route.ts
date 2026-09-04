// NexCargo MOD-001 — Listings API Route (Item)
// C1 Closure Hardened: Mandatory auth, no header fallback.
// Per MOD-001 §5.1 (ShipmentListing) + §3.2 (state machine)

import { NextRequest, NextResponse } from 'next/server';
import { ListingStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { applyListingTransition, isListingTerminal } from '@/modules/mod-001-marketplace/domain/services/listing-state-machine';
import { publishListing, isListingPublishable } from '@/modules/mod-001-marketplace/domain/services/listing-publish-service';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

/**
 * GET /api/marketplace/listings/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;

    // C1 Hardened: Mandatory session identity — no header fallback
    await assertApiAuthorization(_request, 'listings', 'read');

    const repository = new ListingsRepository();
    const listing = await repository.getById(id);

    if (!listing) {
      return NextResponse.json(wrapInContractFramework({ error: `Listing ${id} not found` }, correlationId), { status: 404, headers: { 'x-correlation-id': correlationId } });
    }

    recordMarketplaceMetric('listings.viewed', 1, 'count');

    return NextResponse.json(wrapInContractFramework(listing, correlationId), {
      status: 200,
      headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
    });
  } catch (_error) {
    return NextResponse.json(wrapInContractFramework(null, correlationId), { status: 500, headers: { 'x-correlation-id': correlationId } });
  }
}

/**
 * PATCH /api/marketplace/listings/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;
    const body = await request.json();

    // C1 Hardened: Mandatory session identity — no header fallback
    await assertApiAuthorization(request, 'listings', 'update');

    // "publish" convenience action: DRAFT → PUBLISHED
    if (body.action === 'publish') {
      const currentStatus = body.currentStatus as ListingStatus;
      if (!currentStatus) throw new ValidationError('currentStatus is required when publishing');
      if (!isListingPublishable(currentStatus)) throw new ValidationError(`Only DRAFT listings are publishable, got "${currentStatus}"`);

      const repository = new ListingsRepository();
      await repository.updateStatus(id, ListingStatus.PUBLISHED);

      recordMarketplaceMetric('listings.published', 1, 'count', { listingId: id });

      return NextResponse.json(wrapInContractFramework({ listingId: id, previousStatus: currentStatus, newStatus: ListingStatus.PUBLISHED, isTerminal: false, action: 'publish' }, correlationId), {
        status: 200,
        headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
      });
    }

    // Explicit state transition
    const currentStatus = body.currentStatus as ListingStatus;
    const targetStatus = body.targetStatus as ListingStatus;
    if (!currentStatus || !targetStatus) throw new ValidationError('Both currentStatus and targetStatus are required');

    const newStatus = applyListingTransition(currentStatus, targetStatus);
    const terminal = isListingTerminal(newStatus);

    const repository = new ListingsRepository();
    await repository.updateStatus(id, newStatus);

    recordMarketplaceMetric('listings.stateChanged', 1, 'count', { from: currentStatus, to: newStatus });

    return NextResponse.json(wrapInContractFramework({ listingId: id, previousStatus: currentStatus, newStatus, isTerminal: terminal }, correlationId), {
      status: 200,
      headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), { status: 400, headers: { 'x-correlation-id': correlationId } });
    }
    return NextResponse.json(wrapInContractFramework(null, correlationId), { status: 500, headers: { 'x-correlation-id': correlationId } });
  }
}

/**
 * DELETE /api/marketplace/listings/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;

    // C1 Hardened: Mandatory session identity — no header fallback
    await assertApiAuthorization(_request, 'listings', 'delete');

    const repository = new ListingsRepository();
    await repository.updateStatus(id, ListingStatus.CANCELLED);

    recordMarketplaceMetric('listings.cancelled', 1, 'count');

    return NextResponse.json(wrapInContractFramework({ listingId: id, status: ListingStatus.CANCELLED }, correlationId), {
      status: 200,
      headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
    });
  } catch (_error) {
    return NextResponse.json(wrapInContractFramework(null, correlationId), { status: 500, headers: { 'x-correlation-id': correlationId } });
  }
}
