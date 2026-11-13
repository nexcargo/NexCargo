// NexCargo MOD-002 — POST /api/bookings — Booking Creation Endpoint
// C2-Increment 002 Implementation
// C2-Increment 003 DEC-001: Added FK existence verification + alignment validation
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Reference: MOD-002 §4.7, §3.1 (Booking Formation), §7.4 (Alignment Rule)
// Booking lifecycle: REQUESTED → ALIGNMENT_CHECKED → CONFIRMED | FAILED | CANCELLED

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertAlignment } from '@/modules/mod-002-booking/domain/services/offer-listing-alignment';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // Pattern A auth: session-based, no header fallback
    const ctx = await assertApiAuthorization(request, 'booking_create', 'create');

    const body = await request.json();

    // Required fields validation
    if (!body.bookingId) throw new ValidationError('bookingId is required');
    if (!body.listingId) throw new ValidationError('listingId is required');
    if (!body.selectedOfferId) throw new ValidationError('selectedOfferId is required');
    if (!body.shipperId) throw new ValidationError('shipperId is required');
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

    // Session user must be shipper (business rule)
    if (ctx.userId !== body.shipperId) {
      throw new ValidationError('Shipper ID must match authenticated user');
    }

    // DEC-001 integrity controls — MOD-002 §3.1, §7.4.
    // The referenced listing and offer must exist, belong to this shipper's listing, be linked to
    // each other, and pass alignment. transporterId and price come from the stored offer, never
    // from the request body, so a shipper cannot book a counterparty or price that was not offered.
    const listingsRepository = new ListingsRepository();
    const storedListing = await listingsRepository.getById(String(body.listingId));
    if (!storedListing) {
      throw new ValidationError(`Listing ${body.listingId} does not exist`);
    }
    if (storedListing.shipperId !== ctx.userId) {
      throw new Error('FORBIDDEN: listing belongs to another shipper');
    }

    const offersRepository = new OffersRepository();
    const storedOffer = await offersRepository.getById(String(body.selectedOfferId));
    if (!storedOffer) {
      throw new ValidationError(`Offer ${body.selectedOfferId} does not exist`);
    }
    if (storedOffer.listingId !== storedListing.listingId) {
      throw new ValidationError('Selected offer was not made against this listing');
    }
    if (storedOffer.status !== 'SUBMITTED') {
      throw new ValidationError(`Offer ${storedOffer.offerId} is not selectable in status "${storedOffer.status}"`);
    }

    assertAlignment(
      {
        requiredWeightKg: Number(storedListing.weightKg ?? 0),
        requiredVolumeM3: storedListing.volumeM3 == null ? undefined : Number(storedListing.volumeM3),
        acceptedVehicleTypes: storedListing.acceptedVehicleTypes ?? [],
      },
      {
        declaredWeightKg: Number(storedOffer.declaredCapacity?.maxWeightKg ?? 0),
        declaredVolumeM3: storedOffer.declaredCapacity?.maxVolumeM3 == null
          ? undefined
          : Number(storedOffer.declaredCapacity.maxVolumeM3),
        vehicleType: String(storedOffer.vehicleType ?? ''),
      },
    );

    const repo = new BookingsRepository();
    const result = await repo.create({
      bookingId: body.bookingId,
      listingId: storedListing.listingId,
      selectedOfferId: storedOffer.offerId,
      shipperId: ctx.userId,
      transporterId: storedOffer.transporterId,
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
      offerPrice: Number(storedOffer.priceProposal),
      vehicleType: storedOffer.vehicleType,
      declaredWeightKg: Number(storedOffer.declaredCapacity?.maxWeightKg ?? body.declaredWeightKg ?? 0),
      declaredVolumeM3: storedOffer.declaredCapacity?.maxVolumeM3 == null
        ? body.declaredVolumeM3
        : Number(storedOffer.declaredCapacity.maxVolumeM3),
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
