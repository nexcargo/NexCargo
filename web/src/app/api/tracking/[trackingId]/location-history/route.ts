// NexCargo MOD-003 — GPS Location History Route (C7-001 Phase 1)
// GET /api/tracking/[trackingId]/location-history
// Returns GPS location updates for a tracking record with pagination

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization, authDenialResponse } from '@/lib/supabase/api-auth';
import { GpsUpdateRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/gps-update-repository';

/**
 * GET /api/tracking/[trackingId]/location-history
 * 
 * Returns GPS location update history sorted by timestamp ascending.
 * 
 * Query params:
 * - limit: number of points to return (default 200)
 *
 * I-2 PART C item 6: GPS traces are the most sensitive thing MOD-003 §7.3:999 protects, and this route used
 * to answer anonymous callers. Same 'tracking_read' authority as the detail route; the rows remain RLS-scoped.
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

    // Parse query params
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);

    const gpsRepo = new GpsUpdateRepository();
    const locations = await gpsRepo.getHistory(trackingId, limit);

    return NextResponse.json({
      locations: locations.map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: loc.timestamp,
        speedKmh: loc.speedKmh,
        headingDegrees: loc.headingDegrees,
        accuracyMeters: loc.accuracyMeters,
        source: loc.source,
        isOffline: loc.isOffline,
        batteryLevel: loc.batteryLevel,
        createdAt: loc.createdAt,
      })),
      total: locations.length,
    });
  } catch (error) {
    const denial = authDenialResponse(error);
    if (denial) return denial;
    console.error('[LocationHistory] Error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch location history' },
      { status: 500 }
    );
  }
}
