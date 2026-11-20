// NexCargo MOD-014 — guards for the fleet write endpoints I-5 §3C adds.
//
// "A Transporter must only manage its own fleet" is already a database fact: the logistics_schema
// policies pin a fleet write to ownerid = auth.uid() and a vehicle/driver write to a fleet the session
// owns. What these guards add is the application half of the same boundary — the reference is resolved
// under the caller's own session before the mutation, so an out-of-scope id answers with the explicit
// 404 the existing fleet GET already gives instead of a mutation RLS silently rejects. A row that does
// not exist and a row that belongs to another Transporter get one identical answer, so the endpoints
// cannot be used to probe the platform's fleet ids.

import { NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/supabase/api-auth';
import { ValidationError } from '@/shared/errors/app-errors';
import { AssetAvailabilityState, VehicleType } from '@/shared/types/enums';
import {
  CrossBorderPermitStatus,
  DriverAvailabilityState,
  DriverCertificationStatus,
  FleetOperationalStatus,
} from '@/modules/mod-014-fleet-assets/domain/enums';
import type { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';

/** MOD-014 §4.3:277 — the live drivers_availability_state_check accepts exactly these. */
export const DRIVER_AVAILABILITY_STATES = Object.values(DriverAvailabilityState) as string[];

export const VEHICLE_TYPES = Object.values(VehicleType) as string[];
export const VEHICLE_AVAILABILITY_STATES = Object.values(AssetAvailabilityState) as string[];
export const PERMIT_STATUSES = Object.values(CrossBorderPermitStatus) as string[];
export const FLEET_STATUSES = Object.values(FleetOperationalStatus) as string[];
export const DRIVER_CERTIFICATIONS = Object.values(DriverCertificationStatus) as string[];

export type Owned = { ok: true } | { ok: false; response: NextResponse };

/** The error shape every pre-existing fleet route answers with. */
export function fleetError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** Same mapping the delivered fleet routes use, so a 401 or 403 is never surfaced as a 500. */
export function handleFleetError(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return fleetError(400, 'ERR_4001', error.message);
  }
  if (error instanceof Error) {
    if (error.message.includes('asset_assignments_driver_id_fkey')) {
      return fleetError(400, 'ERR_4001', 'driverId does not reference a driver in this session');
    }
    if (error.message.includes('asset_assignments_vehicle_id_fkey')) {
      return fleetError(400, 'ERR_4001', 'vehicleId does not reference a vehicle in this session');
    }
    if (error.message.includes('asset_assignments_shipment_tracking_id_fkey')) {
      return fleetError(400, 'ERR_4001', 'shipmentTrackingId does not reference a tracking record');
    }
    if (error.message.includes('violates foreign key constraint')) {
      return fleetError(400, 'ERR_4001', 'A referenced record does not exist');
    }
    if (error.message.includes('chk_assignment_has_asset')) {
      return fleetError(400, 'ERR_4001', 'At least one of vehicleId or driverId must be provided');
    }
    if (error.message.includes('UNAUTHORIZED')) {
      return fleetError(401, 'ERR_1003', 'Authentication required');
    }
    if (error.message.includes('FORBIDDEN')) {
      return fleetError(403, 'ERR_1004', 'Access denied');
    }
  }
  return fleetError(500, 'ERR_9001', 'Internal server error');
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  return body as Record<string, unknown>;
}

/** A trimmed, non-empty string, or null when the field is absent or blank. */
export function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** logistics_schema.drivers.license_expiry_date is a DATE; an ISO datetime would be rejected by the column. */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** drivers.platform_user_id is a uuid column; reject malformed values before they reach Postgres. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * The fleet a mutation may touch: readable under this session and owned by it. Governance tiers keep
 * their platform-wide reach, exactly as GET /api/fleet does.
 */
export async function requireOwnedFleet(
  repo: FleetRepository,
  fleetId: string | null,
  ctx: AuthContext,
): Promise<Owned> {
  if (!fleetId) {
    return { ok: false, response: fleetError(400, 'ERR_4000', 'fleetId is required') };
  }
  if (ctx.platformRole) {
    return { ok: true };
  }
  const fleet = await repo.getFleetById(fleetId);
  if (!fleet || fleet.ownerId !== ctx.userId) {
    return { ok: false, response: notForThisSession('Fleet') };
  }
  return { ok: true };
}

export async function requireOwnedVehicle(
  repo: FleetRepository,
  vehicleId: string,
  ctx: AuthContext,
): Promise<Owned> {
  if (ctx.platformRole) {
    return { ok: true };
  }
  const vehicle = await repo.getVehicleById(vehicleId);
  if (!vehicle) {
    return { ok: false, response: notForThisSession('Vehicle') };
  }
  return ownedOrFail(repo, vehicle.fleetId, ctx, 'Vehicle');
}

export async function requireOwnedDriver(
  repo: FleetRepository,
  driverId: string,
  ctx: AuthContext,
): Promise<Owned> {
  if (ctx.platformRole) {
    return { ok: true };
  }
  const driver = await repo.getDriverById(driverId);
  if (!driver) {
    return { ok: false, response: notForThisSession('Driver') };
  }
  return ownedOrFail(repo, driver.fleetId, ctx, 'Driver');
}

/**
 * The fleet leg of the check, answered in the entity's own words. A vehicle or driver that belongs to
 * another Transporter must not be distinguishable from one that does not exist, so the fleet's message is
 * never surfaced from here — that would tell a prober which of the two cases it hit.
 */
async function ownedOrFail(
  repo: FleetRepository,
  fleetId: string,
  ctx: AuthContext,
  entity: string,
): Promise<Owned> {
  const owned = await requireOwnedFleet(repo, fleetId, ctx);
  return owned.ok ? owned : { ok: false, response: notForThisSession(entity) };
}

function notForThisSession(entity: string): NextResponse {
  return fleetError(404, 'ERR_1004', `${entity} not found for this session`);
}
