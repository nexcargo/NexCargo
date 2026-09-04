// NexCargo MOD-002 — POST /api/bookings — Booking Creation Endpoint
// C2-Increment 002 Implementation
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Reference: MOD-002 §4.7, §3.1 (Booking Formation), §7.4 (Alignment Rule)
// Booking lifecycle: REQUESTED → ALIGNMENT_CHECKED → CONFIRMED | FAILED | CANCELLED

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // Pattern A auth: session-based, no header fallback
    const ctx = await assertApiAuthorization(request, 'bookings', 'create');

    const body = await request.json();

    // Required fields validation
    if (!body.bookingId) throw new ValidationError('bookingId is required');
    if (!body.listingId) throw new ValidationError('listingId is required');
    if (!body.selectedOfferId) throw new ValidationError('selectedOfferId is required');
    if (!body.shipperId) throw new ValidationError('shipperId is required');
    if (!body.transporterId) throw new ValidationError('transporterId is required');
    if (!body.originAddress) throw new ValidationError('originAddress is required');
    if (!body.destinationAddress) throw new ValidationError('destinationAddress is required');
    if (!body.cargoDescription) throw new ValidationError('cargoDescription is required');
    if (!body.cargoType) throw new ValidationError('cargoType is required');
    if (typeof body.weightKg !== 'number' || body.weightKg <= 0) {
      throw new ValidationError('weightKg must be a positive number');
    }
    if (typeof body.offerPrice !== 'number' || body.offerPrice <= 0) {
      throw new ValidationError('offerPrice must be a positive number');
    }
    if (!body.vehicleType) throw new ValidationError('vehicleType is required');

    // Session user must be shipper (business rule)
    if (ctx.userId !== body.shipperId) {
      throw new ValidationError('Shipper ID must match authenticated user');
    }

    const repo = new BookingsRepository();
    const result = await repo.create({
      bookingId: body.bookingId,
      listingId: body.listingId,
      selectedOfferId: body.selectedOfferId,
      shipperId: body.shipperId,
      transporterId: body.transporterId,
      status: 'REQUESTED',
      originAddress: body.originAddress,
      originLatitude: body.originLatitude,
      originLongitude: body.originLongitude,
      destinationAddress: body.destinationAddress,
      destinationLatitude: body.destinationLatitude,
      destinationLongitude: body.destinationLongitude,
      cargoDescription: body.cargoDescription,
      cargoType: body.cargoType,
      weightKg: body.weightKg,
      volumeM3: body.volumeM3,
      specialHandling: body.specialHandling,
      offerPrice: body.offerPrice,
      vehicleType: body.vehicleType,
      declaredWeightKg: body.declaredWeightKg,
      declaredVolumeM3: body.declaredVolumeM3,
      currency: body.currency ?? 'MZN',
      availabilityWindowStart: body.availabilityWindowStart,
      availabilityWindowEnd: body.availabilityWindowEnd,
      contractId: body.contractId,
      correlationId: correlationId,
    });

    recordMarketplaceMetric('bookings.created', 1, 'count', { listingId: body.listingId });

    return NextResponse.json(
      wrapInContractFramework(result, correlationId),
      { status: 201, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message, code: error.code }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized', code: 'ERR_1003' }, correlationId),
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message, code: 'ERR_1004' }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
