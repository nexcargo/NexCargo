// NexCargo I-5 §3B/§3C/§3D — the fleet write surface the Transporter screens use.
//
// Handler-level tests again: the real route handlers run against a stubbed Supabase client and a stubbed
// FleetRepository, so what is proved here is the application half of the boundary — who is refused, which
// reference is resolved before a mutation, and which values the governed vocabulary accepts. The database
// half (logistics_schema RLS) is verified separately against the live project; nothing here is RLS proof.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGIN = 'https://app.nexcargo.example';
const SESSION_USER = 'transporter-session-1';
const FOREIGN_OWNER = 'transporter-other-9';
const DELEGATION_PRINCIPAL = 'transporter-principal-7';
const OWN_FLEET = 'fleet-mine-1';
const FOREIGN_FLEET = 'fleet-not-mine-1';

let sessionUser: { id: string; email: string; user_metadata: Record<string, unknown> } | null = null;
let rpcAnswers: Record<string, unknown> = {};
let fleetRepo: Record<string, any> = {};

vi.mock('@/lib/supabase/server', () => ({
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser }, error: null }) },
    rpc: async (name: string) => ({ data: rpcAnswers[name] ?? null, error: null }),
    from: () => fluent(),
    schema: () => ({ from: () => fluent() }),
  })),
}));

function fluent(): any {
  const q: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
        if (prop === 'data') return null;
        if (prop === 'error') return null;
        return () => q;
      },
    },
  );
  return q;
}

vi.mock('@/infrastructure/database/supabase', () => ({
  createAdminClient: vi.fn(() => ({ from: () => fluent(), schema: () => ({ from: () => fluent() }), rpc: async () => ({ data: null, error: null }) })),
  createServerSupabaseClient: vi.fn(() => ({ from: () => fluent(), schema: () => ({ from: () => fluent() }) })),
}));

vi.mock('@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository', () => ({
  FleetRepository: function () {
    return fleetRepo;
  },
}));

import { POST as fleetCreate } from '@/app/api/fleet/route';
import { PATCH as fleetUpdate } from '@/app/api/fleet/[fleetId]/route';
import { POST as vehicleCreate } from '@/app/api/fleet/vehicles/route';
import { PATCH as vehicleUpdate } from '@/app/api/fleet/vehicles/[vehicleId]/route';
import { POST as driverCreate } from '@/app/api/fleet/drivers/route';
import { PATCH as driverUpdate } from '@/app/api/fleet/drivers/[driverId]/route';

const TRANSPORTER = { effective_user_role: null, effective_marketplace_role: 'TRANSPORTER', effective_operational_delegation: null };
const SHIPPER = { effective_user_role: null, effective_marketplace_role: 'SHIPPER', effective_operational_delegation: null };
const ADMIN = { effective_user_role: 'ADMIN', effective_marketplace_role: null, effective_operational_delegation: null };
const DELEGATE = {
  effective_user_role: null,
  effective_marketplace_role: null,
  effective_operational_delegation: {
    principal_transporter_user_id: DELEGATION_PRINCIPAL,
    scopes: ['operational_read', 'assignment_manage'],
  },
};

