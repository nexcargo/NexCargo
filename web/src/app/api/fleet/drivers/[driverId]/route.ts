// NexCargo MOD-014 — PATCH /api/fleet/drivers/[driverId]
// I-5 §3D: the owning Transporter keeps its driver register current — certification standing, availability
// and licence expiry. Both status vocabularies are the existing MOD-014 §4.3 sets; nothing here creates,
// promotes or links a platform account, and the name and licence identity of a Driver are not editable
// because no governing specification gives a re-identification path.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import {
  DRIVER_AVAILABILITY_STATES,
  DRIVER_CERTIFICATIONS,
  fleetError,
  handleFleetError,
  isIsoDate,
  readJsonBody,
  requireOwnedDriver,
  textOf,
} from '../../fleet-write-guard';

/**
 * PATCH /api/fleet/drivers/[driverId]
 * Body: { certificationStatus?, availabilityState?, licenseExpiryDate? } — at least one. `driverId` is the
 * drivers.id reference the fleet API returns as DriverApiShape.id.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> },
) {
  try {
    const ctx = await assertApiAuthorization(request, 'fleet', 'update');
    const { driverId } = await params;
    const repo = new FleetRepository();

    const owned = await requireOwnedDriver(repo, driverId, ctx);
    if (!owned.ok) return owned.response;

    const body = await readJsonBody(request);
    if (!body) {
      return fleetError(400, 'ERR_4000', 'A JSON body with at least one driver field is required');
    }

    const updates: { certificationStatus?: string; availabilityState?: string; licenseExpiryDate?: string | null } = {};

    if ('certificationStatus' in body) {
      const status = textOf(body.certificationStatus);
      if (!status || !DRIVER_CERTIFICATIONS.includes(status)) {
        return fleetError(400, 'ERR_4001', `certificationStatus must be one of ${DRIVER_CERTIFICATIONS.join(', ')}`);
      }
      updates.certificationStatus = status;
    }

    if ('availabilityState' in body) {
      const state = textOf(body.availabilityState);
      if (!state || !DRIVER_AVAILABILITY_STATES.includes(state)) {
        return fleetError(400, 'ERR_4001', `availabilityState must be one of ${DRIVER_AVAILABILITY_STATES.join(', ')}`);
      }
      updates.availabilityState = state;
    }

    if ('licenseExpiryDate' in body) {
      if (body.licenseExpiryDate === null) {
        updates.licenseExpiryDate = null;
      } else {
        const expiry = textOf(body.licenseExpiryDate);
        if (!expiry || !isIsoDate(expiry)) {
          return fleetError(400, 'ERR_4001', 'licenseExpiryDate must be a calendar date (YYYY-MM-DD)');
        }
        updates.licenseExpiryDate = expiry;
      }
    }

    if (Object.keys(updates).length === 0) {
      return fleetError(400, 'ERR_4000', 'At least one of certificationStatus, availabilityState or licenseExpiryDate is required');
    }

    const driver = await repo.updateDriver(driverId, updates);
    return NextResponse.json({ success: true, data: driver }, { status: 200 });
  } catch (error) {
    return handleFleetError(error);
  }
}
