// NexCargo F-I5-04 — vehicle updated_at correctness at the persistence boundary.
//
// These tests run the REAL FleetRepository against a stubbed Supabase client that captures the exact
// UPDATE/INSERT payloads, under a controlled clock (vi.setSystemTime — no sleeps). What is proved here is
// the application half: a successful update carries a server-generated updated_at, a client cannot supply
// or overwrite it, failures return no record, and reads/inserts keep their existing timestamp behavior.
// The database half (column DEFAULT, absence of triggers, RLS) is verified separately against the live
// project; nothing here is RLS proof.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const VEHICLE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const FLEET_ID = 'ffffffff-1111-2222-3333-444444444444';
const OWNER = 'e0fe13fd-6606-475f-a945-0a35ad879f27';
const PRIOR_UPDATED_AT = '2026-11-11T15:03:15.493Z';
const CLOCK_1 = '2026-11-16T12:00:00.000Z';
const CLOCK_2 = '2026-11-16T12:00:01.000Z';

const ROW = {
  id: VEHICLE_ID,
  vehicle_id: '37f9232a-fdf5-4bc7-ac6e-0902a6aa1f77',
  fleet_id: FLEET_ID,
  type: 'TRUCK',
  registration_number: 'FI504-TEST',
  capacity_weight_kg: 1000,
  capacity_volume_m3: null,
  availability_state: 'AVAILABLE',
  insurance_provider: null,
  insurance_policy_number: null,
  insurance_valid_until: null,
  licence_jurisdiction: null,
  licences_valid_nationwide: false,
  cross_border_permit_status: 'NONE',
  compliance_notes: null,
  created_by: OWNER,
  created_at: PRIOR_UPDATED_AT,
  updated_at: PRIOR_UPDATED_AT,
};

let updatePayloads: Array<Record<string, unknown>> = [];
let insertPayloads: Array<Record<string, unknown>> = [];
let updateResult: { data: unknown; error: { message: string } | null };
let readResult: { data: unknown; error: { message: string } | null };

function vehiclesQuery(): any {
  const q: any = {
    update: (payload: Record<string, unknown>) => { updatePayloads.push(payload); return q; },
    insert: (payload: Record<string, unknown>) => { insertPayloads.push(payload); return q; },
    select: () => q,
    eq: () => q,
    order: () => q,
    range: () => q,
    single: async () => updateResult,
    maybeSingle: async () => readResult,
    // listVehicles awaits the builder itself (no terminal single/maybeSingle).
    then: (resolve: (v: unknown) => void) => resolve({ data: [ROW], error: null }),
  };
  return q;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    schema: () => ({ from: () => vehiclesQuery() }),
    from: () => vehiclesQuery(),
  })),
}));

import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(CLOCK_1));
  updatePayloads = [];
  insertPayloads = [];
  // The stub persists what the payload declares, mirroring a successful UPDATE ... RETURNING.
  updateResult = { data: { ...ROW }, error: null };
  readResult = { data: { ...ROW }, error: null };
});

afterEach(() => {
  vi.useRealTimers();
});

/** Make the stub echo the payload's business fields and timestamp back as the persisted row. */
function persistPayload() {
  const original = updateResult;
  updateResult = {
    get data() {
      const p = updatePayloads[updatePayloads.length - 1] ?? {};
      return { ...ROW, ...p };
    },
    error: original.error,
  } as any;
}

