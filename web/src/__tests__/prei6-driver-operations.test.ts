// NexCargo PRE-I-6 FINAL COMPLETION DIRECTIVE Item 3 — minimal Driver operations at the API boundary.
//
// Handler-level tests: the real route handlers, assertApiAuth/assertApiAuthorization, evaluateRBAC and
// resolveDriverAssignment run unmodified against a stubbed session client. The stub mirrors the live
// SECURITY DEFINER role resolvers and the drivers/asset_assignments self-read surface; what is proved
// here is the application half of the assignment-scoped, role-less Driver boundary. The database half
// (migration 070's INSERT/SELECT policies and the atomic_tracking_status_update driver branch) is
// verified separately against the live project; nothing here is RLS proof.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

const DRIVER_ACCOUNT = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const TRANSPORTER = 'bbbbbbbb-0000-4000-8000-0000000000b2';
const TRACKING_ID = 'tttttttt-0000-4000-8000-0000000000t1';
const OTHER_TRACKING = 'tttttttt-0000-4000-8000-0000000000t2';
const BOOKING_ID = 'kkkkkkkk-0000-4000-8000-0000000000k1';
const DRIVER_ROW_ID = 'dddddddd-0000-4000-8000-0000000000d1';
const ASSIGNMENT_ID = 'ssssssss-0000-4000-8000-0000000000s1';

let sessionUserId: string | null = DRIVER_ACCOUNT;
let marketplace: string | null = null;
let platform: string | null = null;
let driverRow: { id: string } | null = { id: DRIVER_ROW_ID };
let assignmentRow: { id: string; trackingId: string; status: string } | null = {
  id: ASSIGNMENT_ID,
  trackingId: TRACKING_ID,
  status: 'ACTIVE',
};
let queryError = false;

/** Mirrors the live resolvers (keyed on the session) and the driver self-read RLS surface. */
function sessionClient() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: sessionUserId === null ? null : {
            id: sessionUserId,
            email: 'driver-account@example.mz',
            created_at: '2026-01-15T00:00:00Z',
            user_metadata: {},
          },
        },
        error: null,
      })),
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'effective_marketplace_role') return { data: marketplace, error: null };
      if (fn === 'effective_user_role') return { data: platform, error: null };
      if (fn === 'effective_operational_delegation') return { data: null, error: null };
      return { data: null, error: new Error('unexpected rpc in this fixture') };
    }),
    schema: vi.fn(() => ({ from: (table: string) => tableQuery(table) })),
    from: (table: string) => tableQuery(table),
  };
}

function tableQuery(table: string) {
  const filters: Record<string, unknown> = {};
  let statusFilter: string[] | null = null;
  const q: any = {
    select: () => q,
    eq: (c: string, v: unknown) => { filters[c] = v; return q; },
    in: (c: string, v: string[]) => { if (c === 'status') statusFilter = v; return q; },
    order: () => q,
    limit: () => q,
    maybeSingle: async () => {
      if (queryError) return { data: null, error: new Error('database unavailable') };
      const drv = driverRow;
      const asg = assignmentRow;
      if (table === 'drivers') {
        const visible = drv !== null && filters['platform_user_id'] === sessionUserId;
        return { data: visible ? { id: drv!.id } : null, error: null };
      }
      if (table === 'asset_assignments') {
        const visible = asg !== null && drv !== null
          && filters['driver_id'] === drv.id
          && filters['shipment_tracking_id'] === asg.trackingId
          && (statusFilter === null || statusFilter.includes(asg.status));
        return { data: visible ? { id: asg.id } : null, error: null };
      }
      return { data: null, error: null };
    },
  };
  return q;
}

const getTrackingById = vi.fn();
const getBookingById = vi.fn();
const submitPOD = vi.fn();
const ingestGps = vi.fn();
const updateTrackingStatus = vi.fn();
const createDiv = vi.fn();

