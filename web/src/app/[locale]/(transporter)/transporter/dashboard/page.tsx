// NexCargo I-5 §3A — Authenticated Transporter dashboard.
// Every row is read through the RLS-enforced session client: the fleet, vehicle and driver rows are the
// ones the Transporter owns (logistics_schema policies pin them to ownerid = auth.uid()), the quotations
// are its own offers, and the bookings and tracking records are those where transporter_id is its user id.
// Nothing here is filtered by a client-supplied role or tenant value (§4).

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { TrackingRecordRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';
import { listInboxNotifications } from '@/modules/mod-016-notifications/infrastructure/repositories/inbox-repository';
import { getTransporterContext } from '../../transporter-session';
import {
  bookingStatusVariant,
  formatDate,
  offerStatusVariant,
  trackingStatusVariant,
  vehicleStateVariant,
} from '../../presentation';

export const dynamic = 'force-dynamic';

const ACTIVE_TRACKING_STATES = ['CREATED', 'BOOKED', 'AWAITING_PICKUP', 'PICKUP_ACKNOWLEDGED', 'IN_TRANSIT', 'AT_BORDER', 'DELAYED'];

export default async function TransporterDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const fleet = new FleetRepository();
  const [fleets, vehicles, drivers, quotations, bookings, trackingRecords, notifications] = await Promise.all([
    fleet.listFleets(ctx.userId),
    fleet.listVehicles(),
    fleet.listDrivers(),
    new OffersRepository().listByTransporter(ctx.userId),
    new BookingsRepository().listByTransporter(ctx.userId),
    new TrackingRecordRepository().listByTransporter(ctx.userId),
    listInboxNotifications(5),
  ]);

  const pendingBookings = bookings.filter((b) => b.status === 'REQUESTED' || b.status === 'ALIGNMENT_CHECKED');
  const openQuotations = quotations.filter((o) => o.status === 'SUBMITTED');
  const activeTrips = trackingRecords.filter((r) => ACTIVE_TRACKING_STATES.includes(r.status));

  const actions = [
    fleets.length === 0
      ? { key: 'outstanding_setup_fleet', href: `/${locale}/transporter/fleet` }
      : vehicles.length === 0
        ? { key: 'outstanding_add_vehicle', href: `/${locale}/transporter/fleet` }
        : null,
    pendingBookings.length > 0
      ? { key: 'outstanding_process_bookings', href: `/${locale}/transporter/bookings` }
      : null,
    openQuotations.length > 0
      ? { key: 'outstanding_quotations_awaiting', href: `/${locale}/transporter/quotations` }
      : null,
    fleets.length > 0 && !fleets.some((f) => f.operationalStatus === 'ACTIVE')
      ? { key: 'outstanding_reactivate_fleet', href: `/${locale}/transporter/profile` }
      : null,
  ].filter((a): a is { key: string; href: string } => a !== null);

  const kpis = [
    { label: t('kpi_vehicles'), value: vehicles.length },
    { label: t('kpi_drivers'), value: drivers.length },
    { label: t('kpi_open_quotations'), value: openQuotations.length },
    { label: t('kpi_booking_requests'), value: pendingBookings.length },
  ];

  const recentBookings = bookings.slice(0, 5);
  const recentTrips = activeTrips.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('overview')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href={`/${locale}/transporter/opportunities`} size="sm">{t('transporter_nav_opportunities')}</Button>
          <Button href={`/${locale}/transporter/fleet`} variant="outline" size="sm">{t('transporter_nav_fleet')}</Button>
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

      <section aria-labelledby="outstanding-actions">
        <Card>
          <CardHeader>
            <CardTitle id="outstanding-actions">{t('outstanding_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {actions.length === 0 ? (
              <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">{t('outstanding_empty')}</p>
            ) : (
              <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                {actions.map((action) => (
                  <li key={action.key} className="py-2.5">
                    <Link
                      href={action.href}
                      className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
                    >
                      {t(action.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="recent-booking-requests">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle id="recent-booking-requests">{t('recent_booking_requests')}</CardTitle>
            <Link
              href={`/${locale}/transporter/bookings`}
              className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
            >
              {t('view_all_bookings')}
            </Link>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('no_booking_requests')}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('no_booking_requests_hint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('col_route')}</th>
                      <th scope="col" className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:table-cell">{t('col_vehicle')}</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('col_status')}</th>
                      <th scope="col" className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 md:table-cell">{t('col_created')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking) => (
                      <tr key={booking.bookingId} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
                        <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">
                          <span className="font-medium">{booking.originAddress}</span>
                          <span className="mx-1 text-zinc-400">→</span>
                          <span>{booking.destinationAddress}</span>
                        </td>
                        <td className="hidden px-3 py-2.5 text-zinc-600 dark:text-zinc-400 sm:table-cell">
                          {t(`vehicle_${booking.vehicleType}`)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={bookingStatusVariant(booking.status)}>
                            {t(`booking_status_${booking.status}`)}
                          </Badge>
                        </td>
                        <td className="hidden px-3 py-2.5 text-zinc-600 dark:text-zinc-400 md:table-cell">
                          {formatDate(booking.createdAt, locale)}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="active-operations">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle id="active-operations">{t('active_operations')}</CardTitle>
              <Link
                href={`/${locale}/transporter/operations`}
                className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
              >
                {t('view_all_operations')}
              </Link>
            </CardHeader>
            <CardContent>
              {recentTrips.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{t('no_active_operations')}</p>
              ) : (
                <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                  {recentTrips.map((trip) => (
                    <li key={trip.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                      <span className="font-medium text-[#0A1628] dark:text-white">{trip.trackingRef}</span>
                      <Badge variant={trackingStatusVariant(trip.status)}>{t(`tracking_status_${trip.status}`)}</Badge>
                      <span className="ml-auto text-zinc-500 dark:text-zinc-400">{formatDate(trip.lastUpdated, locale)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="recent-quotations">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle id="recent-quotations">{t('recent_quotations')}</CardTitle>
              <Link
                href={`/${locale}/transporter/quotations`}
                className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
              >
                {t('view_all_quotations')}
              </Link>
            </CardHeader>
            <CardContent>
              {quotations.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('no_quotations')}</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('no_quotations_hint')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                  {quotations.slice(0, 5).map((offer) => (
                    <li key={offer.offerId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                      <span className="font-medium text-[#0A1628] dark:text-white">
                        {t(`vehicle_${offer.vehicleType}`)}
                      </span>
                      <Badge variant={offerStatusVariant(offer.status)}>{t(`offer_status_${offer.status}`)}</Badge>
                      <span className="ml-auto text-zinc-500 dark:text-zinc-400">{formatDate(offer.createdAt, locale)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <section aria-labelledby="fleet-readiness">
        <Card>
          <CardHeader>
            <CardTitle id="fleet-readiness">{t('fleet_readiness')}</CardTitle>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">{t('fleet_empty')}</p>
            ) : (
              <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                {vehicles.slice(0, 5).map((vehicle) => (
                  <li key={vehicle.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                    <span className="font-medium text-[#0A1628] dark:text-white">{vehicle.registrationNumber}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">{t(`vehicle_${vehicle.type}`)}</span>
                    <Badge variant={vehicleStateVariant(vehicle.availabilityState)}>
                      {t(`vehicle_state_${vehicle.availabilityState}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="recent-notifications">
        <Card>
          <CardHeader>
            <CardTitle id="recent-notifications">{t('recent_notifications')}</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{t('no_notifications')}</p>
            ) : (
              <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                {notifications.map((notification) => (
                  <li key={notification.notificationId} className="py-2.5 text-sm">
                    <p className="font-medium text-[#0A1628] dark:text-white">{notification.title || t('summary_none')}</p>
                    <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{notification.body}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(notification.createdAt, locale)} · {notification.deliveryStatus}
                    </p>
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
