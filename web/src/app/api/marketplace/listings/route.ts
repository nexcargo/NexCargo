// NexCargo MOD-001 — Listings API Route (Collection)
// Authorized by HAO-WAVE1-004 — Wave 1 Increment 4: API Endpoints & Integration Wiring
// Per MOD-001 §5.1 (ShipmentListing) + §3.2 (state machine)
// 
// GET    /api/marketplace/listings     — List published listings (advisory only)
// POST   /api/marketplace/listings     — Create new draft listing

import { NextRequest, NextResponse } from 'next/server';
import { ListingStatus, PricingModel, CargoType } from '@/modules/mod-001-marketplace/domain/enums';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { createAuditEvent } from '@/shared/standards/audit-event-format';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { validateRBAC } from '../rbac-middleware';

/**
 * GET /api/marketplace/listings
 * Returns all PUBLISHED listings for discovery.
 * Advisory-only: does not modify state or trigger actions.
 */
export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // Validate RBAC permission
    const role = request.headers.get('x-user-role') || 'SHIPPER';
    const rbacResult = await validateRBAC(role, 'listings', 'read');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Query published listings (stub — actual Supabase query in later increment)
    const publishedListings: unknown[] = [];

    // Record metric
    recordMarketplaceMetric('listings.listed', publishedListings.length, 'count', { source: 'api' });

    return NextResponse.json(
      wrapInContractFramework(publishedListings, correlationId),
      {
        status: 200,
        headers: {
          'x-correlation-id': correlationId,
          'x-trace-id': context.traceId ?? '',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      {
        status: 500,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}

/**
 * POST /api/marketplace/listings
 * Creates a new draft shipment listing.
 * Advisory-only: creates DRAFT state; publishing requires explicit action.
 */
export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const role = request.headers.get('x-user-role') || 'SHIPPER';
    
    // Validate RBAC permission
    const rbacResult = await validateRBAC(role, 'listings', 'create');
    if (!rbacResult.permitted) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Required fields per MOD-001 §5.1
    const requiredFields = ['shipperId', 'origin', 'destination', 'cargoType', 'weightKg', 'timeWindow'];
    for (const field of requiredFields) {
      if (!(field in body)) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    // Validate origin/destination structure
    if (!body.origin?.latitude || !body.origin?.longitude || !body.origin?.address) {
      throw new ValidationError('Origin must include latitude, longitude, and address');
    }
    if (!body.destination?.latitude || !body.destination?.longitude || !body.destination?.address) {
      throw new ValidationError('Destination must include latitude, longitude, and address');
    }

    // Validate time window
    if (!body.timeWindow?.earliestPickup || !body.timeWindow?.latestDelivery) {
      throw new ValidationError('Time window must include earliestPickup and latestDelivery');
    }

    // Create audit event
    const auditEvent = createAuditEvent({
      eventType: 'listingCreated',
      moduleSource: 'MOD-017',
      userId: body.shipperId,
      userRole: role,
      affectedEntityType: 'ShipmentListing',
      affectedEntityId: body.shipperId, // Will be updated with actual listing ID after persistence
      actionType: 'WRITE',
      metadata: { cargoType: body.cargoType, weightKg: body.weightKg },
      correlationId,
    });

    // Record metric
    recordMarketplaceMetric('listings.created', 1, 'count', { cargoType: body.cargoType });

    // Return success — actual persistence in later increment
    return NextResponse.json(
      wrapInContractFramework({
        status: 'DRAFT',
        shipperId: body.shipperId,
        cargoType: body.cargoType,
        auditEvent,
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
