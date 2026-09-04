// NexCargo MOD-002 — GET /api/bookings/[id] & PATCH /api/bookings/[id] — Single Booking Operations
// C2-Increment 002 Implementation
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Reference: MOD-002 §4.7, §5.1 (State Machine)

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { applyBookingTransition } from '@/modules/mod-002-booking/domain/services/booking-state-machine';
import { BookingStatus } from '@/modules/mod-002-booking/domain/enums';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

/**
 * GET /api/bookings/[id]
 * Returns a single booking by primary key id.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));

  try {
    const { id } = await params;

    // Pattern A auth: session-based
    await assertApiAuthorization(request, 'bookings', 'read');

    const repo = new BookingsRepository();
    const booking = await repo.getById(id);

    if (!booking) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Booking not found', code: 'ERR_1002' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    recordMarketplaceMetric('bookings.viewed', 1, 'count');

    return NextResponse.json(
      wrapInContractFramework(booking, correlationId),
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

/**
 * PATCH /api/bookings/[id]
 * General booking state transition (e.g., ALIGNMENT_CHECKED → CANCELLED).
 * Validates against authoritative state machine before committing.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));

  try {
    const { id } = await params;
    const body = await request.json();

    // Pattern A auth: session-based
    const ctx = await assertApiAuthorization(request, 'bookings', 'update');

    if (!body.action) throw new ValidationError('action is required');
    if (!body.currentStatus) throw new ValidationError('currentStatus is required');

    const currentStatus = body.currentStatus as BookingStatus;
    const targetAction = body.action;

    // Map action to target status
    let targetStatus: BookingStatus;
    switch (targetAction) {
      case 'confirm':
        targetStatus = BookingStatus.CONFIRMED;
        break;
      case 'cancel':
        targetStatus = BookingStatus.CANCELLED;
        break;
      case 'fail':
        targetStatus = BookingStatus.FAILED;
        break;
      default:
        throw new ValidationError(`Invalid action: ${targetAction}. Allowed: confirm, cancel, fail`);
    }

    // State machine validation — prevents bypass of required predecessor states
    validateBookingTransition(currentStatus, targetStatus);

    // Verify booking exists and user has access
    const repo = new BookingsRepository();
    const booking = await repo.getById(id);
    if (!booking) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Booking not found', code: 'ERR_1002' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Shipper can update their own bookings
    if (ctx.userId !== booking.shipperId) {
      throw new Error('FORBIDDEN: Not authorized to update this booking');
    }

    // Apply state transition via repository
    await repo.updateStatus(id, targetStatus);

    recordMarketplaceMetric('bookings.updated', 1, 'count', { targetStatus });

    return NextResponse.json(
      wrapInContractFramework({ bookingId: id, previousStatus: currentStatus, newStatus: targetStatus }, correlationId),
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

/**
 * Validate booking transition using the authoritative state machine.
 * Wrapper that catches ValidationError and re-throws for consistent API handling.
 */
function validateBookingTransition(currentStatus: BookingStatus, targetStatus: BookingStatus): void {
  try {
    applyBookingTransition(currentStatus, targetStatus);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Invalid booking transition: ${currentStatus} → ${targetStatus}`);
  }
}