vi.doMock('@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository', () => ({
  TrackingRecordRepository: class { getById = getTrackingById; },
}));
vi.doMock('@/infrastructure/repositories/bookings-repository', () => ({
  BookingsRepository: class { getById = getBookingById; },
}));
vi.doMock('@/modules/mod-003-tracking/application/services/pod-submission-service', () => ({
  PodSubmissionService: class { submitPOD = submitPOD; },
}));
vi.doMock('@/modules/mod-003-tracking/application/services/gps-ingestion-service', () => ({
  GpsIngestionService: class { ingest = ingestGps; },
}));
vi.doMock('@/modules/mod-003-tracking/application/services/tracking-orchestrator-service', () => ({
  TrackingOrchestratorService: class { updateTrackingStatus = updateTrackingStatus; },
}));
vi.doMock('@/modules/mod-003-tracking/infrastructure/repositories/driver-identity-verification-repository', () => ({
  DriverIdentityVerificationRepository: class { create = createDiv; },
}));

function trackingRecord(status: string) {
  return { id: TRACKING_ID, bookingId: BOOKING_ID, status, visibilityLevel: 'RESTRICTED' };
}

const podBody = {
  bookingId: BOOKING_ID,
  recipientName: 'Ana Recipient',
  signatureRef: 'pod/signature.png',
  photoRefs: ['pod/photo-1.jpg'],
  gpsLat: -25.96,
  gpsLon: 32.58,
};

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const paramsOf = (trackingId: string) => ({ params: Promise.resolve({ trackingId }) }) as any;

let gpsPOST: typeof import('@/app/api/tracking/[trackingId]/gps/route').POST;
let statusPOST: typeof import('@/app/api/tracking/[trackingId]/status/route').POST;
let podPOST: typeof import('@/app/api/tracking/[trackingId]/pod/route').POST;
let pickupProofPOST: typeof import('@/app/api/tracking/[trackingId]/pickup-proof/route').POST;

beforeEach(async () => {
  vi.clearAllMocks();
  sessionUserId = DRIVER_ACCOUNT;
  marketplace = null;
  platform = null;
  driverRow = { id: DRIVER_ROW_ID };
  assignmentRow = { id: ASSIGNMENT_ID, trackingId: TRACKING_ID, status: 'ACTIVE' };
  queryError = false;
  createClientMock.mockResolvedValue(sessionClient() as never);
  getTrackingById.mockResolvedValue(trackingRecord('DELIVERED'));
  getBookingById.mockResolvedValue({ bookingId: BOOKING_ID, transporterId: TRANSPORTER });
  submitPOD.mockResolvedValue({ id: 'pod-1', verificationStatus: 'PENDING' });
  ingestGps.mockResolvedValue(undefined);
  updateTrackingStatus.mockResolvedValue(undefined);
  createDiv.mockResolvedValue({ id: 'div-1', status: 'SUCCESS' });

  gpsPOST = (await import('@/app/api/tracking/[trackingId]/gps/route')).POST;
  statusPOST = (await import('@/app/api/tracking/[trackingId]/status/route')).POST;
  podPOST = (await import('@/app/api/tracking/[trackingId]/pod/route')).POST;
  pickupProofPOST = (await import('@/app/api/tracking/[trackingId]/pickup-proof/route')).POST;
});

describe('Item 3 §A — resolveDriverAssignment resolves under the caller\'s own session', () => {
  it('returns the driver and assignment when the link and a PLANNED/ACTIVE assignment exist', async () => {
    const { resolveDriverAssignment } = await import('@/lib/auth/driver-assignment');
    await expect(resolveDriverAssignment(DRIVER_ACCOUNT, TRACKING_ID)).resolves.toEqual({
      driverId: DRIVER_ROW_ID,
      assignmentId: ASSIGNMENT_ID,
    });
  });

  it('returns null without a driver link, without an assignment, or for a different shipment', async () => {
    const { resolveDriverAssignment } = await import('@/lib/auth/driver-assignment');
    driverRow = null;
    await expect(resolveDriverAssignment(DRIVER_ACCOUNT, TRACKING_ID)).resolves.toBeNull();
    driverRow = { id: DRIVER_ROW_ID };
    assignmentRow = null;
    await expect(resolveDriverAssignment(DRIVER_ACCOUNT, TRACKING_ID)).resolves.toBeNull();
    assignmentRow = { id: ASSIGNMENT_ID, trackingId: OTHER_TRACKING, status: 'ACTIVE' };
    await expect(resolveDriverAssignment(DRIVER_ACCOUNT, TRACKING_ID)).resolves.toBeNull();
  });

  it('does not admit a COMPLETED assignment and fails closed on a query error', async () => {
    const { resolveDriverAssignment } = await import('@/lib/auth/driver-assignment');
    assignmentRow = { id: ASSIGNMENT_ID, trackingId: TRACKING_ID, status: 'COMPLETED' };
    await expect(resolveDriverAssignment(DRIVER_ACCOUNT, TRACKING_ID)).resolves.toBeNull();
    assignmentRow = { id: ASSIGNMENT_ID, trackingId: TRACKING_ID, status: 'ACTIVE' };
    queryError = true;
    await expect(resolveDriverAssignment(DRIVER_ACCOUNT, TRACKING_ID)).resolves.toBeNull();
  });
});

