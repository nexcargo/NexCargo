// NexCargo MOD-003 — Tracking All Records Route (C7-001 Phase 2)
// GET /api/tracking/all
// Minimal read-only endpoint to list active tracking records for dispatcher view
// Uses existing Phase 1 TrackingRecordRepository; no new business logic
//
// I-2 PART C item 6: "all" describes the shape of the query, not the caller's reach. MOD-003 §7.3:999
// forbids exposing another customer's operational data, so the endpoint is authorized as a tracking read and
// the row set is whatever the caller's own RLS scope admits — their own bookings for a participant, the
// delegating Transporter's rows for a delegated Dispatcher.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization, authDenialResponse } from '@/lib/supabase/api-auth';
import { TrackingRecordRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';

export async function GET(request: NextRequest) {
  try {
    const ctx = await assertApiAuthorization(request, 'tracking_read', 'read');

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100') || 100, 500);
    const offset = parseInt(searchParams.get('offset') ?? '0') || 0;

    const repo = new TrackingRecordRepository();

    // listByShipper takes the requesting account for signature compatibility only; access is enforced by RLS.
    const records = await repo.listByShipper(ctx.userId, limit, offset);

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
    const denial = authDenialResponse(error);
    if (denial) return denial;
    console.error('[TrackingAll] Error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch tracking records' },
      { status: 500 }
    );
  }
}
