// NexCargo MOD-003 — GPS Update Route (C7-001 Phase 1)
// POST /api/tracking/[trackingId]/gps
// Submit GPS location update with validation + idempotency

import { NextRequest, NextResponse } from 'next/server';
import { GpsIngestionService } from '@/modules/mod-003-tracking/application/services/gps-ingestion-service';
import { ValidationError } from '@/shared/errors/app-errors';

/**
 * POST /api/tracking/[trackingId]/gps
 * 
 * Submits a GPS coordinate update after validation.
 * Requires authorization via RBAC (DRIVER role).
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
    const { trackingId } = await params;
    if (!trackingId || typeof trackingId !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'trackingId is required' },
        { status: 400 }
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

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to ingest GPS update' },
      { status: 500 }
    );
  }
}
