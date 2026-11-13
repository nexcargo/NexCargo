// NexCargo MOD-003 — Tracking Events Route (C7-001 Phase 1)
// GET /api/tracking/[trackingId]/events
// Paginated event history with role-based visibility

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization, authDenialResponse } from '@/lib/supabase/api-auth';
import { TrackingEventRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-event-repository';

/**
 * GET /api/tracking/[trackingId]/events
 * 
 * Returns paginated tracking event history.
 * 
 * Query params:
 * - limit: number of events to return (default 50, max 200)
 * - offset: page offset (default 0)
 *
 * I-2 PART C item 6: gated like the tracking detail route (MOD-010 §4.2 requires the role check; the event
 * rows stay scoped by RLS).
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
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const eventRepo = new TrackingEventRepository();
    const events = await eventRepo.getHistory(trackingId, limit, offset);

    return NextResponse.json({
      events: events.map(e => ({
        id: e.id,
        eventType: e.eventType,
        source: e.source,
        stateFrom: e.stateFrom,
        stateTo: e.stateTo,
        metadata: e.metadata,
        timestamp: e.eventTimestamp,
      })),
      total: events.length,
      hasMore: events.length === limit,
    });
  } catch (error) {
    const denial = authDenialResponse(error);
    if (denial) return denial;
    console.error('[TrackingEvents] Error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch tracking events' },
      { status: 500 }
    );
  }
}
