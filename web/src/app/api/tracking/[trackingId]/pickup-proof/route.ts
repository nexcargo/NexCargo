// NexCargo MOD-003 — Proof of Pickup submission (PRE-I-6 FINAL COMPLETION DIRECTIVE Item 3).
// POST /api/tracking/[trackingId]/pickup-proof
//
// Proof of Pickup is the existing Driver Identity Verification entity (MOD-003 §4.7), not a new
// artefact: the WS-05 disposition forbids inventing a POD-style POP primitive. An assigned Driver
// records its identity verification at cargo handover. This route only submits the evidence; the
// operational status advance (e.g. PICKUP_ACKNOWLEDGED) is a separate explicit call to the status
// route, mirroring how POD submission does not itself complete a shipment.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuth } from '@/lib/supabase/api-auth';
import { resolveDriverAssignment } from '@/lib/auth/driver-assignment';
import { TrackingRecordRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';
import { DriverIdentityVerificationRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/driver-identity-verification-repository';
import { VerificationMethod, VerificationStatus } from '@/modules/mod-003-tracking/domain/enums';
import { ShipmentStatus } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

const METHODS = Object.values(VerificationMethod) as string[];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> },
) {
  try {
    const authCtx = await assertApiAuth(request);
    const { trackingId } = await params;
    if (!trackingId || typeof trackingId !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'trackingId is required' },
        { status: 400 },
      );
    }

    // Assignment-scoped Driver authorization. Pickup proof is a Driver operational act, so the
    // caller must be role-less (no marketplace membership or platform role) and hold a PLANNED/ACTIVE
    // assignment for this record — the same boundary the database DIV INSERT policy enforces.
    const assignment = authCtx.role === null
      ? await resolveDriverAssignment(authCtx.userId, trackingId)
      : null;
    if (!assignment) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Pickup proof requires an assigned Driver for this tracking record' },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const method = typeof body?.method === 'string' ? body.method.trim() : '';
    if (!METHODS.includes(method)) {
      return NextResponse.json(
        { error: 'validation_error', message: `method must be one of ${METHODS.join(', ')}` },
        { status: 400 },
      );
    }

    const trackingRepo = new TrackingRecordRepository();
    const tracking = await trackingRepo.getById(trackingId);
    if (!tracking) {
      return NextResponse.json(
        { error: 'not_found', message: 'Tracking record not found' },
        { status: 404 },
      );
    }

    // Pickup evidence is submitted at the pickup stage, from authoritative persisted state.
    if (tracking.status !== ShipmentStatus.AWAITING_PICKUP) {
      return NextResponse.json(
        {
          error: 'conflict',
          message: `Pickup proof requires tracking status AWAITING_PICKUP; current status is ${tracking.status}`,
        },
        { status: 409 },
      );
    }

    const repo = new DriverIdentityVerificationRepository();
    const verification = await repo.create({
      trackingId,
      bookingId: tracking.bookingId,
      driverId: assignment.driverId,
      method,
      status: VerificationStatus.SUCCESS,
      verifiedAt: new Date().toISOString(),
    });

    return NextResponse.json(verification, { status: 201 });
  } catch (error) {
    console.error('[PickupProof] Error:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'validation_error', message: error.message, details: error.details },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { error: 'forbidden', message: error.message },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to submit pickup proof' },
      { status: 500 },
    );
  }
}