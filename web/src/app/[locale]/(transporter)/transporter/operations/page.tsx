// NexCargo I-5 §3H — the Transporter's operational overview.
// Tracking records are read through the session client; the RLS policy admits a record only when its booking
// names this user as transporter, and the bookings shown alongside come from listByTransporter. Nothing here
// creates a shipment, confirms a booking or touches payment, escrow or settlement.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { BookingsRepository, type BookingApiShape } from '@/infrastructure/repositories/bookings-repository';
import {
  TrackingRecordRepository,
  type TrackingRecordApiShape,
} from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';
import { getTransporterContext } from '../../transporter-session';
import { formatDateTime, trackingStatusVariant } from '../../presentation';

export const dynamic = 'force-dynamic';

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const TD = 'px-3 py-3 align-top text-sm text-zinc-600 dark:text-zinc-400';

const CLOSED_TRACKING_STATES = ['COMPLETED', 'CANCELLED'];

type Translator = (key: string) => string;

export default async function TransporterOperationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const [records, bookings] = await Promise.all([
    new TrackingRecordRepository().listByTransporter(ctx.userId),
    new BookingsRepository().listByTransporter(ctx.userId),
  ]);
  const bookingById = new Map<string, BookingApiShape>(bookings.map((b) => [b.bookingId, b]));
  const ordered = [...records].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));

  const sections = [
    {
      id: 'operations-active',
      title: t('operations_active_heading'),
      rows: ordered.filter((r) => !CLOSED_TRACKING_STATES.includes(r.status)),
      empty: t('operations_active_empty'),
    },
    {
      id: 'operations-closed',
      title: t('operations_closed_heading'),
      rows: ordered.filter((r) => CLOSED_TRACKING_STATES.includes(r.status)),
      empty: t('operations_closed_empty'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('operations_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('operations_intro')}</p>
        </div>
        <Button href={`/${locale}/transporter/bookings`} size="sm" variant="outline">
          {t('transporter_nav_bookings')}
        </Button>
      </div>

      {ordered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium text-[#0A1628] dark:text-white">{t('operations_empty_title')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{t('operations_empty_desc')}</p>
          </CardContent>
        </Card>
      ) : (
        sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id}>
            <Card>
              <CardHeader>
                <CardTitle id={section.id}>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {section.rows.length === 0 ? (
                  <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">{section.empty}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                          <th scope="col" className={TH}>{t('col_tracking_reference')}</th>
                          <th scope="col" className={TH}>{t('col_route')}</th>
                          <th scope="col" className={TH}>{t('col_status')}</th>
                          <th scope="col" className={`${TH} hidden md:table-cell`}>{t('col_last_updated')}</th>
                          <th scope="col" className={TH}>{t('col_action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((record) => (
                          <OperationRow
                            key={record.id}
                            record={record}
                            booking={bookingById.get(record.bookingId)}
                            locale={locale}
                            t={t}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

function OperationRow({
  record,
  booking,
  locale,
  t,
}: {
  record: TrackingRecordApiShape;
  booking: BookingApiShape | undefined;
  locale: string;
  t: Translator;
}) {
  return (
    <tr className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
      <td className={`${TD} font-mono text-zinc-700 dark:text-zinc-300`}>{record.trackingRef}</td>
      <td className="px-3 py-3 align-top text-sm">
        {booking ? (
          <>
            <span className="font-medium text-[#0A1628] dark:text-white">{booking.originAddress}</span>
            <span className="mx-1 text-zinc-400">→</span>
            <span className="text-zinc-600 dark:text-zinc-400">{booking.destinationAddress}</span>
          </>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">{t('summary_none')}</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <Badge variant={trackingStatusVariant(record.status)}>{t(`tracking_status_${record.status}`)}</Badge>
      </td>
      <td className={`${TD} hidden md:table-cell`}>{formatDateTime(record.lastUpdated, locale)}</td>
      <td className="px-3 py-3 align-top">
        <Link
          href={`/${locale}/transporter/operations/${record.id}`}
          className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
        >
          {t('view_operation')}
        </Link>
      </td>
    </tr>
  );
}