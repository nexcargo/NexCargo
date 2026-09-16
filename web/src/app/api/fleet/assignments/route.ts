// NexCargo MOD-014 — GET / PATCH /api/fleet/assignments
// GET: List asset assignments.
// PATCH: Create or update asset assignments.
// Separate from MOD-002 driver_assignments (ODD-7 decision).

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuth, assertApiAuthorization } from '@/lib/supabase/api-auth';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { applyAssignmentTransition, validateAssignmentTimeWindow } from '@/modules/mod-014-fleet-assets/domain/services/asset-state-machine';
import { AssignmentStatus } from '@/modules/mod-014-fleet-assets/domain/enums';

/**
 * GET /api/fleet/assignments
 * Query params: vehicleId, driverId, shipmentTrackingId, status, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    await assertApiAuth(request);

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const repo = new FleetRepository();

    const limit = Math.min(Number(params.limit) || 50, 200);
    const offset = Number(params.offset) || 0;

    const data = await repo.listAssignments(
      params.vehicleId || undefined,
      params.driverId || undefined,
      params.shipmentTrackingId || undefined,
      params.status || undefined,
      limit,
      offset,
    );

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleFleetError(error);
  }
}

/**
 * PATCH /api/fleet/assignments
 * Body: { action: 'create' | 'update', id?, vehicleId?, driverId?, shipmentTrackingId?, status?, scheduledStart?, scheduledEnd?, notes? }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Auth + RBAC
    const ctx = await assertApiAuthorization(request, 'fleet_assignments', 'update');

    const body = await request.json();
    const repo = new FleetRepository();

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_4000', message: 'Action is required: create or update' } },
        { status: 400 }
      );
    }

    if (body.action === 'create') {
      if (!body.shipmentTrackingId) {
        return NextResponse.json(
          { success: false, error: { code: 'ERR_4000', message: 'shipmentTrackingId is required for create' } },
          { status: 400 }
        );
      }

      // Validate at least one asset
      if (!body.vehicleId && !body.driverId) {
        return NextResponse.json(
          { success: false, error: { code: 'ERR_4000', message: 'At least one of vehicleId or driverId must be provided' } },
          { status: 400 }
        );
      }

      // Validate time window if provided
      if (body.scheduledStart && body.scheduledEnd) {
        const timeResult = validateAssignmentTimeWindow({
          startTime: new Date(body.scheduledStart),
          endTime: new Date(body.scheduledEnd),
        });
        if (!timeResult.isValid) {
          return NextResponse.json(
            { success: false, error: { code: 'ERR_4001', message: timeResult.errors[0] } },
            { status: 400 }
          );
        }
      }

      const assignment = await repo.createAssignment({
        assignmentId: crypto.randomUUID(),
        vehicleId: body.vehicleId || null,
        driverId: body.driverId || null,
        shipmentTrackingId: body.shipmentTrackingId,
        status: (body.status ?? 'PLANNED') as AssignmentStatus,
        scheduledStart: body.scheduledStart || null,
        scheduledEnd: body.scheduledEnd || null,
        notes: body.notes ?? null,
        createdBy: ctx.userId,
      });

      return NextResponse.json({ success: true, data: assignment }, { status: 201 });
    }

    if (body.action === 'update') {
      if (!body.id) {
        return NextResponse.json(
          { success: false, error: { code: 'ERR_4000', message: 'id is required for update' } },
          { status: 400 }
        );
      }

      // Validate state transition if changing status
      if (body.status) {
        const existing = await repo.getAssignmentById(body.id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: { code: 'ERR_4004', message: 'Assignment not found' } },
            { status: 404 }
          );
        }

        const currentStatus = existing.status as AssignmentStatus;
        const targetStatus = body.status as AssignmentStatus;
        
        if (!applyAssignmentTransition(currentStatus, targetStatus)) {
          return NextResponse.json(
            { success: false, error: { code: 'ERR_4002', message: `Invalid transition from ${currentStatus} to ${targetStatus}` } },
            { status: 400 }
          );
        }
      }

      const assignment = await repo.updateAssignment(body.id, {
        status: body.status,
        scheduledStart: body.scheduledStart || null,
        scheduledEnd: body.scheduledEnd || null,
        actualStart: body.actualStart || null,
        actualEnd: body.actualEnd || null,
        notes: body.notes,
      });

      return NextResponse.json({ success: true, data: assignment }, { status: 200 });
    }

    return NextResponse.json(
      { success: false, error: { code: 'ERR_4000', message: 'Unknown action' } },
      { status: 400 }
    );
  } catch (error) {
    return handleFleetError(error);
  }
}

function handleFleetError(error: unknown): NextResponse {
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: { code: 'ERR_1003', message: 'Authentication required' } }, { status: 401 });
    }
    if (message.includes('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: { code: 'ERR_1004', message: 'Access denied' } }, { status: 403 });
    }
  }
  return NextResponse.json({ success: false, error: { code: 'ERR_9001', message: 'Internal server error' } }, { status: 500 });
}
