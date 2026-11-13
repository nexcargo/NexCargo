// NexCargo I-4 — focused tests for the Shipper journey gates.
//
// These cover the four server-side decisions the Shipper experience depends on and that no earlier
// suite exercised: canonical MOD-001 §5.1 validation on create, listing ownership + authoritative
// lifecycle source, matching on stored data only, and the MOD-002 §3.1/§7.4 booking integrity
// controls. Authorization itself (session, role resolution, RBAC) stays covered by the I-1/I-2 suites.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as serverModule from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => sessionClient()),
}));

const SHIPPER_ID = 'shipper-user-001';
const OTHER_ID = 'other-user-002';
const TRANSPORTER_ID = 'transporter-user-009';

function sessionClient(marketplace: string | null = 'SHIPPER') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: SHIPPER_ID, email: 'shipper@example.mz', user_metadata: {} } },
        error: null,
      }),
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'effective_marketplace_role') return { data: marketplace, error: null };
      if (fn === 'effective_user_role') return { data: null, error: null };
      return { data: null, error: new Error('no delegation in this fixture') };
    }),
  };
}

const validListingBody = {
  title: 'Maputo to Beira general cargo',
  description: '8 pallets, shrink-wrapped',
  origin: { latitude: -25.9692, longitude: 32.5855, address: 'Maputo Port' },
  destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
  cargoType: 'GENERAL',
  weightKg: 10000,
  volumeM3: 20,
  timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
  acceptedVehicleTypes: ['HEAVY_TRUCK'],
};

/** A ListingApiShape as the repository returns it. */
function listingRow(overrides: Record<string, unknown> = {}) {
  return {
    listingId: 'listing-0001',
    shipperId: SHIPPER_ID,
    title: 'Maputo to Beira general cargo',
    description: '8 pallets, shrink-wrapped',
    origin: { latitude: -25.9692, longitude: 32.5855, address: 'Maputo Port' },
    destination: { latitude: -15.7806, longitude: 42.9165, address: 'Beira Terminal' },
    cargoType: 'GENERAL',
    weightKg: 10000,
    volumeM3: 20,
    timeWindow: { earliestPickup: '2026-09-01T08:00:00Z', latestDelivery: '2026-09-05T18:00:00Z' },
    pricingModel: 'FIXED',
    status: 'DRAFT',
    publishedAt: null,
    acceptedVehicleTypes: ['HEAVY_TRUCK'],
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
    ...overrides,
  };
}

/** An OfferApiShape as the repository returns it. */
function offerRow(overrides: Record<string, unknown> = {}) {
  return {
    offerId: 'offer-0001',
    transporterId: TRANSPORTER_ID,
    listingId: 'listing-0001',
    priceProposal: 450000,
    availabilityWindow: {
      earliestPickup: '2026-09-01T06:00:00Z',
      latestPickup: '2026-09-01T12:00:00Z',
      estimatedDelivery: '2026-09-04T18:00:00Z',
    },
    vehicleType: 'HEAVY_TRUCK',
    declaredCapacity: { maxWeightKg: 12000, maxVolumeM3: 30 },
    status: 'SUBMITTED',
    notes: 'Tail-lift available',
    createdAt: '2026-08-21T09:00:00Z',
    updatedAt: '2026-08-21T09:00:00Z',
    ...overrides,
  };
}

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: 'booking-0001',
    listingId: 'listing-0001',
    selectedOfferId: 'offer-0001',
    shipperId: SHIPPER_ID,
    transporterId: TRANSPORTER_ID,
    status: 'REQUESTED',
    originAddress: 'Maputo Port',
    destinationAddress: 'Beira Terminal',
    cargoDescription: '8 pallets, shrink-wrapped',
    cargoType: 'GENERAL',
    weightKg: 10000,
    offerPrice: 450000,
    vehicleType: 'HEAVY_TRUCK',
    currency: 'MZN',
    createdAt: '2026-08-22T09:00:00Z',
    updatedAt: '2026-08-22T09:00:00Z',
    ...overrides,
  };
}

