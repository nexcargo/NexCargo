// NexCargo I-5 §3G — booking requests, the contract workflow and the one governed booking-route correction.
//
// The Server Components render from stubbed repositories, but contract-reads.ts and document-reads.ts run for
// real against a stubbed session client: that is what proves the Transporter area reads contracts and documents
// through the RLS-enforced session rather than an admin client. The route tests drive the real PATCH handler,
// which is where the shipper-only ownership check and the state machine refuse a bypass. Neither layer proves
// RLS — the live policies are verified against the project separately. Translations are stubbed to their keys.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { ContractAcceptAction } from '@/app/[locale]/(transporter)/transporter/bookings/contract-accept';
import { awaitingTransporterSignature } from '@/app/[locale]/(transporter)/contract-reads';

const USER_ID = 'transporter-user-009';
const OTHER_TRANSPORTER_ID = 'transporter-user-777';
const SHIPPER_ID = 'shipper-user-001';
const ORIGIN = 'https://app.nexcargo.example';

let sessionUser: { id: string; email: string; created_at: string; user_metadata: Record<string, unknown> } | null = null;
let rpcAnswers: Record<string, unknown> = {};
let tableData: Record<string, unknown> = {};
const queries: Array<{ schema: string; table: string; filters: Record<string, unknown> }> = [];

vi.mock('@/lib/supabase/server', () => ({
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
  createClient: vi.fn(async () => {
    if (!sessionUser) throw new Error('no session');
    return {
      auth: { getUser: async () => ({ data: { user: sessionUser }, error: null }) },
      rpc: async (name: string) => ({ data: rpcAnswers[name] ?? null, error: null }),
      schema: (schema: string) => ({ from: (table: string) => builder(schema, table) }),
    };
  }),
}));

// A thenable query builder: supabase-js resolves on await, and .single()/.maybeSingle() narrow to one row.
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

// DocumentsCard is an async Server Component; the page tests assert what is handed to it. The card itself is
// rendered directly in i5-operations.test.tsx.
vi.mock('@/app/[locale]/(transporter)/documents-card', () => ({
  DocumentsCard: ({ documents }: { documents: Array<{ id: string }> }) => (
    <div data-testid="documents-card">{documents.map((document) => document.id).join(',')}</div>
  ),
}));

const listBookings = vi.fn();
const getBooking = vi.fn();
const updateBookingStatus = vi.fn();
const listOffers = vi.fn();
const getTrackingByBooking = vi.fn();

vi.doMock('@/infrastructure/repositories/bookings-repository', () => ({
  BookingsRepository: class {
    listByTransporter = listBookings;
    getById = getBooking;
    updateStatus = updateBookingStatus;
  },
}));
vi.doMock('@/infrastructure/repositories/offers-repository', () => ({
  OffersRepository: class { listByTransporter = listOffers; },
}));
vi.doMock('@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository', () => ({
  TrackingRecordRepository: class { getByBookingId = getTrackingByBooking; },
}));

const booking = {
  bookingId: 'b-requested', listingId: 'l-1', selectedOfferId: 'o1', shipperId: SHIPPER_ID,
  transporterId: USER_ID, status: 'REQUESTED', confirmationTimestamp: undefined,
  originAddress: 'Maputo Port', originLatitude: -25.96, originLongitude: 32.58,
  destinationAddress: 'Beira Terminal', destinationLatitude: -19.84, destinationLongitude: 34.84,
  cargoDescription: '20 pallets of crated glass', cargoType: 'GENERAL', weightKg: 10000, volumeM3: 20,
  specialHandling: ['FRAGILE', 'KEEP_DRY'], offerPrice: 385000, vehicleType: 'HEAVY_TRUCK',
  declaredWeightKg: 20000, declaredVolumeM3: 40, currency: 'MZN',
  availabilityWindowStart: '2026-12-01T08:00:00Z', availabilityWindowEnd: '2026-12-05T18:00:00Z',
  contractId: undefined, createdAt: '2026-11-11T09:00:00Z', updatedAt: '2026-11-11T09:00:00Z',
};

