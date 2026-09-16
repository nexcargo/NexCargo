// NexCargo MOD-003 — Transporter Trips List Route (C7-001 Phase 2)
// GET /api/tracking/transporter-trips
// Minimal read-only endpoint for transporter active-trips view
// Uses existing Phase 1 TrackingRecordRepository; no new business logic

import { NextResponse } from 'next/server';
import { TrackingRecordRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';

export async function GET() {
  try {
    const repo = new TrackingRecordRepository();

    // Fetch all non-completed, non-cancelled tracking records as "active trips"
    const records = await repo.listByTransporter('all', 50, 0);

    if (!records || records.length === 0) {
      return NextResponse.json([]);
    }

    // Filter to active states only (exclude terminal states)
    const activeTrips = records.filter((r) =>
      !['COMPLETED', 'CANCELLED'].includes(r.status)
    );

    // Map to minimal display shape for transport table
    const result = activeTrips.map((record) => ({
      trackingId: record.id,
      trackingRef: record.trackingRef,
      status: record.status,
      driverName: undefined,
      vehiclePlate: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[TransporterTrips] Error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch transporter trips' },
      { status: 500 }
    );
  }
}
