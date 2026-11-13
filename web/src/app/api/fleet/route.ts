// NexCargo MOD-014 — GET / POST /api/fleet
// Retrieves fleet, vehicle, and driver data with role-aware filtering, and registers a new fleet.
//
// I-2 PART C item 6 (F-I2-08): the owner scope comes from the session, never from a query parameter. A
// governance tier may still filter by an explicit ownerId because its rows are platform-wide; an operating
// Transporter is pinned to their own account and a delegated Dispatcher to the Transporter that delegated to
// them. RLS enforces the same row boundary underneath, so this is the backend half of "enforce delegated
// scope through backend authorization and RLS" rather than a second opinion on it.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization, type AuthContext } from '@/lib/supabase/api-auth';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { fleetError, readJsonBody, textOf } from './fleet-write-guard';

/**
 * GET /api/fleet
 * Query params: entity (fleets|vehicles|drivers), ownerId (governance only), fleetId, type,
 * certificationStatus, availabilityState, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const entity = (params.entity as string) ?? 'fleets';

    // Authorize first. Vehicles are their own resource because migration 045 gates them on the same
    // 'operational_read' scope; drivers are part of a fleet read, which is what 045's driver policy does too.
    const resource = entity === 'vehicles' ? 'fleet_vehicles' : 'fleet';
    const ctx = await assertApiAuthorization(request, resource, 'read');

    const repo = new FleetRepository();
    const limit = Math.min(Number(params.limit) || 50, 200);
    const offset = Number(params.offset) || 0;
    const ownerScope = resolveOwnerScope(ctx, params.ownerId);

    if (entity === 'vehicles') {
      const denied = await assertFleetReadable(repo, params.fleetId, ctx);
      if (denied) return denied;
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
      const denied = await assertFleetReadable(repo, params.fleetId, ctx);
      if (denied) return denied;
      const data = await repo.listDrivers(
        params.fleetId || undefined,
        params.certificationStatus || undefined,
        params.availabilityState || undefined,
        limit,
        offset,
      );
      return NextResponse.json({ success: true, data }, { status: 200 });
    }

    // Default: fleets. A non-governance caller's filter is their own session owner, whatever they asked for.
    const data = await repo.listFleets(ownerScope || undefined, limit, offset);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleFleetError(error);
  }
}

/**
 * POST /api/fleet
 * Body: { name, region? } — I-5 §3C. The owner is always the session user: a body claiming another
 * ownerId is ignored, because membership and ownership are not client-supplied (§4) and the RLS
 * WITH CHECK would reject the row anyway.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await assertApiAuthorization(request, 'fleet', 'create');
    const body = await readJsonBody(request);
    if (!body) {
      return fleetError(400, 'ERR_4000', 'A JSON body with a fleet name is required');
    }

    const name = textOf(body.name);
    if (!name) {
      return fleetError(400, 'ERR_4000', 'name is required');
    }
    if (name.length > 200) {
      return fleetError(400, 'ERR_4001', 'name must be at most 200 characters');
    }
    const region = textOf(body.region);
    if (region && region.length > 100) {
      return fleetError(400, 'ERR_4001', 'region must be at most 100 characters');
    }

    const repo = new FleetRepository();
    const fleet = await repo.createFleet({
      fleetId: crypto.randomUUID(),
      name,
      region: region ?? undefined,
      ownerId: ctx.userId,
    });

    return NextResponse.json({ success: true, data: fleet }, { status: 201 });
  } catch (error) {
    return handleFleetError(error);
  }
}

/**
 * The ownerId a query may use. Governance keeps its explicit filter; everyone else is pinned to the account
 * that actually owns the rows — for a Dispatcher that is the delegating Transporter, per AuthContext.delegation.
 */
function resolveOwnerScope(ctx: AuthContext, requestedOwnerId?: string): string | null {
  if (ctx.platformRole) {
    return requestedOwnerId ?? null;
  }
  if (!ctx.marketplaceRole && ctx.delegation) {
    return ctx.delegation.principalTransporterUserId;
  }
  return ctx.userId;
}

/**
 * A fleet-scoped list is only as private as the fleet reference. RLS already denies rows outside the
 * caller's scope, but it answers an unknown fleet and an unreadable one the same way — with nothing. For a
 * non-governance caller the fleet is resolved under their own session first, so the answer is an explicit 404
 * instead of a silently empty list.
 */
async function assertFleetReadable(
  repo: FleetRepository,
  fleetId: string | undefined,
  ctx: AuthContext,
): Promise<NextResponse | null> {
  if (!fleetId || ctx.platformRole) {
    return null;
  }
  const fleet = await repo.getFleetById(fleetId);
  if (fleet) {
    return null;
  }
  return NextResponse.json(
    { success: false, error: { code: 'ERR_1004', message: 'Fleet not found for this session' } },
    { status: 404 },
  );
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
