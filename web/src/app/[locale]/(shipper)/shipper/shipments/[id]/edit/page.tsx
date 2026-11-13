// NexCargo I-4 §3C — Edit a shipment while the lifecycle permits.
// The API only accepts field edits on a DRAFT listing; this page applies the same rule before
// rendering the form so the shipper is not offered an edit the server would reject.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { toShipmentListing } from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import { ListingStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { getShipperContext } from '../../../../shipper-session';
import { ShipmentForm, type ShipmentDraft } from '../../../../shipment-form';
import { toDateTimeLocalValue } from '../../../../presentation';
import { Notice } from '../../../../notice';

export const dynamic = 'force-dynamic';

export default async function EditShipmentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations('ShipperDashboard');
  const ctx = await getShipperContext();
  if (!ctx) return null;

  const stored = await new ListingsRepository().getById(id);
  // RLS already scopes the read; this re-check keeps the page from rendering an editable form for
  // a row the session is not entitled to.
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

  if (listing.status !== ListingStatus.DRAFT) {
    return (
      <Notice
        href={`/${locale}/shipper/shipments/${id}`}
        label={t('back_to_shipment')}
        title={t('edit_locked_title')}
        body={t('edit_locked_desc')}
      />
    );
  }

  const finite = (value: number) => (Number.isFinite(value) ? value : null);
  const initial: ShipmentDraft = {
    title: listing.title ?? '',
    description: listing.description ?? '',
    origin: {
      address: listing.origin.address,
      latitude: finite(listing.origin.latitude),
      longitude: finite(listing.origin.longitude),
    },
    destination: {
      address: listing.destination.address,
      latitude: finite(listing.destination.latitude),
      longitude: finite(listing.destination.longitude),
    },
    cargoType: String(listing.cargoType),
    weightKg: finite(listing.weightKg),
    volumeM3: listing.volumeM3 ?? null,
    pricingModel: String(listing.pricingModel),
    earliestPickup: toDateTimeLocalValue(listing.timeWindow.earliestPickup),
    latestDelivery: toDateTimeLocalValue(listing.timeWindow.latestDelivery),
    acceptedVehicleTypes: listing.acceptedVehicleTypes.map(String),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/shipper/shipments/${listing.listingId}`}
          className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
        >
          ← {t('back_to_shipment')}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0A1628] dark:text-white">
          {t('edit_shipment_title')}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('edit_shipment_subtitle')}</p>
      </div>

      <ShipmentForm locale={locale} listingId={listing.listingId} initial={initial} />
    </div>
  );
}
