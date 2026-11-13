// NexCargo MOD-014 — PATCH /api/fleet/vehicles/[vehicleId]
// I-5 §3C: a Transporter declares the availability state and cross-border permit standing of a vehicle in
// its own fleet. MOD-014 §4.2 states "Asset statuses are declared by the transporter", and both vocabularies
// are the existing ones — no new lifecycle status is introduced. Identity-bearing attributes (registration
// number, capacities, insurance) are set when the vehicle is registered and are not editable here, because no
// governing specification gives a Transporter a re-registration path.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import {
  PERMIT_STATUSES,
  VEHICLE_AVAILABILITY_STATES,
  fleetError,
  handleFleetError,
  readJsonBody,
  requireOwnedVehicle,
  textOf,
} from '../../fleet-write-guard';

/**
 * PATCH /api/fleet/vehicles/[vehicleId]
 * Body: { availabilityState?, crossBorderPermitStatus?, complianceNotes? } — at least one. `vehicleId` is the
 * vehicles.id reference the fleet API returns as VehicleApiShape.id.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  try {
    const ctx = await assertApiAuthorization(request, 'fleet_vehicles', 'update');
    const { vehicleId } = await params;
    const repo = new FleetRepository();

    const owned = await requireOwnedVehicle(repo, vehicleId, ctx);
    if (!owned.ok) return owned.response;

    const body = await readJsonBody(request);
    if (!body) {
      return fleetError(400, 'ERR_4000', 'A JSON body with at least one vehicle field is required');
    }

    const updates: { availabilityState?: string; crossBorderPermitStatus?: string; complianceNotes?: string } = {};

    if ('availabilityState' in body) {
      const state = textOf(body.availabilityState);
      if (!state || !VEHICLE_AVAILABILITY_STATES.includes(state)) {
        return fleetError(400, 'ERR_4001', `availabilityState must be one of ${VEHICLE_AVAILABILITY_STATES.join(', ')}`);
      }
      updates.availabilityState = state;
    }

    if ('crossBorderPermitStatus' in body) {
      const permit = textOf(body.crossBorderPermitStatus);
      if (!permit || !PERMIT_STATUSES.includes(permit)) {
        return fleetError(400, 'ERR_4001', `crossBorderPermitStatus must be one of ${PERMIT_STATUSES.join(', ')}`);
      }
      updates.crossBorderPermitStatus = permit;
    }

    if ('complianceNotes' in body) {
      if (body.complianceNotes !== null && typeof body.complianceNotes !== 'string') {
        return fleetError(400, 'ERR_4001', 'complianceNotes must be a string or null');
      }
      // The repository leaves an undefined field alone, so clearing the notes is a write of the empty string.
      updates.complianceNotes = typeof body.complianceNotes === 'string' ? body.complianceNotes : '';
    }

    if (Object.keys(updates).length === 0) {
      return fleetError(400, 'ERR_4000', 'At least one of availabilityState, crossBorderPermitStatus or complianceNotes is required');
    }

    const vehicle = await repo.updateVehicle(vehicleId, updates);
    return NextResponse.json({ success: true, data: vehicle }, { status: 200 });
  } catch (error) {
    return handleFleetError(error);
  }
}
