// NexCargo WS-03 — sibling updated_at correctness at the persistence boundary (F-I5-04 precedent).
//
// These tests run the REAL FleetRepository against a stubbed Supabase client that captures the exact
// UPDATE/INSERT payloads per table, under a controlled clock (vi.setSystemTime — no sleeps). They prove the
// application half for the four siblings F-I5-04 did not cover: updateFleet, updateDriver, updateAssignment
// and updateBackhaulStatus. A successful update carries a server-generated updated_at, a client cannot supply
// or overwrite it, failures return no record, and reads/inserts keep their existing timestamp behavior.
// The database half (column DEFAULT now(), absence of timestamp-maintaining triggers) is verified separately
// against the live project; nothing here is RLS proof. updateBackhaulStatus has no application caller and no
// HTTP route, so its live leg is repository + DB premise only — disclosed, not simulated.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const OWNER = 'e0fe13fd-6606-475f-a945-0a35ad879f27';
const FLEET_ID = 'ffffffff-1111-2222-3333-444444444444';
const PRIOR_UPDATED_AT = '2026-11-11T15:03:15.493Z';
const CLOCK_1 = '2026-11-16T12:00:00.000Z';
const CLOCK_2 = '2026-11-16T12:00:01.000Z';
const HOSTILE_TS = '1999-01-01T00:00:00.000Z';

const FLEET_PK = '11111111-aaaa-bbbb-cccc-000000000001';
const DRIVER_PK = '22222222-aaaa-bbbb-cccc-000000000002';
const ASSIGNMENT_PK = '33333333-aaaa-bbbb-cccc-000000000003';
const BACKHAUL_PK = '44444444-aaaa-bbbb-cccc-000000000004';
const TRACKING_ID = 'ce28e62d-ded6-4dcf-8e3c-ba9febb0e4e7';
const VEHICLE_PK = '4308337e-405d-418e-89d1-6852f0d8d011';

const FLEET_ROW = {
  id: FLEET_PK, fleet_id: FLEET_ID, name: 'WS03 Fleet', region: null,
  ownerid: OWNER, operational_status: 'ACTIVE',
  created_at: PRIOR_UPDATED_AT, updated_at: PRIOR_UPDATED_AT,
};
const DRIVER_ROW = {
  id: DRIVER_PK, driver_id: 'd0000000-0000-0000-0000-000000000002', fleet_id: FLEET_ID,
  platform_user_id: null, first_name: 'WS03', last_name: 'Driver',
  license_type: null, license_number: null, license_expiry_date: null,
  certification_status: 'PENDING', availability_state: 'AVAILABLE',
  contact_number: null, compliance_notes: null, created_by: OWNER,
  created_at: PRIOR_UPDATED_AT, updated_at: PRIOR_UPDATED_AT,
};
const ASSIGNMENT_ROW = {
  id: ASSIGNMENT_PK, assignment_id: 'a0000000-0000-0000-0000-000000000003',
  vehicle_id: null, driver_id: DRIVER_PK, shipment_tracking_id: TRACKING_ID,
  status: 'PLANNED', assigned_at: PRIOR_UPDATED_AT,
  scheduled_start: null, scheduled_end: null, actual_start: null, actual_end: null,
  notes: null, created_by: OWNER,
  created_at: PRIOR_UPDATED_AT, updated_at: PRIOR_UPDATED_AT,
};
const BACKHAUL_ROW = {
  id: BACKHAUL_PK, opportunity_id: 'b0000000-0000-0000-0000-000000000004',
  fleet_id: FLEET_ID, shipment_tracking_id: TRACKING_ID, vehicle_id: VEHICLE_PK,
  current_location: null, destination: null, return_route: null, suggested_load_id: null,
  estimated_cost_recovery_pct: null, status: 'IDENTIFIED', created_by: OWNER,
  created_at: PRIOR_UPDATED_AT, updated_at: PRIOR_UPDATED_AT,
};

const ROWS: Record<string, Record<string, unknown>> = {
  fleets: FLEET_ROW,
  drivers: DRIVER_ROW,
  asset_assignments: ASSIGNMENT_ROW,
  backhaul_opportunities: BACKHAUL_ROW,
};

type Call = { table: string; payload: Record<string, unknown> };
let updateCalls: Call[] = [];
let insertCalls: Call[] = [];
let singleResult: { data: unknown; error: { message: string } | null };

