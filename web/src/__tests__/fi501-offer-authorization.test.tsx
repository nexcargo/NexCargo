// NexCargo F-I5-01 — offer-creation authority at the application boundary, and the regressions the
// correction must not cause.
//
// What runs for real here: the route handlers, assertApiAuthorization, resolveEffectiveRoles and
// evaluateRBAC are all unmodified. Only the Supabase session client and the repositories are replaced, so
// the authority a case exercises is the value the authoritative membership resolver returns — never a
// claim the request supplies. Every rejection also asserts that persistence was never reached, which is
// what separates "answered 403" from "refused before writing".
//
// What is deliberately NOT here: the database INSERT policy. A mocked repository cannot exercise RLS, so
// migration 064's WITH CHECK is proven separately against the live database by a rolled-back five-case
// battery whose positive control is a successful Transporter insert.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { evaluateRBAC } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const TRANSPORTER_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const TRANSPORTER_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const SHIPPER = 'cccccccc-0000-4000-8000-000000000003';
const LISTING_ID = 'llllllll-0000-4000-8000-000000000004';

interface SessionOptions {
  userId?: string | null;
  marketplace?: string | null;
  platform?: string | null;
  delegation?: { principal_transporter_user_id: string; scopes: string[] } | null;
  resolverError?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * The three resolvers answer exactly as the live SECURITY DEFINER functions do: keyed on the session,
 * accepting no caller-supplied user id. `resolverError` reproduces an unavailable resolver, which
 * role-authority.ts must turn into a denial rather than a downgrade.
 */
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

const listById = vi.fn();
const listPublished = vi.fn();
const listByListing = vi.fn();
const listByTransporter = vi.fn();
const createOffer = vi.fn();
const updateStatus = vi.fn();
const listByShipper = vi.fn();

vi.doMock('@/infrastructure/repositories/listings-repository', () => ({
  ListingsRepository: class { getById = listById; listPublished = listPublished; },
}));
vi.doMock('@/infrastructure/repositories/offers-repository', () => ({
  OffersRepository: class {
    listByListing = listByListing;
    listByTransporter = listByTransporter;
    create = createOffer;
    updateStatus = updateStatus;
  },
}));
vi.doMock('@/infrastructure/repositories/bookings-repository', () => ({
  BookingsRepository: class { listByShipper = listByShipper; },
}));

const storedListing = {
  listingId: LISTING_ID,
  shipperId: SHIPPER,
  title: 'Crates to Beira',
  description: '20 pallets, side loader',
  origin: { latitude: -25.96, longitude: 32.58, address: 'Maputo Port' },
  destination: { latitude: -19.84, longitude: 34.84, address: 'Beira Terminal' },
  cargoType: 'GENERAL',
  weightKg: 10000,
  volumeM3: 20,
  timeWindow: { earliestPickup: '2026-12-01T08:00:00Z', latestDelivery: '2026-12-05T18:00:00Z' },
  pricingModel: 'FIXED',
  status: 'PUBLISHED',
  publishedAt: '2026-11-02T09:00:00Z',
  acceptedVehicleTypes: [],
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-02T09:00:00Z',
};

function storedOffer(offerId: string, transporterId: string, priceProposal: number) {
  return {
    offerId,
    transporterId,
    listingId: LISTING_ID,
    priceProposal,
    availabilityWindow: {
      earliestPickup: '2026-12-01T09:00:00Z',
      latestPickup: '2026-12-01T14:00:00Z',
      estimatedDelivery: '2026-12-04T18:00:00Z',
    },
    vehicleType: 'HEAVY_TRUCK',
    declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 40 },
    status: 'SUBMITTED',
    notes: 'Side-loader, 24h cover',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
  };
}

const offerFromA = storedOffer('o-a', TRANSPORTER_A, 450000);
const offerFromB = storedOffer('o-b', TRANSPORTER_B, 470000);

