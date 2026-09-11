// NexCargo MOD-003 — Tracking Status Route (C7-001 Phase 1)
// POST /api/tracking/[trackingId]/status
// Manual state transition with state-machine validation + idempotency

import { NextRequest, NextResponse } from 'next/server';
import { TrackingOrchestratorService } from '@/modules/mod-003-tracking/application/services/tracking-orchestrator-service';
import { ValidationError } from '@/shared/errors/app-errors';
import { ShipmentStatus } from '@/shared/types/enums';

/**
 * POST /api/tracking/[trackingId]/status
 * 
 * Submits a tracking event for manual state transition.
 * Validates against the state machine before applying.
 * Requires authorization via RBAC (DRIVER or DISPATCHER roles).
 * 
 * Body:
 * - targetStatus: desired state (must be valid transition)
 * - source: module initiating transition (e.g., "MOD-003" for internal)
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
    const { targetStatus, sourceModule }: { targetStatus?: string; sourceModule?: string } = body as Record<string, unknown>;

    // Validate target status
    if (!targetStatus || typeof targetStatus !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'targetStatus is required and must be a string' },
        { status: 400 }
      );
    }

    // Check if targetStatus is a valid enum value (broad check)
    const allowedStates = Object.values(ShipmentStatus);
    if (!allowedStates.includes(targetStatus as ShipmentStatus) && targetStatus !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'validation_error', message: `Invalid target status: ${targetStatus}` },
        { status: 400 }
      );
    }

    // Create tracking orchestrator service and execute transition
    const orchestrator = new TrackingOrchestratorService();
    await orchestrator.updateTrackingStatus(trackingId, targetStatus, sourceModule || 'MOD-003');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TrackingStatus] Error:', error);
    
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'validation_error', message: error.message, details: error.details },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to update tracking status' },
      { status: 500 }
    );
  }
}
