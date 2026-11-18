// NexCargo I-5 §3B/§3C/§3D/§10(17) — the fleet, driver and profile screens.
//
// The pages are Server Components and their forms are Client Components, so both translation entry points are
// stubbed to return their keys: assertions then name the state instead of the wording. The repository is
// stubbed too, which pins the read scope (the session user's own fleets) and lets the empty and populated
// branches be exercised without a live database. Nothing here proves RLS — the route-level boundary lives in
// i5-fleet-write-routes.test.ts and the live policy is verified against the project separately.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `TransporterDashboard.${key}`,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `TransporterDashboard.${key}`,
}));
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useRouter: () => ({ refresh: vi.fn() }) };
});

const USER_ID = 'transporter-user-009';

function sessionClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID, email: 'ops@example.mz', created_at: '2026-01-15T00:00:00Z', user_metadata: {} } },
        error: null,
      }),
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'effective_marketplace_role') return { data: 'TRANSPORTER', error: null };
      if (fn === 'effective_user_role') return { data: null, error: null };
      return { data: null, error: new Error('no delegation in this fixture') };
    }),
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { created_at: '2026-02-01T00:00:00Z' }, error: null }),
          })),
        })),
      })),
    })),
  };
}

const listFleets = vi.fn();
const listVehicles = vi.fn();
const listDrivers = vi.fn();

vi.doMock('@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository', () => ({
  FleetRepository: class {
    listFleets = listFleets;
    listVehicles = listVehicles;
    listDrivers = listDrivers;
  },
}));

const fleetRow = {
  id: 'f1', fleetId: 'FL1', name: 'Ncula Transport', region: 'Maputo', ownerId: USER_ID,
  operationalStatus: 'ACTIVE', createdAt: '', updatedAt: '',
};
const vehicleRow = {
  id: 'v1', vehicleId: 'V1', fleetId: 'f1', type: 'HEAVY_TRUCK', registrationNumber: 'ABC-1234',
  capacityWeightKg: 20000, capacityVolumeM3: 40, availabilityState: 'MAINTENANCE', insuranceProvider: null,
  insurancePolicyNumber: null, insuranceValidUntil: null, licenceJurisdiction: 'Mozambique',
  licencesValidNationwide: true, crossBorderPermitStatus: 'NONE', complianceNotes: 'Tyre audit due',
  createdBy: USER_ID, createdAt: '', updatedAt: '',
};
const driverRow = {
  id: 'd1', driverId: 'D1', fleetId: 'f1', platformUserId: null, firstName: 'Amina', lastName: 'Chissano',
  licenseType: 'C', licenseNumber: 'AMN-77', licenseExpiryDate: '2027-07-05', certificationStatus: 'PENDING',
  availabilityState: 'OFF_DUTY', contactNumber: '+258 84 000 0000', complianceNotes: null,
  createdBy: USER_ID, createdAt: '', updatedAt: '',
};

async function renderFleet(): Promise<RenderResult> {
  const mod = await import('@/app/[locale]/(transporter)/transporter/fleet/page');
  return render(await mod.default({ params: Promise.resolve({ locale: 'en' }) }) as React.ReactElement);
}
async function renderDrivers(): Promise<RenderResult> {
  const mod = await import('@/app/[locale]/(transporter)/transporter/drivers/page');
  return render(await mod.default({ params: Promise.resolve({ locale: 'en' }) }) as React.ReactElement);
}
async function renderProfile(): Promise<RenderResult> {
  const mod = await import('@/app/[locale]/(transporter)/transporter/profile/page');
  return render(await mod.default({ params: Promise.resolve({ locale: 'en' }) }) as React.ReactElement);
}

/** A status word is rendered as both a badge and a <option>, so presence — not uniqueness — is the claim. */
function shows(key: string): void {
  expect(screen.getAllByText(`TransporterDashboard.${key}`).length, key).toBeGreaterThan(0);
}

/** Fields that a register form and a row editor share are addressed by their element id. */
function valueOf(container: HTMLElement, id: string): string {
  const field = container.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement | null;
  expect(field, id).not.toBeNull();
  return (field as HTMLInputElement).value;
}

beforeEach(() => {
  createClientMock.mockResolvedValue(sessionClient() as never);
  listFleets.mockResolvedValue([fleetRow]);
  listVehicles.mockResolvedValue([vehicleRow]);
  listDrivers.mockResolvedValue([driverRow]);
});

