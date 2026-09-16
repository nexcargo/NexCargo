// NexCargo MOD-014 — POST /api/fleet/vehicles
// Register a new vehicle asset for the authenticated transporter.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { ValidationError } from '@/shared/errors/app-errors';

/**
 * POST /api/fleet/vehicles
 * Body: { fleetId, type, registrationNumber, capacityWeightKg, capacityVolumeM3?, insuranceProvider?,
 *         licenceJurisdiction?, crossBorderPermitStatus?, complianceNotes? }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth + RBAC check (TRANSPORTER role required)
    const ctx = await assertApiAuthorization(request, 'fleet_vehicles', 'create');

    const body = await request.json();

    // Validate required fields
    if (!body.fleetId || !body.type || !body.registrationNumber || body.capacityWeightKg == null) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_4000', message: 'Missing required fields: fleetId, type, registrationNumber, capacityWeightKg' } },
        { status: 400 }
      );
    }

    // Validate Mozambique nationwide licensing rule
    if (body.licenceJurisdiction && body.licenceJurisdiction.toLowerCase() === 'mozambique' && !body.licencesValidNationwide) {
      return NextResponse.json(
        { success: false, error: { code: 'ERR_4001', message: 'Licences issued in Mozambique are valid nationwide (licencesValidNationwide must be true)' } },
        { status: 400 }
      );
    }

    const repo = new FleetRepository();
    const vehicle = await repo.createVehicle({
      vehicleId: crypto.randomUUID(),
      fleetId: body.fleetId,
      type: body.type,
      registrationNumber: body.registrationNumber,
      capacityWeightKg: body.capacityWeightKg,
      capacityVolumeM3: body.capacityVolumeM3 ?? null,
      availabilityState: body.availabilityState ?? 'AVAILABLE',
      insuranceProvider: body.insuranceProvider ?? null,
      insurancePolicyNumber: body.insurancePolicyNumber ?? null,
      insuranceValidUntil: body.insuranceValidUntil ?? null,
      licenceJurisdiction: body.licenceJurisdiction ?? null,
      licencesValidNationwide: body.licencesValidNationwide ?? false,
      crossBorderPermitStatus: body.crossBorderPermitStatus ?? 'NONE',
      complianceNotes: body.complianceNotes ?? null,
      createdBy: ctx.userId,
    });

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
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
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: { code: 'ERR_4001', message: error.message } }, { status: 400 });
    }
  }
  return NextResponse.json({ success: false, error: { code: 'ERR_9001', message: 'Internal server error' } }, { status: 500 });
}
