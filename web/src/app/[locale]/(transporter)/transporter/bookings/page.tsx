// NexCargo I-5 §3G — the Transporter's booking requests and contract workflow.
// Rows come from BookingsRepository.listByTransporter and the contract summaries from the session-scoped
// read in contract-reads.ts, so both are limited to bookings where transporter_id is this user.
// Nothing here confirms a booking, generates a contract or touches payment or escrow: confirmation is the
// Shipper's PATCH /api/booking/[id]/confirm, and the Transporter's own acceptance is the contract signature.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { BookingsRepository, type BookingApiShape } from '@/infrastructure/repositories/bookings-repository';
import { getTransporterContext } from '../../transporter-session';
import { awaitingTransporterSignature, listContractsForBookings, type ContractSummary } from '../../contract-reads';
import { bookingStatusVariant, contractStatusLabelKey, formatDate, formatMoney } from '../../presentation';

export const dynamic = 'force-dynamic';

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const TD = 'px-3 py-3 align-top text-sm text-zinc-600 dark:text-zinc-400';

const CLOSED_BOOKING_STATES = ['FAILED', 'CANCELLED'];

type Translator = (key: string) => string;

export default async function TransporterBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const bookings = await new BookingsRepository().listByTransporter(ctx.userId);
  const contracts = await listContractsForBookings(bookings.map((b) => b.bookingId));
  const ordered = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const closed = ordered.filter((b) => CLOSED_BOOKING_STATES.includes(b.status));
  const awaiting = ordered.filter(
    (b) => !CLOSED_BOOKING_STATES.includes(b.status) && awaitingTransporterSignature(contracts.get(b.bookingId)),
  );
  const inProgress = ordered.filter((b) => !closed.includes(b) && !awaiting.includes(b));

  const sections = [
    { id: 'bookings-awaiting', title: t('bookings_awaiting_heading'), rows: awaiting, empty: t('bookings_awaiting_empty') },
    { id: 'bookings-progress', title: t('bookings_progress_heading'), rows: inProgress, empty: t('bookings_progress_empty') },
    { id: 'bookings-closed', title: t('bookings_closed_heading'), rows: closed, empty: t('bookings_closed_empty') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('bookings_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('bookings_intro')}</p>
        </div>
        <Button href={`/${locale}/transporter/operations`} size="sm" variant="outline">
          {t('transporter_nav_operations')}
        </Button>
      </div>

      {ordered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium text-[#0A1628] dark:text-white">{t('bookings_empty_title')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{t('bookings_empty_desc')}</p>
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
                          <th scope="col" className={TH}>{t('col_booking_reference')}</th>
                          <th scope="col" className={TH}>{t('col_route')}</th>
                          <th scope="col" className={`${TH} hidden md:table-cell`}>{t('col_price')}</th>
                          <th scope="col" className={TH}>{t('col_status')}</th>
                          <th scope="col" className={`${TH} hidden lg:table-cell`}>{t('col_contract_status')}</th>
                          <th scope="col" className={`${TH} hidden md:table-cell`}>{t('col_created')}</th>
                          <th scope="col" className={TH}>{t('col_action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((booking) => (
                          <tr key={booking.bookingId} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
                            <td className={`${TD} font-mono text-zinc-700 dark:text-zinc-300`}>
                              {booking.bookingId.slice(0, 8)}
                            </td>
                            <td className="px-3 py-3 align-top text-sm">
                              <span className="font-medium text-[#0A1628] dark:text-white">{booking.originAddress}</span>
                              <span className="mx-1 text-zinc-400">→</span>
                              <span className="text-zinc-600 dark:text-zinc-400">{booking.destinationAddress}</span>
                            </td>
                            <td className={`${TD} hidden font-medium text-[#0A1628] md:table-cell dark:text-white`}>
                              {formatMoney(booking.offerPrice, booking.currency, locale)}
                            </td>
                            <td className="px-3 py-3 align-top">
                              <Badge variant={bookingStatusVariant(booking.status)}>
                                {t(`booking_status_${booking.status}`)}
                              </Badge>
                            </td>
                            <td className={`${TD} hidden lg:table-cell`}>
                              {contractLabel(contracts.get(booking.bookingId), t)}
                            </td>
                            <td className={`${TD} hidden md:table-cell`}>{formatDate(booking.createdAt, locale)}</td>
                            <td className="px-3 py-3 align-top">
                              <Link
                                href={`/${locale}/transporter/bookings/${booking.bookingId}`}
                                className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
                              >
                                {t('view_booking')}
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
        ))
      )}
    </div>
  );
}

function contractLabel(contract: ContractSummary | undefined, t: Translator): string {
  if (!contract) return t('contract_not_generated');
  const key = contractStatusLabelKey(contract.acceptanceStatus);
  return key ? t(key) : contract.acceptanceStatus;
}