// NexCargo I-5 §3H — the Transporter's operational surface, and the routes it writes through.
//
// Three layers are exercised here, and each proves something different:
//   * operations-transitions.ts is checked against the REAL MOD-003 and MOD-014 state machines, so the UI
//     cannot offer a transition the domain forbids;
//   * the Server Components render from stubbed repositories while contract-reads.ts and document-reads.ts run
//     for real against a stubbed session client — that is what proves the reads are session-scoped rather than
//     admin-scoped, and that another Transporter's operation is not rendered;
//   * the real POST /api/tracking/[trackingId]/status and PATCH /api/fleet/assignments handlers run, which is
//     where RBAC, the stored-state revalidation and the assignment ownership inputs are decided.
// None of this is RLS proof: the live policies are verified against the project separately. Translations are
// stubbed to their keys.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { ShipmentStatus } from '@/shared/types/enums';
import { AssignmentStatus } from '@/modules/mod-014-fleet-assets/domain/enums';
import { nextAssignmentStatuses, nextTrackingStatuses } from '@/app/[locale]/(transporter)/operations-transitions';
import { StatusUpdateForm } from '@/app/[locale]/(transporter)/transporter/operations/status-update';
import { AssignmentForm, AssignmentStatusForm } from '@/app/[locale]/(transporter)/transporter/operations/assignment-forms';
import { PodForm } from '@/app/[locale]/(transporter)/transporter/operations/pod-form';

const USER_ID = 'transporter-user-009';
const OTHER_TRANSPORTER_ID = 'transporter-user-777';
const SHIPPER_ID = 'shipper-user-001';
const DELEGATION_PRINCIPAL = 'transporter-principal-7';
const ORIGIN = 'https://app.nexcargo.example';

const TRACKING_ID = '11111111-1111-4111-8111-111111111111';
const VEHICLE_ID = '22222222-2222-4222-8222-222222222222';
const DRIVER_ID = '33333333-3333-4333-8333-333333333333';
const ASSIGNMENT_ID = '44444444-4444-4444-8444-444444444444';
const BOOKING_ID = 'b-confirmed';

let sessionUser: { id: string; email: string; created_at: string; user_metadata: Record<string, unknown> } | null = null;
let rpcAnswers: Record<string, unknown> = {};
let tableData: Record<string, unknown> = {};
const queries: Array<{ schema: string; table: string; filters: Record<string, unknown> }> = [];
const rpcCalls: Array<{ name: string; args: unknown }> = [];

vi.mock('@/lib/supabase/server', () => ({
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
  createClient: vi.fn(async () => {
    if (!sessionUser) throw new Error('no session');
    return {
      auth: { getUser: async () => ({ data: { user: sessionUser }, error: null }) },
      rpc: async (name: string, args?: unknown) => {
        rpcCalls.push({ name, args });
        return { data: rpcAnswers[name] ?? null, error: null };
      },
      schema: (schema: string) => ({ from: (table: string) => builder(schema, table) }),
    };
  }),
}));

// A thenable query builder: supabase-js resolves on await, .single()/.maybeSingle() narrow to one row, and
// eq/in filters are applied to the fixture rows so a documents read cannot return another entity's rows.
function builder(schema: string, table: string): any {
  const filters: Record<string, unknown> = {};
  const key = `${schema}.${table}`;
  const raw = () => {
    const value = tableData[key];
    if (!Array.isArray(value)) return value;
    return value.filter((row: any) =>
      Object.entries(filters).every(([column, expected]) => {
        if (row == null || !(column in row)) return true;
        return Array.isArray(expected) ? expected.includes(row[column]) : row[column] === expected;
      }),
    );
  };
  const one = () => {
    const value = raw();
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  };
  const answer = (data: unknown) =>
    data instanceof Error ? { data: null, error: { message: data.message } } : { data: data ?? null, error: null };
  const q: any = {
    select: () => {
      queries.push({ schema, table, filters });
      return q;
    },
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return q;
    },
    in: (column: string, value: unknown) => {
      filters[column] = value;
      return q;
    },
    order: () => q,
    single: async () => answer(one()),
    maybeSingle: async () => answer(one()),
    then: (resolve: (value: unknown) => unknown) => resolve(answer(raw())),
  };
  return q;
}