/** The payload the Transporter quotation form actually sends: it never names a transporterId. */
const legitimateBody = {
  listingId: LISTING_ID,
  priceProposal: 450000,
  availabilityWindow: {
    earliestPickup: '2026-12-01T09:00:00Z',
    latestPickup: '2026-12-01T14:00:00Z',
    estimatedDelivery: '2026-12-04T18:00:00Z',
  },
  vehicleType: 'HEAVY_TRUCK',
  declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 40 },
};

function postOffer(body: unknown) {
  return new NextRequest('http://localhost:3000/api/marketplace/offers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let offersPOST: typeof import('@/app/api/marketplace/offers/route').POST;
let offersGET: typeof import('@/app/api/marketplace/offers/route').GET;
let offersPATCH: typeof import('@/app/api/marketplace/offers/[id]/route').PATCH;

beforeEach(async () => {
  createClientMock.mockReset();
  createClientMock.mockResolvedValue(sessionClient() as never);
  for (const fn of [listById, listPublished, listByListing, listByTransporter, createOffer, updateStatus, listByShipper]) {
    fn.mockReset();
  }
  listById.mockResolvedValue(storedListing);
  listPublished.mockResolvedValue([storedListing]);
  listByListing.mockResolvedValue([offerFromA, offerFromB]);
  listByTransporter.mockResolvedValue([offerFromA]);
  listByShipper.mockResolvedValue([]);
  createOffer.mockResolvedValue(offerFromA);
  updateStatus.mockResolvedValue(undefined);

  const collection = await import('@/app/api/marketplace/offers/route');
  const item = await import('@/app/api/marketplace/offers/[id]/route');
  offersPOST = collection.POST;
  offersGET = collection.GET;
  offersPATCH = item.PATCH;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('F-I5-01 §6A — who may create an offer', () => {
  it('allows an authenticated Transporter to create an offer for its own identity', async () => {
    const response = await offersPOST(postOffer(legitimateBody));

    expect(response.status).toBe(201);
    expect(createOffer).toHaveBeenCalledTimes(1);
    expect(createOffer.mock.calls[0][0].transporterId).toBe(TRANSPORTER_A);
    expect(createOffer.mock.calls[0][0].listingId).toBe(LISTING_ID);
  });

  it('refuses an authenticated Shipper before any persistence', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: SHIPPER, marketplace: 'SHIPPER' }) as never);

    const response = await offersPOST(postOffer(legitimateBody));

    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: 'forbidden' });
  });

  it('refuses an unauthenticated request with 401, not 403', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: null }) as never);

    const response = await offersPOST(postOffer(legitimateBody));

    expect(response.status).toBe(401);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('refuses Transporter A submitting under Transporter B\'s identity', async () => {
    const response = await offersPOST(postOffer({ ...legitimateBody, transporterId: TRANSPORTER_B }));

    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('refuses an authenticated user who holds no effective marketplace membership', async () => {
    createClientMock.mockResolvedValue(sessionClient({ marketplace: null, platform: null }) as never);

    const response = await offersPOST(postOffer(legitimateBody));

    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('keeps the existing validation response for a malformed Transporter body', async () => {
    const { declaredCapacity: _omitted, ...malformed } = legitimateBody;

    const response = await offersPOST(postOffer(malformed));

    expect(response.status).toBe(400);
    expect(createOffer).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      data: { error: 'Missing required field: declaredCapacity' },
    });
  });
});

