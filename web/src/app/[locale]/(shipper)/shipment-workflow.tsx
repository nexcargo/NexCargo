// NexCargo I-4 §3D/§3E/§3F — the interactive part of a shipment: quotation comparison, matching
// results and booking initiation.
//
// Reads come from the server-rendered props; every action goes to the existing REST route so the
// server's own authorization, ownership and lifecycle checks are the ones that decide. AI matching
// stays advisory — nothing here auto-selects an offer; the shipper explicitly chooses and explicitly
// initiates, and initiation only ever creates a REQUESTED booking.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ErrorBanner } from '@/shared/ui';
import {
  bookingStatusVariant,
  formatDateTime,
  formatMoney,
  offerStatusVariant,
} from './presentation';

export interface ListingView {
  listingId: string;
  status: string;
  shipperId: string;
  cargoType: string;
  weightKg: number;
  volumeM3: number | null;
  description: string;
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  earliestPickup: string;
  latestDelivery: string;
}

export interface OfferView {
  offerId: string;
  transporterId: string;
  priceProposal: number;
  vehicleType: string;
  maxWeightKg: number;
  maxVolumeM3: number | null;
  earliestPickup: string;
  latestPickup: string;
  estimatedDelivery: string;
  status: string;
  notes: string;
  createdAt: string;
}

export interface BookingView {
  bookingId: string;
  selectedOfferId: string;
  status: string;
  offerPrice: number;
  currency: string;
  createdAt: string;
}

interface MatchRow {
  offerId: string;
  matchScore: number;
  rankingPosition: number;
  isRecommended: boolean;
}

interface MatchingResult {
  matches: MatchRow[];
  matchCount: number;
  relaxed: boolean;
  suggestion?: string;
  stepsApplied?: number[];
}

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const TD = 'px-3 py-3 align-top text-sm text-zinc-600 dark:text-zinc-400';

/** Reads the wrapped error out of a marketplace/booking API response. */
async function readError(response: Response): Promise<string> {
  const parsed = await response.json().catch(() => null);
  const body = (parsed as { data?: { error?: string } } | null)?.data;
  return body?.error ?? `HTTP ${response.status}`;
}

