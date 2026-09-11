// NexCargo MOD-003 — Tracking Init Route (C7-001 Phase 1)
// POST /api/tracking/init
// Initialize tracking record when a booking reaches CONFIRMED status.
// Internal webhook from booking confirmation flow.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TrackingOrchestratorService } from '@/modules/mod-003-tracking/application/services/tracking-orchestrator-service';
import { ValidationError } from '@/shared/errors/app-errors';

/**
 * POST /api/tracking/init
 * 
 * Internal endpoint called after booking confirmation succeeds.
 * Initializes a tracking record linked to the confirmed booking.
 * 
 * Body:
 * - bookingId: UUID of confirmed booking
 * - contractId: Optional contract reference (nullable until contract pipeline operational)
 * 
 * Response:
 * - TrackingRecordApiShape with id, trackingRef, etc.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const bookingId = (body as Record<string, unknown>).bookingId as string;
    const contractId = (body as Record<string, unknown>).contractId as string | null | undefined;

    // Validate required fields
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'bookingId is required and must be a string' },
        { status: 400 }
      );
    }

    // Create tracking record via orchestrator service
    const orchestrator = new TrackingOrchestratorService();
    const result = await orchestrator.initializeTracking(bookingId, contractId ?? undefined);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[TrackingInit] Error:', error);
    
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'validation_error', message: error.message, details: error.details },
        { status: 409 } // Conflict for duplicate initialization
      );
    }

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to initialize tracking record' },
      { status: 500 }
    );
  }
}
