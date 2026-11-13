// NexCargo I-4 §3C — Shipment list and management.
// Every listing the authenticated shipper owns, across all lifecycle states, read through the
// RLS-enforced session client.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent } from '@/shared/ui';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { toShipmentListing } from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import type { ShipmentListing } from '@/modules/mod-001-marketplace/domain/types/listings';
import { getShipperContext } from '../../shipper-session';
import { ShipmentActions } from '../../shipment-actions';
import { formatDate, formatWeight, listingStatusVariant } from '../../presentation';

export const dynamic = 'force-dynamic';

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const TD = 'px-3 py-3 align-top text-zinc-600 dark:text-zinc-400';

export default async function ShipperShipmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('ShipperDashboard');
  const ctx = await getShipperContext();
  if (!ctx) return null;

  const listings = (await new ListingsRepository().listByShipper(ctx.userId)).map(toShipmentListing);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('shipments_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('shipments_subtitle')}</p>
        </div>
        <Button href={`/${locale}/shipper/shipments/new`} size="sm">{t('shipper_nav_create')}</Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {listings.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium text-[#0A1628] dark:text-white">{t('empty_shipments_title')}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{t('empty_shipments_desc')}</p>
              <div className="mt-4">
                <Button href={`/${locale}/shipper/shipments/new`} size="sm">{t('create_first_shipment')}</Button>
              </div>
            </div>
          ) : (
            <ShipmentsTable listings={listings} locale={locale} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function ShipmentsTable({
  listings,
  locale,
}: {
  listings: ShipmentListing[];
  locale: string;
}) {
  const t = await getTranslations('ShipperDashboard');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
            <th scope="col" className={TH}>{t('col_route')}</th>
            <th scope="col" className={`${TH} hidden sm:table-cell`}>{t('col_cargo')}</th>
            <th scope="col" className={`${TH} hidden md:table-cell`}>{t('col_weight')}</th>
            <th scope="col" className={`${TH} hidden lg:table-cell`}>{t('col_created')}</th>
            <th scope="col" className={TH}>{t('col_status')}</th>
            <th scope="col" className={TH}>{t('col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.listingId} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
              <td className="px-3 py-3 align-top">
                <Link
                  href={`/${locale}/shipper/shipments/${listing.listingId}`}
                  className="font-medium text-[#0A1628] hover:underline dark:text-white"
                >
                  {listing.origin.address || t('summary_none')} → {listing.destination.address || t('summary_none')}
                </Link>
                {listing.title && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{listing.title}</p>}
              </td>
              <td className={`${TD} hidden sm:table-cell`}>{t(`cargo_${listing.cargoType}`)}</td>
              <td className={`${TD} hidden md:table-cell`}>{formatWeight(listing.weightKg, locale)}</td>
              <td className={`${TD} hidden lg:table-cell`}>{formatDate(listing.created_at.toISOString(), locale)}</td>
              <td className="px-3 py-3 align-top">
                <Badge variant={listingStatusVariant(listing.status)}>{t(`status_${listing.status}`)}</Badge>
              </td>
              <td className="px-3 py-3 align-top">
                <div className="flex flex-col items-start gap-2">
                  <Link
                    href={`/${locale}/shipper/shipments/${listing.listingId}`}
                    className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
                  >
                    {t('action_view')}
                  </Link>
                  <ShipmentActions listingId={listing.listingId} status={listing.status} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
