// NexCargo I-5 §3G — one booking request, its quotation, its contract and its documents.
// The booking is read through the session client and re-checked against this session's user, so a booking
// belonging to another Transporter is not rendered even if its id is guessed. The only write offered here
// is the Transporter's own contract signature through the existing MOD-002 route; confirmation and contract
// generation stay the Shipper's actions, and nothing on this page touches payment, escrow or settlement.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { BookingsRepository } from '@/infrastructure/repositories/bookings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { TrackingRecordRepository } from '@/modules/mod-003-tracking/infrastructure/repositories/tracking-record-repository';
import { getTransporterContext } from '../../../transporter-session';
import { awaitingTransporterSignature, getContractForBooking } from '../../../contract-reads';
import { listDocumentsForEntity } from '../../../document-reads';
import { DocumentsCard } from '../../../documents-card';
import {
  bookingStatusVariant,
  contractStatusLabelKey,
  contractStatusVariant,
  formatDateTime,
  formatMoney,
  formatWeight,
  offerStatusVariant,
} from '../../../presentation';
import { ContractAcceptAction } from '../contract-accept';

export const dynamic = 'force-dynamic';

const DL = 'grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2';
const TERM = 'text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';
const DESC = 'text-sm text-zinc-700 dark:text-zinc-300';
const NOTICE = 'rounded-md border border-[#E8E6E3] bg-[#FAF9F7] px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';