const offer = {
  offerId: 'o1', transporterId: USER_ID, listingId: 'l-1', priceProposal: 385000,
  availabilityWindow: {
    earliestPickup: '2026-12-01T09:00:00Z', latestPickup: '2026-12-01T14:00:00Z',
    estimatedDelivery: '2026-12-04T18:00:00Z',
  },
  vehicleType: 'HEAVY_TRUCK', declaredCapacity: { maxWeightKg: 20000, maxVolumeM3: 40 },
  status: 'ACCEPTED', notes: 'Side loader', createdAt: '2026-11-04T10:00:00Z', updatedAt: '2026-11-04T10:00:00Z',
};

const contractRow = {
  id: 'c-1', contract_id: 'CONTRACT-1', booking_id: 'b-requested', acceptance_status: 'DRAFT',
  num_signatories: 1, shipper_accepted_at: '2026-11-11T10:00:00Z', transporter_accepted_at: null,
  signed_at: null, digital_signature_status: 'PARTIAL', base_amount: '385000.00', currency: 'MZN',
  terms_snapshot: 'Price 385000 MZN. Pickup Maputo. Delivery Beira.',
  pickup_window_start: '2026-12-01T08:00:00Z', pickup_window_end: '2026-12-01T18:00:00Z',
  delivery_window_start: '2026-12-04T08:00:00Z', delivery_window_end: '2026-12-05T18:00:00Z',
  created_at: '2026-11-11T10:00:00Z',
};

const bookingDocument = {
  id: 'd-booking', document_id: 'DOC-1', document_type: 'BILL_OF_LADING', linked_entity_type: 'booking',
  linked_entity_id: 'b-requested', status: 'UPLOADED', issue_date: null, expiry_date: null,
  created_at: '2026-11-11T11:00:00Z',
};
const contractDocument = {
  id: 'd-contract', document_id: 'DOC-2', document_type: 'CONTRACT', linked_entity_type: 'contract',
  linked_entity_id: 'c-1', status: 'SIGNED', issue_date: null, expiry_date: null,
  created_at: '2026-11-11T12:00:00Z',
};

const TRANSPORTER = { effective_user_role: null, effective_marketplace_role: 'TRANSPORTER', effective_operational_delegation: null };
const SHIPPER = { effective_user_role: null, effective_marketplace_role: 'SHIPPER', effective_operational_delegation: null };

async function renderBookings() {
  const mod = await import('@/app/[locale]/(transporter)/transporter/bookings/page');
  return render((await mod.default({ params: Promise.resolve({ locale: 'en' }) })) as React.ReactElement);
}

async function renderBooking(id: string) {
  const mod = await import('@/app/[locale]/(transporter)/transporter/bookings/[id]/page');
  return render((await mod.default({ params: Promise.resolve({ locale: 'en', id }) })) as React.ReactElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  sessionUser = { id: USER_ID, email: 'ops@example.mz', created_at: '2026-01-15T00:00:00Z', user_metadata: {} };
  rpcAnswers = { ...TRANSPORTER };
  tableData = {
    'app.marketplace_memberships': { created_at: '2026-02-01T00:00:00Z' },
    'logistics_schema.contracts': [],
    'logistics_schema.documents': [],
  };
  listBookings.mockResolvedValue([booking]);
  getBooking.mockResolvedValue(booking);
  updateBookingStatus.mockResolvedValue(undefined);
  listOffers.mockResolvedValue([offer]);
  getTrackingByBooking.mockResolvedValue(null);
});

