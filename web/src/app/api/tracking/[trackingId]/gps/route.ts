// NexCargo MOD-003 — GPS Update Route (C7-001 Phase 1)
// POST /api/tracking/[trackingId]/gps
// Submit GPS location update with validation + idempotency

import { NextRequest, NextResponse } from 'next/server';
import { GpsIngestionService } from '@/modules/mod-003-tracking/application/services/gps-ingestion-service';
import { ValidationError } from '@/shared/errors/app-errors';
import { assertApiAuth } from '@/lib/supabase/api-auth';
import { resolveDriverAssignment } from '@/lib/auth/driver-assignment';

/**
 * POST /api/tracking/[trackingId]/gps
 *
 * Submits a GPS coordinate update after validation.
 * Requires authentication via Supabase session, and the caller must be a Driver linked to a
 * PLANNED/ACTIVE assignment for this tracking record (PRE-I-6 FINAL COMPLETION DIRECTIVE Item 3,
 * migration 070). The sole INSERT policy on logistics_schema.gps_location_updates enforces the same
 * assignment scope plus the role-less boundary at the database; this gate is the application half.
 * A Driver is a MOD-014 asset record subordinate to a Transporter, not an account class.
 *
 * Body:
 * - latitude: decimal (-90 to 90)
 * - longitude: decimal (-180 to 180)
 * - speedKmh: optional (0–250)
 * - headingDegrees: optional (0–360)
 * - accuracyMeters: optional (>0)
 * - batteryLevel: optional (0–100)
 *
 * Idempotency key supported via tracking record's version field.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    // Auth guard: requires valid Supabase session
    const authCtx = await assertApiAuth(request);
    const { trackingId } = await params;
    if (!trackingId || typeof trackingId !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'trackingId is required' },
        { status: 400 }
      );
    }

    // Assignment-scoped Driver authorization: only a role-less account linked to a driver holding a
    // PLANNED/ACTIVE assignment for this shipment may submit telemetry — the same boundary the
    // database INSERT policy enforces. Fail closed when there is no link or no active assignment.
    const assignment = authCtx.role === null
      ? await resolveDriverAssignment(authCtx.userId, trackingId)
      : null;
    if (!assignment) {
      return NextResponse.json(
        { error: 'forbidden', message: 'GPS submission requires an assigned Driver for this tracking record' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { latitude, longitude }: { latitude?: number; longitude?: number } = body as Record<string, unknown>;

    // Validate required fields
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'validation_error', message: 'latitude and longitude are required numbers' },
        { status: 400 }
      );
    }

    const ingestionService = new GpsIngestionService();
    await ingestionService.ingest({
      trackingId,
      latitude,
      longitude,
      speedKmh: body.speedKmh,
      headingDegrees: body.headingDegrees,
      accuracyMeters: body.accuracyMeters,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[GpsUpdate] Error:', error);
    
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

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to ingest GPS update' },
      { status: 500 }
    );
  }
}
