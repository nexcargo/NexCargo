// NexCargo I-4 §3F — the shipper's bookings, read through the session-scoped repository.
// Status here is the established MOD-002 lifecycle; nothing on this page confirms a booking,
// generates a contract or touches payment or escrow.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent } from '@/shared/ui';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { getShipperContext } from '../../shipper-session';
import { bookingStatusVariant, formatDateTime, formatMoney } from '../../presentation';

export const dynamic = 'force-dynamic';

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const TD = 'px-3 py-3 align-top text-sm text-zinc-600 dark:text-zinc-400';

export default async function ShipperBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('ShipperDashboard');
  const ctx = await getShipperContext();
  if (!ctx) return null;

  const bookings = await new BookingsRepository().listByShipper(ctx.userId);
  const ordered = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('bookings_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('bookings_subtitle')}</p>
        </div>
        <Button href={`/${locale}/shipper/shipments`} size="sm" variant="outline">
          {t('shipper_nav_shipments')}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {ordered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium text-[#0A1628] dark:text-white">{t('empty_bookings_title')}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                {t('empty_bookings_desc')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                    <th scope="col" className={TH}>{t('col_booking_reference')}</th>
                    <th scope="col" className={TH}>{t('col_booking_shipment')}</th>
                    <th scope="col" className={TH}>{t('col_booking_price')}</th>
                    <th scope="col" className={`${TH} hidden md:table-cell`}>{t('col_created')}</th>
                    <th scope="col" className={TH}>{t('col_booking_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((booking) => (
                    <tr key={booking.bookingId} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
                      <td className={`${TD} font-mono text-zinc-700 dark:text-zinc-300`}>
                        {booking.bookingId.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Link
                          href={`/${locale}/shipper/shipments/${booking.listingId}`}
                          className="font-medium text-[#0A1628] hover:underline dark:text-white"
                        >
                          {booking.originAddress} → {booking.destinationAddress}
                        </Link>
                      </td>
                      <td className={`${TD} font-medium text-[#0A1628] dark:text-white`}>
                        {formatMoney(booking.offerPrice, booking.currency, locale)}
                      </td>
                      <td className={`${TD} hidden md:table-cell`}>
                        {formatDateTime(booking.createdAt, locale)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge variant={bookingStatusVariant(booking.status)}>
                          {t(`booking_status_${booking.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