describe('§3C /transporter/fleet', () => {
  it('reads only the session user\'s fleets', async () => {
    await renderFleet();
    expect(listFleets).toHaveBeenCalledWith(USER_ID);
  });

  it('shows the registered vehicle with the status the Transporter declared', async () => {
    const { container } = await renderFleet();

    expect(screen.getByText('ABC-1234')).toBeTruthy();
    shows('vehicle_HEAVY_TRUCK');
    shows('vehicle_state_MAINTENANCE');
    shows('permit_NONE');
    expect(container.textContent).toMatch(/20\D000 kg/);

    // The editor starts from the stored row, so what is on screen is what the database holds.
    expect(valueOf(container, 'v1-state')).toBe('MAINTENANCE');
    expect(valueOf(container, 'v1-permit')).toBe('NONE');
    expect(valueOf(container, 'v1-notes')).toBe('Tyre audit due');
    // The save button stays dead until something actually changed, so an unchanged row cannot write.
    const save = screen.getByText('TransporterDashboard.update_vehicle_submit').closest('button') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('falls back to the empty states and asks for a first fleet', async () => {
    listFleets.mockResolvedValue([]);
    listVehicles.mockResolvedValue([]);

    await renderFleet();

    expect(screen.getByText('TransporterDashboard.no_fleets_hint')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.register_vehicle_needs_fleet')).toBeTruthy();
    expect(screen.queryByText('ABC-1234')).toBeNull();
  });

  it('renders nothing when there is no session, leaving the layout gate to redirect', async () => {
    createClientMock.mockRejectedValue(new Error('no session'));
    const mod = await import('@/app/[locale]/(transporter)/transporter/fleet/page');
    expect(await mod.default({ params: Promise.resolve({ locale: 'en' }) })).toBeNull();
  });
});

describe('§3D /transporter/drivers', () => {
  it('lists the register with MOD-014 §4.3 vocabularies and says plainly that the row is not an account', async () => {
    const { container } = await renderDrivers();

    expect(screen.getByText('Amina Chissano')).toBeTruthy();
    shows('driver_cert_PENDING');
    shows('driver_state_OFF_DUTY');
    expect(screen.getByText('TransporterDashboard.account_unlinked')).toBeTruthy();

    expect(valueOf(container, 'd1-cert')).toBe('PENDING');
    expect(valueOf(container, 'd1-availability')).toBe('OFF_DUTY');
    expect(valueOf(container, 'd1-expiry')).toBe('2027-07-05');
  });

  it('marks a driver whose row was linked through delegation', async () => {
    listDrivers.mockResolvedValue([{ ...driverRow, platformUserId: 'driver-account-1' }]);

    await renderDrivers();

    expect(screen.getByText('TransporterDashboard.account_linked')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.account_unlinked')).toBeNull();
  });

  it('asks for a fleet before a driver can be registered, and offers no account field', async () => {
    listFleets.mockResolvedValue([]);
    listDrivers.mockResolvedValue([]);

    const { container } = await renderDrivers();

    expect(screen.getByText('TransporterDashboard.no_drivers_hint')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.register_driver_needs_fleet')).toBeTruthy();
    expect(container.querySelector('#driver-fleet')).toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
  });
});

describe('§3B /transporter/profile', () => {
  it('reports the capability the register actually holds and pre-fills the editable identity', async () => {
    listVehicles.mockResolvedValue([
      vehicleRow,
      { ...vehicleRow, id: 'v2', availabilityState: 'AVAILABLE', crossBorderPermitStatus: 'PRE_EXISTING' },
    ]);
    listDrivers.mockResolvedValue([driverRow, { ...driverRow, id: 'd2', certificationStatus: 'VERIFIED' }]);

    const { container } = await renderProfile();

    // vehicles 2, available 1, cross-border ready 2, drivers 2, verified 1
    expect(screen.getAllByText('2')).toHaveLength(3);
    expect(screen.getAllByText('1')).toHaveLength(2);

    expect(valueOf(container, 'f1-name')).toBe('Ncula Transport');
    expect(valueOf(container, 'f1-region')).toBe('Maputo');
    expect(valueOf(container, 'f1-status')).toBe('ACTIVE');
    shows('fleet_status_ACTIVE');
  });

  it('points at the fleet register instead of inventing a company table when nothing is registered', async () => {
    listFleets.mockResolvedValue([]);

    const { container } = await renderProfile();

    expect(screen.getByText('TransporterDashboard.no_fleet_profile_hint')).toBeTruthy();
    expect(container.querySelector('#f1-name')).toBeNull();
  });

  it('scopes the fleet read to the session account', async () => {
    await renderProfile();
    expect(listFleets.mock.calls[0][0]).toBe(USER_ID);
  });
});

// The MOD-014 write routes resolve vehicles.id and drivers.id, while the repository shape also carries the
// separate vehicle_id / driver_id business keys. The pages map the primary key into the editor's identifier
// prop; addressing a mutation by the business key instead answers 404, so that mapping is part of the contract.
describe('§3C/§3D row editors address the primary key', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: {} }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('sends the vehicle update to vehicles.id, not the vehicle_id business key', async () => {
    const { container } = await renderFleet();
    const state = container.querySelector('#v1-state') as HTMLSelectElement;

    fireEvent.change(state, { target: { value: 'AVAILABLE' } });
    fireEvent.submit(state.closest('form') as HTMLFormElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/fleet/vehicles/v1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });

  it('sends the driver update to drivers.id, not the driver_id business key', async () => {
    const { container } = await renderDrivers();
    const certification = container.querySelector('#d1-cert') as HTMLSelectElement;

    fireEvent.change(certification, { target: { value: 'VERIFIED' } });
    fireEvent.submit(certification.closest('form') as HTMLFormElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/fleet/drivers/d1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });
});
