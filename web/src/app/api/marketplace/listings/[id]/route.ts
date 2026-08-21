// NexCargo MOD-001 — Listings API Route (Item)
// Authorized by HAO-WAVE1-004 — Wave 1 Increment 4: API Endpoints & Integration Wiring
// Per MOD-001 §5.1 (ShipmentListing) + §3.2 (state machine)
// 
// GET    /api/marketplace/listings/[id]     — Get listing by ID
// PATCH  /api/marketplace/listings/[id]     — Update listing state (e.g., publish, cancel)
// DELETE /api/marketplace/listings/[id]     — Cancel listing

import { NextRequest, NextResponse } from 'next/server';
import { ListingStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { applyListingTransition, isListingTerminal } from '@/modules/mod-001-marketplace/domain/services/listing-state-machine';
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
 * Advisory-only: validates transition but does NOT auto-publish or auto-book.
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

    // Validate state transition
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
