// NexCargo I-4 §5/§10(11) — the client-interactive states of the Shipper journey.
//
// The live HTTP acceptance run proves what the server renders; this suite proves the state machines
// inside the two client components: validation feedback before any call, the busy/label change while
// a request is in flight, the server error surfaced in the banner, matching results and relaxation
// advice, and booking initiation that stops at the REQUESTED boundary. Translations are stubbed to
// their message keys so assertions name the state rather than its wording.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${namespace}.${key} ${JSON.stringify(values)}` : `${namespace}.${key}`,
  useLocale: () => 'en',
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));

import { ShipmentForm } from '@/app/[locale]/(shipper)/shipment-form';
import { ShipmentWorkflow, type ListingView, type OfferView } from '@/app/[locale]/(shipper)/shipment-workflow';

const fetchMock = vi.fn();
const jsonResponse = (status: number, data: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ data }),
});

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const filledForm = () => {
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_title'), { target: { value: 'Maputo to Beira' } });
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_origin_address'), { target: { value: 'Av. Julius Nyerere 1234' } });
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_origin_latitude'), { target: { value: '-25.965' } });
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_origin_longitude'), { target: { value: '32.583' } });
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_destination_address'), { target: { value: 'Avenue do Zambesia 10' } });
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_destination_latitude'), { target: { value: '-19.841' } });
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_destination_longitude'), { target: { value: '34.84' } });
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_weight_kg'), { target: { value: '4200' } });
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_earliest_pickup'), { target: { value: '2026-12-01T08:00' } });
  fireEvent.change(screen.getByLabelText('ShipperDashboard.field_latest_delivery'), { target: { value: '2026-12-05T18:00' } });
};

