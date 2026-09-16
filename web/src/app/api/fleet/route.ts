// NexCargo MOD-014 — GET /api/fleet
// Retrieves fleet, vehicle, and driver data with role-aware filtering.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuth } from '@/lib/supabase/api-auth';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';

/**
 * GET /api/fleet
 * Query params: entity (fleets|vehicles|drivers), ownerId, fleetId, type, certificationStatus, availabilityState, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate first
    const authResult = await assertApiAuth(request);

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const repo = new FleetRepository();

    const entity = (params.entity as string) ?? 'fleets';
    const limit = Math.min(Number(params.limit) || 50, 200);
    const offset = Number(params.offset) || 0;

    if (entity === 'vehicles') {
      const data = await repo.listVehicles(
        params.fleetId || undefined,
        params.type || undefined,
        params.availabilityState || undefined,
        limit,
        offset,
      );
      return NextResponse.json({ success: true, data }, { status: 200 });
    }

    if (entity === 'drivers') {
      const data = await repo.listDrivers(
        params.fleetId || undefined,
        params.certificationStatus || undefined,
        params.availabilityState || undefined,
        limit,
        offset,
      );
      return NextResponse.json({ success: true, data }, { status: 200 });
    }

    // Default: fleets
    const data = await repo.listFleets(
      params.ownerId || undefined,
      limit,
      offset,
    );
    return NextResponse.json({ success: true, data }, { status: 200 });
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
