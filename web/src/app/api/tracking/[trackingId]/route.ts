// NexCargo MOD-003 — Tracking Detail Route (C7-001 Phase 1)
// GET /api/tracking/[trackingId]
// Fetch tracking record + latest summary with role-based visibility

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization, authDenialResponse } from '@/lib/supabase/api-auth';
import { TrackingRecordRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';
import { TrackingEventRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-event-repository';
import { GpsUpdateRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/gps-update-repository';

/**
 * GET /api/tracking/[trackingId]
 *
 * Returns the tracking record along with:
 * - Latest event status summary
 * - Last known GPS location (if available)
 *
 * Access controlled by RLS policies on logistics_schema tables.
 *
 * I-2 PART C item 6: RLS alone was not enough here. MOD-010 §4.2 requires role validation on every API
 * request, and an unauthenticated call reached the query layer as the anon role. The resource is the new
 * 'tracking_read' pair, which is the party-scoped read MOD-003 §7.3:995 describes; the row set is still
 * decided by RLS, so this adds a 401/403 signal without widening or narrowing any row.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    await assertApiAuthorization(request, 'tracking_read', 'read');

    const { trackingId } = await params;
    if (!trackingId || typeof trackingId !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'trackingId is required' },
        { status: 400 }
      );
    }

    const trackingRepo = new TrackingRecordRepository();
    const eventRepo = new TrackingEventRepository();
    const gpsRepo = new GpsUpdateRepository();

    // Get tracking record (RLS applied via Supabase client auth session)
    const record = await trackingRepo.getById(trackingId);
    if (!record) {
      return NextResponse.json(
        { error: 'not_found', message: `Tracking record ${trackingId} not found` },
        { status: 404 }
      );
    }

    // Get last 5 events for summary
    const recentEvents = await eventRepo.getHistory(trackingId, 5);

    // Get last GPS location
    const lastGps = await gpsRepo.getLastForTrackingId(trackingId);

    const response = {
      id: record.id,
      trackingRef: record.trackingRef,
      bookingId: record.bookingId,
      contractId: record.contractId,
      status: record.status,
      visibilityLevel: record.visibilityLevel,
      activatedAt: record.activatedAt,
      completedAt: record.completedAt,
      lastUpdated: record.lastUpdated,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      recentEvents: recentEvents.map(e => ({
        eventType: e.eventType,
        stateTo: e.stateTo,
        source: e.source,
        timestamp: e.eventTimestamp,
      })),
      lastKnownLocation: lastGps
        ? { latitude: lastGps.latitude, longitude: lastGps.longitude, timestamp: lastGps.timestamp }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    const denial = authDenialResponse(error);
    if (denial) return denial;
    console.error('[TrackingDetail] Error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch tracking detail' },
      { status: 500 }
    );
  }
}
