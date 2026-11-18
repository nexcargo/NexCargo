// NexCargo MOD-014 — GET / POST /api/fleet/drivers
// Lists drivers with role-aware filtering, and registers a driver against the caller's own fleet.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuth, assertApiAuthorization } from '@/lib/supabase/api-auth';
import { handleFleetError } from '../fleet-write-guard';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import {
  DRIVER_AVAILABILITY_STATES,
  DRIVER_CERTIFICATIONS,
  fleetError,
  isIsoDate,
  isUuid,
  readJsonBody,
  requireOwnedFleet,
  textOf,
} from '../fleet-write-guard';

/**
 * GET /api/fleet/drivers
 * Query params: fleetId, certificationStatus, availabilityState, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    await assertApiAuth(request);

    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const repo = new FleetRepository();

    const limit = Math.min(Number(params.limit) || 50, 200);
    const offset = Number(params.offset) || 0;

    const data = await repo.listDrivers(
      params.fleetId || undefined,
      params.certificationStatus || undefined,
      params.availabilityState || undefined,
      limit,
      offset,
    );

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleFleetError(error);
  }
}

/**
 * POST /api/fleet/drivers
 * Body: { fleetId, firstName, lastName, licenseType?, licenseNumber?, licenseExpiryDate?,
 *         certificationStatus?, availabilityState?, contactNumber?, platformUserId? }
 *
 * I-5 §3D: a Driver is a record in the Transporter's fleet register, not a marketplace member.
 * PRE-I-6 FINAL COMPLETION DIRECTIVE Item 3: the owning Transporter may optionally associate the
 * record with an existing platform account (platformUserId). The association confers no role —
 * migration 070's driver policies admit a linked account only through an assignment to a shipment,
 * and the account keeps whatever roles it already had. The caller's own session fixes the fleet: an
 * attempt to attach a Driver to a fleet the session does not own is refused with the same 404 as an
 * unknown fleet.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await assertApiAuthorization(request, 'fleet', 'create');

    const body = await readJsonBody(request);
    if (!body) {
      return fleetError(400, 'ERR_4000', 'A JSON body with a fleetId, firstName and lastName is required');
    }
    let platformUserId: string | null = null;
    if (body.platformUserId !== undefined && body.platformUserId !== null) {
      const linked = textOf(body.platformUserId);
      if (!linked || !isUuid(linked)) {
        return fleetError(400, 'ERR_4001', 'platformUserId must be a UUID of an existing platform account');
      }
      platformUserId = linked;
    }

    const firstName = textOf(body.firstName);
    if (!firstName) return fleetError(400, 'ERR_4000', 'firstName is required');
    if (firstName.length > 100) return fleetError(400, 'ERR_4001', 'firstName must be at most 100 characters');

    const lastName = textOf(body.lastName);
    if (!lastName) return fleetError(400, 'ERR_4000', 'lastName is required');
    if (lastName.length > 100) return fleetError(400, 'ERR_4001', 'lastName must be at most 100 characters');

    const fleetId = textOf(body.fleetId);
    if (!fleetId) return fleetError(400, 'ERR_4000', 'fleetId is required');
    const repo = new FleetRepository();
    const owned = await requireOwnedFleet(repo, fleetId, ctx);
    if (!owned.ok) return owned.response;

    const licenseType = textOf(body.licenseType);
    if (licenseType && licenseType.length > 50) {
      return fleetError(400, 'ERR_4001', 'licenseType must be at most 50 characters');
    }
    const licenseNumber = textOf(body.licenseNumber);
    if (licenseNumber && licenseNumber.length > 100) {
      return fleetError(400, 'ERR_4001', 'licenseNumber must be at most 100 characters');
    }
    const contactNumber = textOf(body.contactNumber);
    if (contactNumber && contactNumber.length > 30) {
      return fleetError(400, 'ERR_4001', 'contactNumber must be at most 30 characters');
    }
    const expiry = textOf(body.licenseExpiryDate);
    if (expiry && !isIsoDate(expiry)) {
      return fleetError(400, 'ERR_4001', 'licenseExpiryDate must be a calendar date (YYYY-MM-DD)');
    }

    const certificationStatus = textOf(body.certificationStatus) ?? 'PENDING';
    if (!DRIVER_CERTIFICATIONS.includes(certificationStatus)) {
      return fleetError(400, 'ERR_4001', `certificationStatus must be one of ${DRIVER_CERTIFICATIONS.join(', ')}`);
    }
    const availabilityState = textOf(body.availabilityState) ?? 'AVAILABLE';
    if (!DRIVER_AVAILABILITY_STATES.includes(availabilityState)) {
      return fleetError(400, 'ERR_4001', `availabilityState must be one of ${DRIVER_AVAILABILITY_STATES.join(', ')}`);
    }

    const driver = await repo.createDriver({
      driverId: crypto.randomUUID(),
      fleetId: fleetId as string,
      platformUserId,
      firstName,
      lastName,
      licenseType,
      licenseNumber,
      licenseExpiryDate: expiry,
      certificationStatus,
      availabilityState,
      contactNumber,
      createdBy: ctx.userId,
    });

    return NextResponse.json({ success: true, data: driver }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('drivers_platform_user_id_fkey')) {
      return fleetError(400, 'ERR_4001', 'platformUserId does not reference an existing platform account');
    }
    return handleFleetError(error);
  }
}
