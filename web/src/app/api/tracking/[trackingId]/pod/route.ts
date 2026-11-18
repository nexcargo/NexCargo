// NexCargo MOD-003 — POD Submit Route (C7-001 Phase 1)
// POST /api/tracking/[trackingId]/pod
// Submit Proof of Delivery with evidence validation

import { NextRequest, NextResponse } from 'next/server';
import { PodSubmissionService } from '@/modules/mod-003-tracking/application/services/pod-submission-service';
import type { CreatePodParams } from '@/modules/mod-003-tracking/infrastructure/repositories/pod-repository';
import { TrackingRecordRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { ValidationError } from '@/shared/errors/app-errors';
import { ShipmentStatus } from '@/shared/types/enums';
import { assertApiAuth, assertApiAuthorization, type AuthContext } from '@/lib/supabase/api-auth';
import { resolveDriverAssignment } from '@/lib/auth/driver-assignment';

/**
 * POST /api/tracking/[trackingId]/pod
 *
 * Submits POD evidence after validation.
 *
 * Authorization (F-I5-02): the caller must hold an effective TRANSPORTER marketplace
 * membership resolved from app.marketplace_memberships (pod_create matrix entry).
 * DRIVER is not an account class: a Driver is a MOD-014 asset record subordinate to a
 * Transporter, so no Driver POD authority exists. Dispatchers have no pod_create
 * delegation scope. Identity claims in the body or headers confer nothing.
 *
 * Ownership: the persisted tracking record must belong to a booking whose transporter
 * is the authenticated caller, and the submitted bookingId must match that record.
 * Database RLS ("Transporter submits POD for own booking", migration 063) independently
 * enforces the same membership + dual-parent + transporter-party boundary on INSERT.
 *
 * Lifecycle (MOD-003 §5: Delivered -> PODSubmitted -> Completed): POD is evidence of
 * successful delivery, so submission is accepted only while the persisted tracking
 * status is DELIVERED. Premature or incompatible states receive 409.
 *
 * Body:
 * - bookingId: UUID of linked booking
 * - recipientName: text
 * - signatureRef: Supabase Storage file reference (URL or path)
 * - photoRefs: array of Supabase Storage file references
 * - gpsLat: decimal (-90 to 90)
 * - gpsLon: decimal (-180 to 180)
 *
 * Response:
 * - PodApiShape with id and verificationStatus=PENDING
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    const { trackingId } = await params;
    if (!trackingId || typeof trackingId !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'trackingId is required' },
        { status: 400 }
      );
    }

    // Authorization: the owning Transporter through the pod_create matrix, or a role-less account
    // linked to a PLANNED/ACTIVE Driver assignment for this record (PRE-I-6 FINAL COMPLETION
    // DIRECTIVE Item 3, migration 070). The fallback admits only role-less callers, matching the
    // database POD INSERT policy's driver branch; role-holders keep their matrix authority.
    let driverPath = false;
    let authCtx: AuthContext;
    try {
      authCtx = await assertApiAuthorization(request, 'pod_create', 'create');
    } catch (authError) {
      if (authError instanceof Error && authError.message.startsWith('FORBIDDEN')) {
        authCtx = await assertApiAuth(request);
        const assignment = authCtx.role === null
          ? await resolveDriverAssignment(authCtx.userId, trackingId)
          : null;
        if (!assignment) throw authError;
        driverPath = true;
      } else {
        throw authError;
      }
    }

    // Parse request body
    const body = await request.json();
    const {
      bookingId,
      recipientName,
      signatureRef,
      photoRefs,
      gpsLat,
      gpsLon,
    }: Omit<CreatePodParams, 'submissionMethod'> & { submissionMethod?: string } = body;

    // Validate required fields
    if (!bookingId || !recipientName || !signatureRef || !Array.isArray(photoRefs)) {
      return NextResponse.json(
        { error: 'validation_error', message: 'Required fields missing' },
        { status: 400 }
      );
    }

    if (typeof gpsLat !== 'number' || typeof gpsLon !== 'number') {
      return NextResponse.json(
        { error: 'validation_error', message: 'gpsLat and gpsLon are required numbers' },
        { status: 400 }
      );
    }

    // Check photo count requirement
    if (photoRefs.length < 1) {
      return NextResponse.json(
        { error: 'validation_error', message: 'At least one photograph is required' },
        { status: 400 }
      );
    }

    // Ownership: resolve the persisted tracking record under the caller's session.
    // RLS hides other Transporters' records, so a foreign trackingId reads as not found.
    const trackingRepo = new TrackingRecordRepository();
    const tracking = await trackingRepo.getById(trackingId);
    if (!tracking) {
      return NextResponse.json(
        { error: 'not_found', message: 'Tracking record not found' },
        { status: 404 }
      );
    }

    // The submitted bookingId must be the tracking record's own booking; a client-supplied
    // identifier never establishes authority over a different pairing.
    if (bookingId !== tracking.bookingId) {
      return NextResponse.json(
        { error: 'forbidden', message: 'bookingId does not match the booking of this tracking record' },
        { status: 403 }
      );
    }

    // Transporter path: the booking must be owned by the caller. The Driver path skips this read —
    // a Driver is not the booking's transporter; its authority is the assignment, and the database
    // POD INSERT policy independently pins the dual-parent pairing and the assignment scope.
    if (!driverPath) {
      const bookingsRepo = new BookingsRepository();
      const booking = await bookingsRepo.getById(tracking.bookingId);
      if (!booking) {
        return NextResponse.json(
          { error: 'not_found', message: 'Booking not found' },
          { status: 404 }
        );
      }
      if (booking.transporterId !== authCtx.userId) {
        return NextResponse.json(
          { error: 'forbidden', message: 'POD may only be submitted by the Transporter that owns the booking' },
          { status: 403 }
        );
      }
    }

    // Lifecycle gate from authoritative persisted state, never a request-body status.
    if (tracking.status !== ShipmentStatus.DELIVERED) {
      return NextResponse.json(
        {
          error: 'conflict',
          message: `POD submission requires tracking status DELIVERED; current status is ${tracking.status}`,
        },
        { status: 409 }
      );
    }

    // Submit POD via service
    const podService = new PodSubmissionService();
    const result = await podService.submitPOD({
      trackingId,
      bookingId,
      recipientName,
      signatureRef,
      photoRefs,
      gpsLat,
      gpsLon,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[PodSubmit] Error:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'validation_error', message: error.message, details: error.details },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { error: 'forbidden', message: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to submit POD' },
      { status: 500 }
    );
  }
}