export default async function TransporterBookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const booking = await new BookingsRepository().getById(id);

  if (!booking || booking.transporterId !== ctx.userId) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('booking_not_found')}</p>
          <Link
            href={`/${locale}/transporter/bookings`}
            className="mt-2 inline-block text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
          >
            {t('booking_back')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const [contract, offers, tracking] = await Promise.all([
    getContractForBooking(booking.bookingId),
    new OffersRepository().listByTransporter(ctx.userId),
    new TrackingRecordRepository().getByBookingId(booking.bookingId),
  ]);
  const offer = offers.find((row) => row.offerId === booking.selectedOfferId) ?? null;

  const bookingDocuments = await listDocumentsForEntity('booking', booking.bookingId);
  const contractDocuments = contract ? await listDocumentsForEntity('contract', contract.id) : [];
  const documents = [...bookingDocuments, ...contractDocuments];

  const awaitingSignature = awaitingTransporterSignature(contract);
  const awaitingShipper =
    !!contract && contract.acceptanceStatus === 'DRAFT' && !!contract.transporterAcceptedAt && !contract.shipperAcceptedAt;
  const open = booking.status === 'REQUESTED' || booking.status === 'ALIGNMENT_CHECKED';
  const contractStatusKey = contract ? contractStatusLabelKey(contract.acceptanceStatus) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">
            {t('booking_detail_title', { reference: booking.bookingId.slice(0, 8) })}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={bookingStatusVariant(booking.status)}>{t(`booking_status_${booking.status}`)}</Badge>
            {contract ? (
              <Badge variant={contractStatusVariant(contract.acceptanceStatus)}>
                {contractStatusKey ? t(contractStatusKey) : contract.acceptanceStatus}
              </Badge>
            ) : null}
          </div>
        </div>
        <Link
          href={`/${locale}/transporter/bookings`}
          className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
        >
          {t('booking_back')}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('booking_shipment_heading')}</CardTitle>
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
                <dt className={TERM}>{t('col_volume')}</dt>
                <dd className={DESC}>{booking.volumeM3 ? `${booking.volumeM3} m³` : t('summary_none')}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_vehicle_type')}</dt>
                <dd className={DESC}>{t(`vehicle_${booking.vehicleType}`)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_price')}</dt>
                <dd className={`${DESC} font-medium text-[#0A1628] dark:text-white`}>
                  {formatMoney(booking.offerPrice, booking.currency, locale)}
                </dd>
              </div>
              <div>
                <dt className={TERM}>{t('booking_window_start')}</dt>
                <dd className={DESC}>{formatDateTime(booking.availabilityWindowStart, locale) || t('summary_none')}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('booking_window_end')}</dt>
                <dd className={DESC}>{formatDateTime(booking.availabilityWindowEnd, locale) || t('summary_none')}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className={TERM}>{t('col_special_handling')}</dt>
                <dd className={DESC}>
                  {booking.specialHandling?.length ? booking.specialHandling.join(' · ') : t('summary_none')}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className={TERM}>{t('booking_cargo_description')}</dt>
                <dd className={DESC}>{booking.cargoDescription}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('booking_quotation_heading')}</CardTitle>
          </CardHeader>
          <CardContent>
            {offer ? (
              <dl className={DL}>
                <div>
                  <dt className={TERM}>{t('col_price')}</dt>
                  <dd className={`${DESC} font-medium text-[#0A1628] dark:text-white`}>
                    {formatMoney(offer.priceProposal, booking.currency, locale)}
                  </dd>
                </div>
                <div>
                  <dt className={TERM}>{t('col_status')}</dt>
                  <dd className={DESC}>
                    <Badge variant={offerStatusVariant(offer.status)}>{t(`offer_status_${offer.status}`)}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className={TERM}>{t('col_vehicle_type')}</dt>
                  <dd className={DESC}>{t(`vehicle_${offer.vehicleType}`)}</dd>
                </div>
                <div>
                  <dt className={TERM}>{t('col_quoted_on')}</dt>
                  <dd className={DESC}>{formatDateTime(offer.createdAt, locale)}</dd>
                </div>
                {offer.notes ? (
                  <div className="sm:col-span-2">
                    <dt className={TERM}>{t('field_notes')}</dt>
                    <dd className={DESC}>{offer.notes}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('quotation_not_visible')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('booking_contract_heading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!contract ? (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('contract_not_generated')}</p>
              <p className={NOTICE}>{t('booking_confirm_notice')}</p>
            </>
          ) : (
            <>
              <dl className={DL}>
                <div>
                  <dt className={TERM}>{t('col_contract_status')}</dt>
                  <dd className={DESC}>
                    <Badge variant={contractStatusVariant(contract.acceptanceStatus)}>
                      {contractStatusKey ? t(contractStatusKey) : contract.acceptanceStatus}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className={TERM}>{t('contract_value')}</dt>
                  <dd className={`${DESC} font-medium text-[#0A1628] dark:text-white`}>
                    {formatMoney(contract.baseAmount, contract.currency, locale)}
                  </dd>
                </div>
                <div>
                  <dt className={TERM}>{t('contract_signatories')}</dt>
                  <dd className={DESC}>{contract.numSignatories} / 2</dd>
                </div>
                <div>
                  <dt className={TERM}>{t('contract_signature_status')}</dt>
                  <dd className={DESC}>{t(`signature_status_${contract.digitalSignatureStatus}`)}</dd>
                </div>
                <div>
                  <dt className={TERM}>{t('contract_shipper_signed')}</dt>
                  <dd className={DESC}>{formatDateTime(contract.shipperAcceptedAt, locale) || t('signature_pending')}</dd>
                </div>
                <div>
                  <dt className={TERM}>{t('contract_transporter_signed')}</dt>
                  <dd className={DESC}>{formatDateTime(contract.transporterAcceptedAt, locale) || t('signature_pending')}</dd>
                </div>
                <div>
                  <dt className={TERM}>{t('contract_pickup_window')}</dt>
                  <dd className={DESC}>
                    {formatDateTime(contract.pickupWindowStart, locale)} — {formatDateTime(contract.pickupWindowEnd, locale)}
                  </dd>
                </div>
                <div>
                  <dt className={TERM}>{t('contract_delivery_window')}</dt>
                  <dd className={DESC}>
                    {formatDateTime(contract.deliveryWindowStart, locale)} — {formatDateTime(contract.deliveryWindowEnd, locale)}
                  </dd>
                </div>
                {contract.signedAt ? (
                  <div>
                    <dt className={TERM}>{t('contract_signed_at')}</dt>
                    <dd className={DESC}>{formatDateTime(contract.signedAt, locale)}</dd>
                  </div>
                ) : null}
              </dl>

              <div>
                <p className={TERM}>{t('contract_terms')}</p>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-[#E8E6E3] bg-[#FAF9F7] p-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  {contract.termsSnapshot}
                </pre>
              </div>

              {awaitingSignature ? (
                <div className="space-y-2 border-t border-[#E8E6E3] pt-4 dark:border-zinc-800">
                  <p className={NOTICE}>{t('contract_accept_notice')}</p>
                  <ContractAcceptAction contractId={contract.id} />
                </div>
              ) : null}

              {awaitingShipper ? <p className={NOTICE}>{t('contract_awaiting_shipper')}</p> : null}

              {contract.acceptanceStatus === 'ACTIVE' ? (
                <div className="space-y-2 border-t border-[#E8E6E3] pt-4 dark:border-zinc-800">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('booking_operations_notice')}</p>
                  {tracking ? (
                    <Button href={`/${locale}/transporter/operations/${tracking.id}`} size="sm">
                      {t('booking_operations_link')}
                    </Button>
                  ) : (
                    <p className={NOTICE}>{t('operations_not_initialised')}</p>
                  )}
                </div>
              ) : null}
            </>
          )}

          {open ? <p className={NOTICE}>{t('booking_decline_notice')}</p> : null}
        </CardContent>
      </Card>

      <DocumentsCard documents={documents} locale={locale} />
    </div>
  );
}