function queryFor(table: string): any {
  const q: any = {
    update: (payload: Record<string, unknown>) => { updateCalls.push({ table, payload }); return q; },
    insert: (payload: Record<string, unknown>) => { insertCalls.push({ table, payload }); return q; },
    select: () => q,
    eq: () => q,
    order: () => q,
    range: () => q,
    single: async () => singleResult,
    maybeSingle: async () => ({ data: ROWS[table], error: null }),
    // list* methods await the builder itself (no terminal single/maybeSingle).
    then: (resolve: (v: unknown) => void) => resolve({ data: [ROWS[table]], error: null }),
  };
  return q;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    schema: () => ({ from: (table: string) => queryFor(table) }),
    from: (table: string) => queryFor(table),
  })),
}));

import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(CLOCK_1));
  updateCalls = [];
  insertCalls = [];
  singleResult = { data: { ...FLEET_ROW }, error: null };
});

afterEach(() => {
  vi.useRealTimers();
});

/** Make the stub echo the last UPDATE payload's fields back as the persisted row (UPDATE ... RETURNING). */
function persistPayload() {
  singleResult = {
    get data() {
      const last = updateCalls[updateCalls.length - 1];
      return { ...ROWS[last.table], ...last.payload };
    },
    error: null,
  } as any;
}

interface Case {
  name: string;
  table: string;
  pk: string;
  failMsg: string;
  business: Record<string, unknown>;
  expectedKeys: string[];
  reflected: [string, unknown];
  run: (repo: FleetRepository, updates: any) => Promise<any>;
  hostile: (repo: FleetRepository) => Promise<any>;
  reads: (repo: FleetRepository) => Promise<any[]>;
  create: (repo: FleetRepository) => Promise<any>;
}

const CASES: Case[] = [
  {
    name: 'updateFleet', table: 'fleets', pk: FLEET_PK, failMsg: 'Failed to update fleet',
    business: { operationalStatus: 'SUSPENDED' },
    expectedKeys: ['operational_status', 'updated_at'],
    reflected: ['operationalStatus', 'SUSPENDED'],
    run: (repo, u) => repo.updateFleet(FLEET_PK, u),
    hostile: (repo) => repo.updateFleet(FLEET_PK, {
      operationalStatus: 'SUSPENDED', updated_at: HOSTILE_TS, updatedAt: HOSTILE_TS,
      ownerid: 'attacker-id', fleet_id: 'foreign-fleet', created_by: 'attacker-id', created_at: HOSTILE_TS,
    } as any),
    reads: async (repo) => [await repo.getFleetById(FLEET_PK), (await repo.listFleets())[0]],
    create: (repo) => repo.createFleet({ fleetId: 'new-fleet-id', name: 'WS03 New Fleet', ownerId: OWNER }),
  },
  {
    name: 'updateDriver', table: 'drivers', pk: DRIVER_PK, failMsg: 'Failed to update driver',
    business: { certificationStatus: 'VERIFIED' },
    expectedKeys: ['certification_status', 'updated_at'],
    reflected: ['certificationStatus', 'VERIFIED'],
    run: (repo, u) => repo.updateDriver(DRIVER_PK, u),
    hostile: (repo) => repo.updateDriver(DRIVER_PK, {
      certificationStatus: 'VERIFIED', updated_at: HOSTILE_TS, updatedAt: HOSTILE_TS,
      fleet_id: 'foreign-fleet', created_by: 'attacker-id', platform_user_id: 'attacker-id',
    } as any),
    reads: async (repo) => [
      await repo.getDriverById(DRIVER_PK),
      await repo.getDriverByBusinessKey(DRIVER_ROW.driver_id),
      (await repo.listDrivers())[0],
    ],
    create: (repo) => repo.createDriver({
      driverId: 'new-driver-id', fleetId: FLEET_ID, firstName: 'WS03', lastName: 'New', createdBy: OWNER,
    }),
  },
  {
    name: 'updateAssignment', table: 'asset_assignments', pk: ASSIGNMENT_PK, failMsg: 'Failed to update assignment',
    business: { status: 'ACTIVE' },
    expectedKeys: ['status', 'updated_at'],
    reflected: ['status', 'ACTIVE'],
    run: (repo, u) => repo.updateAssignment(ASSIGNMENT_PK, u),
    hostile: (repo) => repo.updateAssignment(ASSIGNMENT_PK, {
      status: 'ACTIVE', updated_at: HOSTILE_TS, updatedAt: HOSTILE_TS,
      created_by: 'attacker-id', shipment_tracking_id: 'foreign-tracking', vehicle_id: 'foreign-vehicle',
    } as any),
    reads: async (repo) => [await repo.getAssignmentById(ASSIGNMENT_PK), (await repo.listAssignments())[0]],
    create: (repo) => repo.createAssignment({
      assignmentId: 'new-assignment-id', driverId: DRIVER_PK, shipmentTrackingId: TRACKING_ID, createdBy: OWNER,
    }),
  },
  {
    name: 'updateBackhaulStatus', table: 'backhaul_opportunities', pk: BACKHAUL_PK, failMsg: 'Failed to update backhaul status',
    business: { status: 'MATCHED' },
    expectedKeys: ['status', 'updated_at'],
    reflected: ['status', 'MATCHED'],
    run: (repo, u) => repo.updateBackhaulStatus(BACKHAUL_PK, u.status),
    // The signature is (id, status): there is no object through which to inject fields. A stray third
    // argument is ignored by the function, proving the payload is exactly the two server-controlled keys.
    hostile: (repo) => (repo.updateBackhaulStatus as any)(BACKHAUL_PK, 'MATCHED', { updated_at: HOSTILE_TS, created_by: 'attacker-id' }),
    reads: async (repo) => [(await repo.listBackhaulOpportunities())[0]],
    create: (repo) => repo.createBackhaulOpportunity({
      opportunityId: 'new-opportunity-id', fleetId: FLEET_ID, shipmentTrackingId: TRACKING_ID,
      vehicleId: VEHICLE_PK, createdBy: OWNER,
    }),
  },
];

