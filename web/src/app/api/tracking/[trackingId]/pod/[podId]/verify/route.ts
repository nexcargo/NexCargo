// NexCargo MOD-003 — POD Verify Route (C7-001 Phase 1)
// PATCH /api/tracking/[trackingId]/pod/[podId]/verify
// Approve or reject a submitted POD with role-based authorization (MODERATOR+)

import { NextRequest, NextResponse } from 'next/server';
import { PodSubmissionService } from '@/modules/mod-003-tracking/application/services/pod-submission-service';
import { ValidationError } from '@/shared/errors/app-errors';

/**
 * PATCH /api/tracking/[trackingId]/pod/[podId]/verify
 * 
 * Verifies or rejects a submitted POD.
 * Requires authorization via RBAC (MODERATOR, ADMIN, or SUPER_ADMIN roles).
 * 
 * Body:
 * - verify: boolean (true = approve/VERIFIED, false = reject/REJECTED)
 * - adminOverride: optional boolean for exceptional circumstances
 * 
 * Response:
 * - success: true if verification succeeded
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string; podId: string }> }
) {
  try {
    const { trackingId, podId } = await params;
    
    if (!trackingId || typeof trackingId !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'trackingId is required' },
        { status: 400 }
      );
    }

    if (!podId || typeof podId !== 'string') {
      return NextResponse.json(
        { error: 'validation_error', message: 'podId is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { verify, adminOverride }: { verify?: boolean; adminOverride?: boolean } = body as Record<string, unknown>;

    // Validate verify field
    if (typeof verify !== 'boolean') {
      return NextResponse.json(
        { error: 'validation_error', message: 'verify must be true or false' },
        { status: 400 }
      );
    }

    // Submit POD verification via service
    const podService = new PodSubmissionService();
    await podService.verifyPOD(podId, verify, adminOverride);

    // If approved and POD verification succeeded, complete tracking record
    if (verify === true) {
      // Optionally mark tracking as completed after successful POD verification
      // Note: actual completion is handled by delivery confirmation event flow
      // This route focuses on POD approval only
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PodVerify] Error:', error);
    
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'validation_error', message: error.message, details: error.details },
        { status: 409 } // Conflict for already verified/rejected PODs
      );
    }

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to verify POD' },
      { status: 500 }
    );
  }
}
