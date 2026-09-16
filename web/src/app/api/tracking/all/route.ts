// NexCargo MOD-003 — Tracking All Records Route (C7-001 Phase 2)
// GET /api/tracking/all
// Minimal read-only endpoint to list active tracking records for dispatcher view
// Uses existing Phase 1 TrackingRecordRepository; no new business logic

import { NextRequest, NextResponse } from 'next/server';
import { TrackingRecordRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100') || 100, 500);
    const offset = parseInt(searchParams.get('offset') ?? '0') || 0;

    const repo = new TrackingRecordRepository();

    // Use listByShipper — RLS will enforce session-based access control
    const records = await repo.listByShipper('all', limit, offset);

    if (!records || records.length === 0) {
      return NextResponse.json([]);
    }

    // Apply status filter in-memory if provided
    const filtered = statusFilter
      ? records.filter((r) => r.status === statusFilter)
      : records;

    // Map to minimal display shape
    const result = filtered.map((record) => ({
      trackingId: record.id,
      trackingRef: record.trackingRef,
      status: record.status,
      bookingId: record.bookingId,
      contractId: record.contractId,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[TrackingAll] Error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch tracking records' },
      { status: 500 }
    );
  }
}