for (const c of CASES) {
  describe(`WS-03 ${c.name} — a successful update advances updated_at`, () => {
    it('sends a server-generated updated_at equal to the controlled clock, later than the prior value', async () => {
      persistPayload();
      const repo = new FleetRepository();
      const result = await c.run(repo, c.business);

      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].table).toBe(c.table);
      const payload = updateCalls[0].payload;
      expect(payload['updated_at']).toBe(CLOCK_1);
      expect(Date.parse(payload['updated_at'] as string)).toBeGreaterThan(Date.parse(PRIOR_UPDATED_AT));
      expect(result.updatedAt).toBe(CLOCK_1);
      expect(result[c.reflected[0]]).toBe(c.reflected[1]);
      expect(Object.keys(payload).sort()).toEqual([...c.expectedKeys].sort());
    });

    it('advances monotonically across consecutive updates under an advancing controlled clock', async () => {
      persistPayload();
      const repo = new FleetRepository();
      await c.run(repo, c.business);
      vi.setSystemTime(new Date(CLOCK_2));
      await c.run(repo, c.business);

      expect(updateCalls).toHaveLength(2);
      expect(updateCalls[0].payload['updated_at']).toBe(CLOCK_1);
      expect(updateCalls[1].payload['updated_at']).toBe(CLOCK_2);
      expect(Date.parse(updateCalls[1].payload['updated_at'] as string))
        .toBeGreaterThan(Date.parse(updateCalls[0].payload['updated_at'] as string));
    });
  });

  describe(`WS-03 ${c.name} — the timestamp is never client-controlled`, () => {
    it('ignores injected updated_at/updatedAt and ownership fields even if they reach the repository input', async () => {
      persistPayload();
      const repo = new FleetRepository();
      await c.hostile(repo);

      const payload = updateCalls[0].payload;
      expect(payload['updated_at']).toBe(CLOCK_1);
      expect(payload).not.toHaveProperty('updatedAt');
      expect(payload).not.toHaveProperty('created_by');
      expect(payload).not.toHaveProperty('created_at');
      expect(Object.keys(payload).sort()).toEqual([...c.expectedKeys].sort());
    });
  });

  describe(`WS-03 ${c.name} — failures produce no success and no misleading timestamp`, () => {
    it('throws on a database/RLS rejection and returns no record', async () => {
      singleResult = { data: null, error: { message: `permission denied for table ${c.table}` } };
      const repo = new FleetRepository();
      await expect(c.run(repo, c.business)).rejects.toThrow(c.failMsg);
      expect(updateCalls).toHaveLength(1);
    });

    it('throws when the update matches no row (single() errors) instead of fabricating a record', async () => {
      singleResult = { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
      const repo = new FleetRepository();
      await expect(c.run(repo, c.business)).rejects.toThrow(c.failMsg);
    });
  });

  describe(`WS-03 ${c.name} — reads and inserts keep their existing timestamp behavior`, () => {
    it('read methods issue no UPDATE and return the prior timestamp', async () => {
      const repo = new FleetRepository();
      const shapes = await c.reads(repo);
      for (const s of shapes) expect(s?.updatedAt).toBe(PRIOR_UPDATED_AT);
      expect(updateCalls).toHaveLength(0);
    });

    it('create supplies no timestamps — the column DEFAULT now() remains the insert authority', async () => {
      singleResult = { data: { ...ROWS[c.table] }, error: null };
      const repo = new FleetRepository();
      await c.create(repo);
      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0].table).toBe(c.table);
      expect(insertCalls[0].payload).not.toHaveProperty('updated_at');
      expect(insertCalls[0].payload).not.toHaveProperty('created_at');
      expect(updateCalls).toHaveLength(0);
    });
  });
}