describe('I-5 §3G — the booking list reads only this Transporter’s bookings', () => {
  it('asks for this session’s bookings and the contracts of exactly those bookings', async () => {
    await renderBookings();

    expect(listBookings).toHaveBeenCalledWith(USER_ID);
    const contractQuery = queries.find((q) => q.table === 'contracts');
    expect(contractQuery?.schema).toBe('logistics_schema');
    expect(contractQuery?.filters).toEqual({ booking_id: ['b-requested'], is_deleted: false });
  });

  it('puts an unsigned draft contract in the awaiting-signature section', async () => {
    tableData['logistics_schema.contracts'] = [contractRow];

    await renderBookings();

    expect(screen.getByText('TransporterDashboard.bookings_awaiting_heading')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.contract_status_DRAFT')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.bookings_progress_empty')).toBeTruthy();
  });

  it('moves a booking the Transporter has already signed out of the awaiting section', async () => {
    tableData['logistics_schema.contracts'] = [{ ...contractRow, transporter_accepted_at: '2026-11-11T13:00:00Z' }];

    await renderBookings();

    expect(screen.getByText('TransporterDashboard.bookings_awaiting_empty')).toBeTruthy();
    expect(screen.getAllByText('TransporterDashboard.view_booking')).toHaveLength(1);
  });

  it('treats an active contract as in progress, not as awaiting acceptance', async () => {
    tableData['logistics_schema.contracts'] = [{
      ...contractRow, acceptance_status: 'ACTIVE', num_signatories: 2,
      transporter_accepted_at: '2026-11-11T13:00:00Z', signed_at: '2026-11-11T13:00:00Z',
      digital_signature_status: 'EXECUTED',
    }];

    await renderBookings();

    expect(screen.getByText('TransporterDashboard.bookings_awaiting_empty')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.contract_status_ACTIVE')).toBeTruthy();
  });

  it('separates failed and cancelled bookings into the closed section', async () => {
    listBookings.mockResolvedValue([
      { ...booking, bookingId: 'b-failed', status: 'FAILED' },
      { ...booking, bookingId: 'b-cancelled', status: 'CANCELLED' },
    ]);

    await renderBookings();

    expect(screen.getByText('TransporterDashboard.booking_status_FAILED')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.booking_status_CANCELLED')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.bookings_awaiting_empty')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.bookings_progress_empty')).toBeTruthy();
  });

  it('names a booking with no contract as not generated', async () => {
    await renderBookings();

    expect(screen.getByText('TransporterDashboard.contract_not_generated')).toBeTruthy();
  });

  it('shows the empty state and the route that fills it', async () => {
    listBookings.mockResolvedValue([]);

    await renderBookings();

    expect(screen.getByText('TransporterDashboard.bookings_empty_title')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.bookings_empty_desc')).toBeTruthy();
    expect(queries.some((q) => q.table === 'contracts')).toBe(false);
  });

  it('renders nothing when the session is gone, leaving the layout gate to redirect', async () => {
    sessionUser = null;
    const mod = await import('@/app/[locale]/(transporter)/transporter/bookings/page');

    expect(await mod.default({ params: Promise.resolve({ locale: 'en' }) })).toBeNull();
  });
});

describe('I-5 §3G/§4 — one booking, and no other Transporter’s', () => {
  it('refuses a booking whose transporter is somebody else, before reading its contract', async () => {
    getBooking.mockResolvedValue({ ...booking, transporterId: OTHER_TRANSPORTER_ID });

    await renderBooking('b-requested');

    expect(screen.getByText('TransporterDashboard.booking_not_found')).toBeTruthy();
    expect(queries.some((q) => q.table === 'contracts')).toBe(false);
    expect(queries.some((q) => q.table === 'documents')).toBe(false);
    expect(listOffers).not.toHaveBeenCalled();
  });

  it('refuses a booking that does not exist', async () => {
    getBooking.mockResolvedValue(null);

    await renderBooking('b-missing');

    expect(screen.getByText('TransporterDashboard.booking_not_found')).toBeTruthy();
  });

  it('says the shipper must confirm first when no contract exists, and offers no signature', async () => {
    await renderBooking('b-requested');

    expect(screen.getByText('TransporterDashboard.contract_not_generated')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.booking_confirm_notice')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'TransporterDashboard.contract_accept_button' })).toBeNull();
  });

  it('offers the signature exactly when a draft contract awaits this Transporter', async () => {
    tableData['logistics_schema.contracts'] = [contractRow];

    await renderBooking('b-requested');

    expect(screen.getByText('TransporterDashboard.contract_accept_notice')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'TransporterDashboard.contract_accept_button' })).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.signature_status_PARTIAL')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText(/Price 385000 MZN/)).toBeTruthy();
  });

  it('withholds the signature once this Transporter has signed and says who is next', async () => {
    tableData['logistics_schema.contracts'] = [
      { ...contractRow, shipper_accepted_at: null, transporter_accepted_at: '2026-11-11T13:00:00Z' },
    ];

    await renderBooking('b-requested');

    expect(screen.queryByRole('button', { name: 'TransporterDashboard.contract_accept_button' })).toBeNull();
    expect(screen.getByText('TransporterDashboard.contract_awaiting_shipper')).toBeTruthy();
  });

  it('offers neither signature nor a waiting notice once both parties have signed a draft', async () => {
    tableData['logistics_schema.contracts'] = [
      { ...contractRow, transporter_accepted_at: '2026-11-11T13:00:00Z', num_signatories: 2 },
    ];

    await renderBooking('b-requested');

    expect(screen.queryByRole('button', { name: 'TransporterDashboard.contract_accept_button' })).toBeNull();
    expect(screen.queryByText('TransporterDashboard.contract_awaiting_shipper')).toBeNull();
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('links an active contract to its operation when tracking exists', async () => {
    tableData['logistics_schema.contracts'] = [{ ...contractRow, acceptance_status: 'ACTIVE', num_signatories: 2 }];
    getTrackingByBooking.mockResolvedValue({ id: 'tr-1', trackingRef: 'TRK-1', bookingId: 'b-requested', status: 'CREATED' });

    await renderBooking('b-requested');

    expect(screen.getByText('TransporterDashboard.booking_operations_notice')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'TransporterDashboard.booking_operations_link' }).getAttribute('href'))
      .toBe('/en/transporter/operations/tr-1');
    expect(screen.queryByText('TransporterDashboard.operations_not_initialised')).toBeNull();
  });

  it('discloses an active contract whose tracking record has not been created', async () => {
    tableData['logistics_schema.contracts'] = [{ ...contractRow, acceptance_status: 'ACTIVE' }];

    await renderBooking('b-requested');

    expect(screen.getByText('TransporterDashboard.operations_not_initialised')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'TransporterDashboard.booking_operations_link' })).toBeNull();
  });

  it('discloses that declining is not a Transporter action while the request is open', async () => {
    await renderBooking('b-requested');

    expect(screen.getByText('TransporterDashboard.booking_decline_notice')).toBeTruthy();
  });

  it('drops the decline notice once the booking is confirmed', async () => {
    getBooking.mockResolvedValue({ ...booking, status: 'CONFIRMED' });

    await renderBooking('b-requested');

    expect(screen.queryByText('TransporterDashboard.booking_decline_notice')).toBeNull();
  });

  it('shows only the quotation this session owns, never a competitor’s', async () => {
    await renderBooking('b-requested');

    expect(listOffers).toHaveBeenCalledWith(USER_ID);
    expect(screen.getByText('TransporterDashboard.booking_quotation_heading')).toBeTruthy();
    expect(screen.getByText('TransporterDashboard.offer_status_ACCEPTED')).toBeTruthy();
    expect(screen.queryByText('TransporterDashboard.quotation_not_visible')).toBeNull();
  });

  it('says so when the selected quotation is not among this session’s offers', async () => {
    listOffers.mockResolvedValue([{ ...offer, offerId: 'o-other' }]);

    await renderBooking('b-requested');

    expect(screen.getByText('TransporterDashboard.quotation_not_visible')).toBeTruthy();
  });

  it('joins the special-handling list and falls back when it is empty', async () => {
    const { unmount } = await renderBooking('b-requested');
    expect(screen.getByText('FRAGILE · KEEP_DRY')).toBeTruthy();
    unmount();

    getBooking.mockResolvedValue({ ...booking, specialHandling: [] });
    await renderBooking('b-requested');
    expect(screen.getAllByText('TransporterDashboard.summary_none').length).toBeGreaterThan(0);
    expect(screen.queryByText('FRAGILE · KEEP_DRY')).toBeNull();
  });

  it('hands the booking-linked and contract-linked documents to the card', async () => {
    tableData['logistics_schema.contracts'] = [contractRow];
    tableData['logistics_schema.documents'] = [bookingDocument, contractDocument];

    await renderBooking('b-requested');

    expect(screen.getByTestId('documents-card').textContent).toBe('d-booking,d-contract');
    const documentQueries = queries.filter((q) => q.table === 'documents');
    expect(documentQueries).toHaveLength(2);
    expect(documentQueries[0].filters).toEqual({ linked_entity_type: 'booking', linked_entity_id: 'b-requested', is_deleted: false });
    expect(documentQueries[1].filters).toEqual({ linked_entity_type: 'contract', linked_entity_id: 'c-1', is_deleted: false });
  });

  it('reads only booking documents when there is no contract', async () => {
    tableData['logistics_schema.documents'] = [bookingDocument];

    await renderBooking('b-requested');

    expect(screen.getByTestId('documents-card').textContent).toBe('d-booking');
    expect(queries.filter((q) => q.table === 'documents')).toHaveLength(1);
  });

  it('renders nothing without a session', async () => {
    sessionUser = null;
    const mod = await import('@/app/[locale]/(transporter)/transporter/bookings/[id]/page');

    expect(await mod.default({ params: Promise.resolve({ locale: 'en', id: 'b-requested' }) })).toBeNull();
  });
});

