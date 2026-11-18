// NexCargo I-5 §3E/§3F — opportunities, the quotation workflow and the offer lifecycle boundaries.
//
// Two kinds of proof live here. The Server Components render from stubbed repository results, which pins what
// is read — the published listings, this session's AVAILABLE vehicles, this session's own quotations — and which
// branch each state takes. The eligibility verdicts come from the real MOD-001 hard filters rather than a stub,
// so the listing page cannot silently disagree with the engine that ranks the shipper's side. The route tests
// drive the real handlers with a session client: that is where a quotation is pinned to the signed-in user and
// where the state machine refuses a transition. Neither layer proves RLS — the live policy is verified against
// the project separately. Translations are stubbed to their keys so assertions name the state, not the wording.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { QuotationForm } from '@/app/[locale]/(transporter)/transporter/opportunities/quotation-form';
import { QuotationActions } from '@/app/[locale]/(transporter)/transporter/quotations/quotation-actions';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `TransporterDashboard.${key}`,
  useLocale: () => 'en',
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `TransporterDashboard.${key}`,
}));

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh }),
}));

const USER_ID = 'transporter-user-009';
const SHIPPER_ID = 'shipper-user-001';
const OTHER_TRANSPORTER_ID = 'transporter-user-777';

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

const listPublished = vi.fn();
const listById = vi.fn();
const listVehicles = vi.fn();
const listByTransporter = vi.fn();
const listByListing = vi.fn();
const createOffer = vi.fn();
const updateStatus = vi.fn();

vi.doMock('@/infrastructure/repositories/listings-repository', () => ({
  ListingsRepository: class {
    listPublished = listPublished;
    getById = listById;
  },
}));
vi.doMock('@/infrastructure/repositories/offers-repository', () => ({
  OffersRepository: class {
    listByTransporter = listByTransporter;
    listByListing = listByListing;
    create = createOffer;
    updateStatus = updateStatus;
  },
}));
vi.doMock('@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository', () => ({
  FleetRepository: class { listVehicles = listVehicles; },
}));

const vehicleRow = {
  id: 'v1', vehicleId: 'V1', fleetId: 'f1', type: 'HEAVY_TRUCK', registrationNumber: 'ABC-1234',
  capacityWeightKg: 20000, capacityVolumeM3: 40, availabilityState: 'AVAILABLE', insuranceProvider: null,
  insurancePolicyNumber: null, insuranceValidUntil: null, licenceJurisdiction: null,
  licencesValidNationwide: false, crossBorderPermitStatus: 'PRE_EXISTING', complianceNotes: null,
  createdBy: USER_ID, createdAt: '', updatedAt: '',
};
const refrigeratedVehicleRow = {
  ...vehicleRow, id: 'v2', vehicleId: 'V2', registrationNumber: 'REF-2222', type: 'REFRIGERATED',
};

const generalListing = {
  listingId: 'l-general', shipperId: SHIPPER_ID, title: 'Crates to Beira', description: '20 pallets, side loader',
  origin: { latitude: -25.96, longitude: 32.58, address: 'Maputo Port' },
  destination: { latitude: -19.84, longitude: 34.84, address: 'Beira Terminal' },
  cargoType: 'GENERAL', weightKg: 10000, volumeM3: 20,
  timeWindow: { earliestPickup: '2026-12-01T08:00:00Z', latestDelivery: '2026-12-05T18:00:00Z' },
  pricingModel: 'FIXED', status: 'PUBLISHED', publishedAt: '2026-11-02T09:00:00Z',
  acceptedVehicleTypes: [], createdAt: '2026-11-01T09:00:00Z', updatedAt: '2026-11-02T09:00:00Z',
};
// Refrigerated cargo needs a refrigerated unit (MOD-001 filter 1), so this row is outside the heavy truck.
const coldListing = {
  ...generalListing, listingId: 'l-cold', title: 'Frozen fish to Nampula', cargoType: 'REFRIGERATED',
  publishedAt: '2026-11-03T09:00:00Z', createdAt: '2026-11-03T09:00:00Z',
};