describe('F-I5-01 §4 — the shape of the refusal', () => {
  it('answers 403 for a Shipper even when persistence would have failed', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: SHIPPER, marketplace: 'SHIPPER' }) as never);
    createOffer.mockRejectedValue(new Error('Failed to create offer: row-level security violation'));

    const response = await offersPOST(postOffer(legitimateBody));

    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('still reports a genuine persistence failure as 500 for an authorized Transporter', async () => {
    createOffer.mockRejectedValue(new Error('Failed to create offer: connection reset'));

    expect((await offersPOST(postOffer(legitimateBody))).status).toBe(500);
    expect(createOffer).toHaveBeenCalledTimes(1);
  });

  it('fails closed with 403 when the membership resolver is unavailable', async () => {
    createClientMock.mockResolvedValue(sessionClient({ resolverError: true }) as never);

    const response = await offersPOST(postOffer(legitimateBody));

    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('does not accept an operational delegation as offer-creation authority', async () => {
    createClientMock.mockResolvedValue(sessionClient({
      marketplace: null,
      platform: null,
      delegation: { principal_transporter_user_id: TRANSPORTER_A, scopes: ['operational_read', 'assignment_manage'] },
    }) as never);

    const response = await offersPOST(postOffer({ ...legitimateBody, transporterId: TRANSPORTER_A }));

    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('ignores a role claim in client-writable user metadata', async () => {
    createClientMock.mockResolvedValue(sessionClient({
      userId: SHIPPER,
      marketplace: 'SHIPPER',
      metadata: { role: 'TRANSPORTER', marketplaceRole: 'TRANSPORTER', tenantId: 'tenant-of-a-transporter' },
    }) as never);

    const response = await offersPOST(postOffer(legitimateBody));

    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('ignores a role claim in the request body', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: SHIPPER, marketplace: 'SHIPPER' }) as never);

    const response = await offersPOST(postOffer({
      ...legitimateBody,
      role: 'TRANSPORTER',
      marketplaceRole: 'TRANSPORTER',
      transporterId: TRANSPORTER_A,
    }));

    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('requires Transporter membership even for a platform governance tier', async () => {
    // The live INSERT policy demands effective_marketplace_role() = 'TRANSPORTER' too, so an ADMIN
    // without that membership is refused at both layers rather than only at one.
    createClientMock.mockResolvedValue(sessionClient({ marketplace: null, platform: 'ADMIN' }) as never);

    const response = await offersPOST(postOffer(legitimateBody));

    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('accepts a body that names the caller\'s own identity', async () => {
    const response = await offersPOST(postOffer({ ...legitimateBody, transporterId: TRANSPORTER_A }));

    expect(response.status).toBe(201);
    expect(createOffer.mock.calls[0][0].transporterId).toBe(TRANSPORTER_A);
  });
});

describe('F-I5-01 §6C — the Shipper keeps the quotations it receives', () => {
  it('still lists the quotations for a shipment through the offers read route', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: SHIPPER, marketplace: 'SHIPPER' }) as never);

    const response = await offersGET(new NextRequest(
      `http://localhost:3000/api/marketplace/offers?listingId=${LISTING_ID}`,
    ));

    expect(response.status).toBe(200);
    expect(listByListing).toHaveBeenCalledWith(LISTING_ID);
    const payload = await response.json();
    expect(payload.data).toHaveLength(2);
    expect(payload.data.map((row: { transporterId: string }) => row.transporterId))
      .toEqual([TRANSPORTER_A, TRANSPORTER_B]);
  });

  it('still renders every received quotation on the Shipper shipment detail page', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: SHIPPER, marketplace: 'SHIPPER' }) as never);
    const page = await import('@/app/[locale]/(shipper)/shipper/shipments/[id]/page');

    const element = await page.default({ params: Promise.resolve({ locale: 'en', id: LISTING_ID }) });
    render(element as React.ReactElement);

    expect(listByListing).toHaveBeenCalledWith(LISTING_ID);
    expect(screen.getAllByText('ShipperDashboard.offer_status_SUBMITTED')).toHaveLength(2);
    expect(screen.getByText(TRANSPORTER_A.slice(0, 8))).toBeInTheDocument();
    expect(screen.getByText(TRANSPORTER_B.slice(0, 8))).toBeInTheDocument();
  });

  it('reads no quotations for a shipment belonging to another Shipper', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: TRANSPORTER_B, marketplace: 'SHIPPER' }) as never);
    const page = await import('@/app/[locale]/(shipper)/shipper/shipments/[id]/page');

    const element = await page.default({ params: Promise.resolve({ locale: 'en', id: LISTING_ID }) });
    render(element as React.ReactElement);

    expect(screen.getByText('ShipperDashboard.not_found_title')).toBeInTheDocument();
    expect(listByListing).not.toHaveBeenCalled();
  });

  it('refuses creation from the same Shipper session that just read the quotations', async () => {
    createClientMock.mockResolvedValue(sessionClient({ userId: SHIPPER, marketplace: 'SHIPPER' }) as never);

    const read = await offersGET(new NextRequest(
      `http://localhost:3000/api/marketplace/offers?listingId=${LISTING_ID}`,
    ));
    const write = await offersPOST(postOffer(legitimateBody));

    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });
});

