// NexCargo MOD-001 — Listings API Route (Item)
// Authorized by HAO-WAVE1-004/005 — Wave 1 Increment 4 + 5
// Per MOD-001 §5.1 (ShipmentListing) + §3.2 (state machine)
// 
// GET    /api/marketplace/listings/[id]     — Get listing by ID
// PATCH  /api/marketplace/listings/[id]     — Update listing state / Publish / Cancel
// DELETE /api/marketplace/listings/[id]     — Cancel listing

import { NextRequest, NextResponse } from 'next/server';
import { ListingStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { applyListingTransition, isListingTerminal } from '@/modules/mod-001-marketplace/domain/services/listing-state-machine';
import { publishListing, isListingPublishable } from '@/modules/mod-001-marketplace/domain/services/listing-publish-service';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { validateRBAC } from '../../rbac-middleware';

/**
 * GET /api/marketplace/listings/[id]
 * Returns a single listing by ID.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;
    const role = _request.headers.get('x-user-role') || 'SHIPPER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'listings', 'read');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Return stub listing data (actual DB query in later increment)
    const listing = {
      listingId: id,
      status: 'PUBLISHED' as ListingStatus,
    };

    recordMarketplaceMetric('listings.viewed', 1, 'count');

    return NextResponse.json(
      wrapInContractFramework(listing, correlationId),
      {
        status: 200,
        headers: {
          'x-correlation-id': correlationId,
          'x-trace-id': context.traceId ?? '',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}

/**
 * PATCH /api/marketplace/listings/[id]
 * Updates listing state via validated state transition.
 * Supports explicit transitions (currentStatus + targetStatus) and
 * the convenience publish action (DRAFT → PUBLISHED).
 * Advisory-only: validates transition but does NOT auto-book or execute.
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
    const role = request.headers.get('x-user-role') || 'SHIPPER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'listings', 'update');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Support for "publish" convenience action (Increment 5)
    // If action=publish is specified, transition DRAFT → PUBLISHED using dedicated service
    if (body.action === 'publish') {
      const currentStatus = body.currentStatus as ListingStatus;
      
      if (!currentStatus) {
        throw new ValidationError('currentStatus is required when publishing');
      }

      if (!isListingPublishable(currentStatus)) {
        throw new ValidationError(
          `Listing in "${currentStatus}" state cannot be published. Only DRAFT listings are publishable.`,
        );
      }

      const newStatus = publishListing(currentStatus);
      const terminal = isListingTerminal(newStatus);

      recordMarketplaceMetric('listings.published', 1, 'count', { listingId: id });

      return NextResponse.json(
        wrapInContractFramework({
          listingId: id,
          previousStatus: currentStatus,
          newStatus,
          isTerminal: terminal,
          action: 'publish',
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

    // Explicit state transition path (existing Increment 4 behavior)
    const currentStatus = body.currentStatus as ListingStatus;
    const targetStatus = body.targetStatus as ListingStatus;

    if (!currentStatus || !targetStatus) {
      throw new ValidationError('Both currentStatus and targetStatus are required');
    }

    // Apply state transition validation (advisory only)
    const newStatus = applyListingTransition(currentStatus, targetStatus);

    // Check if terminal state
    const terminal = isListingTerminal(newStatus);

    recordMarketplaceMetric('listings.stateChanged', 1, 'count', { from: currentStatus, to: newStatus });

    return NextResponse.json(
      wrapInContractFramework({
        listingId: id,
        previousStatus: currentStatus,
        newStatus,
        isTerminal: terminal,
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

/**
 * DELETE /api/marketplace/listings/[id]
 * Cancels a listing (transitions to CANCELLED state).
 * Advisory-only: does not auto-confirm or trigger financial actions.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;
    const role = _request.headers.get('x-user-role') || 'SHIPPER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'listings', 'delete');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    recordMarketplaceMetric('listings.cancelled', 1, 'count');

    return NextResponse.json(
      wrapInContractFramework({
        listingId: id,
        status: 'CANCELLED',
      }, correlationId),
      {
        status: 200,
        headers: {
          'x-correlation-id': correlationId,
          'x-trace-id': context.traceId ?? '',
        },
      },
    );
  } catch (_error) {
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
