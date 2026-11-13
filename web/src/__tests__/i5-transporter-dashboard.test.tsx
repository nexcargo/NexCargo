// NexCargo I-5 §3A/§10(17) — the Transporter dashboard renders its states from repository results.
//
// The dashboard is a Server Component whose data comes from the RLS-scoped reads, so this suite pins that
// it asks for the session user's own fleets, quotations, bookings and trips, that a brand-new Transporter
// sees the empty states plus the one action that unblocks them, and that a populated account sees real
// rows instead. Translations are stubbed to their keys so assertions name the state, not the wording.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

const USER_ID = 'transporter-user-009';
const SHIPPER_ID = 'shipper-user-001';

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
const listOffersByTransporter = vi.fn();
const listBookingsByTransporter = vi.fn();
const listTripsByTransporter = vi.fn();
const listInbox = vi.fn();

vi.doMock('@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository', () => ({
  FleetRepository: class {
    listFleets = listFleets;
    listVehicles = listVehicles;
    listDrivers = listDrivers;
  },
}));
vi.doMock('@/infrastructure/repositories/offers-repository', () => ({
  OffersRepository: class { listByTransporter = listOffersByTransporter; },
}));
vi.doMock('@/infrastructure/repositories/bookings-repository', () => ({
  BookingsRepository: class { listByTransporter = listBookingsByTransporter; },
}));
vi.doMock('@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository', () => ({
  TrackingRecordRepository: class { listByTransporter = listTripsByTransporter; },
}));
vi.doMock('@/modules/mod-016-notifications/infrastructure/repositories/inbox-repository', () => ({
  listInboxNotifications: listInbox,
}));
vi.doMock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `TransporterDashboard.${key}`,
}));

const fleetRow = {
  id: 'f1', fleetId: 'FL1', name: 'Ncula Transport', region: 'Maputo', ownerId: USER_ID,
  operationalStatus: 'ACTIVE', createdAt: '', updatedAt: '',
};
const vehicleRow = {
  id: 'v1', vehicleId: 'V1', fleetId: 'f1', type: 'HEAVY_TRUCK', registrationNumber: 'ABC-1234',
  capacityWeightKg: 20000, capacityVolumeM3: 40, availabilityState: 'AVAILABLE', insuranceProvider: null,
  insurancePolicyNumber: null, insuranceValidUntil: null, licenceJurisdiction: null,
  licencesValidNationwide: false, crossBorderPermitStatus: 'PRE_EXISTING', complianceNotes: null,
  createdBy: USER_ID, createdAt: '', updatedAt: '',
};
const offerRow = {
  offerId: 'o1', transporterId: USER_ID, listingId: 'l1', priceProposal: 450000, availabilityWindow: {},
  vehicleType: 'HEAVY_TRUCK', declaredCapacity: {}, status: 'SUBMITTED', createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '',
};
const bookingRow = {
  bookingId: 'b1', listingId: 'l1', selectedOfferId: 'o1', shipperId: SHIPPER_ID, transporterId: USER_ID,
  status: 'REQUESTED', originAddress: 'Maputo Port', destinationAddress: 'Beira Terminal',
  cargoDescription: '', cargoType: 'GENERAL', weightKg: 10000, offerPrice: 450000,
  vehicleType: 'HEAVY_TRUCK', currency: 'MZN', createdAt: '2026-10-02T00:00:00Z', updatedAt: '',
};
const tripRow = {
  id: 't1', trackingRef: 'TRK-9', bookingId: 'b1', status: 'IN_TRANSIT', visibilityLevel: 'RESTRICTED',
  activatedAt: '', lastUpdated: '2026-10-03T00:00:00Z', createdAt: '', updatedAt: '',
};
const notificationRow = {
  notificationId: 'n1', title: 'Booking requested', body: 'A shipper requested a booking.',
  sourceModule: 'MOD-002', eventType: 'BOOKING_REQUESTED', priorityLevel: 'MEDIUM',
  deliveryStatus: 'DELIVERED', createdAt: '2026-10-02T00:00:00Z',
};

async function renderDashboard() {
  const mod = await import('@/app/[locale]/(transporter)/transporter/dashboard/page');
  const element = await mod.default({ params: Promise.resolve({ locale: 'en' }) });
  return render(element as React.ReactElement);
}

beforeEach(() => {
  createClientMock.mockResolvedValue(sessionClient() as never);
  listFleets.mockResolvedValue([]);
  listVehicles.mockResolvedValue([]);
  listDrivers.mockResolvedValue([]);
  listOffersByTransporter.mockResolvedValue([]);
  listBookingsByTransporter.mockResolvedValue([]);
  listTripsByTransporter.mockResolvedValue([]);
  listInbox.mockResolvedValue([]);
});

describe('I-5 §3A — dashboard data scope', () => {
  it('asks every read for the session user id', async () => {
    await renderDashboard();

    expect(listFleets).toHaveBeenCalledWith(USER_ID);
    expect(listOffersByTransporter).toHaveBeenCalledWith(USER_ID);
    expect(listBookingsByTransporter).toHaveBeenCalledWith(USER_ID);
    expect(listTripsByTransporter).toHaveBeenCalledWith(USER_ID);
  });

  it('renders nothing when the session is gone, leaving the layout gate to redirect', async () => {
    createClientMock.mockRejectedValue(new Error('no session'));

    const mod = await import('@/app/[locale]/(transporter)/transporter/dashboard/page');

    expect(await mod.default({ params: Promise.resolve({ locale: 'en' }) })).toBeNull();
  });
});

describe('I-5 §10(17) — empty and populated states', () => {
  it('shows the empty journey and the single action that unblocks it', async () => {
    await renderDashboard();

    expect(screen.getByText('TransporterDashboard.no_booking_requests')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.no_quotations')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.no_active_operations')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.no_notifications')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.outstanding_setup_fleet')).toBeTruthy();
    expect(screen.getAllByText('0').length).toBe(4);
  });

  it('lists real booking requests, operations, fleet and notifications', async () => {
    listFleets.mockResolvedValue([fleetRow]);
    listVehicles.mockResolvedValue([vehicleRow]);
    listOffersByTransporter.mockResolvedValue([offerRow]);
    listBookingsByTransporter.mockResolvedValue([bookingRow]);
    listTripsByTransporter.mockResolvedValue([tripRow]);
    listInbox.mockResolvedValue([notificationRow]);

    await renderDashboard();

    expect(screen.getByText('Maputo Port')).toBeTruthy();
    expect(screen.getByText('Beira Terminal')).toBeTruthy();
    expect(screen.getByText('TRK-9')).toBeTruthy();
    expect(screen.getByText('ABC-1234')).toBeTruthy();
    expect(screen.getByText('Booking requested')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.booking_status_REQUESTED')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.tracking_status_IN_TRANSIT')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.outstanding_process_bookings')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.outstanding_setup_fleet')).toBeNull();
  });

  it('keeps terminal tracking records out of active operations', async () => {
    listTripsByTransporter.mockResolvedValue([{ ...tripRow, id: 't2', trackingRef: 'TRK-DONE', status: 'COMPLETED' }]);

    await renderDashboard();

    expect(screen.getByText('TransporterDashboard.no_active_operations')).toBeTruthy();
    expect(screen.queryByText('TRK-DONE')).toBeNull();
  });
});
