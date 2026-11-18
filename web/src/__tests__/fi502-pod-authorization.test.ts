// NexCargo F-I5-02 — POD authorization, ownership and lifecycle at the API boundary.
//
// What runs for real here: both POD route handlers, assertApiAuthorization, resolveEffectiveRoles,
// resolveOperationalDelegation and evaluateRBAC are unmodified. Only the Supabase session client,
// the tracking/booking repositories and PodSubmissionService are replaced, so the authority a case
// exercises is the value the authoritative membership resolver returns — never a claim the request
// supplies. Every rejection also asserts that POD persistence was never reached.
//
// What is deliberately NOT here: the database INSERT/UPDATE policies. A mocked repository cannot
// exercise RLS, so migration 063's WITH CHECK and the platform-only UPDATE policy are proven
// separately against the live database with rolled-back probes. The service/repository/orchestrator
// corrections (verify() .select(), VERIFIED-before-COMPLETED) are covered by
// fi502-pod-lifecycle-services.test.ts against the real classes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

const TRANSPORTER_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const TRANSPORTER_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const SHIPPER = 'cccccccc-0000-4000-8000-000000000003';
const MODERATOR = 'dddddddd-0000-4000-8000-000000000005';
const TRACKING_ID = 'tttttttt-0000-4000-8000-000000000006';
const BOOKING_ID = 'kkkkkkkk-0000-4000-8000-000000000007';
const POD_ID = 'pppppppp-0000-4000-8000-000000000008';

interface SessionOptions {
  userId?: string | null;
  marketplace?: string | null;
  platform?: string | null;
  delegation?: { principal_transporter_user_id: string; scopes: string[] } | null;
  resolverError?: boolean;
  metadata?: Record<string, unknown>;
}

/** Mirrors the live SECURITY DEFINER resolvers: keyed on the session, no caller-supplied identity. */
function sessionClient(options: SessionOptions = {}) {
  const {
    userId = TRANSPORTER_A,
    marketplace = 'TRANSPORTER',
    platform = null,
    delegation = null,
    resolverError = false,
    metadata = {},
  } = options;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId === null ? null : {
            id: userId,
            email: 'participant@example.mz',
            created_at: '2026-01-15T00:00:00Z',
            user_metadata: metadata,
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'effective_marketplace_role') {
        return resolverError
          ? { data: null, error: new Error('resolver unavailable') }
          : { data: marketplace, error: null };
      }
      if (fn === 'effective_user_role') return { data: platform, error: null };
      if (fn === 'effective_operational_delegation') return { data: delegation, error: null };
      return { data: null, error: new Error('unexpected rpc in this fixture') };
    }),
    // PRE-I-6 Item 3: the POD route's Driver fallback resolves drivers/asset_assignments under the
    // session. This fixture has no driver rows, so the lookup returns null and the denial stands.
    schema: vi.fn(() => ({
      from: vi.fn(() => {
        const q: any = {
          select: () => q,
          eq: () => q,
          in: () => q,
          order: () => q,
          limit: () => q,
          single: vi.fn().mockResolvedValue({ data: { created_at: '2026-02-01T00:00:00Z' }, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (res: (v: unknown) => void) => res({ data: null, error: null }),
        };
        return q;
      }),
    })),
  };
}

const getTrackingById = vi.fn();
const getBookingById = vi.fn();
const submitPOD = vi.fn();
const verifyPOD = vi.fn();
const completeAfterPODVVerification = vi.fn();

vi.doMock('@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository', () => ({
  TrackingRecordRepository: class { getById = getTrackingById; },
}));
vi.doMock('@/infrastructure/repositories/bookings-repository', () => ({
  BookingsRepository: class { getById = getBookingById; },
}));
vi.doMock('@/modules/mod-003-tracking/application/services/pod-submission-service', () => ({
  PodSubmissionService: class {
    submitPOD = submitPOD;
    verifyPOD = verifyPOD;
    completeAfterPODVVerification = completeAfterPODVVerification;
  },
}));

