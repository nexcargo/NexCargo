// NexCargo MOD-002 — PATCH /api/bookings/[id]/confirm — Booking Confirmation Endpoint
// C2-Increment 002 + C3 Contract Linkage
// Authorized directive: HAO-WAVE2-AUTH-001 (Wave 2 authorized) + HAO-C3-AUTHORIZATION
// Reference: MOD-002 §4.7, §5.1 (State Machine), MOD-002 §8 (Event Model)
//
// Rules:
//   - /confirm is the SOLE mechanism that produces final CONFIRMED status.
//   - Predecessor state MUST be ALIGNMENT_CHECKED (enforced by state machine).
//   - Cannot bypass the Booking state machine.
//   - Invalid state transitions fail explicitly (no fake-success).
//   - Uses confirm_booking_with_contract() SECDEF for atomic booking+contract creation.
//   - Per C3: booking confirmation creates/links Contract via trusted RPC.

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { BookingStatus } from '@/modules/mod-002-booking/domain/enums';
import { applyBookingTransition } from '@/modules/mod-002-booking/domain/services/booking-state-machine';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { createClient } from '@/lib/supabase/server';
import { InMemoryEventEmitter } from '@/shared/events/emitter';
import { EventClassification, EventCriticality } from '@/shared/types/enums';

/**
 * PATCH /api/bookings/[id]/confirm
 * Advances booking from ALIGNMENT_CHECKED → CONFIRMED.
 * Validates source state is ALIGNMENT_CHECKED per authoritative state machine.
 * Creates contract row and links contract_id to booking via confirm_booking_with_contract() SECDEF.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;

    // Validate booking UUID format early
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Invalid booking ID format', code: 'ERR_3001' }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const ctx = await assertApiAuthorization(_request, 'booking_confirm', 'update');

    // Retrieve existing booking for pre-validation (state check before SECDEF call)
    const repo = new BookingsRepository();
    const booking = await repo.getById(id);

    if (!booking) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Booking not found', code: 'ERR_1002' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Confirm ownership: only the Shipper may confirm their booking
    if (ctx.userId !== booking.shipperId) {
      throw new Error('FORBIDDEN: Only the booking Shipper may confirm this booking');
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

    // C3: Use trusted SECDEF for atomic booking confirmation + contract creation
    // This replaces the old direct repo.confirmBooking() path which skipped contract creation entirely.
    const supabase = await createClient();
    const { data: result, error: secdefError } = await supabase.rpc('confirm_booking_with_contract', {
      p_booking_id: id,
      p_correlation_id: correlationId,
    });

    if (secdefError) {
      const errMsg = secdefError.message;

      // Map known SECDEF errors to proper API responses
      if (errMsg.includes('BOOKING_NOT_FOUND')) {
        return NextResponse.json(
          wrapInContractFramework({ error: 'Booking not found or deleted', code: 'ERR_1002' }, correlationId),
          { status: 404, headers: { 'x-correlation-id': correlationId } },
        );
      }

      if (errMsg.includes('INVALID_PREDECESSOR')) {
        return NextResponse.json(
          wrapInContractFramework({ error: 'Booking must be in ALIGNMENT_CHECKED state to confirm', code: 'ERR_1005' }, correlationId),
          { status: 409, headers: { 'x-correlation-id': correlationId } },
        );
      }

      if (errMsg.includes('ACCESS_DENIED') || errMsg.includes('UNAUTHORIZED')) {
        return NextResponse.json(
          wrapInContractFramework({ error: 'Access denied: you are not the shipper of this booking', code: 'ERR_3002' }, correlationId),
          { status: 403, headers: { 'x-correlation-id': correlationId } },
        );
      }

      return NextResponse.json(
        wrapInContractFramework({ error: 'Booking confirmation failed', details: errMsg, code: 'ERR_1000' }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!result) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'No response from booking confirmation', code: 'ERR_3098' }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const secureResult = result as Record<string, unknown>;

    recordMarketplaceMetric('bookings.confirmed', 1, 'count', { listingId: booking.listingId });

    // C5 Increment 1 — Emit bookingConfirmed canonical event (non-blocking)
    try {
      const { getEventBus } = await import('@/shared/events/handler-registry');
      const emitter = InMemoryEventEmitter.createEvent({
        eventType: 'bookingConfirmed',
        sourceModule: 'MOD-002',
        aggregateId: id,
        aggregateType: 'Booking',
        payload: {
          transporter_id: booking.transporterId,
          listingId: booking.listingId,
        },
        classification: EventClassification.BUSINESS,
        criticality: EventCriticality.CRITICAL,
        correlationId,
      });
      await getEventBus().publish(emitter);
    } catch (emissionErr: unknown) {
      const message = emissionErr instanceof Error ? emissionErr.message : String(emissionErr);
      console.error('[BookingConfirm] Event emission failed (non-blocking):', message);
    }

    return NextResponse.json(
      wrapInContractFramework(
        {
          bookingId: id,
          previousStatus: currentStatus,
          newStatus: BookingStatus.CONFIRMED,
          confirmedBy: ctx.userId,
          confirmationTimestamp: new Date().toISOString(),
          contractId: secureResult.contract_id as string | undefined,
          acceptanceStatus: secureResult.acceptance_status as string | undefined,
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
