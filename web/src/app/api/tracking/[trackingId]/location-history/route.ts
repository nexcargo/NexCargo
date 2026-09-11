// NexCargo MOD-003 — GPS Location History Route (C7-001 Phase 1)
// GET /api/tracking/[trackingId]/location-history
// Returns GPS location updates for a tracking record with pagination

import { NextRequest, NextResponse } from 'next/server';
import { GpsUpdateRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/gps-update-repository';

/**
 * GET /api/tracking/[trackingId]/location-history
 * 
 * Returns GPS location update history sorted by timestamp ascending.
 * 
 * Query params:
 * - limit: number of points to return (default 200)
 */
export async function GET(
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
    console.error('[LocationHistory] Error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch location history' },
      { status: 500 }
    );
  }
}
