// NexCargo MOD-002 — PATCH /api/bookings/[id]/confirm — Booking Confirmation Endpoint
// C2-Increment 002 Implementation
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Reference: MOD-002 §4.7, §5.1 (State Machine)
//
// Rules:
//   - /confirm is the SOLE mechanism that produces final CONFIRMED status.
//   - Predecessor state MUST be ALIGNMENT_CHECKED (enforced by state machine).
//   - Cannot bypass the Booking state machine.
//   - Invalid state transitions fail explicitly (no fake-success).

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { BookingStatus } from '@/modules/mod-002-booking/domain/enums';
import { applyBookingTransition } from '@/modules/mod-002-booking/domain/services/booking-state-machine';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

/**
 * PATCH /api/bookings/[id]/confirm
 * Advances booking from ALIGNMENT_CHECKED → CONFIRMED.
 * Validates source state is ALIGNMENT_CHECKED per authoritative state machine.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;

    // Pattern A auth: session-based, requires bookings update permission
    const ctx = await assertApiAuthorization(_request, 'bookings', 'update');

    // Retrieve existing booking
    const repo = new BookingsRepository();
    const booking = await repo.getById(id);

    if (!booking) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Booking not found', code: 'ERR_1002' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Predecessor guard: only ALIGNMENT_CHECKED can advance to CONFIRMED
    const currentStatus = booking.status as BookingStatus;
    if (currentStatus !== BookingStatus.ALIGNMENT_CHECKED) {
      throw new ValidationError(
        `Cannot confirm booking in status ${currentStatus}. Only bookings in ALIGNMENT_CHECKED may be confirmed.`,
      );
    }

    // State machine enforcement: APPLY the transition to verify it's valid
    const validatedTarget = applyBookingTransition(
      currentStatus,
      BookingStatus.CONFIRMED,
    );
    if (validatedTarget !== BookingStatus.CONFIRMED) {
      throw new ValidationError(
        'Invalid transition: ALIGNMENT_CHECKED cannot advance to CONFIRMED via state machine',
      );
    }

    // Confirm booking (sets status=CONFIRMED + confirmation_timestamp)
    await repo.confirmBooking(id);

    recordMarketplaceMetric('bookings.confirmed', 1, 'count', { listingId: booking.listingId });

    return NextResponse.json(
      wrapInContractFramework(
        {
          bookingId: id,
          previousStatus: currentStatus,
          newStatus: BookingStatus.CONFIRMED,
          confirmedBy: ctx.userId,
          confirmationTimestamp: new Date().toISOString(),
        },
        correlationId,
      ),
      { status: 200, headers: { 'x-correlation-id': correlationId } },
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
