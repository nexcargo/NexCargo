// NexCargo MOD-001 — Offers API Route (Collection)
// Authorized by HAO-WAVE1-004 — Wave 1 Increment 4: API Endpoints & Integration Wiring
// Per MOD-001 §5.2 (TransportOffer) + §3.2 (state machine)
// 
// GET    /api/marketplace/offers     — List offers for a listing
// POST   /api/marketplace/offers     — Create new offer submission

import { NextRequest, NextResponse } from 'next/server';
import { OfferStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { validateRBAC } from '../rbac-middleware';

/**
 * GET /api/marketplace/offers
 * Returns all offers for a specific listing.
 */
export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const role = request.headers.get('x-user-role') || 'TRANSPORTER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'offers', 'read');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Extract listingId from query params
    const url = new URL(request.url);
    const listingId = url.searchParams.get('listingId');
    if (!listingId) {
      throw new ValidationError('listingId query parameter is required');
    }

    // Return stub offers data (actual DB query in later increment)
    const offers: unknown[] = [];

    recordMarketplaceMetric('offers.listed', offers.length, 'count');

    return NextResponse.json(
      wrapInContractFramework({ listingId, offers }, correlationId),
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
 * POST /api/marketplace/offers
 * Creates a new offer submission.
 * Advisory-only: creates SUBMITTED state; does NOT auto-accept or auto-book.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const body = await request.json();
    const role = request.headers.get('x-user-role') || 'TRANSPORTER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'offers', 'create');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Required fields per MOD-001 §5.2
    const requiredFields = ['transporterId', 'listingId', 'priceProposal', 'availabilityWindow', 'vehicleType', 'declaredCapacity'];
    for (const field of requiredFields) {
      if (!(field in body)) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    // Validate availability window structure
    if (!body.availabilityWindow?.earliestPickup || !body.availabilityWindow?.latestPickup || !body.availabilityWindow?.estimatedDelivery) {
      throw new ValidationError('Availability window must include earliestPickup, latestPickup, and estimatedDelivery');
    }

    // Validate declared capacity structure
    if (!body.declaredCapacity?.maxWeightKg) {
      throw new ValidationError('Declared capacity must include maxWeightKg');
    }

    // Return success with SUBMITTED status
    // Actual persistence and event emission in later increment
    return NextResponse.json(
      wrapInContractFramework({
        offerId: 'stub-offer-id',
        transporterId: body.transporterId,
        listingId: body.listingId,
        priceProposal: body.priceProposal,
        vehicleType: body.vehicleType,
        status: 'SUBMITTED' as OfferStatus,
      }, correlationId),
      {
        status: 201,
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
