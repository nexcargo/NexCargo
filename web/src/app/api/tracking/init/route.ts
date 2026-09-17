// NexCargo MOD-003 — Tracking Init Route (C7-001 Phase 1)
// POST /api/tracking/init
// Initialize tracking record when a booking reaches CONFIRMED status.
// Privileged manual/recovery endpoint — ADMIN/SUPER_ADMIN only.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TrackingOrchestratorService } from '@/modules/mod-003-tracking/application/services/tracking-orchestrator-service';
import { ValidationError } from '@/shared/errors/app-errors';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

/**
 * POST /api/tracking/init
 * 
 * Privileged recovery endpoint — restricted to ADMIN/SUPER_ADMIN roles.
 * Initializes a tracking record linked to the confirmed booking.
 * NOT used by normal ContractSigned flow (that uses trusted RPC).
 * 
 * Body:
 * - bookingId: UUID of confirmed booking
 * - contractId: Optional contract reference
 * 
 * Response:
 * - TrackingRecordApiShape with id, trackingRef, etc.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth guard: ADMIN/SUPER_ADMIN only
    await assertApiAuthorization(request, 'tracking', 'create');

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

    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { error: 'forbidden', message: error.message },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to initialize tracking record' },
      { status: 500 }
    );
  }
}