function req(path: string, init: { method?: string; body?: unknown } = {}) {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const json = async (response: Response) => (await response.json()) as { success: boolean; error?: { code: string; message: string }; data?: any };

const paramsOf = <T>(value: T) => ({ params: Promise.resolve(value) }) as any;

const OWN_FLEET_ROW = { id: OWN_FLEET, fleetId: 'FLEET-1', name: 'Maputo Line', region: 'Maputo', ownerId: SESSION_USER, operationalStatus: 'ACTIVE' };
const FOREIGN_FLEET_ROW = { ...OWN_FLEET_ROW, id: FOREIGN_FLEET, ownerId: FOREIGN_OWNER };
const OWN_VEHICLE = { id: 'vehicle-mine-1', fleetId: OWN_FLEET };
const FOREIGN_VEHICLE = { id: 'vehicle-theirs-1', fleetId: FOREIGN_FLEET };
const OWN_DRIVER = { id: 'driver-mine-1', fleetId: OWN_FLEET };
const FOREIGN_DRIVER = { id: 'driver-theirs-1', fleetId: FOREIGN_FLEET };

beforeEach(() => {
  vi.clearAllMocks();
  sessionUser = { id: SESSION_USER, email: `${SESSION_USER}@nexcargo.example`, user_metadata: {} };
  rpcAnswers = { ...TRANSPORTER };
  fleetRepo = {
    getFleetById: vi.fn(async (id: string) => (id === OWN_FLEET ? OWN_FLEET_ROW : id === FOREIGN_FLEET ? FOREIGN_FLEET_ROW : null)),
    getVehicleById: vi.fn(async (id: string) => (id === OWN_VEHICLE.id ? OWN_VEHICLE : id === FOREIGN_VEHICLE.id ? FOREIGN_VEHICLE : null)),
    getDriverById: vi.fn(async (id: string) => (id === OWN_DRIVER.id ? OWN_DRIVER : id === FOREIGN_DRIVER.id ? FOREIGN_DRIVER : null)),
    createFleet: vi.fn(async (input: any) => ({ ...OWN_FLEET_ROW, ...input })),
    createVehicle: vi.fn(async (input: any) => ({ id: 'vehicle-new-1', ...input })),
    updateFleet: vi.fn(async (id: string, updates: any) => ({ ...OWN_FLEET_ROW, id, ...updates })),
    updateVehicle: vi.fn(async (id: string, updates: any) => ({ id, ...updates })),
    createDriver: vi.fn(async (input: any) => ({ ...input })),
    updateDriver: vi.fn(async (id: string, updates: any) => ({ id, ...updates })),
  };
});

describe('§3C POST /api/fleet — a fleet is always owned by the session', () => {
  it('refuses an anonymous caller before the repository is touched', async () => {
    sessionUser = null;
    const response = await fleetCreate(req('/api/fleet', { body: { name: 'Maputo Line' } }));
    expect(response.status).toBe(401);
    expect(fleetRepo.createFleet).not.toHaveBeenCalled();
  });

  it('refuses a Shipper and a delegated Dispatcher: neither manages a fleet', async () => {
    rpcAnswers = { ...SHIPPER };
    expect((await fleetCreate(req('/api/fleet', { body: { name: 'Maputo Line' } }))).status).toBe(403);
    rpcAnswers = { ...DELEGATE };
    expect((await fleetCreate(req('/api/fleet', { body: { name: 'Maputo Line' } }))).status).toBe(403);
    expect(fleetRepo.createFleet).not.toHaveBeenCalled();
  });

  it('ignores an ownerId in the body and stores the session account', async () => {
    const response = await fleetCreate(req('/api/fleet', { body: { name: '  Maputo Line  ', ownerId: FOREIGN_OWNER } }));
    expect(response.status).toBe(201);
    expect(fleetRepo.createFleet).toHaveBeenCalledWith({
      fleetId: expect.any(String),
      name: 'Maputo Line',
      region: undefined,
      ownerId: SESSION_USER,
    });
  });

  it.each([
    { label: 'no body fields', body: {} },
    { label: 'blank name', body: { name: '   ' } },
    { label: 'name over the column length', body: { name: 'x'.repeat(201) } },
    { label: 'region over the column length', body: { name: 'Maputo Line', region: 'r'.repeat(101) } },
  ])('answers 400 for $label', async ({ body }: { body: Record<string, unknown> }) => {
    const response = await fleetCreate(req('/api/fleet', { body }));
    expect(response.status).toBe(400);
    expect(fleetRepo.createFleet).not.toHaveBeenCalled();
  });
});

describe('§3B/§3C PATCH /api/fleet/[fleetId] — only your own fleet', () => {
  it('answers the same 404 for an unknown fleet and for one owned by another Transporter', async () => {
    const unknown = await fleetUpdate(req('/api/fleet/fleet-ghost', { method: 'PATCH', body: { name: 'Renamed' } }), paramsOf({ fleetId: 'fleet-ghost' }));
    const foreign = await fleetUpdate(req(`/api/fleet/${FOREIGN_FLEET}`, { method: 'PATCH', body: { name: 'Renamed' } }), paramsOf({ fleetId: FOREIGN_FLEET }));
    expect(unknown.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(await json(unknown)).toEqual(await json(foreign));
    expect(fleetRepo.updateFleet).not.toHaveBeenCalled();
  });

  it('updates the declared attributes of the caller\'s own fleet and stores an empty region as null', async () => {
    const response = await fleetUpdate(
      req(`/api/fleet/${OWN_FLEET}`, { method: 'PATCH', body: { name: 'Maputo Line', region: '  ', operationalStatus: 'INACTIVE' } }),
      paramsOf({ fleetId: OWN_FLEET }),
    );
    expect(response.status).toBe(200);
    expect(fleetRepo.updateFleet).toHaveBeenCalledWith(OWN_FLEET, { name: 'Maputo Line', region: null, operationalStatus: 'INACTIVE' });
  });

  it.each([
    { label: 'no editable field', body: {} },
    { label: 'an empty name', body: { name: '' } },
    { label: 'a status outside MOD-014 §4.1', body: { operationalStatus: 'PAUSED_FOR_MAINTENANCE' } },
    { label: 'a non-string region', body: { region: 17 } },
  ])('answers 400 for $label', async ({ body }: { body: Record<string, unknown> }) => {
    const response = await fleetUpdate(req(`/api/fleet/${OWN_FLEET}`, { method: 'PATCH', body }), paramsOf({ fleetId: OWN_FLEET }));
    expect(response.status).toBe(400);
    expect(fleetRepo.updateFleet).not.toHaveBeenCalled();
  });

  it('lets a governance tier skip the ownership probe but not the validation', async () => {
    rpcAnswers = { ...ADMIN };
    expect((await fleetUpdate(req(`/api/fleet/${FOREIGN_FLEET}`, { method: 'PATCH', body: { operationalStatus: 'ACTIVE' } }), paramsOf({ fleetId: FOREIGN_FLEET }))).status).toBe(200);
    expect((await fleetUpdate(req(`/api/fleet/${FOREIGN_FLEET}`, { method: 'PATCH', body: { operationalStatus: 'ARCHIVED' } }), paramsOf({ fleetId: FOREIGN_FLEET }))).status).toBe(400);
  });
});

describe('§3C POST /api/fleet/vehicles — registration is validated, not deferred to the database', () => {
  const valid = {
    fleetId: OWN_FLEET,
    type: 'HEAVY_TRUCK',
    registrationNumber: 'ABC-1234',
    capacityWeightKg: 20000,
    capacityVolumeM3: 40,
    licenceJurisdiction: 'Mozambique',
    licencesValidNationwide: true,
    crossBorderPermitStatus: 'PRE_EXISTING',
  };

  it('registers a vehicle against the caller\'s own fleet with the session as its author', async () => {
    const response = await vehicleCreate(req('/api/fleet/vehicles', { body: valid }));
    expect(response.status).toBe(201);
    expect(fleetRepo.createVehicle).toHaveBeenCalledWith(expect.objectContaining({
      fleetId: OWN_FLEET,
      type: 'HEAVY_TRUCK',
      capacityWeightKg: 20000,
      availabilityState: 'AVAILABLE',
      crossBorderPermitStatus: 'PRE_EXISTING',
      createdBy: SESSION_USER,
    }));
  });

  it('answers 400 for a body that is not a JSON object', async () => {
    const response = await vehicleCreate(req('/api/fleet/vehicles', { body: [] }));
    expect(response.status).toBe(400);
    expect((await json(response)).error?.code).toBe('ERR_4000');
    expect(fleetRepo.createVehicle).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'a type the vehicle vocabulary does not contain', body: { ...valid, type: 'HOVERCRAFT' } },
    { label: 'zero capacity', body: { ...valid, capacityWeightKg: 0 } },
    { label: 'a negative capacity', body: { ...valid, capacityWeightKg: -5 } },
    { label: 'a capacity that is not a number', body: { ...valid, capacityWeightKg: '20t' } },
    { label: 'an availability state outside the asset vocabulary', body: { ...valid, availabilityState: 'AT_THE_SHOP' } },
    { label: 'a permit status outside the permit vocabulary', body: { ...valid, crossBorderPermitStatus: 'SOMETIMES' } },
  ])('refuses $label with a client error instead of reaching the database', async ({ body }: { body: Record<string, unknown> }) => {
    const response = await vehicleCreate(req('/api/fleet/vehicles', { body }));
    expect(response.status).toBe(400);
    expect((await json(response)).error?.code).toBe('ERR_4001');
    expect(fleetRepo.createVehicle).not.toHaveBeenCalled();
  });

  it('keeps the Mozambique nationwide-licence rule a 400', async () => {
    const response = await vehicleCreate(req('/api/fleet/vehicles', { body: { ...valid, licencesValidNationwide: false } }));
    expect(response.status).toBe(400);
    expect((await json(response)).error?.message).toMatch(/nationwide/);
  });

  it('refuses a fleet the caller cannot read, and answers the same way for someone else\'s fleet and an unknown id', async () => {
    const foreign = await vehicleCreate(req('/api/fleet/vehicles', { body: { ...valid, fleetId: FOREIGN_FLEET } }));
    const unknown = await vehicleCreate(req('/api/fleet/vehicles', { body: { ...valid, fleetId: 'fleet-ghost-1' } }));
    expect(foreign.status).toBe(404);
    expect(await json(unknown)).toEqual(await json(foreign));
    expect(fleetRepo.createVehicle).not.toHaveBeenCalled();
  });

  it('refuses a Shipper and an anonymous caller before any repository call', async () => {
    rpcAnswers = { ...SHIPPER };
    expect((await vehicleCreate(req('/api/fleet/vehicles', { body: valid }))).status).toBe(403);

    sessionUser = null;
    expect((await vehicleCreate(req('/api/fleet/vehicles', { body: valid }))).status).toBe(401);
    expect(fleetRepo.createVehicle).not.toHaveBeenCalled();
  });

  it('is structurally out of reach for a delegated Dispatcher', async () => {
    rpcAnswers = { ...DELEGATE };
    const response = await vehicleCreate(req('/api/fleet/vehicles', { body: valid }));
    expect(response.status).toBe(403);
    expect(fleetRepo.createVehicle).not.toHaveBeenCalled();
  });

  it('lets a governance tier register against a fleet it does not own', async () => {
    rpcAnswers = { ...ADMIN };
    const response = await vehicleCreate(req('/api/fleet/vehicles', { body: { ...valid, fleetId: FOREIGN_FLEET } }));
    expect(response.status).toBe(201);
    expect(fleetRepo.getFleetById).not.toHaveBeenCalled();
    expect(fleetRepo.createVehicle).toHaveBeenCalledWith(expect.objectContaining({ fleetId: FOREIGN_FLEET }));
  });
});

describe('§3C PATCH /api/fleet/vehicles/[vehicleId] — status declaration inside your own fleet', () => {
  it('refuses a vehicle that is unknown or attached to another Transporter\'s fleet', async () => {
    const ghost = await vehicleUpdate(req('/api/fleet/vehicles/vehicle-ghost', { method: 'PATCH', body: { availabilityState: 'AVAILABLE' } }), paramsOf({ vehicleId: 'vehicle-ghost' }));
    const foreign = await vehicleUpdate(req('/api/fleet/vehicles/vehicle-theirs-1', { method: 'PATCH', body: { availabilityState: 'AVAILABLE' } }), paramsOf({ vehicleId: 'vehicle-theirs-1' }));
    expect(ghost.status).toBe(404);
    expect(foreign.status).toBe(404);
    // Identical answers, so the endpoint cannot be used to probe which vehicle ids exist on the platform.
    expect(await json(ghost)).toEqual(await json(foreign));
    expect(fleetRepo.updateVehicle).not.toHaveBeenCalled();
  });

  it('writes only the governed status vocabulary and clears notes as the empty string', async () => {
    const response = await vehicleUpdate(
      req('/api/fleet/vehicles/vehicle-mine-1', { method: 'PATCH', body: { availabilityState: 'MAINTENANCE', crossBorderPermitStatus: 'TEMPORARY_OBTAINABLE', complianceNotes: null } }),
      paramsOf({ vehicleId: 'vehicle-mine-1' }),
    );
    expect(response.status).toBe(200);
    expect(fleetRepo.updateVehicle).toHaveBeenCalledWith('vehicle-mine-1', {
      availabilityState: 'MAINTENANCE',
      crossBorderPermitStatus: 'TEMPORARY_OBTAINABLE',
      complianceNotes: '',
    });
  });

  it('rejects a lifecycle status the vehicle CHECK constraint does not accept', async () => {
    const response = await vehicleUpdate(req('/api/fleet/vehicles/vehicle-mine-1', { method: 'PATCH', body: { availabilityState: 'DESTROYED' } }), paramsOf({ vehicleId: 'vehicle-mine-1' }));
    expect(response.status).toBe(400);
    expect((await json(response)).error?.code).toBe('ERR_4001');
  });

  it('refuses a Dispatcher: fleet writes are not delegable', async () => {
    rpcAnswers = { ...DELEGATE };
    const response = await vehicleUpdate(req('/api/fleet/vehicles/vehicle-mine-1', { method: 'PATCH', body: { availabilityState: 'AVAILABLE' } }), paramsOf({ vehicleId: 'vehicle-mine-1' }));
    expect(response.status).toBe(403);
    expect(fleetRepo.updateVehicle).not.toHaveBeenCalled();
  });
});

describe('§3D POST /api/fleet/drivers — a Driver is a register entry, not an account', () => {
  it('refuses a body that tries to attach a platform account', async () => {
    const response = await driverCreate(req('/api/fleet/drivers', { body: { fleetId: OWN_FLEET, firstName: 'Amina', lastName: 'Chissano', platformUserId: FOREIGN_OWNER } }));
    expect(response.status).toBe(400);
    expect((await json(response)).error?.message).toMatch(/delegation/);
    expect(fleetRepo.createDriver).not.toHaveBeenCalled();
  });

  it('attaches a driver to the caller\'s fleet with no platform account and the declared defaults', async () => {
    const response = await driverCreate(
      req('/api/fleet/drivers', { body: { fleetId: OWN_FLEET, firstName: ' Amina ', lastName: 'Chissano', licenseNumber: 'AMN-77', contactNumber: '+258 84 000 0000' } }),
    );
    expect(response.status).toBe(201);
    const input = fleetRepo.createDriver.mock.calls[0][0];
    expect(input).toMatchObject({ fleetId: OWN_FLEET, firstName: 'Amina', lastName: 'Chissano', certificationStatus: 'PENDING', availabilityState: 'AVAILABLE', createdBy: SESSION_USER });
    expect(input.platformUserId).toBeUndefined();
  });

  it('answers 404 without probing the insert when the fleet is not the caller\'s', async () => {
    const response = await driverCreate(req('/api/fleet/drivers', { body: { fleetId: FOREIGN_FLEET, firstName: 'Amina', lastName: 'Chissano' } }));
    expect(response.status).toBe(404);
    expect(fleetRepo.createDriver).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'missing first name', body: { fleetId: OWN_FLEET, lastName: 'Chissano' } },
    { label: 'missing last name', body: { fleetId: OWN_FLEET, firstName: 'Amina' } },
    { label: 'a licence date that is not ISO', body: { fleetId: OWN_FLEET, firstName: 'Amina', lastName: 'C', licenseExpiryDate: '05/07/2027' } },
    { label: 'a certification outside MOD-014 §4.3', body: { fleetId: OWN_FLEET, firstName: 'Amina', lastName: 'C', certificationStatus: 'TRUSTED' } },
    { label: 'an availability state the CHECK rejects', body: { fleetId: OWN_FLEET, firstName: 'Amina', lastName: 'C', availabilityState: 'SICK' } },
  ])('answers 400 for $label', async ({ body }: { body: Record<string, unknown> }) => {
    const response = await driverCreate(req('/api/fleet/drivers', { body }));
    expect(response.status).toBe(400);
    expect(fleetRepo.createDriver).not.toHaveBeenCalled();
  });
});

