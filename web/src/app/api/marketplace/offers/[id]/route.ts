// NexCargo MOD-001 — Offers API Route (Item)
// C1 Closure Hardened: Mandatory auth, no header fallback.
// Per MOD-001 §5.2 (TransportOffer) + §3.2 (state machine)

import { NextRequest, NextResponse } from 'next/server';
import { OfferStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { validateAndApplyOfferTransition } from '@/modules/mod-001-marketplace/infrastructure/integrations/offer-state-service';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

/**
 * GET /api/marketplace/offers/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;

    // C1 Hardened: Mandatory session identity
    await assertApiAuthorization(_request, 'offers', 'read');

    const repository = new OffersRepository();
    const offer = await repository.getById(id);

    if (!offer) {
      return NextResponse.json(wrapInContractFramework({ error: `Offer ${id} not found` }, correlationId), { status: 404, headers: { 'x-correlation-id': correlationId } });
    }

    recordMarketplaceMetric('offers.viewed', 1, 'count');

    return NextResponse.json(wrapInContractFramework(offer, correlationId), {
      status: 200,
      headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
    });
  } catch (_error) {
    return NextResponse.json(wrapInContractFramework(null, correlationId), { status: 500, headers: { 'x-correlation-id': correlationId } });
  }
}

/**
 * PATCH /api/marketplace/offers/[id]
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

    // C1 Hardened: Mandatory session identity
    await assertApiAuthorization(request, 'offers', 'update');

    // "accept" convenience action
    if (body.action === 'accept') {
      const currentStatus = body.currentStatus as OfferStatus;
      if (!currentStatus) throw new ValidationError('currentStatus is required when accepting an offer');

      const result = validateAndApplyOfferTransition(currentStatus, OfferStatus.ACCEPTED);
      const repository = new OffersRepository();
      await repository.updateStatus(id, result.newStatus);

      recordMarketplaceMetric('offers.accepted', 1, 'count', { offerId: id });

      return NextResponse.json(wrapInContractFramework({ offerId: id, previousStatus: currentStatus, newStatus: result.newStatus, isTerminal: result.isTerminal, action: 'accept' }, correlationId), {
        status: 200,
        headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
      });
    }

    // "reject" convenience action
    if (body.action === 'reject') {
      const currentStatus = body.currentStatus as OfferStatus;
      if (!currentStatus) throw new ValidationError('currentStatus is required when rejecting an offer');

      const result = validateAndApplyOfferTransition(currentStatus, OfferStatus.REJECTED);
      const repository = new OffersRepository();
      await repository.updateStatus(id, result.newStatus);

      recordMarketplaceMetric('offers.rejected', 1, 'count', { offerId: id });

      return NextResponse.json(wrapInContractFramework({ offerId: id, previousStatus: currentStatus, newStatus: result.newStatus, isTerminal: result.isTerminal, action: 'reject' }, correlationId), {
        status: 200,
        headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' },
      });
    }

    // Explicit state transition
    const currentStatus = body.currentStatus as OfferStatus;
    const targetStatus = body.targetStatus as OfferStatus;
    if (!currentStatus || !targetStatus) throw new ValidationError('Both currentStatus and targetStatus are required');

    const result = validateAndApplyOfferTransition(currentStatus, targetStatus);
    const repository = new OffersRepository();
    await repository.updateStatus(id, result.newStatus);

    recordMarketplaceMetric('offers.stateChanged', 1, 'count', { from: currentStatus, to: result.newStatus });

    return NextResponse.json(wrapInContractFramework({ offerId: id, previousStatus: currentStatus, newStatus: result.newStatus, isTerminal: result.isTerminal }, correlationId), {
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