const submittedOffer = {
  offerId: 'o1', transporterId: USER_ID, listingId: 'l-general', priceProposal: 450000,
  availabilityWindow: {
    earliestPickup: '2026-12-01T09:00:00Z', latestPickup: '2026-12-01T14:00:00Z',
    estimatedDelivery: '2026-12-04T18:00:00Z',
  },
  vehicleType: 'HEAVY_TRUCK', declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 40 },
  status: 'SUBMITTED', notes: undefined, createdAt: '2026-11-04T10:00:00Z', updatedAt: '2026-11-04T10:00:00Z',
};
// A quotation whose shipment has left the market is not in listPublished(), so the row must name that state.
const acceptedOnClosedListing = {
  ...submittedOffer, offerId: 'o2', listingId: 'l-gone', status: 'ACCEPTED',
  createdAt: '2026-10-20T10:00:00Z',
};

async function renderOpportunities() {
  const mod = await import('@/app/[locale]/(transporter)/transporter/opportunities/page');
  const element = await mod.default({ params: Promise.resolve({ locale: 'en' }) });
  return render(element as React.ReactElement);
}

async function renderOpportunity(id: string) {
  const mod = await import('@/app/[locale]/(transporter)/transporter/opportunities/[id]/page');
  const element = await mod.default({ params: Promise.resolve({ locale: 'en', id }) });
  return render(element as React.ReactElement);
}

async function renderQuotations() {
  const mod = await import('@/app/[locale]/(transporter)/transporter/quotations/page');
  const element = await mod.default({ params: Promise.resolve({ locale: 'en' }) });
  return render(element as React.ReactElement);
}

beforeEach(() => {
  createClientMock.mockReset();
  createClientMock.mockResolvedValue(sessionClient() as never);
  push.mockReset();
  replace.mockReset();
  refresh.mockReset();
  for (const fn of [listPublished, listById, listVehicles, listByTransporter, listByListing, createOffer, updateStatus]) {
    fn.mockReset();
  }
  listPublished.mockResolvedValue([generalListing, coldListing]);
  listById.mockResolvedValue(generalListing);
  listVehicles.mockResolvedValue([vehicleRow]);
  listByTransporter.mockResolvedValue([]);
  createOffer.mockResolvedValue(submittedOffer);
  updateStatus.mockResolvedValue(undefined);
});

