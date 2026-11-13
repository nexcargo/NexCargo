// NexCargo MOD-014 — PATCH /api/fleet/[fleetId]
// I-5 §3B/§3C: a Transporter edits the display name, operating region and operational status of a fleet it
// owns. These are the attributes MOD-014 §4.1 lets the owning Transporter declare; ownership, the owner's
// account and the fleet reference itself are not editable through this route, and the lifecycle vocabulary
// is the existing FleetOperationalStatus — no new fleet status is introduced.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import {
  FLEET_STATUSES,
  fleetError,
  handleFleetError,
  readJsonBody,
  requireOwnedFleet,
  textOf,
} from '../fleet-write-guard';

/**
 * PATCH /api/fleet/[fleetId]
 * Body: { name?, region?, operationalStatus? } — at least one. `fleetId` is the fleets.id reference the
 * rest of the fleet API already uses (GET /api/fleet?entity=vehicles&fleetId=…).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fleetId: string }> },
) {
  try {
    const ctx = await assertApiAuthorization(request, 'fleet', 'update');
    const { fleetId } = await params;
    const repo = new FleetRepository();

    const owned = await requireOwnedFleet(repo, fleetId, ctx);
    if (!owned.ok) return owned.response;

    const body = await readJsonBody(request);
    if (!body) {
      return fleetError(400, 'ERR_4000', 'A JSON body with at least one fleet field is required');
    }

    const updates: { name?: string; region?: string | null; operationalStatus?: string } = {};

    if ('name' in body) {
      const name = textOf(body.name);
      if (!name) return fleetError(400, 'ERR_4000', 'name must not be empty');
      if (name.length > 200) return fleetError(400, 'ERR_4001', 'name must be at most 200 characters');
      updates.name = name;
    }

    if ('region' in body) {
      if (body.region === null) {
        updates.region = null;
      } else if (typeof body.region !== 'string') {
        return fleetError(400, 'ERR_4001', 'region must be a string or null');
      } else {
        const region = body.region.trim();
        if (region.length > 100) {
          return fleetError(400, 'ERR_4001', 'region must be at most 100 characters');
        }
        // An empty string is how the UI clears the region; the column is nullable, so it is stored as null.
        updates.region = region === '' ? null : region;
      }
    }

    if ('operationalStatus' in body) {
      const status = textOf(body.operationalStatus);
      if (!status || !FLEET_STATUSES.includes(status)) {
        return fleetError(400, 'ERR_4001', `operationalStatus must be one of ${FLEET_STATUSES.join(', ')}`);
      }
      updates.operationalStatus = status;
    }

    if (Object.keys(updates).length === 0) {
      return fleetError(400, 'ERR_4000', 'At least one of name, region or operationalStatus is required');
    }

    const fleet = await repo.updateFleet(fleetId, updates);
    return NextResponse.json({ success: true, data: fleet }, { status: 200 });
  } catch (error) {
    return handleFleetError(error);
  }
}