export function ShipmentWorkflow({
  listing,
  offers,
  booking,
}: {
  listing: ListingView;
  offers: OfferView[];
  booking: BookingView | null;
}) {
  const t = useTranslations('ShipperDashboard');
  const locale = useLocale();
  const router = useRouter();

  const [selectedOfferId, setSelectedOfferId] = useState(booking?.selectedOfferId ?? '');
  const [matchingBusy, setMatchingBusy] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchingResult | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingNotice, setBookingNotice] = useState<string | null>(null);

  const selectable = offers.filter((offer) => offer.status === 'SUBMITTED');
  const chosen = selectable.find((offer) => offer.offerId === selectedOfferId) ?? null;

  // MOD-002 §4.7 required booking fields, surfaced before the call rather than after a rejection.
  const missing: string[] = [];
  if (!listing.description) missing.push(t('field_description'));
  if (!(listing.weightKg > 0)) missing.push(t('field_weight_kg'));

  async function runMatching() {
    setMatchingBusy(true);
    setMatchingError(null);
    setMatches(null);
    try {
      const response = await fetch('/api/marketplace/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.listingId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.data?.error ?? `HTTP ${response.status}`);
      setMatches(payload?.data as MatchingResult);
    } catch (error) {
      setMatchingError(error instanceof Error ? error.message : String(error));
    } finally {
      setMatchingBusy(false);
    }
  }

  async function initiateBooking() {
    if (!chosen) return;
    setBookingBusy(true);
    setBookingError(null);
    setBookingNotice(null);
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: crypto.randomUUID(),
          listingId: listing.listingId,
          selectedOfferId: chosen.offerId,
          shipperId: listing.shipperId,
          originAddress: listing.originAddress,
          originLatitude: listing.originLatitude,
          originLongitude: listing.originLongitude,
          destinationAddress: listing.destinationAddress,
          destinationLatitude: listing.destinationLatitude,
          destinationLongitude: listing.destinationLongitude,
          cargoDescription: listing.description,
          cargoType: listing.cargoType,
          weightKg: listing.weightKg,
          volumeM3: listing.volumeM3 ?? undefined,
          offerPrice: chosen.priceProposal,
          availabilityWindowStart: chosen.earliestPickup || listing.earliestPickup,
          availabilityWindowEnd: chosen.estimatedDelivery || listing.latestDelivery,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const payload = await response.json().catch(() => null);
      const reference = payload?.data?.bookingId ?? chosen.offerId;
      setBookingNotice(t('booking_success', { reference: String(reference) }));
      router.refresh();
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : String(error));
    } finally {
      setBookingBusy(false);
    }
  }

  const matchByOffer = new Map((matches?.matches ?? []).map((row) => [row.offerId, row]));
  const offerById = new Map(offers.map((offer) => [offer.offerId, offer]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('section_offers')}</CardTitle>
          <CardDescription>{t('offers_hint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">{t('offers_empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                    <th scope="col" className={TH}>{t('col_offer_status')}</th>
                    <th scope="col" className={TH}>{t('col_offer_transporter')}</th>
                    <th scope="col" className={TH}>{t('col_offer_price')}</th>
                    <th scope="col" className={TH}>{t('col_offer_vehicle')}</th>
                    <th scope="col" className={`${TH} hidden md:table-cell`}>{t('col_offer_capacity')}</th>
                    <th scope="col" className={`${TH} hidden lg:table-cell`}>{t('col_offer_availability')}</th>
                    <th scope="col" className={`${TH} hidden lg:table-cell`}>{t('col_offer_notes')}</th>
                    <th scope="col" className={TH}>{t('offer_select')}</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => {
                    const match = matchByOffer.get(offer.offerId);
                    const canSelect = offer.status === 'SUBMITTED' && !booking;
                    return (
                      <tr key={offer.offerId} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
                        <td className="px-3 py-3 align-top">
                          <Badge variant={offerStatusVariant(offer.status)}>
                            {t(`offer_status_${offer.status}`)}
                          </Badge>
                          {match && (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {t('col_match_score')}: {match.matchScore}
                            </p>
                          )}
                        </td>
                        <td className={`${TD} font-mono`}>{offer.transporterId.slice(0, 8)}</td>
                        <td className={`${TD} font-medium text-[#0A1628] dark:text-white`}>
                          {formatMoney(offer.priceProposal, 'MZN', locale)}
                        </td>
                        <td className={TD}>{t(`vehicle_${offer.vehicleType}`)}</td>
                        <td className={`${TD} hidden md:table-cell`}>
                          {offer.maxVolumeM3 == null
                            ? t('capacity_weight', { kg: String(offer.maxWeightKg) })
                            : t('capacity_weight_volume', {
                                kg: String(offer.maxWeightKg),
                                m3: String(offer.maxVolumeM3),
                              })}
                        </td>
                        <td className={`${TD} hidden lg:table-cell`}>
                          {offer.earliestPickup
                            ? t('availability_window', {
                                pickup: formatDateTime(offer.earliestPickup, locale),
                                delivery: formatDateTime(offer.estimatedDelivery || offer.latestPickup, locale),
                              })
                            : '—'}
                        </td>
                        <td className={`${TD} hidden max-w-xs lg:table-cell`}>{offer.notes || '—'}</td>
                        <td className="px-3 py-3 align-top">
                          {canSelect ? (
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                              <input
                                type="radio"
                                name="selected-offer"
                                className="h-4 w-4 border-zinc-300 text-[#1A5C9E] dark:border-zinc-600"
                                checked={selectedOfferId === offer.offerId}
                                onChange={() => setSelectedOfferId(offer.offerId)}
                              />
                              <span className="sr-only">{t('offer_select')}</span>
                            </label>
                          ) : (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {booking && offer.offerId === booking.selectedOfferId ? t('offer_selected') : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('section_matching')}</CardTitle>
          <CardDescription>{t('matching_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {listing.status !== 'PUBLISHED' ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('matching_requires_published')}</p>
          ) : (
            <Button size="sm" isLoading={matchingBusy} onClick={() => void runMatching()}>
              {matchingBusy ? t('matching_running') : t('run_matching')}
            </Button>
          )}

          {matchingError && <ErrorBanner message={matchingError} />}

          {matches?.relaxed && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
              <p className="font-medium">{t('matching_relaxed')}</p>
              {matches.suggestion && <p className="mt-1">{matches.suggestion}</p>}
              {matches.stepsApplied && matches.stepsApplied.length > 0 && (
                <p className="mt-1 text-xs">
                  {t('matching_steps')}: {matches.stepsApplied.join(', ')}
                </p>
              )}
            </div>
          )}

          {matches && matches.matches.length === 0 && !matches.relaxed && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('matching_empty')}</p>
          )}

          {matches && matches.matches.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('section_matching')}</caption>
                <thead>
                  <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                    <th scope="col" className={TH}>{t('col_match_rank')}</th>
                    <th scope="col" className={TH}>{t('col_offer_transporter')}</th>
                    <th scope="col" className={TH}>{t('col_match_score')}</th>
                    <th scope="col" className={TH}>{t('col_match_recommended')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...matches.matches]
                    .sort((a, b) => a.rankingPosition - b.rankingPosition)
                    .map((row) => (
                      <tr key={row.offerId} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
                        <td className={TD}>{row.rankingPosition}</td>
                        <td className={`${TD} font-mono`}>{(offerById.get(row.offerId)?.transporterId ?? row.offerId).slice(0, 8)}</td>
                        <td className={`${TD} font-medium text-[#0A1628] dark:text-white`}>{row.matchScore}</td>
                        <td className={TD}>
                          {row.isRecommended ? (
                            <Badge variant="success">{t('recommended_yes')}</Badge>
                          ) : (
                            <span className="text-zinc-500 dark:text-zinc-400">{t('recommended_no')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('matching_advisory_notice')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('section_booking')}</CardTitle>
          <CardDescription>{t('booking_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {booking ? (
            <div>
              <p className="text-sm font-medium text-[#0A1628] dark:text-white">{t('booking_existing')}</p>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t('col_booking_reference')}
                  </dt>
                  <dd className="font-mono text-zinc-700 dark:text-zinc-300">{booking.bookingId}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('col_status')}</dt>
                  <dd>
                    <Badge variant={bookingStatusVariant(booking.status)}>
                      {t(`booking_status_${booking.status}`)}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('col_booking_price')}</dt>
                  <dd className="text-zinc-700 dark:text-zinc-300">
                    {formatMoney(booking.offerPrice, booking.currency, locale)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <>
              {missing.length > 0 && (
                <ErrorBanner
                  message={
                    <span>
                      <strong className="block">{t('form_errors_title')}</strong>
                      <ul className="mt-1 list-disc pl-5">
                        {missing.map((label) => <li key={label}>{label}</li>)}
                      </ul>
                    </span>
                  }
                />
              )}
              {bookingNotice && (
                <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
                  {bookingNotice}
                </p>
              )}
              {bookingError && <ErrorBanner message={bookingError} />}
              <div className="flex flex-col items-start gap-2">
                <Button
                  size="sm"
                  isLoading={bookingBusy}
                  disabled={bookingBusy || !chosen || missing.length > 0}
                  onClick={() => void initiateBooking()}
                >
                  {bookingBusy ? t('booking_initiating') : t('initiate_booking')}
                </Button>
                {!chosen && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {listing.status !== 'PUBLISHED' ? t('booking_requires_published') : t('booking_requires_offer')}
                  </p>
                )}
              </div>
            </>
          )}

          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('booking_notice')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