describe('I-5 §3E — opportunity reads and the engine verdict', () => {
  it('asks for the published listings, the available vehicles and this session\'s quotations', async () => {
    await renderOpportunities();

    expect(listPublished).toHaveBeenCalledTimes(1);
    expect(listVehicles).toHaveBeenCalledWith(undefined, undefined, 'AVAILABLE');
    expect(listByTransporter).toHaveBeenCalledWith(USER_ID);
  });

  it('separates what the hard filters admit from what they do not', async () => {
    await renderOpportunities();

    // one eligible row -> exactly one quotation link
    expect(screen.getAllByText('TransporterDashboard.submit_quote')).toHaveLength(1);
    expect(screen.getByText('Crates to Beira')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.opportunity_not_eligible')).toBeTruthy();
    expect(screen.getByText('Frozen fish to Nampula')).toBeTruthy();
  });

  it('admits the refrigerated shipment once a refrigerated vehicle is in the fleet', async () => {
    listVehicles.mockResolvedValue([vehicleRow, refrigeratedVehicleRow]);

    await renderOpportunities();

    expect(screen.getAllByText('TransporterDashboard.submit_quote')).toHaveLength(2);
    expect(screen.queryByText('TransporterDashboard.opportunity_not_eligible')).toBeNull();
    expect(screen.queryByText('TransporterDashboard.fleet_missing_hint')).toBeNull();
  });

  it('marks a listing already quoted out of the open set and shows its stored status', async () => {
    listByTransporter.mockResolvedValue([submittedOffer]);

    await renderOpportunities();

    expect(screen.getByText('TransporterDashboard.offer_status_SUBMITTED')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.no_opportunities')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.submit_quote')).toBeNull();
  });

  it('tells a transporter with no available vehicle what to fix first', async () => {
    listVehicles.mockResolvedValue([]);

    await renderOpportunities();

    expect(screen.getByText('TransporterDashboard.fleet_missing_hint')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.submit_quote')).toBeNull();
  });

  it('renders nothing when the session is gone, leaving the layout gate to redirect', async () => {
    createClientMock.mockRejectedValue(new Error('no session'));
    const mod = await import('@/app/[locale]/(transporter)/transporter/opportunities/page');

    expect(await mod.default({ params: Promise.resolve({ locale: 'en' }) })).toBeNull();
  });
});

describe('I-5 §3E/§3F — one opportunity prepared for quotation', () => {
  it('refuses a listing that has left the quotable lifecycle', async () => {
    listById.mockResolvedValue({ ...generalListing, status: 'BOOKED' });

    await renderOpportunity('l-general');

    expect(screen.getByText('TransporterDashboard.opportunity_not_found')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.quote_prepare_title')).toBeNull();
    expect(screen.queryByText('TransporterDashboard.advisory_title')).toBeNull();
  });

  it('computes the advisory band from the listing alone and never reads competing quotations', async () => {
    await renderOpportunity('l-general');

    expect(screen.getByText('TransporterDashboard.advisory_confidence')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.advisory_notice')).toBeTruthy();
    expect(listByListing).not.toHaveBeenCalled();
    expect(listByTransporter).toHaveBeenCalledWith(USER_ID);
  });

  it('shows the quotation form with the fitting vehicles when nothing is quoted yet', async () => {
    await renderOpportunity('l-general');

    expect(screen.getByText('TransporterDashboard.quote_prepare_title')).toBeTruthy();
    expect(screen.getByText('ABC-1234')).toBeTruthy();
    expect(screen.getByLabelText('TransporterDashboard.field_vehicle')).toBeTruthy();
  });

  it('withholds the form when no vehicle fits and says so', async () => {
    listById.mockResolvedValue(coldListing);

    await renderOpportunity('l-cold');

    expect(screen.getByText('TransporterDashboard.opportunity_none_match')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.quote_prepare_title')).toBeNull();
  });

  it('replaces the form with the existing-quotation notice once one is on file', async () => {
    listByTransporter.mockResolvedValue([submittedOffer]);

    await renderOpportunity('l-general');

    expect(screen.queryByText('TransporterDashboard.quote_prepare_title')).toBeNull();
    expect(screen.getByText('TransporterDashboard.opportunity_already_quoted_notice')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.quotation_amend_notice')).toBeTruthy();
  });

  it('renders nothing without a session', async () => {
    createClientMock.mockRejectedValue(new Error('no session'));
    const mod = await import('@/app/[locale]/(transporter)/transporter/opportunities/[id]/page');

    expect(await mod.default({ params: Promise.resolve({ locale: 'en', id: 'l-general' }) })).toBeNull();
  });
});

describe('I-5 §10(17) — the quotations list', () => {
  it('reads only this session\'s quotations and names each row\'s state', async () => {
    listByTransporter.mockResolvedValue([submittedOffer, acceptedOnClosedListing]);

    await renderQuotations();

    expect(listByTransporter).toHaveBeenCalledWith(USER_ID);
    expect(screen.getByText('Crates to Beira')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.offer_status_SUBMITTED')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.quotation_listing_closed')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.quotation_terminal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'TransporterDashboard.withdraw_quotation' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'TransporterDashboard.resubmit_quotation' })).toBeNull();
  });

  it('shows the empty state and the route that fills it', async () => {
    await renderQuotations();

    expect(screen.getByText('TransporterDashboard.no_quotations')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.no_quotations_hint')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.transporter_nav_opportunities')).toBeTruthy();
  });
});

describe('I-5 §3F — the quotation form client states', () => {
  const fetchMock = vi.fn();
  const jsonResponse = (status: number, data: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  });

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(
      <QuotationForm
        listingId="l-general"
        earliestPickup="2026-12-01T08:00:00Z"
        latestDelivery="2026-12-05T18:00:00Z"
        vehicles={[
          { vehicleId: 'V1', registrationNumber: 'ABC-1234', type: 'HEAVY_TRUCK', capacityWeightKg: 20000, capacityVolumeM3: 40 },
        ]}
      />,
    );
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('reports the missing price before any request leaves the browser', () => {
    fireEvent.submit(screen.getByRole('button', { name: 'TransporterDashboard.submit_quotation' }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent('TransporterDashboard.validation_price');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an availability window that cannot be met, before any request', () => {
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_price_proposal (MZN)'), { target: { value: '450000' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_availability_estimated_delivery'), { target: { value: '2026-11-30T08:00' } });
    fireEvent.submit(screen.getByRole('button', { name: 'TransporterDashboard.submit_quotation' }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent('TransporterDashboard.validation_availability_order');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits the chosen vehicle capacity through the existing offers route, then lands on the list', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, submittedOffer));
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_price_proposal (MZN)'), { target: { value: '450000' } });
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_notes'), { target: { value: 'Side loader, 24h cover' } });
    fireEvent.submit(screen.getByRole('button', { name: 'TransporterDashboard.submit_quotation' }).closest('form')!);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en/transporter/quotations'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/marketplace/offers');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // The untouched prefilled window must survive the datetime-local round trip unchanged, whatever the
    // browser's timezone: shifting it silently would move the Transporter's promise away from the listing.
    expect(body).toEqual({
      listingId: 'l-general',
      priceProposal: 450000,
      availabilityWindow: {
        earliestPickup: '2026-12-01T08:00:00.000Z',
        latestPickup: '2026-12-01T08:00:00.000Z',
        estimatedDelivery: '2026-12-05T18:00:00.000Z',
      },
      vehicleType: 'HEAVY_TRUCK',
      declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 40 },
      notes: 'Side loader, 24h cover',
    });
    expect(body.transporterId).toBeUndefined();
  });

  it('surfaces the server rejection instead of failing silently', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'Listing is not accepting quotations' }));
    fireEvent.change(screen.getByLabelText('TransporterDashboard.field_price_proposal (MZN)'), { target: { value: '450000' } });
    fireEvent.submit(screen.getByRole('button', { name: 'TransporterDashboard.submit_quotation' }).closest('form')!);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Listing is not accepting quotations'));
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('I-5 §3F — withdraw and resubmit, nothing else', () => {
  const fetchMock = vi.fn();
  const jsonResponse = (status: number, data: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  });

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('withdraws a submitted quotation through the explicit transition, after confirming', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { offerId: 'o1', newStatus: 'WITHDRAWN' }));
    render(<QuotationActions offerId="o1" status="SUBMITTED" />);

    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.withdraw_quotation' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('TransporterDashboard.quotation_withdrawn'));

    expect(globalThis.confirm).toHaveBeenCalledWith('TransporterDashboard.confirm_withdraw');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/marketplace/offers/o1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currentStatus: 'SUBMITTED', targetStatus: 'WITHDRAWN' });
  });

  it('sends nothing when the confirmation is declined', () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<QuotationActions offerId="o1" status="SUBMITTED" />);

    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.withdraw_quotation' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resubmits a withdrawn quotation without asking again', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { offerId: 'o1', newStatus: 'SUBMITTED' }));
    render(<QuotationActions offerId="o1" status="WITHDRAWN" />);

    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.resubmit_quotation' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('TransporterDashboard.quotation_resubmitted'));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currentStatus: 'WITHDRAWN', targetStatus: 'SUBMITTED' });
  });

  it('offers no action on a terminal quotation', () => {
    const { container } = render(<QuotationActions offerId="o1" status="ACCEPTED" />);

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a refusal the server still enforces', async () => {
    // An authorization denial is the one marketplace answer that is not contract-wrapped: authDenialResponse
    // puts the reason in a top-level message rather than data.error.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden', message: 'Authentication required' }),
    });
    render(<QuotationActions offerId="o1" status="SUBMITTED" />);

    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.withdraw_quotation' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Authentication required'));
  });
});