function trackingRecord(status: string) {
  return {
    id: TRACKING_ID,
    trackingRef: 'TRK-20261115-TEST01',
    bookingId: BOOKING_ID,
    contractId: undefined,
    status,
    visibilityLevel: 'RESTRICTED',
    activatedAt: '2026-11-10T08:00:00Z',
    completedAt: undefined,
    lastUpdated: '2026-11-14T10:00:00Z',
    createdAt: '2026-11-10T08:00:00Z',
    updatedAt: '2026-11-14T10:00:00Z',
  };
}

const ownBooking = { bookingId: BOOKING_ID, transporterId: TRANSPORTER_A, shipperId: SHIPPER };

const createdPod = {
  id: POD_ID,
  trackingId: TRACKING_ID,
  bookingId: BOOKING_ID,
  recipientName: 'Ana Recipient',
  signatureRef: 'pod/signature.png',
  photoRefs: ['pod/photo-1.jpg'],
  gpsLat: -25.96,
  gpsLon: 32.58,
  submissionMethod: 'ONLINE',
  verificationStatus: 'PENDING',
  adminOverride: false,
  submittedAt: '2026-11-15T09:00:00Z',
  verifiedAt: undefined,
  createdAt: '2026-11-15T09:00:00Z',
  updatedAt: '2026-11-15T09:00:00Z',
};

/** The payload the Transporter POD form actually sends: it never names an actor identity. */
const legitimateBody = {
  bookingId: BOOKING_ID,
  recipientName: 'Ana Recipient',
  signatureRef: 'pod/signature.png',
  photoRefs: ['pod/photo-1.jpg'],
  gpsLat: -25.96,
  gpsLon: 32.58,
};