describe('F-I5-01 §6C — unrelated authority and lifecycle are unchanged', () => {
  it('leaves the shared RBAC matrix intact for every other resource', () => {
    // The correction is deliberately at the offer-creation route, not in this matrix: removing SHIPPER
    // from offers would break the quotation read above, and removing it from create would break
    // listings:create and booking_create. These assertions pin that boundary.
    expect(evaluateRBAC('SHIPPER', 'offers', 'read').permitted).toBe(true);
    expect(evaluateRBAC('SHIPPER', 'listings', 'create').permitted).toBe(true);
    expect(evaluateRBAC('SHIPPER', 'booking_create', 'create').permitted).toBe(true);
    expect(evaluateRBAC('SHIPPER', 'booking_read', 'read').permitted).toBe(true);
    expect(evaluateRBAC('SHIPPER', 'booking_confirm', 'update').permitted).toBe(true);
    expect(evaluateRBAC('SHIPPER', 'quotes', 'read').permitted).toBe(true);
    expect(evaluateRBAC('TRANSPORTER', 'offers', 'create').permitted).toBe(true);
    expect(evaluateRBAC('TRANSPORTER', 'offers', 'update').permitted).toBe(true);
    expect(evaluateRBAC('TRANSPORTER', 'fleet', 'create').permitted).toBe(true);
    expect(evaluateRBAC('DRIVER', 'offers', 'create').permitted).toBe(false);
    expect(evaluateRBAC('SHIPPER', 'offers', 'create').permitted).toBe(true);
  });

  it('applies the two quotation transitions the lifecycle allows', async () => {
    for (const [currentStatus, targetStatus] of [['SUBMITTED', 'WITHDRAWN'], ['WITHDRAWN', 'SUBMITTED']] as const) {
      const request = new NextRequest('http://localhost:3000/api/marketplace/offers/o-a', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus, targetStatus }),
      });

      const response = await offersPATCH(request, { params: Promise.resolve({ id: 'o-a' }) });

      expect(response.status).toBe(200);
      expect(updateStatus).toHaveBeenLastCalledWith('o-a', targetStatus);
    }
  });

  it('still refuses a transition out of a terminal quotation state', async () => {
    for (const currentStatus of ['ACCEPTED', 'REJECTED', 'EXPIRED']) {
      const request = new NextRequest('http://localhost:3000/api/marketplace/offers/o-a', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus, targetStatus: 'SUBMITTED' }),
      });

      expect((await offersPATCH(request, { params: Promise.resolve({ id: 'o-a' }) })).status).toBe(400);
    }
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('still reads only this session\'s quotations for the Transporter list', async () => {
    const page = await import('@/app/[locale]/(transporter)/transporter/quotations/page');

    const element = await page.default({ params: Promise.resolve({ locale: 'en' }) });
    render(element as React.ReactElement);

    expect(listByTransporter).toHaveBeenCalledWith(TRANSPORTER_A);
    expect(listByListing).not.toHaveBeenCalled();
  });
});