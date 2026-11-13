// NexCargo MOD-014 — POST /api/fleet/vehicles
// Register a new vehicle asset for the authenticated transporter.
//
// I-5 §3C: the Transporter registers a vehicle through this route, so the vocabularies and the positive-weight
// rule that the logistics_schema CHECK constraints enforce are checked here too. Without it, an out-of-
// vocabulary type or a zero capacity reached the insert and came back as ERR_9001 — a rejected request
// reported as an application failure instead of as the client error it is.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import {
  PERMIT_STATUSES,
  VEHICLE_AVAILABILITY_STATES,
  VEHICLE_TYPES,
  fleetError,
  handleFleetError,
  readJsonBody,
  requireOwnedFleet,
  textOf,
} from '../fleet-write-guard';

/**
 * POST /api/fleet/vehicles
 * Body: { fleetId, type, registrationNumber, capacityWeightKg, capacityVolumeM3?, insuranceProvider?,
 *         licenceJurisdiction?, crossBorderPermitStatus?, complianceNotes? }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth + RBAC check (TRANSPORTER role required)
    const ctx = await assertApiAuthorization(request, 'fleet_vehicles', 'create');

    const body = await readJsonBody(request);
    if (!body) {
      return fleetError(400, 'ERR_4000', 'A JSON body with a fleetId, type, registrationNumber and capacityWeightKg is required');
    }

    // Validate required fields
    const fleetId = textOf(body.fleetId);
    const registrationNumber = textOf(body.registrationNumber);
    if (!fleetId || !body.type || !registrationNumber || body.capacityWeightKg == null) {
      return fleetError(400, 'ERR_4000', 'Missing required fields: fleetId, type, registrationNumber, capacityWeightKg');
    }

    const repo = new FleetRepository();

    // I-2 item 6 (F-I2-08) + I-5 §3C: the fleet reference is resolved under the caller's own session before
    // anything else about the payload, so an out-of-scope fleet answers 404 whether or not the rest of the
    // body is valid. RLS WITH CHECK refuses the row anyway; the guard is the application half of the same
    // boundary and answers an unreadable fleet and an unowned one identically, so the route cannot be used to
    // probe which fleet ids exist on the platform.
    const owned = await requireOwnedFleet(repo, fleetId, ctx);
    if (!owned.ok) return owned.response;

    const type = textOf(body.type);
    if (!type || !VEHICLE_TYPES.includes(type)) {
      return fleetError(400, 'ERR_4001', `type must be one of ${VEHICLE_TYPES.join(', ')}`);
    }

    // vehicles_capacity_weight_kg_check is `capacity_weight_kg > 0`, and the column is numeric.
    const capacityWeightKg = body.capacityWeightKg;
    if (typeof capacityWeightKg !== 'number' || !Number.isFinite(capacityWeightKg) || capacityWeightKg <= 0) {
      return fleetError(400, 'ERR_4001', 'capacityWeightKg must be a number greater than zero');
    }

    if ('availabilityState' in body && body.availabilityState != null) {
      const state = textOf(body.availabilityState);
      if (!state || !VEHICLE_AVAILABILITY_STATES.includes(state)) {
        return fleetError(400, 'ERR_4001', `availabilityState must be one of ${VEHICLE_AVAILABILITY_STATES.join(', ')}`);
      }
    }

    if ('crossBorderPermitStatus' in body && body.crossBorderPermitStatus != null) {
      const permit = textOf(body.crossBorderPermitStatus);
      if (!permit || !PERMIT_STATUSES.includes(permit)) {
        return fleetError(400, 'ERR_4001', `crossBorderPermitStatus must be one of ${PERMIT_STATUSES.join(', ')}`);
      }
    }

    // Validate Mozambique nationwide licensing rule
    if (body.licenceJurisdiction && String(body.licenceJurisdiction).toLowerCase() === 'mozambique' && !body.licencesValidNationwide) {
      return fleetError(400, 'ERR_4001', 'Licences issued in Mozambique are valid nationwide (licencesValidNationwide must be true)');
    }

    // The remaining fields are forwarded as declared; the columns and the checks above are the boundary.
    const forward = <T,>(value: unknown): T | undefined => value as T | undefined;
    const vehicle = await repo.createVehicle({
      vehicleId: crypto.randomUUID(),
      fleetId,
      type,
      registrationNumber,
      capacityWeightKg,
      capacityVolumeM3: forward<number>(body.capacityVolumeM3) ?? null,
      availabilityState: forward<string>(body.availabilityState) ?? 'AVAILABLE',
      insuranceProvider: forward<string>(body.insuranceProvider) ?? null,
      insurancePolicyNumber: forward<string>(body.insurancePolicyNumber) ?? null,
      insuranceValidUntil: forward<string>(body.insuranceValidUntil) ?? null,
      licenceJurisdiction: forward<string>(body.licenceJurisdiction) ?? null,
      licencesValidNationwide: forward<boolean>(body.licencesValidNationwide) ?? false,
      crossBorderPermitStatus: forward<string>(body.crossBorderPermitStatus) ?? 'NONE',
      complianceNotes: forward<string>(body.complianceNotes) ?? null,
      createdBy: ctx.userId,
    });

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (error) {
    return handleFleetError(error);
  }
}