describe('I-5 §3G — the Transporter’s acceptance is the contract signature', () => {
  const fetchMock = vi.fn();
  const jsonResponse = (status: number, data: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('confirms, then signs through the existing MOD-002 accept route', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { message: 'Contract accepted by transporter.' } }));
    render(<ContractAcceptAction contractId="c-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.contract_accept_button' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('TransporterDashboard.contract_accepted'));

    expect(globalThis.confirm).toHaveBeenCalledWith('TransporterDashboard.contract_accept_confirm');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/contracts/c-1/accept');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
    expect(screen.getByText('Contract accepted by transporter.')).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });

  it('sends nothing when the confirmation is declined', () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<ContractAcceptAction contractId="c-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.contract_accept_button' }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the governed refusal instead of claiming success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden', message: 'Not a party to this contract' }));
    render(<ContractAcceptAction contractId="c-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.contract_accept_button' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not a party to this contract'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('never calls a booking confirmation or a payment route', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: {} }));
    render(<ContractAcceptAction contractId="c-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'TransporterDashboard.contract_accept_button' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    for (const call of fetchMock.mock.calls) {
      expect(call[0]).not.toContain('/api/booking/');
      expect(call[0]).not.toContain('/api/payments');
      expect(call[0]).not.toContain('/confirm');
    }
  });
});