describe('I-5 §3F/§4 — the offers routes stay the authority', () => {
  let offersPOST: typeof import('@/app/api/marketplace/offers/route').POST;
  let offersPATCH: typeof import('@/app/api/marketplace/offers/[id]/route').PATCH;

  beforeEach(async () => {
    const collection = await import('@/app/api/marketplace/offers/route');
    const item = await import('@/app/api/marketplace/offers/[id]/route');
    offersPOST = collection.POST;
    offersPATCH = item.PATCH;
  });

  // F-I5-01 §4.5/§6A: the I-5 behaviour silently rewrote a foreign transporterId to the session user and
  // answered 201. The LA directive requires an explicit refusal instead, so the pinning guarantee is now
  // asserted on a legitimate body and the injection case asserts 403 with no persistence.
  it('refuses an offer that names another transporter and writes nothing', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transporterId: OTHER_TRANSPORTER_ID,
        listingId: 'l-general',
        priceProposal: 450000,
        availabilityWindow: { earliestPickup: '2026-12-01T09:00:00Z', latestPickup: '2026-12-01T14:00:00Z', estimatedDelivery: '2026-12-04T18:00:00Z' },
        vehicleType: 'HEAVY_TRUCK',
        declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 40 },
      }),
    });

    const response = await offersPOST(request);
    expect(response.status).toBe(403);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('pins the new quotation to the session user', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: 'l-general',
        priceProposal: 450000,
        availabilityWindow: { earliestPickup: '2026-12-01T09:00:00Z', latestPickup: '2026-12-01T14:00:00Z', estimatedDelivery: '2026-12-04T18:00:00Z' },
        vehicleType: 'HEAVY_TRUCK',
        declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 40 },
      }),
    });

    const response = await offersPOST(request);
    expect(response.status).toBe(201);
    const stored = createOffer.mock.calls[0][0];
    expect(stored.transporterId).toBe(USER_ID);
    expect(stored.status ?? 'SUBMITTED').toBe('SUBMITTED');
  });

  it('refuses to create a quotation without a session', async () => {
    createClientMock.mockRejectedValue(new Error('no session'));
    const request = new NextRequest('http://localhost:3000/api/marketplace/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: 'l-general', priceProposal: 1, availabilityWindow: {}, vehicleType: 'HEAVY_TRUCK', declaredCapacity: {} }),
    });

    expect((await offersPOST(request)).status).toBe(401);
    expect(createOffer).not.toHaveBeenCalled();
  });

  it('applies the two transitions the lifecycle allows', async () => {
    for (const [currentStatus, targetStatus] of [['SUBMITTED', 'WITHDRAWN'], ['WITHDRAWN', 'SUBMITTED']] as const) {
      const request = new NextRequest('http://localhost:3000/api/marketplace/offers/o1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus, targetStatus }),
      });
      const response = await offersPATCH(request, { params: Promise.resolve({ id: 'o1' }) });

      expect(response.status).toBe(200);
      expect(updateStatus).toHaveBeenLastCalledWith('o1', targetStatus);
    }
  });

  it('refuses a transition out of a terminal state and writes nothing', async () => {
    for (const currentStatus of ['ACCEPTED', 'REJECTED', 'EXPIRED']) {
      const request = new NextRequest('http://localhost:3000/api/marketplace/offers/o1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus, targetStatus: 'SUBMITTED' }),
      });
      const response = await offersPATCH(request, { params: Promise.resolve({ id: 'o1' }) });

      expect(response.status).toBe(400);
    }
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('refuses an incomplete transition body', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/offers/o1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStatus: 'WITHDRAWN' }),
    });

    expect((await offersPATCH(request, { params: Promise.resolve({ id: 'o1' }) })).status).toBe(400);
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
