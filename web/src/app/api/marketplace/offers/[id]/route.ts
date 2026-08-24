// NexCargo MOD-001 — Offers API Route (Item)
// Authorized by HAO-WAVE1-004/005 — Wave 1 Increment 4 + 5
// Per MOD-001 §5.2 (TransportOffer) + §3.2 (state machine)
// 
// GET    /api/marketplace/offers/[id]     — Get offer by ID
// PATCH  /api/marketplace/offers/[id]     — Update state / Accept / Reject

import { NextRequest, NextResponse } from 'next/server';
import { OfferStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { validateAndApplyOfferTransition } from '@/modules/mod-001-marketplace/infrastructure/integrations/offer-state-service';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { validateRBAC } from '../../rbac-middleware';

/**
 * GET /api/marketplace/offers/[id]
 * Returns a single offer by ID.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;
    const role = _request.headers.get('x-user-role') || 'TRANSPORTER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'offers', 'read');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Return stub offer data (actual DB query in later increment)
    const offer = {
      offerId: id,
      status: 'SUBMITTED' as OfferStatus,
    };

    recordMarketplaceMetric('offers.viewed', 1, 'count');

    return NextResponse.json(
      wrapInContractFramework(offer, correlationId),
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

/**
 * PATCH /api/marketplace/offers/[id]
 * Updates offer state via validated state transition.
 * Supports explicit transitions (currentStatus + targetStatus) and
 * convenience actions: "accept", "reject" (Increment 5).
 * Advisory-only: does NOT auto-book or execute financial actions.
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
    const role = request.headers.get('x-user-role') || 'TRANSPORTER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'offers', 'update');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Support for "accept" convenience action (Increment 5)
    if (body.action === 'accept') {
      const currentStatus = body.currentStatus as OfferStatus;
      
      if (!currentStatus) {
        throw new ValidationError('currentStatus is required when accepting an offer');
      }

      const result = validateAndApplyOfferTransition(currentStatus, OfferStatus.ACCEPTED);

      recordMarketplaceMetric('offers.accepted', 1, 'count', { offerId: id });

      return NextResponse.json(
        wrapInContractFramework({
          offerId: id,
          previousStatus: currentStatus,
          newStatus: result.newStatus,
          isTerminal: result.isTerminal,
          action: 'accept',
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

    // Support for "reject" convenience action (Increment 5)
    if (body.action === 'reject') {
      const currentStatus = body.currentStatus as OfferStatus;
      
      if (!currentStatus) {
        throw new ValidationError('currentStatus is required when rejecting an offer');
      }

      const result = validateAndApplyOfferTransition(currentStatus, OfferStatus.REJECTED);

      recordMarketplaceMetric('offers.rejected', 1, 'count', { offerId: id });

      return NextResponse.json(
        wrapInContractFramework({
          offerId: id,
          previousStatus: currentStatus,
          newStatus: result.newStatus,
          isTerminal: result.isTerminal,
          action: 'reject',
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
    const currentStatus = body.currentStatus as OfferStatus;
    const targetStatus = body.targetStatus as OfferStatus;

    if (!currentStatus || !targetStatus) {
      throw new ValidationError('Both currentStatus and targetStatus are required');
    }

    // Apply state transition validation (advisory only)
    const result = validateAndApplyOfferTransition(currentStatus, targetStatus);

    recordMarketplaceMetric('offers.stateChanged', 1, 'count', { from: currentStatus, to: result.newStatus });

    return NextResponse.json(
      wrapInContractFramework({
        offerId: id,
        previousStatus: currentStatus,
        newStatus: result.newStatus,
        isTerminal: result.isTerminal,
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