describe('§3D PATCH /api/fleet/drivers/[driverId] — standing within your own register', () => {
  it('refuses a driver outside the caller\'s fleet with the same answer as an unknown one', async () => {
    const ghost = await driverUpdate(req('/api/fleet/drivers/driver-ghost', { method: 'PATCH', body: { availabilityState: 'OFF_DUTY' } }), paramsOf({ driverId: 'driver-ghost' }));
    const foreign = await driverUpdate(req('/api/fleet/drivers/driver-theirs-1', { method: 'PATCH', body: { availabilityState: 'OFF_DUTY' } }), paramsOf({ driverId: 'driver-theirs-1' }));
    expect(ghost.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(await json(ghost)).toEqual(await json(foreign));
    expect(fleetRepo.updateDriver).not.toHaveBeenCalled();
  });

  it('updates certification, availability and licence expiry', async () => {
    const response = await driverUpdate(
      req('/api/fleet/drivers/driver-mine-1', { method: 'PATCH', body: { certificationStatus: 'VERIFIED', availabilityState: 'ASSIGNED', licenseExpiryDate: '2027-07-05' } }),
      paramsOf({ driverId: 'driver-mine-1' }),
    );
    expect(response.status).toBe(200);
    expect(fleetRepo.updateDriver).toHaveBeenCalledWith('driver-mine-1', { certificationStatus: 'VERIFIED', availabilityState: 'ASSIGNED', licenseExpiryDate: '2027-07-05' });
  });

  it('clears a licence expiry date but never a driver name', async () => {
    const cleared = await driverUpdate(req('/api/fleet/drivers/driver-mine-1', { method: 'PATCH', body: { licenseExpiryDate: null } }), paramsOf({ driverId: 'driver-mine-1' }));
    expect(cleared.status).toBe(200);
    expect(fleetRepo.updateDriver).toHaveBeenLastCalledWith('driver-mine-1', { licenseExpiryDate: null });

    fleetRepo.updateDriver.mockClear();
    const renamed = await driverUpdate(req('/api/fleet/drivers/driver-mine-1', { method: 'PATCH', body: { firstName: 'Someone', lastName: 'Else' } }), paramsOf({ driverId: 'driver-mine-1' }));
    expect(renamed.status).toBe(400);
    expect(fleetRepo.updateDriver).not.toHaveBeenCalled();
  });

  it('refuses a Dispatcher, whose delegation covers reads and assignments, not the register', async () => {
    rpcAnswers = { ...DELEGATE };
    const response = await driverUpdate(req('/api/fleet/drivers/driver-mine-1', { method: 'PATCH', body: { certificationStatus: 'VERIFIED' } }), paramsOf({ driverId: 'driver-mine-1' }));
    expect(response.status).toBe(403);
    expect(fleetRepo.updateDriver).not.toHaveBeenCalled();
  });
});