const getListingsById = vi.fn();
const createListing = vi.fn();
const updateListingStatus = vi.fn();
const updateListingDraft = vi.fn();
const getOffer = vi.fn();
const listOffersByListing = vi.fn();
const createBooking = vi.fn();
const listBookingsByShipper = vi.fn();

vi.doMock('@/infrastructure/repositories/listings-repository', () => ({
  ListingsRepository: class {
    getById = getListingsById;
    create = createListing;
    updateStatus = updateListingStatus;
    updateDraft = updateListingDraft;
  },
}));

vi.doMock('@/infrastructure/repositories/offers-repository', () => ({
  OffersRepository: class {
    getById = getOffer;
    listByListing = listOffersByListing;
  },
}));

vi.doMock('@/infrastructure/repositories/bookings-repository', () => ({
  BookingsRepository: class {
    create = createBooking;
    listByShipper = listBookingsByShipper;
  },
}));

let postListing: typeof import('@/app/api/marketplace/listings/route').POST;
let patchListing: typeof import('@/app/api/marketplace/listings/[id]/route').PATCH;
let postMatching: typeof import('@/app/api/marketplace/matching/route').POST;
let postBooking: typeof import('@/app/api/booking/route').POST;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(serverModule.createClient).mockImplementation(async () => sessionClient() as never);

  postListing = (await import('@/app/api/marketplace/listings/route')).POST;
  patchListing = (await import('@/app/api/marketplace/listings/[id]/route')).PATCH;
  postMatching = (await import('@/app/api/marketplace/matching/route')).POST;
  postBooking = (await import('@/app/api/booking/route')).POST;
});

function jsonRequest(path: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function errorOf(response: Response): Promise<string> {
  const payload = await response.json();
  return payload?.data?.error ?? '';
}

describe('I-4 §3B — canonical MOD-001 §5.1 validation on shipment creation', () => {
  it('creates a DRAFT shipment when the canonical rules hold', async () => {
    createListing.mockResolvedValue(listingRow());

    const response = await postListing(jsonRequest('/api/marketplace/listings', 'POST', validListingBody));

    expect(response.status).toBe(201);
    expect(createListing).toHaveBeenCalledTimes(1);
    const persisted = createListing.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted.shipperId).toBe(SHIPPER_ID);
    expect(persisted.acceptedVehicleTypes).toEqual(['HEAVY_TRUCK']);
  });

  it('rejects an origin without coordinates and persists nothing', async () => {
    const body = { ...validListingBody, origin: { address: 'Maputo Port' } };

    const response = await postListing(jsonRequest('/api/marketplace/listings', 'POST', body));

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toContain('Origin must include latitude, longitude, and address');
    expect(createListing).not.toHaveBeenCalled();
  });

  it('rejects a shipment with neither weight nor volume', async () => {
    const body = { ...validListingBody, weightKg: undefined, volumeM3: undefined };

    const response = await postListing(jsonRequest('/api/marketplace/listings', 'POST', body));

    expect(response.status).toBe(400);
    expect(createListing).not.toHaveBeenCalled();
  });

  it('rejects a time window whose pickup is not before delivery', async () => {
    const body = {
      ...validListingBody,
      timeWindow: { earliestPickup: '2026-09-05T18:00:00Z', latestDelivery: '2026-09-01T08:00:00Z' },
    };

    const response = await postListing(jsonRequest('/api/marketplace/listings', 'POST', body));

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toContain('earliestPickup must be before latestDelivery');
    expect(createListing).not.toHaveBeenCalled();
  });
});