vi.mock('@/infrastructure/database/supabase', () => ({
  createAdminClient: vi.fn(() => {
    throw new Error('the Transporter area must not use an admin client');
  }),
  createServerSupabaseClient: vi.fn(() => {
    throw new Error('the Transporter area must not use a service client');
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `TransporterDashboard.${key}`,
  useLocale: () => 'en',
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `TransporterDashboard.${key}`,
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

// The card is an async Server Component, so the page tests assert what is handed to it. The card itself is
// rendered directly in its own describe block below via importActual.
vi.mock('@/app/[locale]/(transporter)/documents-card', () => ({
  DocumentsCard: ({ documents }: { documents: Array<{ id: string }> }) => (
    <div data-testid="documents-card">{documents.map((document) => document.id).join(',')}</div>
  ),
}));

const listBookings = vi.fn();
const getBooking = vi.fn();
const listTracking = vi.fn();
const getTracking = vi.fn();
const markCompleted = vi.fn();
const getHistory = vi.fn();
const listPods = vi.fn();
const createPod = vi.fn();
const listAssignments = vi.fn();
const listVehicles = vi.fn();
const listDrivers = vi.fn();
const createAssignment = vi.fn();
const updateAssignment = vi.fn();
const getAssignment = vi.fn();

vi.doMock('@/infrastructure/repositories/bookings-repository', () => ({
  BookingsRepository: class {
    listByTransporter = listBookings;
    getById = getBooking;
  },
}));
vi.doMock('@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository', () => ({
  TrackingRecordRepository: class {
    listByTransporter = listTracking;
    getById = getTracking;
    markCompleted = markCompleted;
  },
}));
vi.doMock('@/modules/mod-003-tracking/infrastructure/repositories/tracking-event-repository', () => ({
  TrackingEventRepository: class { getHistory = getHistory; },
}));
vi.doMock('@/modules/mod-003-tracking/infrastructure/repositories/pod-repository', () => ({
  PodRepository: class {
    getByTrackingId = listPods;
    create = createPod;
  },
}));
vi.doMock('@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository', () => ({
  FleetRepository: class {
    listAssignments = listAssignments;
    listVehicles = listVehicles;
    listDrivers = listDrivers;
    createAssignment = createAssignment;
    updateAssignment = updateAssignment;
    getAssignmentById = getAssignment;
  },
}));

const booking = {
  bookingId: BOOKING_ID, listingId: 'l-1', selectedOfferId: 'o1', shipperId: SHIPPER_ID,
  transporterId: USER_ID, status: 'CONFIRMED', confirmationTimestamp: '2026-11-11T12:00:00Z',
  originAddress: 'Maputo Port', originLatitude: -25.96, originLongitude: 32.58,
  destinationAddress: 'Beira Terminal', destinationLatitude: -19.84, destinationLongitude: 34.84,
  cargoDescription: '20 pallets of crated glass', cargoType: 'GENERAL', weightKg: 10000, volumeM3: 20,
  specialHandling: ['FRAGILE'], offerPrice: 385000, vehicleType: 'HEAVY_TRUCK',
  declaredWeightKg: 20000, declaredVolumeM3: 40, currency: 'MZN',
  availabilityWindowStart: '2026-12-01T08:00:00Z', availabilityWindowEnd: '2026-12-05T18:00:00Z',
  contractId: 'c-1', createdAt: '2026-11-11T09:00:00Z', updatedAt: '2026-11-11T12:00:00Z',
};

const record = {
  id: TRACKING_ID, trackingRef: 'TRK-20261112-ABC123', bookingId: BOOKING_ID, contractId: 'c-1',
  status: 'IN_TRANSIT', visibilityLevel: 'PARTY', activatedAt: '2026-11-11T12:05:00Z',
  completedAt: undefined, lastUpdated: '2026-11-12T08:00:00Z',
  createdAt: '2026-11-11T12:05:00Z', updatedAt: '2026-11-12T08:00:00Z',
};

const vehicle = {
  id: VEHICLE_ID, vehicleId: 'VEH-1', fleetId: 'f-1', type: 'HEAVY_TRUCK',
  registrationNumber: 'ABC-123-MC', capacityWeightKg: 20000, capacityVolumeM3: 40,
  availabilityState: 'AVAILABLE',
};
const driver = {
  id: DRIVER_ID, driverId: 'DRV-1', fleetId: 'f-1', platformUserId: null,
  firstName: 'Ana', lastName: 'Machel', licenseType: 'HEAVY', availabilityState: 'AVAILABLE',
};
const assignment = {
  id: ASSIGNMENT_ID, assignmentId: 'ASG-1', vehicleId: VEHICLE_ID, driverId: DRIVER_ID,
  shipmentTrackingId: TRACKING_ID, status: 'PLANNED', assignedAt: '2026-11-12T08:10:00Z',
  scheduledStart: null, scheduledEnd: null, actualStart: null, actualEnd: null, notes: null,
  createdBy: USER_ID, createdAt: '2026-11-12T08:10:00Z', updatedAt: '2026-11-12T08:10:00Z',
};
const event = {
  id: 'e-1', trackingId: TRACKING_ID, eventType: 'STATUS_CHANGED', eventTimestamp: '2026-11-12T08:00:00Z',
  source: 'MOD-003', stateFrom: 'PICKUP_ACKNOWLEDGED', stateTo: 'IN_TRANSIT', metadata: {},
  createdAt: '2026-11-12T08:00:00Z',
};
const pod = {
  id: 'pod-1', trackingId: TRACKING_ID, bookingId: BOOKING_ID, recipientName: 'Beira Terminal clerk',
  signatureRef: 'pod/signature-1.png', photoRefs: ['pod/photo-1.jpg', 'pod/photo-2.jpg'],
  gpsLat: -19.84, gpsLon: 34.84, submissionMethod: 'ONLINE', verificationStatus: 'PENDING',
  adminOverride: false, submittedAt: '2026-11-12T09:00:00Z', verifiedAt: undefined,
  createdAt: '2026-11-12T09:00:00Z', updatedAt: '2026-11-12T09:00:00Z',
};

const contractRow = {
  id: 'c-1', contract_id: 'CONTRACT-1', booking_id: BOOKING_ID, acceptance_status: 'ACTIVE',
  num_signatories: 2, shipper_accepted_at: '2026-11-11T10:00:00Z', transporter_accepted_at: '2026-11-11T11:00:00Z',
  signed_at: '2026-11-11T11:00:00Z', digital_signature_status: 'EXECUTED', base_amount: '385000.00', currency: 'MZN',
  terms_snapshot: 'Price 385000 MZN.', pickup_window_start: '2026-12-01T08:00:00Z',
  pickup_window_end: '2026-12-01T18:00:00Z', delivery_window_start: '2026-12-04T08:00:00Z',
  delivery_window_end: '2026-12-05T18:00:00Z', created_at: '2026-11-11T10:00:00Z',
};
const bookingDocument = {
  id: 'd-booking', document_id: 'DOC-1', document_type: 'BILL_OF_LADING', linked_entity_type: 'booking',
  linked_entity_id: BOOKING_ID, status: 'UPLOADED', issue_date: null, expiry_date: null,
  created_at: '2026-11-11T11:00:00Z',
};
const contractDocument = {
  id: 'd-contract', document_id: 'DOC-2', document_type: 'CONTRACT', linked_entity_type: 'contract',
  linked_entity_id: 'c-1', status: 'SIGNED', issue_date: null, expiry_date: null,
  created_at: '2026-11-11T12:00:00Z',
};

const TRANSPORTER = { effective_user_role: null, effective_marketplace_role: 'TRANSPORTER', effective_operational_delegation: null };
const SHIPPER = { effective_user_role: null, effective_marketplace_role: 'SHIPPER', effective_operational_delegation: null };

async function renderOperations() {
  const mod = await import('@/app/[locale]/(transporter)/transporter/operations/page');
  return render((await mod.default({ params: Promise.resolve({ locale: 'en' }) })) as React.ReactElement);
}

async function renderOperation(id: string) {
  const mod = await import('@/app/[locale]/(transporter)/transporter/operations/[id]/page');
  return render((await mod.default({ params: Promise.resolve({ locale: 'en', id }) })) as React.ReactElement);
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  rpcCalls.length = 0;
  sessionUser = { id: USER_ID, email: 'ops@example.mz', created_at: '2026-01-15T00:00:00Z', user_metadata: {} };
  rpcAnswers = { ...TRANSPORTER };
  tableData = {
    'app.marketplace_memberships': { created_at: '2026-02-01T00:00:00Z' },
    'logistics_schema.contracts': [contractRow],
    'logistics_schema.documents': [bookingDocument, contractDocument],
  };
  listBookings.mockResolvedValue([booking]);
  getBooking.mockResolvedValue(booking);
  listTracking.mockResolvedValue([record]);
  getTracking.mockResolvedValue(record);
  markCompleted.mockResolvedValue(undefined);
  getHistory.mockResolvedValue([event]);
  listPods.mockResolvedValue([]);
  createPod.mockResolvedValue(pod);
  listAssignments.mockResolvedValue([assignment]);
  listVehicles.mockResolvedValue([vehicle]);
  listDrivers.mockResolvedValue([driver]);
  createAssignment.mockResolvedValue(assignment);
  updateAssignment.mockResolvedValue({ ...assignment, status: 'ACTIVE' });
  getAssignment.mockResolvedValue(assignment);
});

describe('I-5 §3H — the offered transitions come from the authoritative state machines', () => {
  it('offers exactly the MOD-003 successors of IN_TRANSIT', () => {
    expect(nextTrackingStatuses('IN_TRANSIT').sort()).toEqual(
      ['AT_BORDER', 'DELIVERED', 'CANCELLED', 'DELAYED'].sort(),
    );
  });

  it('offers no way to skip pickup acknowledgement', () => {
    expect(nextTrackingStatuses('AWAITING_PICKUP')).not.toContain('IN_TRANSIT');
    expect(nextTrackingStatuses('AWAITING_PICKUP')).not.toContain('DELIVERED');
    expect(nextTrackingStatuses('AWAITING_PICKUP')).toContain('PICKUP_ACKNOWLEDGED');
  });

  it('never offers a state outside the governed vocabulary', () => {
    const vocabulary = new Set<string>([...Object.values(ShipmentStatus), 'CANCELLED']);
    for (const state of vocabulary) {
      for (const candidate of nextTrackingStatuses(state)) {
        expect(vocabulary.has(candidate)).toBe(true);
      }
    }
  });

  it('offers nothing from the terminal tracking states', () => {
    expect(nextTrackingStatuses('COMPLETED')).toEqual([]);
    expect(nextTrackingStatuses('CANCELLED')).toEqual([]);
  });

  it('offers nothing for a status the domain does not know', () => {
    expect(nextTrackingStatuses('DELIVERED_AND_PAID')).toEqual([]);
    expect(nextAssignmentStatuses('DISPATCHED')).toEqual([]);
  });

  it('offers exactly the MOD-014 successors of an assignment', () => {
    expect(nextAssignmentStatuses('PLANNED').sort()).toEqual(['ACTIVE', 'CANCELLED'].sort());
    expect(nextAssignmentStatuses('ACTIVE').sort()).toEqual(['COMPLETED', 'CANCELLED'].sort());
    expect(nextAssignmentStatuses('COMPLETED')).toEqual([]);
    expect(nextAssignmentStatuses('CANCELLED')).toEqual([]);
  });

  it('does not let an assignment jump from planned to completed', () => {
    expect(nextAssignmentStatuses(AssignmentStatus.PLANNED)).not.toContain(AssignmentStatus.COMPLETED);
  });
});

describe('I-5 §3H — the operations overview reads only this Transporter’s records', () => {
  it('reads tracking and bookings by the session user, never by a supplied id', async () => {
    await renderOperations();

    expect(listTracking).toHaveBeenCalledWith(USER_ID);
    expect(listBookings).toHaveBeenCalledWith(USER_ID);
  });

  it('separates active operations from closed ones', async () => {
    listTracking.mockResolvedValue([
      record,
      { ...record, id: 'tr-done', trackingRef: 'TRK-DONE', status: 'COMPLETED', lastUpdated: '2026-11-10T08:00:00Z' },
      { ...record, id: 'tr-void', trackingRef: 'TRK-VOID', status: 'CANCELLED', lastUpdated: '2026-11-09T08:00:00Z' },
    ]);

    await renderOperations();

    const active = document.getElementById('operations-active')?.closest('section');
    const closed = document.getElementById('operations-closed')?.closest('section');
    expect(active?.textContent).toContain('TRK-20261112-ABC123');
    expect(active?.textContent).not.toContain('TRK-DONE');
    expect(closed?.textContent).toContain('TRK-DONE');
    expect(closed?.textContent).toContain('TRK-VOID');
    expect(closed?.textContent).not.toContain('TRK-20261112-ABC123');
  });

  it('orders each section by the most recently updated record', async () => {
    listTracking.mockResolvedValue([
      { ...record, id: 'tr-old', trackingRef: 'TRK-OLD', lastUpdated: '2026-11-01T08:00:00Z' },
      { ...record, id: 'tr-new', trackingRef: 'TRK-NEW', lastUpdated: '2026-11-12T08:00:00Z' },
    ]);

    await renderOperations();

    const references = screen.getAllByText(/^TRK-/).map((node) => node.textContent);
    expect(references).toEqual(['TRK-NEW', 'TRK-OLD']);
  });

  it('links each row to its own operation', async () => {
    await renderOperations();

    expect(screen.getByRole('link', { name: 'TransporterDashboard.view_operation' }).getAttribute('href'))
      .toBe(`/en/transporter/operations/${TRACKING_ID}`);
  });

  it('shows the route from the matching booking, and a dash when the booking is not readable', async () => {
    const { unmount } = await renderOperations();
    expect(screen.getByText('Maputo Port')).toBeTruthy();
    expect(screen.getByText('Beira Terminal')).toBeTruthy();
    unmount();

    listBookings.mockResolvedValue([]);
    await renderOperations();
    expect(screen.getByText('TransporterDashboard.summary_none')).toBeTruthy();
  });

  it('renders the empty state instead of two empty tables', async () => {
    listTracking.mockResolvedValue([]);

    await renderOperations();

    expect(screen.getByText('TransporterDashboard.operations_empty_title')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says so when one section is empty but the other is not', async () => {
    await renderOperations();

    expect(screen.getByText('TransporterDashboard.operations_closed_empty')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.operations_active_empty')).toBeNull();
  });

  it('renders nothing at all without a session', async () => {
    sessionUser = null;
    const mod = await import('@/app/[locale]/(transporter)/transporter/operations/page');

    expect(await mod.default({ params: Promise.resolve({ locale: 'en' }) })).toBeNull();
    expect(listTracking).not.toHaveBeenCalled();
  });
});

describe('I-5 §3H/§4 — one operation, and no other Transporter’s', () => {
  it('refuses an operation whose booking names another Transporter, before reading its assets', async () => {
    getBooking.mockResolvedValue({ ...booking, transporterId: OTHER_TRANSPORTER_ID });

    await renderOperation(TRACKING_ID);

    expect(screen.getByText('TransporterDashboard.operation_not_found')).toBeTruthy();
    expect(listAssignments).not.toHaveBeenCalled();
    expect(listPods).not.toHaveBeenCalled();
    expect(queries.filter((q) => q.table === 'documents')).toHaveLength(0);
  });

  it('refuses a tracking record that does not exist without reading a booking', async () => {
    getTracking.mockResolvedValue(null);

    await renderOperation('tr-missing');

    expect(screen.getByText('TransporterDashboard.operation_not_found')).toBeTruthy();
    expect(getBooking).not.toHaveBeenCalled();
  });

  it('refuses a record whose booking cannot be read', async () => {
    getBooking.mockResolvedValue(null);

    await renderOperation(TRACKING_ID);

    expect(screen.getByText('TransporterDashboard.operation_not_found')).toBeTruthy();
    expect(listAssignments).not.toHaveBeenCalled();
  });

  it('scopes the assignment, vehicle and driver reads to this session’s fleet', async () => {
    await renderOperation(TRACKING_ID);

    expect(listAssignments).toHaveBeenCalledWith(undefined, undefined, TRACKING_ID);
    expect(listVehicles).toHaveBeenCalledWith();
    expect(listDrivers).toHaveBeenCalledWith();
    expect(getHistory).toHaveBeenCalledWith(TRACKING_ID, 20);
    expect(listPods).toHaveBeenCalledWith(TRACKING_ID);
  });

  it('offers only the transitions the current state permits', async () => {
    await renderOperation(TRACKING_ID);

    const select = screen.getByLabelText('TransporterDashboard.field_target_status') as HTMLSelectElement;
    const offered = Array.from(select.options).map((option) => option.value);
    expect(offered.sort()).toEqual(nextTrackingStatuses('IN_TRANSIT').sort());
    expect(offered).not.toContain('COMPLETED');
  });

  it('names the assigned vehicle and driver from the fleet rows', async () => {
    await renderOperation(TRACKING_ID);

    const table = screen.getByRole('table');
    expect(within(table).getByText('ABC-123-MC')).toBeTruthy();
    expect(within(table).getByText('Ana Machel')).toBeTruthy();
    expect(within(table).getByText('TransporterDashboard.assignment_status_PLANNED')).toBeTruthy();
  });

  it('says when an assignment carries no vehicle or no driver', async () => {
    listAssignments.mockResolvedValue([{ ...assignment, vehicleId: null, driverId: null }]);

    await renderOperation(TRACKING_ID);

    expect(screen.getAllByText('TransporterDashboard.assignment_no_vehicle').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TransporterDashboard.assignment_no_driver').length).toBeGreaterThan(0);
  });

  it('renders the milestone history with its source and target state', async () => {
    await renderOperation(TRACKING_ID);

    const milestones = screen.getByRole('list');
    expect(within(milestones).getByText('STATUS_CHANGED')).toBeTruthy();
    expect(within(milestones).getByText('TransporterDashboard.tracking_status_IN_TRANSIT')).toBeTruthy();
    expect(within(milestones).getByText('MOD-003')).toBeTruthy();
  });

  it('shows the empty milestone and assignment states', async () => {
    getHistory.mockResolvedValue([]);
    listAssignments.mockResolvedValue([]);

    await renderOperation(TRACKING_ID);

    expect(screen.getByText('TransporterDashboard.operation_no_events')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.operation_no_assignments')).toBeTruthy();
  });

  it('withholds the POD form until the shipment is delivered', async () => {
    await renderOperation(TRACKING_ID);

    expect(screen.getByText('TransporterDashboard.pod_not_yet_available')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.pod_submit_heading')).toBeNull();
  });

  it('offers the POD form on a delivered shipment', async () => {
    getTracking.mockResolvedValue({ ...record, status: 'DELIVERED' });

    await renderOperation(TRACKING_ID);

    expect(screen.getByText('TransporterDashboard.pod_submit_heading')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.pod_not_yet_available')).toBeNull();
  });

  it('shows a submitted POD as pending verification and never as verified by this screen', async () => {
    getTracking.mockResolvedValue({ ...record, status: 'DELIVERED' });
    listPods.mockResolvedValue([pod]);

    await renderOperation(TRACKING_ID);

    expect(screen.getByText('Beira Terminal clerk')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.pod_verification_PENDING')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.pod_verification_notice')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.pod_verification_VERIFIED')).toBeNull();
  });

  it('discloses that pickup proof and financial confirmation are not Transporter actions', async () => {
    await renderOperation(TRACKING_ID);

    expect(screen.getByText('TransporterDashboard.operation_pickup_proof_notice')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.operation_financial_notice')).toBeTruthy();
  });

  it('hands both document sets to the card and reads them through the session client', async () => {
    await renderOperation(TRACKING_ID);

    expect(screen.getByTestId('documents-card').textContent).toBe('d-booking,d-contract');
    const documentQueries = queries.filter((q) => q.table === 'documents');
    expect(documentQueries).toHaveLength(2);
    expect(documentQueries.every((q) => q.schema === 'logistics_schema')).toBe(true);
    expect(documentQueries[0].filters).toEqual({ linked_entity_type: 'booking', linked_entity_id: BOOKING_ID, is_deleted: false });
    expect(documentQueries[1].filters).toEqual({ linked_entity_type: 'contract', linked_entity_id: 'c-1', is_deleted: false });
  });

  it('renders nothing at all without a session', async () => {
    sessionUser = null;
    const mod = await import('@/app/[locale]/(transporter)/transporter/operations/[id]/page');

    expect(await mod.default({ params: Promise.resolve({ locale: 'en', id: TRACKING_ID }) })).toBeNull();
    expect(getTracking).not.toHaveBeenCalled();
  });
});

describe('I-5 §3H — the status form posts a transition, not a status override', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('posts the chosen target and the MOD-003 source to the existing route', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));

    render(<StatusUpdateForm trackingId={TRACKING_ID} options={['AT_BORDER', 'DELIVERED']} />);
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_target_status'), { target: { value: 'DELIVERED' } });
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.update_status_submit' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe(`/api/tracking/${TRACKING_ID}/status`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ targetStatus: 'DELIVERED', sourceModule: 'MOD-003' });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('operation_status_updated'));
    expect(refresh).toHaveBeenCalled();
  });

  it('offers no form at all when the state is terminal', () => {
    render(<StatusUpdateForm trackingId={TRACKING_ID} options={[]} />);

    expect(screen.getByText('TransporterDashboard.operation_no_transitions')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('surfaces the server refusal instead of claiming success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: 'validation_error', message: 'Invalid tracking transition' }));

    render(<StatusUpdateForm trackingId={TRACKING_ID} options={['DELIVERED']} />);
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.update_status_submit' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Invalid tracking transition'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('surfaces an authorization denial', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden', message: 'FORBIDDEN: tracking_status' }));

    render(<StatusUpdateForm trackingId={TRACKING_ID} options={['DELIVERED']} />);
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.update_status_submit' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('FORBIDDEN'));
  });
});

describe('I-5 §3C/§3H — an assignment carries this fleet’s asset primary keys', () => {
  const fetchMock = vi.fn();
  const vehicles = [{ id: VEHICLE_ID, registrationNumber: 'ABC-123-MC', type: 'HEAVY_TRUCK' }];
  const drivers = [{ id: DRIVER_ID, name: 'Ana Machel' }];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('refuses to submit without a vehicle or a driver', async () => {
    render(<AssignmentForm trackingId={TRACKING_ID} vehicles={vehicles} drivers={drivers} />);
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.create_assignment_submit' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('validation_assignment_asset'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a scheduled window that ends before it starts', async () => {
    render(<AssignmentForm trackingId={TRACKING_ID} vehicles={vehicles} drivers={drivers} />);
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_vehicle'), { target: { value: VEHICLE_ID } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_scheduled_start'), { target: { value: '2026-12-02T10:00' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_scheduled_end'), { target: { value: '2026-12-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.create_assignment_submit' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('validation_assignment_window'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the vehicle and driver UUIDs the assignment foreign keys reference', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { success: true, data: assignment }));

    render(<AssignmentForm trackingId={TRACKING_ID} vehicles={vehicles} drivers={drivers} />);
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_vehicle'), { target: { value: VEHICLE_ID } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_driver'), { target: { value: DRIVER_ID } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_scheduled_start'), { target: { value: '2026-12-01T10:00' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_scheduled_end'), { target: { value: '2026-12-01T18:00' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_notes'), { target: { value: '  Side loader  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.create_assignment_submit' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/fleet/assignments');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body);
    expect(body.action).toBe('create');
    expect(body.shipmentTrackingId).toBe(TRACKING_ID);
    expect(body.vehicleId).toBe(VEHICLE_ID);
    expect(body.driverId).toBe(DRIVER_ID);
    expect(body.notes).toBe('Side loader');
    expect(body.scheduledStart).toBe(new Date('2026-12-01T10:00').toISOString());
    expect(body.scheduledEnd).toBe(new Date('2026-12-01T18:00').toISOString());
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('assignment_created'));
  });

  it('omits the asset that was not chosen instead of sending an empty identifier', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { success: true, data: assignment }));

    render(<AssignmentForm trackingId={TRACKING_ID} vehicles={vehicles} drivers={drivers} />);
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_driver'), { target: { value: DRIVER_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.create_assignment_submit' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.vehicleId).toBeUndefined();
    expect(body.driverId).toBe(DRIVER_ID);
    expect(body.scheduledStart).toBeUndefined();
  });

  it('explains that a fleet is needed before an assignment is possible', () => {
    render(<AssignmentForm trackingId={TRACKING_ID} vehicles={[]} drivers={[]} />);

    expect(screen.getByText('TransporterDashboard.assignment_needs_assets')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('surfaces the database refusal when the asset belongs to another fleet', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { success: false, error: { code: 'ERR_9001', message: 'Internal server error' } }));

    render(<AssignmentForm trackingId={TRACKING_ID} vehicles={vehicles} drivers={drivers} />);
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_vehicle'), { target: { value: VEHICLE_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.create_assignment_submit' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Internal server error'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('posts an assignment transition through the same route', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { ...assignment, status: 'ACTIVE' } }));

    render(<AssignmentStatusForm assignmentId={ASSIGNMENT_ID} options={['ACTIVE', 'CANCELLED']} />);
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.update_assignment_submit' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/fleet/assignments');
    expect(JSON.parse(init.body)).toEqual({ action: 'update', id: ASSIGNMENT_ID, status: 'ACTIVE' });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('assignment_updated'));
  });

  it('renders no transition control for a terminal assignment', () => {
    const { container } = render(<AssignmentStatusForm assignmentId={ASSIGNMENT_ID} options={[]} />);

    expect(container.firstChild).toBeNull();
  });
});

describe('I-5 §3H — POD evidence mirrors the MOD-003 validation', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function fillValid() {
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_pod_recipient'), { target: { value: '  Beira clerk  ' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_pod_signature'), { target: { value: 'pod/signature-1.png' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_pod_photos'), { target: { value: 'pod/photo-1.jpg\n\n  pod/photo-2.jpg  \n' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_pod_latitude'), { target: { value: '-19.84' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_pod_longitude'), { target: { value: '34.84' } });
  }

  it('lists every missing requirement at once and posts nothing', async () => {
    render(<PodForm trackingId={TRACKING_ID} bookingId={BOOKING_ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.submit_pod' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    const alert = screen.getByRole('alert').textContent ?? '';
    for (const key of ['validation_pod_recipient', 'validation_pod_signature', 'validation_pod_photos', 'validation_pod_latitude', 'validation_pod_longitude']) {
      expect(alert).toContain(key);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a GPS fix outside the governed range', async () => {
    render(<PodForm trackingId={TRACKING_ID} bookingId={BOOKING_ID} />);
    fillValid();
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_pod_latitude'), { target: { value: '-91' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_pod_longitude'), { target: { value: '181' } });
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.submit_pod' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('validation_pod_latitude'));
    expect(screen.getByRole('alert').textContent).toContain('validation_pod_longitude');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only photo list', async () => {
    render(<PodForm trackingId={TRACKING_ID} bookingId={BOOKING_ID} />);
    fillValid();
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_pod_photos'), { target: { value: '  \n \n' } });
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.submit_pod' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('validation_pod_photos'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts exactly the payload PodSubmissionService validates', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { ...pod, verificationStatus: 'PENDING' }));

    render(<PodForm trackingId={TRACKING_ID} bookingId={BOOKING_ID} />);
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.submit_pod' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe(`/api/tracking/${TRACKING_ID}/pod`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      bookingId: BOOKING_ID,
      recipientName: 'Beira clerk',
      signatureRef: 'pod/signature-1.png',
      photoRefs: ['pod/photo-1.jpg', 'pod/photo-2.jpg'],
      gpsLat: -19.84,
      gpsLon: 34.84,
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('pod_submitted'));
  });

  it('never sends a verification status, an override or a completion claim', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, pod));

    render(<PodForm trackingId={TRACKING_ID} bookingId={BOOKING_ID} />);
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.submit_pod' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(body).sort()).toEqual(['bookingId', 'gpsLat', 'gpsLon', 'photoRefs', 'recipientName', 'signatureRef']);
  });

  it('surfaces the RLS refusal rather than reporting a submitted POD', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'internal_error', message: 'Failed to submit POD' }));

    render(<PodForm trackingId={TRACKING_ID} bookingId={BOOKING_ID} />);
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.submit_pod' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Failed to submit POD'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('I-5 §3G/§3H — the document read and the read-only card', () => {
  it('reads documents by entity through the session client and maps the row', async () => {
    const { listDocumentsForEntity } = await import('@/app/[locale]/(transporter)/document-reads');

    const documents = await listDocumentsForEntity('contract', 'c-1');

    expect(documents).toEqual([
      {
        id: 'd-contract', documentId: 'DOC-2', documentType: 'CONTRACT', linkedEntityType: 'contract',
        linkedEntityId: 'c-1', status: 'SIGNED', issueDate: undefined, expiryDate: undefined,
        createdAt: '2026-11-11T12:00:00Z',
      },
    ]);
    const query = queries.find((q) => q.table === 'documents');
    expect(query?.schema).toBe('logistics_schema');
    expect(query?.filters).toEqual({ linked_entity_type: 'contract', linked_entity_id: 'c-1', is_deleted: false });
  });

  it('propagates a read failure instead of showing an empty document list', async () => {
    tableData['logistics_schema.documents'] = new Error('permission denied for table documents');
    const { listDocumentsForEntity } = await import('@/app/[locale]/(transporter)/document-reads');

    await expect(listDocumentsForEntity('booking', BOOKING_ID)).rejects.toThrow(/permission denied/);
  });

  it('renders a download link per document and no upload control', async () => {
    const { DocumentsCard } = await vi.importActual<typeof import('@/app/[locale]/(transporter)/documents-card')>(
      '@/app/[locale]/(transporter)/documents-card',
    );
    const { listDocumentsForEntity } = await import('@/app/[locale]/(transporter)/document-reads');
    const documents = [
      ...(await listDocumentsForEntity('booking', BOOKING_ID)),
      ...(await listDocumentsForEntity('contract', 'c-1')),
    ];

    render((await DocumentsCard({ documents, locale: 'en' })) as React.ReactElement);

    const links = screen.getAllByRole('link', { name: 'TransporterDashboard.document_download' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/api/documents/d-booking/download',
      '/api/documents/d-contract/download',
    ]);
    expect(screen.getByText('TransporterDashboard.documents_read_only_notice')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText(/upload/i)).toBeNull();
  });

  it('falls back to the raw vocabulary when a type or status has no label', async () => {
    const { DocumentsCard } = await vi.importActual<typeof import('@/app/[locale]/(transporter)/documents-card')>(
      '@/app/[locale]/(transporter)/documents-card',
    );

    render(
      (await DocumentsCard({
        documents: [{
          id: 'd-x', documentId: 'DOC-X', documentType: 'UNLISTED_TYPE', linkedEntityType: 'booking',
          linkedEntityId: BOOKING_ID, status: 'UNLISTED_STATUS', issueDate: undefined, expiryDate: undefined,
          createdAt: '2026-11-11T11:00:00Z',
        }],
        locale: 'en',
      })) as React.ReactElement,
    );

    expect(screen.getByText('UNLISTED_TYPE')).toBeTruthy();
    expect(screen.getByText('UNLISTED_STATUS')).toBeTruthy();
  });

  it('renders the empty document state', async () => {
    const { DocumentsCard } = await vi.importActual<typeof import('@/app/[locale]/(transporter)/documents-card')>(
      '@/app/[locale]/(transporter)/documents-card',
    );

    render((await DocumentsCard({ documents: [], locale: 'en' })) as React.ReactElement);

    expect(screen.getByText('TransporterDashboard.documents_empty')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('I-5 §3H/§4 — POST /api/tracking/[trackingId]/status decides on the stored state', () => {
  const params = { params: Promise.resolve({ trackingId: TRACKING_ID }) } as any;

  function request(body: unknown) {
    return new NextRequest(`${ORIGIN}/api/tracking/${TRACKING_ID}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function post(body: unknown) {
    const { POST } = await import('@/app/api/tracking/[trackingId]/status/route');
    return POST(request(body), params);
  }

  it('refuses an anonymous caller before the record is read', async () => {
    sessionUser = null;

    const response = await post({ targetStatus: 'DELIVERED' });

    expect(response.status).toBe(401);
    expect(getTracking).not.toHaveBeenCalled();
    expect(rpcCalls.filter((call) => call.name === 'atomic_tracking_status_update')).toHaveLength(0);
  });

  it('refuses a Shipper, who holds no tracking_status authority', async () => {
    rpcAnswers = { ...SHIPPER };

    const response = await post({ targetStatus: 'DELIVERED' });

    expect(response.status).toBe(403);
    expect(getTracking).not.toHaveBeenCalled();
  });

  it('refuses a caller with no resolved role and no delegation', async () => {
    rpcAnswers = { effective_user_role: null, effective_marketplace_role: null, effective_operational_delegation: null };

    const response = await post({ targetStatus: 'DELIVERED' });

    expect(response.status).toBe(403);
  });

  it('refuses a status outside the governed vocabulary', async () => {
    const response = await post({ targetStatus: 'DELIVERED_AND_PAID' });

    expect(response.status).toBe(400);
    expect(getTracking).not.toHaveBeenCalled();
  });

  it('refuses a transition the stored state forbids, without writing', async () => {
    const response = await post({ targetStatus: 'COMPLETED' });

    expect(response.status).toBe(409);
    expect(rpcCalls.filter((call) => call.name === 'atomic_tracking_status_update')).toHaveLength(0);
    expect(markCompleted).not.toHaveBeenCalled();
  });

  it('passes the transition to the SECURITY DEFINER RPC with the caller’s session', async () => {
    const response = await post({ targetStatus: 'DELIVERED', sourceModule: 'MOD-003' });

    expect(response.status).toBe(200);
    const call = rpcCalls.find((entry) => entry.name === 'atomic_tracking_status_update');
    expect(call?.args).toEqual({ p_tracking_id: TRACKING_ID, p_target_status: 'DELIVERED', p_source_module: 'MOD-003' });
    expect(markCompleted).not.toHaveBeenCalled();
  });

  it('stamps completion only when the transition actually reaches COMPLETED', async () => {
    getTracking.mockResolvedValue({ ...record, status: 'DELIVERED' });

    const response = await post({ targetStatus: 'COMPLETED' });

    expect(response.status).toBe(200);
    expect(markCompleted).toHaveBeenCalledWith(TRACKING_ID);
  });

  it('admits a bounded delegation carrying tracking_update', async () => {
    rpcAnswers = {
      effective_user_role: null,
      effective_marketplace_role: null,
      effective_operational_delegation: { principal_transporter_user_id: DELEGATION_PRINCIPAL, scopes: ['tracking_update'] },
    };

    const response = await post({ targetStatus: 'DELIVERED' });

    expect(response.status).toBe(200);
  });

  it('refuses a delegation whose scopes do not cover a tracking update', async () => {
    rpcAnswers = {
      effective_user_role: null,
      effective_marketplace_role: null,
      effective_operational_delegation: { principal_transporter_user_id: DELEGATION_PRINCIPAL, scopes: ['operational_read'] },
    };

    const response = await post({ targetStatus: 'DELIVERED' });

    expect(response.status).toBe(403);
    expect(rpcCalls.filter((call) => call.name === 'atomic_tracking_status_update')).toHaveLength(0);
  });

  it('reports a missing record as a validation failure, not a success', async () => {
    getTracking.mockResolvedValue(null);

    const response = await post({ targetStatus: 'DELIVERED' });

    expect(response.status).toBe(409);
    expect(rpcCalls.filter((call) => call.name === 'atomic_tracking_status_update')).toHaveLength(0);
  });
});

describe('I-5 §3C/§3H — PATCH /api/fleet/assignments binds the write to the session', () => {
  async function patch(body: unknown) {
    const { PATCH } = await import('@/app/api/fleet/assignments/route');
    return PATCH(
      new NextRequest(`${ORIGIN}/api/fleet/assignments`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  }

  it('refuses an anonymous caller before any assignment is created', async () => {
    sessionUser = null;

    const response = await patch({ action: 'create', shipmentTrackingId: TRACKING_ID, vehicleId: VEHICLE_ID });

    expect(response.status).toBe(401);
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it('refuses a Shipper, who holds no fleet_assignments authority', async () => {
    rpcAnswers = { ...SHIPPER };

    const response = await patch({ action: 'create', shipmentTrackingId: TRACKING_ID, vehicleId: VEHICLE_ID });

    expect(response.status).toBe(403);
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it('requires the tracking record and at least one asset', async () => {
    expect((await patch({ action: 'create', vehicleId: VEHICLE_ID })).status).toBe(400);
    expect((await patch({ action: 'create', shipmentTrackingId: TRACKING_ID })).status).toBe(400);
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it('refuses an inverted scheduled window', async () => {
    const response = await patch({
      action: 'create', shipmentTrackingId: TRACKING_ID, vehicleId: VEHICLE_ID,
      scheduledStart: '2026-12-02T10:00:00Z', scheduledEnd: '2026-12-01T10:00:00Z',
    });

    expect(response.status).toBe(400);
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it('records the session user as the creator and defaults the assignment to PLANNED', async () => {
    const response = await patch({ action: 'create', shipmentTrackingId: TRACKING_ID, vehicleId: VEHICLE_ID, driverId: DRIVER_ID });

    expect(response.status).toBe(201);
    const input = createAssignment.mock.calls[0][0];
    expect(input.createdBy).toBe(USER_ID);
    expect(input.status).toBe('PLANNED');
    expect(input.vehicleId).toBe(VEHICLE_ID);
    expect(input.driverId).toBe(DRIVER_ID);
    expect(input.shipmentTrackingId).toBe(TRACKING_ID);
  });

  it('applies a permitted assignment transition', async () => {
    const response = await patch({ action: 'update', id: ASSIGNMENT_ID, status: 'ACTIVE' });

    expect(response.status).toBe(200);
    expect(updateAssignment).toHaveBeenCalledWith(ASSIGNMENT_ID, expect.objectContaining({ status: 'ACTIVE' }));
  });

  // Pre-existing defect, disclosed rather than amended under I-5: applyAssignmentTransition throws instead of
  // returning false, so the handler's boolean check never runs and the refusal escapes as a 500. The write is
  // still refused, which is the security-relevant half; the status code is wrong.
  it('refuses a forbidden assignment transition without writing, but reports it as a 500', async () => {
    getAssignment.mockResolvedValue({ ...assignment, status: 'COMPLETED' });

    const response = await patch({ action: 'update', id: ASSIGNMENT_ID, status: 'ACTIVE' });

    expect(response.status).toBe(500);
    expect(updateAssignment).not.toHaveBeenCalled();
  });

  it('refuses a transition on an assignment this session cannot read', async () => {
    getAssignment.mockResolvedValue(null);

    const response = await patch({ action: 'update', id: ASSIGNMENT_ID, status: 'ACTIVE' });

    expect(response.status).toBe(404);
    expect(updateAssignment).not.toHaveBeenCalled();
  });

  it('refuses an unknown action', async () => {
    expect((await patch({ action: 'delete', id: ASSIGNMENT_ID })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect(updateAssignment).not.toHaveBeenCalled();
    expect(createAssignment).not.toHaveBeenCalled();
  });
});