function postPod(body: unknown, trackingId: string = TRACKING_ID) {
  return new NextRequest(`http://localhost:3000/api/tracking/${trackingId}/pod`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function patchVerify(body: unknown) {
  return new NextRequest(`http://localhost:3000/api/tracking/${TRACKING_ID}/pod/${POD_ID}/verify`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let podPOST: typeof import('@/app/api/tracking/[trackingId]/pod/route').POST;
let verifyPATCH: typeof import('@/app/api/tracking/[trackingId]/pod/[podId]/verify/route').PATCH;

beforeEach(async () => {
  createClientMock.mockReset();
  createClientMock.mockResolvedValue(sessionClient() as never);
  for (const fn of [getTrackingById, getBookingById, submitPOD, verifyPOD, completeAfterPODVVerification]) {
    fn.mockReset();
  }
  getTrackingById.mockResolvedValue(trackingRecord('DELIVERED'));
  getBookingById.mockResolvedValue(ownBooking);
  submitPOD.mockResolvedValue(createdPod);
  verifyPOD.mockResolvedValue(undefined);

  const submitRoute = await import('@/app/api/tracking/[trackingId]/pod/route');
  const verifyRoute = await import('@/app/api/tracking/[trackingId]/pod/[podId]/verify/route');
  podPOST = submitRoute.POST;
  verifyPATCH = verifyRoute.PATCH;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('F-I5-02 §6A — who may submit POD', () => {
  it('accepts an authorized Transporter for its own DELIVERED shipment', async () => {
    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(201);
    expect(submitPOD).toHaveBeenCalledTimes(1);
    expect(submitPOD.mock.calls[0][0]).toMatchObject({ trackingId: TRACKING_ID, bookingId: BOOKING_ID });
    await expect(response.json()).resolves.toMatchObject({ id: POD_ID, verificationStatus: 'PENDING' });
  });

  it('refuses an unauthenticated request with 401 before any read or write', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: null }) as never);

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(401);
    expect(submitPOD).not.toHaveBeenCalled();
    expect(getTrackingById).not.toHaveBeenCalled();
  });

  it('refuses an authenticated Shipper with 403', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: SHIPPER, marketplace: 'SHIPPER' }) as never);

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: 'forbidden' });
  });

  it('refuses a user with no effective marketplace membership', async () => {
    createClientMock.mockResolvedValue(sessionClient({ marketplace: null, platform: null }) as never);

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('fails closed when the authoritative resolver is unavailable', async () => {
    createClientMock.mockResolvedValue(sessionClient({ resolverError: true }) as never);

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('refuses a delegated Dispatcher even with every operational scope', async () => {
    createClientMock.mockResolvedValue(sessionClient({
      userId: 'eeeeeeee-0000-4000-8000-000000000009',
      marketplace: null,
      platform: null,
      delegation: {
        principal_transporter_user_id: TRANSPORTER_A,
        scopes: ['operational_read', 'assignment_manage', 'tracking_update'],
      },
    }) as never);

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('refuses platform governance tiers on the submission path (pod_create is Transporter-only)', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: MODERATOR, marketplace: null, platform: 'MODERATOR' }) as never);

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('does not let client-supplied role or identity claims confer authority', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: SHIPPER, marketplace: 'SHIPPER' }) as never);

    const response = await podPOST(postPod({
      ...legitimateBody,
      role: 'TRANSPORTER',
      transporterId: TRANSPORTER_A,
      driverId: 'ffffffff-0000-4000-8000-00000000000a',
    }), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('does not treat user_metadata.role as authority', async () => {
    createClientMock.mockResolvedValue(sessionClient({
      marketplace: null,
      platform: null,
      metadata: { role: 'TRANSPORTER' },
    }) as never);

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });
});

describe('F-I5-02 §4.2 — ownership and tenant boundaries', () => {
  it('answers 404 when RLS hides another Transporter\'s tracking record', async () => {
    getTrackingById.mockResolvedValue(null);

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(404);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('refuses when the persisted booking names a different Transporter', async () => {
    getBookingById.mockResolvedValue({ ...ownBooking, transporterId: TRANSPORTER_B });

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('refuses a client-supplied bookingId that is not the tracking record\'s booking', async () => {
    const response = await podPOST(postPod({
      ...legitimateBody,
      bookingId: 'kkkkkkkk-0000-4000-8000-000000000099',
    }), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(403);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('answers 404 when the booking is not readable', async () => {
    getBookingById.mockResolvedValue(null);

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(404);
    expect(submitPOD).not.toHaveBeenCalled();
  });
});

describe('F-I5-02 §4.3 — lifecycle gate from persisted state', () => {
  it.each([
    'CREATED', 'BOOKED', 'AWAITING_PICKUP', 'PICKUP_ACKNOWLEDGED', 'IN_TRANSIT', 'AT_BORDER', 'DELAYED',
  ])('refuses premature submission at %s with 409', async (status) => {
    getTrackingById.mockResolvedValue(trackingRecord(status));

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(409);
    expect(submitPOD).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: 'conflict' });
  });

  it.each(['COMPLETED', 'CANCELLED'])('refuses submission at terminal state %s with 409', async (status) => {
    getTrackingById.mockResolvedValue(trackingRecord(status));

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(409);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('cannot be bypassed by a client-supplied status claim', async () => {
    getTrackingById.mockResolvedValue(trackingRecord('IN_TRANSIT'));

    const response = await podPOST(postPod({
      ...legitimateBody,
      status: 'DELIVERED',
      targetStatus: 'DELIVERED',
      trackingStatus: 'DELIVERED',
    }), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(409);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('accepts at the canonical DELIVERED stage only', async () => {
    getTrackingById.mockResolvedValue(trackingRecord('DELIVERED'));

    const response = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(201);
    expect(submitPOD).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing repeat-submission persistence design (no uniqueness invented)', async () => {
    const first = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });
    const second = await podPOST(postPod(legitimateBody), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(submitPOD).toHaveBeenCalledTimes(2);
  });
});

describe('F-I5-02 §4.1 — validation semantics preserved', () => {
  it('answers 400 for missing required fields', async () => {
    const { signatureRef: _omitted, ...malformed } = legitimateBody;

    const response = await podPOST(postPod(malformed), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(400);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('answers 400 for non-numeric GPS', async () => {
    const response = await podPOST(postPod({ ...legitimateBody, gpsLat: 'south' }), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(400);
    expect(submitPOD).not.toHaveBeenCalled();
  });

  it('answers 400 for an empty photo array', async () => {
    const response = await podPOST(postPod({ ...legitimateBody, photoRefs: [] }), { params: Promise.resolve({ trackingId: TRACKING_ID }) });

    expect(response.status).toBe(400);
    expect(submitPOD).not.toHaveBeenCalled();
  });
});

describe('F-I5-02 §6C — platform-only verification boundary', () => {
  it('allows MODERATOR to approve a POD', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: MODERATOR, marketplace: null, platform: 'MODERATOR' }) as never);

    const response = await verifyPATCH(patchVerify({ verify: true }), { params: Promise.resolve({ trackingId: TRACKING_ID, podId: POD_ID }) });

    expect(response.status).toBe(200);
    expect(verifyPOD).toHaveBeenCalledWith(POD_ID, true, undefined);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it('allows ADMIN to reject a POD', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: MODERATOR, marketplace: null, platform: 'ADMIN' }) as never);

    const response = await verifyPATCH(patchVerify({ verify: false }), { params: Promise.resolve({ trackingId: TRACKING_ID, podId: POD_ID }) });

    expect(response.status).toBe(200);
    expect(verifyPOD).toHaveBeenCalledWith(POD_ID, false, undefined);
  });

  it('refuses an unauthenticated verification with 401', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: null }) as never);

    const response = await verifyPATCH(patchVerify({ verify: true }), { params: Promise.resolve({ trackingId: TRACKING_ID, podId: POD_ID }) });

    expect(response.status).toBe(401);
    expect(verifyPOD).not.toHaveBeenCalled();
  });

  it('refuses Transporter self-verification with 403', async () => {
    const response = await verifyPATCH(patchVerify({ verify: true }), { params: Promise.resolve({ trackingId: TRACKING_ID, podId: POD_ID }) });

    expect(response.status).toBe(403);
    expect(verifyPOD).not.toHaveBeenCalled();
  });

  it('refuses Shipper verification with 403', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: SHIPPER, marketplace: 'SHIPPER' }) as never);

    const response = await verifyPATCH(patchVerify({ verify: true }), { params: Promise.resolve({ trackingId: TRACKING_ID, podId: POD_ID }) });

    expect(response.status).toBe(403);
    expect(verifyPOD).not.toHaveBeenCalled();
  });

  it('refuses a delegated Dispatcher verification with 403', async () => {
    createClientMock.mockResolvedValue(sessionClient({
      userId: 'eeeeeeee-0000-4000-8000-000000000009',
      marketplace: null,
      platform: null,
      delegation: {
        principal_transporter_user_id: TRANSPORTER_A,
        scopes: ['operational_read', 'assignment_manage', 'tracking_update'],
      },
    }) as never);

    const response = await verifyPATCH(patchVerify({ verify: true }), { params: Promise.resolve({ trackingId: TRACKING_ID, podId: POD_ID }) });

    expect(response.status).toBe(403);
    expect(verifyPOD).not.toHaveBeenCalled();
  });

  it('answers 400 when verify is not a boolean', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: MODERATOR, marketplace: null, platform: 'MODERATOR' }) as never);

    const response = await verifyPATCH(patchVerify({ verify: 'yes' }), { params: Promise.resolve({ trackingId: TRACKING_ID, podId: POD_ID }) });

    expect(response.status).toBe(400);
    expect(verifyPOD).not.toHaveBeenCalled();
  });

  it('answers 409 when the POD is already verified/rejected or absent', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: MODERATOR, marketplace: null, platform: 'MODERATOR' }) as never);
    verifyPOD.mockRejectedValue(new ValidationError('POD not found or already verified/rejected'));

    const response = await verifyPATCH(patchVerify({ verify: true }), { params: Promise.resolve({ trackingId: TRACKING_ID, podId: POD_ID }) });

    expect(response.status).toBe(409);
  });

  it('keeps verification distinct from completion — approval never completes the shipment', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: MODERATOR, marketplace: null, platform: 'MODERATOR' }) as never);

    const response = await verifyPATCH(patchVerify({ verify: true }), { params: Promise.resolve({ trackingId: TRACKING_ID, podId: POD_ID }) });

    expect(response.status).toBe(200);
    expect(completeAfterPODVVerification).not.toHaveBeenCalled();
  });
});