describe('I-4 §3C — listing ownership and authoritative lifecycle source', () => {
  const patch = (body: unknown) =>
    patchListing(jsonRequest('/api/marketplace/listings/listing-0001', 'PATCH', body), {
      params: Promise.resolve({ id: 'listing-0001' }),
    });

  it('answers 404 rather than acting on a listing that does not exist', async () => {
    getListingsById.mockResolvedValue(null);

    const response = await patch({ action: 'publish' });

    expect(response.status).toBe(404);
    expect(updateListingStatus).not.toHaveBeenCalled();
  });

  it('refuses to publish another shipper listing', async () => {
    getListingsById.mockResolvedValue(listingRow({ shipperId: OTHER_ID }));

    const response = await patch({ action: 'publish' });

    expect(response.status).toBe(403);
    expect(updateListingStatus).not.toHaveBeenCalled();
  });

  it('takes the transition source from the stored row, not from the request body', async () => {
    // A DRAFT row cannot become CANCELLED directly (MOD-001 §3.2). The body claiming PUBLISHED must
    // not be believed, otherwise any caller could pick its own source state.
    getListingsById.mockResolvedValue(listingRow({ status: 'DRAFT' }));

    const response = await patch({ currentStatus: 'PUBLISHED', targetStatus: 'CANCELLED' });

    expect(response.status).toBe(400);
    expect(updateListingStatus).not.toHaveBeenCalled();
  });

  it('cancels a PUBLISHED listing owned by the session user', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED' }));
    updateListingStatus.mockResolvedValue(undefined);

    const response = await patch({ targetStatus: 'CANCELLED' });

    expect(response.status).toBe(200);
    expect(updateListingStatus).toHaveBeenCalledWith('listing-0001', 'CANCELLED');
  });

  it('refuses to publish a listing whose stored data no longer satisfies §5.1', async () => {
    getListingsById.mockResolvedValue(listingRow({ timeWindow: {} }));

    const response = await patch({ action: 'publish' });

    expect(response.status).toBe(400);
    expect(updateListingStatus).not.toHaveBeenCalled();
  });

  it('edits only a DRAFT listing, and re-validates the merged result', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED' }));

    const rejected = await patch({ action: 'update', ...validListingBody });

    expect(rejected.status).toBe(400);
    expect(updateListingDraft).not.toHaveBeenCalled();
  });

  it('persists a validated DRAFT edit through updateDraft', async () => {
    getListingsById.mockResolvedValue(listingRow());
    updateListingDraft.mockResolvedValue(listingRow({ title: 'Renamed draft' }));

    const response = await patch({ action: 'update', title: 'Renamed draft' });

    expect(response.status).toBe(200);
    expect(updateListingDraft).toHaveBeenCalledTimes(1);
    const params = updateListingDraft.mock.calls[0][1] as Record<string, unknown>;
    expect(params.title).toBe('Renamed draft');
    expect(params.originAddress).toBe('Maputo Port');
    expect(params.acceptedVehicleTypes).toEqual(['HEAVY_TRUCK']);
  });
});

describe('I-4 §3D — the matching engine runs on stored data only', () => {
  it('reports 404 for a listing that does not exist instead of inventing one', async () => {
    getListingsById.mockResolvedValue(null);

    const response = await postMatching(jsonRequest('/api/marketplace/matching', 'POST', { listingId: 'nope' }));

    expect(response.status).toBe(404);
    expect(listOffersByListing).not.toHaveBeenCalled();
  });

  it('refuses to run matching on another shipper listing', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED', shipperId: OTHER_ID }));

    const response = await postMatching(
      jsonRequest('/api/marketplace/matching', 'POST', { listingId: 'listing-0001' }),
    );

    expect(response.status).toBe(403);
    expect(listOffersByListing).not.toHaveBeenCalled();
  });

  it('refuses a listing that is not PUBLISHED (MOD-001 §5.3)', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'DRAFT' }));

    const response = await postMatching(
      jsonRequest('/api/marketplace/matching', 'POST', { listingId: 'listing-0001' }),
    );

    expect(response.status).toBe(400);
    expect(listOffersByListing).not.toHaveBeenCalled();
  });

  it('ignores offers supplied in the request body and scores the stored ones', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED' }));
    listOffersByListing.mockResolvedValue([offerRow()]);

    const response = await postMatching(
      jsonRequest('/api/marketplace/matching', 'POST', {
        listingId: 'listing-0001',
        offers: [{ offerId: 'injected-offer', transporterId: 'attacker' }],
      }),
    );

    expect(response.status).toBe(200);
    expect(listOffersByListing).toHaveBeenCalledWith('listing-0001');
    const payload = await response.json();
    const matchedIds: string[] = payload.data.matches.map((row: { offerId: string }) => row.offerId);
    expect(matchedIds).toContain('offer-0001');
    expect(matchedIds).not.toContain('injected-offer');
  });

  it('returns a relaxation explanation when no stored offer passes the hard filters', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED' }));
    // A vehicle that declares 100 kg of capacity cannot carry a 10 000 kg shipment, so the engine's
    // hard capacity filter rejects it (MOD-001 §6.4.1).
    listOffersByListing.mockResolvedValue([
      offerRow({ declaredCapacity: { maxWeightKg: 100, maxVolumeM3: 1 } }),
    ]);

    const response = await postMatching(
      jsonRequest('/api/marketplace/matching', 'POST', { listingId: 'listing-0001' }),
    );

    const payload = await response.json();
    expect(payload.data.matchCount).toBe(0);
    expect(payload.data.relaxed).toBe(true);
    expect(typeof payload.data.suggestion).toBe('string');
  });
});

