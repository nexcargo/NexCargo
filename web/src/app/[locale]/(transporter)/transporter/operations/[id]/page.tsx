// NexCargo I-5 §3H — one operation: the shipment, its assigned assets, its milestones and its evidence.
// Every read is session-scoped and the booking is re-checked against this user, so an operation belonging to
// another Transporter is not rendered. Writes go to the existing MOD-003 and MOD-014 routes, which enforce the
// lifecycle and the ownership boundary themselves. Payment, escrow and settlement are system-controlled and
// are neither triggered nor confirmed from this page.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { TrackingRecordRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';
import { TrackingEventRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-event-repository';
import { PodRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/pod-repository';
import { getTransporterContext } from '../../../transporter-session';
import { getContractForBooking } from '../../../contract-reads';
import { listDocumentsForEntity } from '../../../document-reads';
import { DocumentsCard } from '../../../documents-card';
import { nextAssignmentStatuses, nextTrackingStatuses } from '../../../operations-transitions';
import {
  assignmentStatusVariant,
  bookingStatusVariant,
  formatDateTime,
  formatWeight,
  trackingStatusVariant,
} from '../../../presentation';
import { AssignmentForm, AssignmentStatusForm } from '../assignment-forms';
import { PodForm } from '../pod-form';
import { StatusUpdateForm } from '../status-update';

export const dynamic = 'force-dynamic';

const DL = 'grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2';
const TERM = 'text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';
const DESC = 'text-sm text-zinc-700 dark:text-zinc-300';
const NOTICE = 'rounded-md border border-[#E8E6E3] bg-[#FAF9F7] px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';
const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const TD = 'px-3 py-3 align-top text-sm text-zinc-600 dark:text-zinc-400';

export default async function TransporterOperationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const record = await new TrackingRecordRepository().getById(id);
  const booking = record ? await new BookingsRepository().getById(record.bookingId) : null;

  if (!record || !booking || booking.transporterId !== ctx.userId) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('operation_not_found')}</p>
          <Link
            href={`/${locale}/transporter/operations`}
            className="mt-2 inline-block text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
          >
            {t('operation_back')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const fleet = new FleetRepository();
  const [contract, assignments, vehicles, drivers, events, pods] = await Promise.all([
    getContractForBooking(booking.bookingId),
    fleet.listAssignments(undefined, undefined, record.id),
    fleet.listVehicles(),
    fleet.listDrivers(),
    new TrackingEventRepository().getHistory(record.id, 20),
    new PodRepository().getByTrackingId(record.id),
  ]);

  const bookingDocuments = await listDocumentsForEntity('booking', booking.bookingId);
  const contractDocuments = contract ? await listDocumentsForEntity('contract', contract.id) : [];
  const documents = [...bookingDocuments, ...contractDocuments];

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const nextStatuses = nextTrackingStatuses(record.status);
  const delivered = record.status === 'DELIVERED' || record.status === 'COMPLETED';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{record.trackingRef}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={trackingStatusVariant(record.status)}>{t(`tracking_status_${record.status}`)}</Badge>
            <Badge variant={bookingStatusVariant(booking.status)}>{t(`booking_status_${booking.status}`)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/${locale}/transporter/bookings/${booking.bookingId}`}
            className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
          >
            {t('view_booking')}
          </Link>
          <Link
            href={`/${locale}/transporter/operations`}
            className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
          >
            {t('operation_back')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('operation_shipment_heading')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className={DL}>
              <div>
                <dt className={TERM}>{t('col_route')}</dt>
                <dd className={DESC}>{booking.originAddress}</dd>
                <dd className={DESC}>{booking.destinationAddress}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_cargo')}</dt>
                <dd className={DESC}>{t(`cargo_${booking.cargoType}`)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_weight')}</dt>
                <dd className={DESC}>{formatWeight(booking.weightKg, locale)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_vehicle_type')}</dt>
                <dd className={DESC}>{t(`vehicle_${booking.vehicleType}`)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('booking_window_start')}</dt>
                <dd className={DESC}>{formatDateTime(booking.availabilityWindowStart, locale) || t('summary_none')}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('booking_window_end')}</dt>
                <dd className={DESC}>{formatDateTime(booking.availabilityWindowEnd, locale) || t('summary_none')}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('operation_activated')}</dt>
                <dd className={DESC}>{formatDateTime(record.activatedAt, locale)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_last_updated')}</dt>
                <dd className={DESC}>{formatDateTime(record.lastUpdated, locale)}</dd>
              </div>
              {record.completedAt ? (
                <div>
                  <dt className={TERM}>{t('operation_completed')}</dt>
                  <dd className={DESC}>{formatDateTime(record.completedAt, locale)}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('operation_status_heading')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusUpdateForm trackingId={record.id} options={nextStatuses} />
            <p className={NOTICE}>{t('operation_pickup_proof_notice')}</p>
            <p className={NOTICE}>{t('operation_financial_notice')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('operation_assets_heading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignments.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('operation_no_assignments')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                    <th scope="col" className={TH}>{t('col_vehicle')}</th>
                    <th scope="col" className={TH}>{t('col_driver')}</th>
                    <th scope="col" className={TH}>{t('col_status')}</th>
                    <th scope="col" className={`${TH} hidden lg:table-cell`}>{t('col_scheduled_window')}</th>
                    <th scope="col" className={TH}>{t('col_action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => {
                    const vehicle = assignment.vehicleId ? vehicleById.get(assignment.vehicleId) : undefined;
                    const driver = assignment.driverId ? driverById.get(assignment.driverId) : undefined;
                    return (
                      <tr key={assignment.id} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
                        <td className={`${TD} font-medium text-[#0A1628] dark:text-white`}>
                          {vehicle ? vehicle.registrationNumber : t('assignment_no_vehicle')}
                        </td>
                        <td className={TD}>
                          {driver ? `${driver.firstName} ${driver.lastName}` : t('assignment_no_driver')}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Badge variant={assignmentStatusVariant(assignment.status)}>
                            {t(`assignment_status_${assignment.status}`)}
                          </Badge>
                        </td>
                        <td className={`${TD} hidden lg:table-cell`}>
                          {assignment.scheduledStart
                            ? `${formatDateTime(assignment.scheduledStart, locale)} — ${formatDateTime(assignment.scheduledEnd, locale)}`
                            : t('summary_none')}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <AssignmentStatusForm
                            assignmentId={assignment.id}
                            options={nextAssignmentStatuses(assignment.status)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <AssignmentForm
            trackingId={record.id}
            vehicles={vehicles.map((vehicle) => ({
              id: vehicle.id,
              registrationNumber: vehicle.registrationNumber,
              type: vehicle.type,
            }))}
            drivers={drivers.map((driver) => ({
              id: driver.id,
              name: `${driver.firstName} ${driver.lastName}`,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('operation_milestones_heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('operation_no_events')}</p>
          ) : (
            <ol className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{event.eventType}</span>
                  {event.stateTo ? (
                    <Badge variant={trackingStatusVariant(event.stateTo)}>{t(`tracking_status_${event.stateTo}`)}</Badge>
                  ) : null}
                  <span className="text-zinc-500 dark:text-zinc-400">{event.source}</span>
                  <span className="ml-auto text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(event.eventTimestamp, locale)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('operation_pod_heading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pods.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('pod_none')}</p>
          ) : (
            <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
              {pods.map((pod) => (
                <li key={pod.id} className="space-y-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-medium text-[#0A1628] dark:text-white">{pod.recipientName}</span>
                    <Badge variant={pod.verificationStatus === 'VERIFIED' ? 'success' : pod.verificationStatus === 'REJECTED' ? 'danger' : 'warning'}>
                      {t(`pod_verification_${pod.verificationStatus}`)}
                    </Badge>
                    <span className="ml-auto text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(pod.submittedAt, locale)}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {t('pod_evidence_summary', { photos: pod.photoRefs.length })}
                    {pod.gpsLat != null && pod.gpsLon != null ? ` · ${pod.gpsLat}, ${pod.gpsLon}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {delivered ? (
            <PodForm trackingId={record.id} bookingId={booking.bookingId} />
          ) : (
            <p className={NOTICE}>{t('pod_not_yet_available')}</p>
          )}

          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('pod_verification_notice')}</p>
        </CardContent>
      </Card>

      <DocumentsCard documents={documents} locale={locale} />
    </div>
  );
}