describe('I-5 §3G — awaitingTransporterSignature is the draft-and-unsigned test', () => {
  const summary = (overrides: Record<string, unknown> = {}) => ({
    id: 'c-1', contractId: 'CONTRACT-1', bookingId: 'b-requested', acceptanceStatus: 'DRAFT',
    numSignatories: 1, shipperAcceptedAt: '2026-11-11T10:00:00Z', transporterAcceptedAt: undefined,
    signedAt: undefined, digitalSignatureStatus: 'PARTIAL', baseAmount: 385000, currency: 'MZN',
    termsSnapshot: '', pickupWindowStart: '', pickupWindowEnd: '', deliveryWindowStart: '',
    deliveryWindowEnd: '', createdAt: '', ...overrides,
  }) as never;

  it('is true only for a draft this Transporter has not signed', () => {
    expect(awaitingTransporterSignature(summary())).toBe(true);
    expect(awaitingTransporterSignature(summary({ transporterAcceptedAt: '2026-11-11T13:00:00Z' }))).toBe(false);
    expect(awaitingTransporterSignature(summary({ acceptanceStatus: 'ACTIVE' }))).toBe(false);
    expect(awaitingTransporterSignature(null)).toBe(false);
    expect(awaitingTransporterSignature(undefined)).toBe(false);
  });

  it('does not treat a missing shipper signature as the Transporter’s turn', () => {
    expect(awaitingTransporterSignature(summary({ shipperAcceptedAt: undefined }))).toBe(true);
  });
});