describe('I-4 §3F — booking initiation integrity controls', () => {
  const bookingBody = (overrides: Record<string, unknown> = {}) => ({
    bookingId: 'bkg-client-0001',
    listingId: 'listing-0001',
    selectedOfferId: 'offer-0001',
    shipperId: SHIPPER_ID,
    originAddress: 'Maputo Port',
    destinationAddress: 'Beira Terminal',
    cargoDescription: '8 pallets, shrink-wrapped',
    cargoType: 'GENERAL',
    weightKg: 10000,
    offerPrice: 1,
    ...overrides,
  });

  it('rejects a booking that references a listing which does not exist', async () => {
    getListingsById.mockResolvedValue(null);

    const response = await postBooking(jsonRequest('/api/booking', 'POST', bookingBody()));

    expect(response.status).toBe(400);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('rejects booking against another shipper listing', async () => {
    getListingsById.mockResolvedValue(listingRow({ shipperId: OTHER_ID }));

    const response = await postBooking(jsonRequest('/api/booking', 'POST', bookingBody()));

    expect(response.status).toBe(403);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('rejects an offer that was not made against this listing', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED' }));
    getOffer.mockResolvedValue(offerRow({ listingId: 'other-listing' }));

    const response = await postBooking(jsonRequest('/api/booking', 'POST', bookingBody()));

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toContain('not made against this listing');
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('rejects an offer that is no longer selectable', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED' }));
    getOffer.mockResolvedValue(offerRow({ status: 'WITHDRAWN' }));

    const response = await postBooking(jsonRequest('/api/booking', 'POST', bookingBody()));

    expect(response.status).toBe(400);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('rejects an offer whose declared capacity cannot carry the shipment (MOD-002 §7.4)', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED', weightKg: 40000 }));
    getOffer.mockResolvedValue(offerRow());

    const response = await postBooking(jsonRequest('/api/booking', 'POST', bookingBody({ weightKg: 40000 })));

    expect(response.status).toBe(400);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('takes the counterparty and price from the stored offer, never from the body', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED' }));
    getOffer.mockResolvedValue(offerRow());
    createBooking.mockResolvedValue(bookingRow());

    const response = await postBooking(
      jsonRequest(
        '/api/booking',
        'POST',
        bookingBody({ transporterId: 'attacker-transporter', offerPrice: 1, vehicleType: 'LIGHT_DELIVERY' }),
      ),
    );

    expect(response.status).toBe(201);
    const created = createBooking.mock.calls[0][0] as Record<string, unknown>;
    expect(created.transporterId).toBe(TRANSPORTER_ID);
    expect(created.offerPrice).toBe(450000);
    expect(created.vehicleType).toBe('HEAVY_TRUCK');
    expect(created.status).toBe('REQUESTED');
  });

  it('rejects a shipperId that does not match the session', async () => {
    getListingsById.mockResolvedValue(listingRow({ status: 'PUBLISHED' }));

    const response = await postBooking(jsonRequest('/api/booking', 'POST', bookingBody({ shipperId: OTHER_ID })));

    expect(response.status).toBe(400);
    expect(createBooking).not.toHaveBeenCalled();
  });
});


