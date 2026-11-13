// NexCargo MOD-001 — Listings API Route (Item)
// C1 Closure Hardened: Mandatory auth, no header fallback.
// Per MOD-001 §5.1 (ShipmentListing) + §3.2 (state machine)

import { NextRequest, NextResponse } from 'next/server';
import { ListingStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { applyListingTransition, isListingTerminal } from '@/modules/mod-001-marketplace/domain/services/listing-state-machine';
import { publishListing, isListingPublishable } from '@/modules/mod-001-marketplace/domain/services/listing-publish-service';
import { validateListingRequiredFields, validateTimeWindow } from '@/modules/mod-001-marketplace/domain/services/listing-validation';
import { toShipmentListing } from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import type { ListingApiShape } from '@/infrastructure/repositories/listings-repository';
import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { assertApiAuthorization, authDenialResponse } from '@/lib/supabase/api-auth';

const PLATFORM_ROLES = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * I-4 §3C/§4: ownership is enforced server-side. A marketplace member may only act on their own
 * listing; platform roles act across the marketplace. RLS is the backstop, not the only control.
 */
function assertListingOwnership(listing: ListingApiShape, userId: string, platformRole: string | null): void {
  if (platformRole && PLATFORM_ROLES.includes(platformRole)) return;
  if (listing.shipperId !== userId) {
    throw new Error('FORBIDDEN: listing belongs to another shipper');
  }
}

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
  } catch (error) {
    return denialOrServerError(error, correlationId);
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
    const authCtx = await assertApiAuthorization(request, 'listings', 'update');

    const repository = new ListingsRepository();
    const stored = await repository.getById(id);
    if (!stored) {
      return NextResponse.json(wrapInContractFramework({ error: `Listing ${id} not found` }, correlationId), { status: 404, headers: { 'x-correlation-id': correlationId } });
    }
    assertListingOwnership(stored, authCtx.userId, authCtx.platformRole);

    // The stored row is authoritative for the transition source. body.currentStatus is advisory
    // only — trusting it let a caller assert any source state and skip transition rules.
    const currentStatus = stored.status as ListingStatus;

    // Field-level edit. MOD-001 §3.2 admits no transition out of DRAFT other than PUBLISHED, so a
    // published shipment's commercial terms are immutable — only DRAFT rows are editable.
    if (body.action === 'update') {
      if (currentStatus !== ListingStatus.DRAFT) {
        throw new ValidationError(`Only DRAFT listings can be edited, got "${currentStatus}"`);
      }

      // The jsonb columns keep the stored shape as-is; the domain object below is built from it,
      // never the other way round, so an edit cannot silently rewrite the geo structure.
      const originGeo = (body.origin ?? stored.origin) as Record<string, unknown>;
      const destinationGeo = (body.destination ?? stored.destination) as Record<string, unknown>;
      const timeWindow = (body.timeWindow ?? stored.timeWindow) as Record<string, unknown>;

      const edited = {
        listingId: id,
        shipperId: stored.shipperId,
        origin: originGeo,
        destination: destinationGeo,
        cargoType: body.cargoType ?? stored.cargoType,
        weightKg: Number(body.weightKg ?? stored.weightKg ?? 0),
        volumeM3: body.volumeM3 === undefined
          ? (stored.volumeM3 == null ? undefined : Number(stored.volumeM3))
          : (body.volumeM3 == null ? undefined : Number(body.volumeM3)),
        timeWindow,
        pricingModel: body.pricingModel ?? stored.pricingModel,
        status: ListingStatus.DRAFT,
        acceptedVehicleTypes: Array.isArray(body.acceptedVehicleTypes)
          ? body.acceptedVehicleTypes
          : stored.acceptedVehicleTypes,
      } as unknown as ShipmentListing;

      validateListingRequiredFields(edited);
      validateTimeWindow(edited);

      const updated = await repository.updateDraft(id, {
        title: body.title ?? stored.title,
        description: body.description ?? stored.description,
        originGeo,
        destinationGeo,
        originAddress: String(originGeo.address ?? ''),
        destinationAddress: String(destinationGeo.address ?? ''),
        cargoType: String(edited.cargoType),
        weightKg: edited.weightKg,
        volumeM3: edited.volumeM3 ?? null,
        timeWindow,
        pricingModel: String(edited.pricingModel),
        acceptedVehicleTypes: edited.acceptedVehicleTypes.map(String),
      });

      recordMarketplaceMetric('listings.updated', 1, 'count', { listingId: id });

      return NextResponse.json(wrapInContractFramework(updated, correlationId), {
        status: 200,
        headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
      });
    }

    // "publish" convenience action: DRAFT → PUBLISHED
    if (body.action === 'publish') {
      if (!isListingPublishable(currentStatus)) throw new ValidationError(`Only DRAFT listings are publishable, got "${currentStatus}"`);

      // MOD-001 §5.1:293 — a listing cannot be published without origin, destination, cargoType
      // and at least one of weight or volume. Re-checked here because DRAFT rows may be incomplete.
      const candidate = toShipmentListing(stored);
      validateListingRequiredFields(candidate);
      validateTimeWindow(candidate);

      await repository.updateStatus(id, ListingStatus.PUBLISHED);

      recordMarketplaceMetric('listings.published', 1, 'count', { listingId: id });

      return NextResponse.json(wrapInContractFramework({ listingId: id, previousStatus: currentStatus, newStatus: ListingStatus.PUBLISHED, isTerminal: false, action: 'publish' }, correlationId), {
        status: 200,
        headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
      });
    }

    // Explicit state transition
    const targetStatus = body.targetStatus as ListingStatus;
    if (!targetStatus) throw new ValidationError('targetStatus is required');

    const newStatus = applyListingTransition(currentStatus, targetStatus);
    const terminal = isListingTerminal(newStatus);

    await repository.updateStatus(id, newStatus);

    recordMarketplaceMetric('listings.stateChanged', 1, 'count', { from: currentStatus, to: newStatus });

    return NextResponse.json(wrapInContractFramework({ listingId: id, previousStatus: currentStatus, newStatus, isTerminal: terminal }, correlationId), {
      status: 200,
      headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
    });
  } catch (error) {
    return denialOrServerError(error, correlationId);
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
    const authCtx = await assertApiAuthorization(_request, 'listings', 'delete');

    const repository = new ListingsRepository();
    const stored = await repository.getById(id);
    if (!stored) {
      return NextResponse.json(wrapInContractFramework({ error: `Listing ${id} not found` }, correlationId), { status: 404, headers: { 'x-correlation-id': correlationId } });
    }
    assertListingOwnership(stored, authCtx.userId, authCtx.platformRole);

    await repository.updateStatus(id, ListingStatus.CANCELLED);

    recordMarketplaceMetric('listings.cancelled', 1, 'count');

    return NextResponse.json(wrapInContractFramework({ listingId: id, status: ListingStatus.CANCELLED }, correlationId), {
      status: 200,
      headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
    });
  } catch (error) {
    return denialOrServerError(error, correlationId);
  }
}
