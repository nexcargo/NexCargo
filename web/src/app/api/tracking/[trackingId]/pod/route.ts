// NexCargo MOD-003 — POD Submit Route (C7-001 Phase 1)
// POST /api/tracking/[trackingId]/pod
// Submit Proof of Delivery with evidence validation

import { NextRequest, NextResponse } from 'next/server';
import { PodSubmissionService } from '@/modules/mod-003-tracking/application/services/pod-submission-service';
import type { CreatePodParams } from '@/modules/mod-003-tracking/infrastructure/repositories/pod-repository';
import { ValidationError } from '@/shared/errors/app-errors';

/**
 * POST /api/tracking/[trackingId]/pod
 * 
 * Submits POD evidence after validation.
 * Requires authorization via RBAC (DRIVER role).
 * 
 * Body:
 * - trackingId: UUID of tracking record
 * - bookingId: UUID of linked booking
 * - recipientName: text
 * - signatureRef: Supabase Storage file reference (URL or path)
 * - photoRefs: array of Supabase Storage file references
 * - gpsLat: decimal (-90 to 90)
 * - gpsLon: decimal (-180 to 180)
 * 
 * Response:
 * - PodApiShape with id and verificationStatus=PENDING
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
    const {
      bookingId,
      recipientName,
      signatureRef,
      photoRefs,
      gpsLat,
      gpsLon,
    }: Omit<CreatePodParams, 'submissionMethod'> & { submissionMethod?: string } = body;

    // Validate required fields
    if (!bookingId || !recipientName || !signatureRef || !Array.isArray(photoRefs)) {
      return NextResponse.json(
        { error: 'validation_error', message: 'Required fields missing' },
        { status: 400 }
      );
    }

    if (typeof gpsLat !== 'number' || typeof gpsLon !== 'number') {
      return NextResponse.json(
        { error: 'validation_error', message: 'gpsLat and gpsLon are required numbers' },
        { status: 400 }
      );
    }

    // Check photo count requirement
    if (photoRefs.length < 1) {
      return NextResponse.json(
        { error: 'validation_error', message: 'At least one photograph is required' },
        { status: 400 }
      );
    }

    // Submit POD via service
    const podService = new PodSubmissionService();
    const result = await podService.submitPOD({
      trackingId,
      bookingId,
      recipientName,
      signatureRef,
      photoRefs,
      gpsLat,
      gpsLon,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[PodSubmit] Error:', error);
    
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'validation_error', message: error.message, details: error.details },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to submit POD' },
      { status: 500 }
    );
  }
}
