// NexCargo I-4 §3A — Authenticated Shipper dashboard.
// Data is read in the Server Component through the repositories, which use the RLS-enforced
// session client. Ownership is therefore enforced by the database, not by a client-side filter.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { toShipmentListing } from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import { getShipperContext } from '../../shipper-session';
import {
  formatDate,
  formatWeight,
  listingStatusVariant,
  bookingStatusVariant,
} from '../../presentation';

export const dynamic = 'force-dynamic';

export default async function ShipperDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('ShipperDashboard');
  const ctx = await getShipperContext();
  if (!ctx) return null;

  const listings = (await new ListingsRepository().listByShipper(ctx.userId)).map(toShipmentListing);
  const bookings = await new BookingsRepository().listByShipper(ctx.userId);

  const offerCounts = await Promise.all(
    listings.map((listing) =>
      new OffersRepository().listByListing(listing.listingId).then((offers) => offers.length),
    ),
  );
  const totalOffers = offerCounts.reduce((sum, count) => sum + count, 0);

  const published = listings.filter((l) => l.status === 'PUBLISHED').length;
  const drafts = listings.filter((l) => l.status === 'DRAFT').length;
  const activeBookings = bookings.filter(
    (b) => b.status === 'REQUESTED' || b.status === 'ALIGNMENT_CHECKED',
  ).length;

  const recentListings = listings.slice(0, 5);
  const recentBookings = bookings.slice(0, 5);

  const kpis = [
    { label: t('published_shipments'), value: published },
    { label: t('draft_shipments'), value: drafts },
    { label: t('total_offers'), value: totalOffers },
    { label: t('active_bookings'), value: activeBookings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('overview')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href={`/${locale}/shipper/shipments/new`} size="sm">{t('shipper_nav_create')}</Button>
          <Button href={`/${locale}/shipper/shipments`} variant="outline" size="sm">{t('shipper_nav_shipments')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#0A1628] dark:text-white">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section aria-labelledby="recent-shipments">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle id="recent-shipments">{t('recent_shipments')}</CardTitle>
            <Link
              href={`/${locale}/shipper/shipments`}
              className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
            >
              {t('view_all_shipments')}
            </Link>
          </CardHeader>
          <CardContent>
            {recentListings.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('no_recent_shipments')}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">{t('create_shipment_desc')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('col_route')}</th>
                      <th scope="col" className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:table-cell">{t('col_cargo')}</th>
                      <th scope="col" className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 md:table-cell">{t('col_weight')}</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('col_status')}</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentListings.map((listing) => (
                      <tr key={listing.listingId} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
                        <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">
                          <span className="font-medium">{listing.origin.address || t('summary_none')}</span>
                          <span className="mx-1 text-zinc-400">→</span>
                          <span>{listing.destination.address || t('summary_none')}</span>
                        </td>
                        <td className="hidden px-3 py-2.5 text-zinc-600 dark:text-zinc-400 sm:table-cell">
                          {t(`cargo_${listing.cargoType}`)}
                        </td>
                        <td className="hidden px-3 py-2.5 text-zinc-600 dark:text-zinc-400 md:table-cell">
                          {formatWeight(listing.weightKg, locale)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={listingStatusVariant(listing.status)}>
                            {t(`status_${listing.status}`)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Link
                            href={`/${locale}/shipper/shipments/${listing.listingId}`}
                            className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
                          >
                            {t('action_view')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="recent-bookings">
        <Card>
          <CardHeader>
            <CardTitle id="recent-bookings">{t('recent_bookings')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{t('no_bookings')}</p>
            ) : (
              <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                {recentBookings.map((booking) => (
                  <li key={booking.bookingId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                    <span className="font-medium text-[#0A1628] dark:text-white">
                      {booking.originAddress} → {booking.destinationAddress}
                    </span>
                    <Badge variant={bookingStatusVariant(booking.status)}>
                      {t(`booking_status_${booking.status}`)}
                    </Badge>
                    <span className="text-zinc-500 dark:text-zinc-400">{formatDate(booking.createdAt, locale)}</span>
                    <Link
                      href={`/${locale}/shipper/shipments/${booking.listingId}`}
                      className="ml-auto text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
                    >
                      {t('action_view')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