describe('F-I5-04 §6.1 — a successful vehicle update advances updated_at', () => {
  it('sends a server-generated updated_at equal to the controlled clock, later than the prior value', async () => {
    persistPayload();
    const repo = new FleetRepository();
    const result = await repo.updateVehicle(VEHICLE_ID, { availabilityState: 'MAINTENANCE' });

    expect(updatePayloads).toHaveLength(1);
    const payload = updatePayloads[0];
    expect(payload['availability_state']).toBe('MAINTENANCE');
    expect(payload['updated_at']).toBe(CLOCK_1);
    expect(Date.parse(payload['updated_at'] as string)).toBeGreaterThan(Date.parse(PRIOR_UPDATED_AT));
    // The returned record reflects the persisted timestamp, not the stale pre-update value.
    expect(result.updatedAt).toBe(CLOCK_1);
    expect(result.availabilityState).toBe('MAINTENANCE');
    // No business field beyond the declared one is touched.
    expect(Object.keys(payload).sort()).toEqual(['availability_state', 'updated_at']);
  });

  it('advances monotonically across consecutive updates under an advancing controlled clock', async () => {
    persistPayload();
    const repo = new FleetRepository();
    await repo.updateVehicle(VEHICLE_ID, { complianceNotes: 'first' });
    vi.setSystemTime(new Date(CLOCK_2));
    await repo.updateVehicle(VEHICLE_ID, { complianceNotes: 'second' });

    expect(updatePayloads).toHaveLength(2);
    expect(updatePayloads[0]['updated_at']).toBe(CLOCK_1);
    expect(updatePayloads[1]['updated_at']).toBe(CLOCK_2);
    expect(Date.parse(updatePayloads[1]['updated_at'] as string)).toBeGreaterThan(Date.parse(updatePayloads[0]['updated_at'] as string));
  });
});

describe('F-I5-04 §6.1/§4.1 — the timestamp is never client-controlled', () => {
  it('ignores injected updated_at/updatedAt and ownership fields even if they reach the repository input', async () => {
    persistPayload();
    const repo = new FleetRepository();
    await repo.updateVehicle(VEHICLE_ID, {
      availabilityState: 'AVAILABLE',
      updated_at: '1999-01-01T00:00:00.000Z',
      updatedAt: '1999-01-01T00:00:00.000Z',
      transporter_id: 'attacker-id',
      fleet_id: 'foreign-fleet',
      created_by: 'attacker-id',
    } as any);

    const payload = updatePayloads[0];
    expect(payload['updated_at']).toBe(CLOCK_1);
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('transporter_id');
    expect(payload).not.toHaveProperty('fleet_id');
    expect(payload).not.toHaveProperty('created_by');
    expect(Object.keys(payload).sort()).toEqual(['availability_state', 'updated_at']);
  });
});

describe('F-I5-04 §6.2 — failures produce no success and no misleading timestamp', () => {
  it('throws on a database/RLS rejection and returns no record', async () => {
    updateResult = { data: null, error: { message: 'permission denied for table vehicles' } };
    const repo = new FleetRepository();
    await expect(repo.updateVehicle(VEHICLE_ID, { availabilityState: 'MAINTENANCE' })).rejects.toThrow('Failed to update vehicle');
    // The attempt carried a timestamp, but the rejected statement persists nothing; no success shape exists.
    expect(updatePayloads).toHaveLength(1);
  });

  it('throws when the update matches no row (single() errors) instead of fabricating a record', async () => {
    updateResult = { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
    const repo = new FleetRepository();
    await expect(repo.updateVehicle('00000000-0000-0000-0000-000000000000', { availabilityState: 'AVAILABLE' })).rejects.toThrow('Failed to update vehicle');
  });
});

describe('F-I5-04 §4.1/§6.3 — reads and inserts keep their existing timestamp behavior', () => {
  it('getVehicleById and listVehicles issue no UPDATE at all', async () => {
    const repo = new FleetRepository();
    const one = await repo.getVehicleById(VEHICLE_ID);
    const many = await repo.listVehicles(FLEET_ID);
    expect(one?.updatedAt).toBe(PRIOR_UPDATED_AT);
    expect(many[0]?.updatedAt).toBe(PRIOR_UPDATED_AT);
    expect(updatePayloads).toHaveLength(0);
  });

  it('createVehicle supplies no timestamps — the column DEFAULT now() remains the insert authority', async () => {
    updateResult = { data: { ...ROW }, error: null };
    const repo = new FleetRepository();
    await repo.createVehicle({
      vehicleId: '99999999-8888-7777-6666-555555555555',
      fleetId: FLEET_ID,
      type: 'TRUCK',
      registrationNumber: 'FI504-NEW',
      capacityWeightKg: 500,
      createdBy: OWNER,
    });
    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0]).not.toHaveProperty('updated_at');
    expect(insertPayloads[0]).not.toHaveProperty('created_at');
    expect(updatePayloads).toHaveLength(0);
  });
});