describe('I-5 §3G — PATCH /api/booking/[id] exposes the alignment predecessor, nothing more', () => {
  let PATCH: typeof import('@/app/api/booking/[id]/route').PATCH;

  beforeEach(async () => {
    PATCH = (await import('@/app/api/booking/[id]/route')).PATCH;
  });

  const request = (body: unknown) =>
    new NextRequest(`${ORIGIN}/api/booking/b-requested`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const params = { params: Promise.resolve({ id: 'b-requested' }) } as never;

  it('lets the owning shipper advance REQUESTED to ALIGNMENT_CHECKED', async () => {
    sessionUser = { id: SHIPPER_ID, email: 'shipper@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };

    const response = await PATCH(request({ action: 'align', currentStatus: 'REQUESTED' }), params);

    expect(response.status).toBe(200);
    expect(updateBookingStatus).toHaveBeenCalledWith('b-requested', 'ALIGNMENT_CHECKED');
  });

  it('does not confirm the booking as a side effect of aligning it', async () => {
    sessionUser = { id: SHIPPER_ID, email: 'shipper@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };

    await PATCH(request({ action: 'align', currentStatus: 'REQUESTED' }), params);

    expect(updateBookingStatus).toHaveBeenCalledTimes(1);
    expect(updateBookingStatus.mock.calls[0][1]).not.toBe('CONFIRMED');
  });

  it('refuses a Transporter, because booking_update is not a Transporter permission', async () => {
    const response = await PATCH(request({ action: 'align', currentStatus: 'REQUESTED' }), params);

    expect(response.status).toBe(403);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('refuses an anonymous caller before the repository is touched', async () => {
    sessionUser = null;

    const response = await PATCH(request({ action: 'align', currentStatus: 'REQUESTED' }), params);

    expect(response.status).toBe(401);
    expect(getBooking).not.toHaveBeenCalled();
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('refuses a shipper who does not own the booking', async () => {
    sessionUser = { id: 'shipper-other-2', email: 'other@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };

    const response = await PATCH(request({ action: 'align', currentStatus: 'REQUESTED' }), params);

    expect(response.status).toBe(403);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('refuses to align a booking that is already past the predecessor', async () => {
    sessionUser = { id: SHIPPER_ID, email: 'shipper@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };
    getBooking.mockResolvedValue({ ...booking, status: 'CONFIRMED' });

    const response = await PATCH(request({ action: 'align', currentStatus: 'CONFIRMED' }), params);

    expect(response.status).toBe(400);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('names the four allowed actions when the action is unknown', async () => {
    sessionUser = { id: SHIPPER_ID, email: 'shipper@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };

    const response = await PATCH(request({ action: 'accept', currentStatus: 'REQUESTED' }), params);
    const payload = (await response.json()) as { data?: { error?: string } };

    expect(response.status).toBe(400);
    expect(JSON.stringify(payload)).toContain('align, confirm, cancel, fail');
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('still requires the current status, so no action can skip the state machine', async () => {
    sessionUser = { id: SHIPPER_ID, email: 'shipper@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };

    const response = await PATCH(request({ action: 'align' }), params);

    expect(response.status).toBe(400);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  // WS-02 item 2 regressions: the persisted booking state, not the client claim, governs the transition.
  it('refuses a forged currentStatus that would skip a required predecessor', async () => {
    sessionUser = { id: SHIPPER_ID, email: 'shipper@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };
    // Persisted REQUESTED; the client claims ALIGNMENT_CHECKED to reach confirm without aligning.
    const response = await PATCH(request({ action: 'confirm', currentStatus: 'ALIGNMENT_CHECKED' }), params);

    expect(response.status).toBe(409);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('refuses a stale currentStatus with a conflict instead of writing', async () => {
    sessionUser = { id: SHIPPER_ID, email: 'shipper@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };
    getBooking.mockResolvedValue({ ...booking, status: 'ALIGNMENT_CHECKED' });

    const response = await PATCH(request({ action: 'align', currentStatus: 'REQUESTED' }), params);

    expect(response.status).toBe(409);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('answers 404 for an unreadable booking before any status conflict is disclosed', async () => {
    sessionUser = { id: SHIPPER_ID, email: 'shipper@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };
    getBooking.mockResolvedValue(null);

    const response = await PATCH(request({ action: 'confirm', currentStatus: 'ALIGNMENT_CHECKED' }), params);

    expect(response.status).toBe(404);
    expect(updateBookingStatus).not.toHaveBeenCalled();
  });

  it('reports the persisted status as previousStatus on a lawful transition', async () => {
    sessionUser = { id: SHIPPER_ID, email: 'shipper@example.mz', created_at: '', user_metadata: {} };
    rpcAnswers = { ...SHIPPER };

    const response = await PATCH(request({ action: 'align', currentStatus: 'REQUESTED' }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(payload)).toContain('"previousStatus":"REQUESTED"');
    expect(updateBookingStatus).toHaveBeenCalledWith('b-requested', 'ALIGNMENT_CHECKED');
  });
});