describe('ShipmentForm client validation feedback (§10 criterion 11)', () => {
  beforeEach(() => render(<ShipmentForm locale="en" />));

  it('names every canonical rule the empty draft breaks, without calling the API', () => {
    fireEvent.submit(screen.getByRole('button', { name: 'ShipperDashboard.save_draft' }).closest('form')!);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('ShipperDashboard.validation_origin');
    expect(alert).toHaveTextContent('ShipperDashboard.validation_destination');
    expect(alert).toHaveTextContent('ShipperDashboard.validation_weight_or_volume');
    expect(alert).toHaveTextContent('ShipperDashboard.validation_time_window');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an inverted collection window before any request', () => {
    filledForm();
    fireEvent.change(screen.getByLabelText('ShipperDashboard.field_earliest_pickup'), { target: { value: '2026-12-06T08:00' } });
    fireEvent.submit(screen.getByRole('button', { name: 'ShipperDashboard.save_draft' }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('ShipperDashboard.validation_time_window');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the busy label while the create call is open, then lands on the new shipment', async () => {
    let release: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    filledForm();
    fireEvent.submit(screen.getByRole('button', { name: 'ShipperDashboard.save_draft' }).closest('form')!);

    const busy = screen.getByRole('button', { name: /ShipperDashboard\.saving/ }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(push).not.toHaveBeenCalled();

    release(jsonResponse(201, { listingId: 'listing-77' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en/shipper/shipments/listing-77'));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.weightKg).toBe(4200);
    expect(body.volumeM3).toBeNull();
  });

  it('surfaces the server rejection instead of silently staying busy', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'At least one of weight or volume must be specified' }));
    filledForm();
    fireEvent.submit(screen.getByRole('button', { name: 'ShipperDashboard.save_draft' }).closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('At least one of weight or volume must be specified'));
    expect(screen.getByRole('button', { name: 'ShipperDashboard.save_draft' })).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('publishes only after the draft exists, through the governed publish action', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { listingId: 'listing-78' }))
      .mockResolvedValueOnce(jsonResponse(200, { listingId: 'listing-78', newStatus: 'PUBLISHED' }));
    filledForm();
    fireEvent.click(screen.getByRole('button', { name: 'ShipperDashboard.save_and_publish' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en/shipper/shipments/listing-78'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/api/marketplace/listings/listing-78');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: 'publish' });
  });
});

const listing: ListingView = {
  listingId: 'listing-77',
  status: 'PUBLISHED',
  shipperId: 'shipper-1',
  cargoType: 'GENERAL',
  weightKg: 4200,
  volumeM3: 18,
  description: '20 crates of general cargo',
  originAddress: 'Av. Julius Nyerere 1234, Maputo',
  originLatitude: -25.965,
  originLongitude: 32.583,
  destinationAddress: 'Avenue do Zambesia 10, Beira',
  destinationLatitude: -19.841,
  destinationLongitude: 34.84,
  earliestPickup: '2026-12-01T08:00:00.000Z',
  latestDelivery: '2026-12-05T18:00:00.000Z',
};

const offer: OfferView = {
  offerId: 'offer-1',
  transporterId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  priceProposal: 385000,
  vehicleType: 'HEAVY_TRUCK',
  maxWeightKg: 20000,
  maxVolumeM3: 60,
  earliestPickup: '2026-12-01T09:00:00.000Z',
  latestPickup: '2026-12-01T14:00:00.000Z',
  estimatedDelivery: '2026-12-04T18:00:00.000Z',
  status: 'SUBMITTED',
  notes: 'Side-loader, 24h cover',
  createdAt: '2026-11-10T10:00:00.000Z',
};

describe('ShipmentWorkflow states (§10 criteria 5, 6, 7, 11)', () => {
  beforeEach(() => render(<ShipmentWorkflow listing={listing} offers={[offer]} booking={null} />));

  it('runs matching against the existing engine endpoint and ranks what comes back', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      listingId: listing.listingId,
      matches: [{ offerId: 'offer-1', matchScore: 82, rankingPosition: 1, isRecommended: true }],
      matchCount: 1,
      relaxed: false,
    }));
    fireEvent.click(screen.getByRole('button', { name: 'ShipperDashboard.run_matching' }));
    // The Button primitive prefixes its accessible name with the spinner's "Loading" label.
    expect(screen.getByRole('button', { name: /ShipperDashboard\.matching_running/ })).toBeDisabled();
    await waitFor(() => expect(screen.getByText('82')).toBeInTheDocument());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ listingId: 'listing-77' });
    expect(screen.getByText('ShipperDashboard.matching_advisory_notice')).toBeInTheDocument();
  });

  it('reports the relaxation advice when nothing qualifies', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      listingId: listing.listingId, matches: [], matchCount: 0, relaxed: true,
      suggestion: 'Consider widening the delivery window.', stepsApplied: [1],
    }));
    fireEvent.click(screen.getByRole('button', { name: 'ShipperDashboard.run_matching' }));
    await waitFor(() => expect(screen.getByText('ShipperDashboard.matching_relaxed')).toBeInTheDocument());
    expect(screen.getByText('Consider widening the delivery window.')).toBeInTheDocument();
  });

  it('surfaces a matching failure in the error state', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'Matching is temporarily unavailable' }));
    fireEvent.click(screen.getByRole('button', { name: 'ShipperDashboard.run_matching' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Matching is temporarily unavailable'));
  });

  it('keeps booking disabled until the shipper explicitly selects a quotation', () => {
    expect(screen.getByRole('button', { name: 'ShipperDashboard.initiate_booking' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio'));
    expect(screen.getByRole('button', { name: 'ShipperDashboard.initiate_booking' })).not.toBeDisabled();
  });

  it('initiates a REQUESTED booking and never reaches a confirmation endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { bookingId: 'booking-9', status: 'REQUESTED' }));
    fireEvent.click(screen.getByRole('radio'));
    fireEvent.click(screen.getByRole('button', { name: 'ShipperDashboard.initiate_booking' }));
    await waitFor(() => expect(screen.getByRole('status'))
      .toHaveTextContent('ShipperDashboard.booking_success {"reference":"booking-9"}'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/booking');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.selectedOfferId).toBe('offer-1');
    expect(body.shipperId).toBe(listing.shipperId);
  });

});

describe('ShipmentWorkflow with an initiated booking (§3F boundary)', () => {
  it('shows the booking and offers no second initiation', () => {
    render(<ShipmentWorkflow listing={listing} offers={[offer]}
      booking={{ bookingId: 'booking-9', selectedOfferId: 'offer-1', status: 'REQUESTED', offerPrice: 385000, currency: 'MZN', createdAt: offer.createdAt }} />);
    expect(screen.queryByRole('button', { name: 'ShipperDashboard.initiate_booking' })).not.toBeInTheDocument();
    expect(screen.getByText('booking-9')).toBeInTheDocument();
    expect(screen.getByText('ShipperDashboard.offer_selected')).toBeInTheDocument();
  });
});
