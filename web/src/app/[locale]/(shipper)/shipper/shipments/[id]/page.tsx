// NexCargo I-4 §3C/§3D/§3E/§3F — shipment detail: summary, lifecycle, quotations, matching and
// booking initiation for one shipment the authenticated shipper owns.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import {
  toShipmentListing,
  toTransportOffer,
} from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import { ListingStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { getShipperContext } from '../../../shipper-session';
import { Notice } from '../../../notice';
import { ShipmentActions } from '../../../shipment-actions';
import { ShipmentWorkflow, type BookingView, type ListingView, type OfferView } from '../../../shipment-workflow';
import { formatDate, formatDateTime, formatWeight, listingStatusVariant } from '../../../presentation';

export const dynamic = 'force-dynamic';

const DT = 'text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const DD = 'mt-0.5 text-sm text-zinc-700 dark:text-zinc-300';

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations('ShipperDashboard');
  const ctx = await getShipperContext();
  if (!ctx) return null;

  const stored = await new ListingsRepository().getById(id);
  // Server-side ownership: a listing belonging to another shipper is reported as absent, so the
  // detail page never becomes a cross-tenant read oracle.
  if (!stored || stored.shipperId !== ctx.userId) {
    return (
      <Notice
        href={`/${locale}/shipper/shipments`}
        label={t('back_to_shipments')}
        title={t('not_found_title')}
        body={t('not_found_desc')}
      />
    );
  }

  const listing = toShipmentListing(stored);
  const [storedOffers, storedBookings] = await Promise.all([
    new OffersRepository().listByListing(listing.listingId),
    new BookingsRepository().listByShipper(ctx.userId),
  ]);

  const offers: OfferView[] = storedOffers.map((row) => {
    const offer = toTransportOffer(row);
    return {
      offerId: offer.offerId,
      transporterId: offer.transporterId,
      priceProposal: offer.priceProposal,
      vehicleType: String(offer.vehicleType),
      maxWeightKg: offer.declaredCapacity.maxWeightKg,
      maxVolumeM3: offer.declaredCapacity.maxVolumeM3 ?? null,
      earliestPickup: offer.availabilityWindow.earliestPickup,
      latestPickup: offer.availabilityWindow.latestPickup,
      estimatedDelivery: offer.availabilityWindow.estimatedDelivery,
      status: String(offer.status),
      notes: offer.notes ?? '',
      createdAt: offer.created_at.toISOString(),
    };
  });

  const bookingRow = storedBookings
    .filter((booking) => booking.listingId === listing.listingId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const booking: BookingView | null = bookingRow
    ? {
        bookingId: bookingRow.bookingId,
        selectedOfferId: bookingRow.selectedOfferId,
        status: bookingRow.status,
        offerPrice: bookingRow.offerPrice,
        currency: bookingRow.currency,
        createdAt: bookingRow.createdAt,
      }
    : null;

  const view: ListingView = {
    listingId: listing.listingId,
    status: String(listing.status),
    shipperId: listing.shipperId,
    cargoType: String(listing.cargoType),
    weightKg: listing.weightKg,
    volumeM3: listing.volumeM3 ?? null,
    description: listing.description ?? '',
    originAddress: listing.origin.address,
    originLatitude: listing.origin.latitude,
    originLongitude: listing.origin.longitude,
    destinationAddress: listing.destination.address,
    destinationLatitude: listing.destination.latitude,
    destinationLongitude: listing.destination.longitude,
    earliestPickup: listing.timeWindow.earliestPickup,
    latestDelivery: listing.timeWindow.latestDelivery,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/${locale}/shipper/shipments`}
            className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
          >
            ← {t('back_to_shipments')}
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#0A1628] dark:text-white">
            {listing.title || t('shipment_detail_title')}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {listing.origin.address || t('summary_none')} → {listing.destination.address || t('summary_none')}
          </p>
        </div>
        <Badge variant={listingStatusVariant(listing.status)}>{t(`status_${listing.status}`)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('section_summary')}</CardTitle>
          {listing.description && <CardDescription>{listing.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className={DT}>{t('summary_reference')}</dt>
              <dd className={`${DD} font-mono`}>{listing.listingId}</dd>
            </div>
            <div>
              <dt className={DT}>{t('summary_cargo_type')}</dt>
              <dd className={DD}>{t(`cargo_${listing.cargoType}`)}</dd>
            </div>
            <div>
              <dt className={DT}>{t('summary_weight')}</dt>
              <dd className={DD}>{formatWeight(listing.weightKg, locale) || t('summary_none')}</dd>
            </div>
            <div>
              <dt className={DT}>{t('summary_volume')}</dt>
              <dd className={DD}>{listing.volumeM3 == null ? t('summary_none') : `${listing.volumeM3} m³`}</dd>
            </div>
            <div>
              <dt className={DT}>{t('summary_pricing_model')}</dt>
              <dd className={DD}>{t(`pricing_${listing.pricingModel}`)}</dd>
            </div>
            <div>
              <dt className={DT}>{t('summary_pickup')}</dt>
              <dd className={DD}>{formatDateTime(listing.timeWindow.earliestPickup, locale)}</dd>
            </div>
            <div>
              <dt className={DT}>{t('summary_delivery')}</dt>
              <dd className={DD}>{formatDateTime(listing.timeWindow.latestDelivery, locale)}</dd>
            </div>
            <div>
              <dt className={DT}>{t('summary_accepted_vehicles')}</dt>
              <dd className={DD}>
                {listing.acceptedVehicleTypes.length === 0
                  ? t('summary_none')
                  : listing.acceptedVehicleTypes.map((vehicle) => t(`vehicle_${vehicle}`)).join(', ')}
              </dd>
            </div>
            <div>
              <dt className={DT}>{t('summary_origin')}</dt>
              <dd className={DD}>{listing.origin.address || t('summary_none')}</dd>
            </div>
            <div>
              <dt className={DT}>{t('summary_destination')}</dt>
              <dd className={DD}>{listing.destination.address || t('summary_none')}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('section_lifecycle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className={DT}>{t('lifecycle_created')}</dt>
                <dd className={DD}>{formatDate(listing.created_at.toISOString(), locale)}</dd>
              </div>
              <div>
                <dt className={DT}>{t('lifecycle_published')}</dt>
                <dd className={DD}>
                  {listing.publishedAt ? formatDate(listing.publishedAt, locale) : t('lifecycle_not_published')}
                </dd>
              </div>
              <div>
                <dt className={DT}>{t('lifecycle_status')}</dt>
                <dd className={DD}>
                  <Badge variant={listingStatusVariant(listing.status)}>{t(`status_${listing.status}`)}</Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('detail_actions')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {listing.status === ListingStatus.DRAFT && (
              <Button href={`/${locale}/shipper/shipments/${listing.listingId}/edit`} variant="outline" size="sm">
                {t('action_edit')}
              </Button>
            )}
            <ShipmentActions listingId={listing.listingId} status={String(listing.status)} />
          </CardContent>
        </Card>
      </div>

      <ShipmentWorkflow listing={view} offers={offers} booking={booking} />
    </div>
  );
}