describe('Item 3 §B — GPS submission is assignment-scoped and role-less', () => {
  it('answers 401 without a session', async () => {
    sessionUserId = null;
    const r = await gpsPOST(post(`/api/tracking/${TRACKING_ID}/gps`, { latitude: -25.9, longitude: 32.5 }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(401);
    expect(ingestGps).not.toHaveBeenCalled();
  });

  it('admits the assigned role-less Driver', async () => {
    const r = await gpsPOST(post(`/api/tracking/${TRACKING_ID}/gps`, { latitude: -25.9, longitude: 32.5 }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(200);
    expect(ingestGps).toHaveBeenCalledTimes(1);
  });

  it('refuses a role-less account without an assignment for this record', async () => {
    assignmentRow = { id: ASSIGNMENT_ID, trackingId: OTHER_TRACKING, status: 'ACTIVE' };
    const r = await gpsPOST(post(`/api/tracking/${TRACKING_ID}/gps`, { latitude: -25.9, longitude: 32.5 }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(403);
    expect(ingestGps).not.toHaveBeenCalled();
  });

  it('refuses a role-holder even when a driver link exists — the boundary is role-less', async () => {
    marketplace = 'TRANSPORTER';
    const r = await gpsPOST(post(`/api/tracking/${TRACKING_ID}/gps`, { latitude: -25.9, longitude: 32.5 }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(403);
    expect(ingestGps).not.toHaveBeenCalled();
  });
});

describe('Item 3 §C — status transitions: Drivers progress, never terminate', () => {
  it('admits an assigned Driver for an operational transition', async () => {
    const r = await statusPOST(post(`/api/tracking/${TRACKING_ID}/status`, { targetStatus: 'PICKUP_ACKNOWLEDGED' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(200);
    expect(updateTrackingStatus).toHaveBeenCalledWith(TRACKING_ID, 'PICKUP_ACKNOWLEDGED', 'MOD-003');
  });

  it.each(['COMPLETED', 'CANCELLED'])('refuses a Driver target of %s before any orchestrator call', async (target) => {
    const r = await statusPOST(post(`/api/tracking/${TRACKING_ID}/status`, { targetStatus: target }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(403);
    expect(updateTrackingStatus).not.toHaveBeenCalled();
  });

  it('refuses a role-less account without an assignment', async () => {
    assignmentRow = null;
    const r = await statusPOST(post(`/api/tracking/${TRACKING_ID}/status`, { targetStatus: 'IN_TRANSIT' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(403);
    expect(updateTrackingStatus).not.toHaveBeenCalled();
  });

  it('keeps a Shipper refused — the fallback never widens role-holder authority', async () => {
    marketplace = 'SHIPPER';
    const r = await statusPOST(post(`/api/tracking/${TRACKING_ID}/status`, { targetStatus: 'IN_TRANSIT' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(403);
    expect(updateTrackingStatus).not.toHaveBeenCalled();
  });

  it('keeps the Transporter matrix path intact', async () => {
    sessionUserId = TRANSPORTER;
    marketplace = 'TRANSPORTER';
    driverRow = null;
    assignmentRow = null;
    const r = await statusPOST(post(`/api/tracking/${TRACKING_ID}/status`, { targetStatus: 'IN_TRANSIT' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(200);
    expect(updateTrackingStatus).toHaveBeenCalledTimes(1);
  });
});

describe('Item 3 §D — POD submission through the Driver path', () => {
  it('admits an assigned Driver on a DELIVERED record without the booking-transporter ownership read', async () => {
    const r = await podPOST(post(`/api/tracking/${TRACKING_ID}/pod`, podBody), paramsOf(TRACKING_ID));
    expect(r.status).toBe(201);
    expect(submitPOD).toHaveBeenCalledTimes(1);
    expect(getBookingById).not.toHaveBeenCalled();
  });

  it('still pins the submitted bookingId to the tracking record\'s own booking', async () => {
    const r = await podPOST(post(`/api/tracking/${TRACKING_ID}/pod`, { ...podBody, bookingId: 'kkkkkkkk-0000-4000-8000-0000000000k9' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('keeps the DELIVERED lifecycle gate for the Driver path', async () => {
    getTrackingById.mockResolvedValue(trackingRecord('IN_TRANSIT'));
    const r = await podPOST(post(`/api/tracking/${TRACKING_ID}/pod`, podBody), paramsOf(TRACKING_ID));
    expect(r.status).toBe(409);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('refuses a role-less account without an assignment', async () => {
    driverRow = null;
    const r = await podPOST(post(`/api/tracking/${TRACKING_ID}/pod`, podBody), paramsOf(TRACKING_ID));
    expect(r.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });
});

describe('Item 3 §E — pickup proof is the Driver Identity Verification entity', () => {
  beforeEach(() => {
    getTrackingById.mockResolvedValue(trackingRecord('AWAITING_PICKUP'));
  });

  it('answers 401 without a session', async () => {
    sessionUserId = null;
    const r = await pickupProofPOST(post(`/api/tracking/${TRACKING_ID}/pickup-proof`, { method: 'QR_CODE' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(401);
    expect(createDiv).not.toHaveBeenCalled();
  });

  it('records a SUCCESS verification pinned to the assigned driver and the record\'s booking', async () => {
    const r = await pickupProofPOST(post(`/api/tracking/${TRACKING_ID}/pickup-proof`, { method: 'QR_CODE' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(201);
    expect(createDiv).toHaveBeenCalledTimes(1);
    const input = createDiv.mock.calls[0][0];
    expect(input).toMatchObject({
      trackingId: TRACKING_ID,
      bookingId: BOOKING_ID,
      driverId: DRIVER_ROW_ID,
      method: 'QR_CODE',
      status: 'SUCCESS',
    });
    expect(typeof input.verifiedAt).toBe('string');
  });

  it('refuses a role-holder and a role-less account without an assignment', async () => {
    marketplace = 'TRANSPORTER';
    expect((await pickupProofPOST(post(`/api/tracking/${TRACKING_ID}/pickup-proof`, { method: 'QR_CODE' }), paramsOf(TRACKING_ID))).status).toBe(403);
    marketplace = null;
    assignmentRow = null;
    expect((await pickupProofPOST(post(`/api/tracking/${TRACKING_ID}/pickup-proof`, { method: 'QR_CODE' }), paramsOf(TRACKING_ID))).status).toBe(403);
    expect(createDiv).not.toHaveBeenCalled();
  });

  it('refuses a method outside the MOD-003 §4.7 vocabulary', async () => {
    const r = await pickupProofPOST(post(`/api/tracking/${TRACKING_ID}/pickup-proof`, { method: 'SELFIE' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(400);
    expect(createDiv).not.toHaveBeenCalled();
  });

  it('refuses pickup evidence outside the AWAITING_PICKUP stage', async () => {
    getTrackingById.mockResolvedValue(trackingRecord('IN_TRANSIT'));
    const r = await pickupProofPOST(post(`/api/tracking/${TRACKING_ID}/pickup-proof`, { method: 'OTP' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(409);
    expect(createDiv).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown tracking record', async () => {
    getTrackingById.mockResolvedValue(null);
    const r = await pickupProofPOST(post(`/api/tracking/${TRACKING_ID}/pickup-proof`, { method: 'OTP' }), paramsOf(TRACKING_ID));
    expect(r.status).toBe(404);
    expect(createDiv).not.toHaveBeenCalled();
  });
});