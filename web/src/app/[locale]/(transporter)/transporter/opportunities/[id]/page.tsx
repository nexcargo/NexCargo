// NexCargo I-5 §3E/§3F — one opportunity, prepared for quotation.
// The listing is read through the same RLS-filtered path the collection route uses, so a shipment that is
// not published simply is not returned. The compatibility verdict and the vehicle options come from the
// MOD-001 hard filters over this transporter's own available fleet; the price band is MOD-001 §5.4
// advisory output, computed from the stored listing alone (no competing quotations are read, so nothing
// about another transporter's pricing is inferred or shown). Submitting stays an explicit act.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { toShipmentListing } from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import { createAdvisoryQuote } from '@/modules/mod-001-marketplace/application/use-cases/marketplace-use-cases';
import { vehiclesThatFit } from '../../../opportunity-eligibility';
import { getTransporterContext } from '../../../transporter-session';
import { formatDateTime, formatMoney, formatWeight, offerStatusVariant } from '../../../presentation';
import { QuotationForm } from '../quotation-form';

export const dynamic = 'force-dynamic';

const DL = 'grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2';
const TERM = 'text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';
const DESC = 'text-sm text-zinc-700 dark:text-zinc-300';

export default async function TransporterOpportunityDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const [listingRow, vehicles, quotations] = await Promise.all([
    new ListingsRepository().getById(id),
    new FleetRepository().listVehicles(undefined, undefined, 'AVAILABLE'),
    new OffersRepository().listByTransporter(ctx.userId),
  ]);

  const listing = listingRow ? toShipmentListing(listingRow) : null;
  // A listing that has since been booked, expired or cancelled is no longer quotable; the shipper's own
  // lifecycle owns that, and MOD-001 §3.2 keeps DRAFT invisible to transporters.
  const quotable = listing !== null && listing.status === 'PUBLISHED';
  const existingQuotation = quotations.find((offer) => offer.listingId === id) ?? null;
  const fitting = listingRow && quotable ? vehiclesThatFit(listingRow, vehicles) : [];

  if (!listing || !quotable) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('opportunity_not_found')}</p>
            <Link
              href={`/${locale}/transporter/opportunities`}
              className="mt-2 inline-block text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
            >
              {t('opportunity_back')}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MOD-001 §5.4 needs weight and a complete window; a listing without them simply has no advisory band.
  const advisory =
    listing.weightKg > 0 && listing.timeWindow.earliestPickup && listing.timeWindow.latestDelivery
      ? createAdvisoryQuote({
          listingId: listing.listingId,
          cargoType: listing.cargoType,
          weightKg: listing.weightKg,
          volumeM3: listing.volumeM3,
          timeWindow: listing.timeWindow,
          pricingModel: listing.pricingModel,
        })
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">
            {listing.title || t('untitled_shipment')}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('opportunities_intro')}</p>
        </div>
        <Link
          href={`/${locale}/transporter/opportunities`}
          className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
        >
          {t('opportunity_back')}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('opportunity_requirements')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className={DL}>
              <div>
                <dt className={TERM}>{t('col_route')}</dt>
                <dd className={DESC}>{listing.origin.address}</dd>
                <dd className={DESC}>{listing.destination.address}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_cargo')}</dt>
                <dd className={DESC}>{t(`cargo_${listing.cargoType}`)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_weight')}</dt>
                <dd className={DESC}>{formatWeight(listing.weightKg, locale)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_volume')}</dt>
                <dd className={DESC}>{listing.volumeM3 ? `${listing.volumeM3} m³` : '—'}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_pickup')}</dt>
                <dd className={DESC}>{formatDateTime(listing.timeWindow.earliestPickup, locale)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('col_delivery')}</dt>
                <dd className={DESC}>{formatDateTime(listing.timeWindow.latestDelivery, locale)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('field_pricing_model')}</dt>
                <dd className={DESC}>{t(`pricing_${listing.pricingModel}`)}</dd>
              </div>
              <div>
                <dt className={TERM}>{t('opportunity_accepted_vehicles')}</dt>
                <dd className={DESC}>
                  {listing.acceptedVehicleTypes.length === 0
                    ? t('opportunity_all_vehicles')
                    : listing.acceptedVehicleTypes.map((type) => t(`vehicle_${type}`)).join(' · ')}
                </dd>
              </div>
            </dl>
            {listing.description ? (
              <p className="mt-4 border-t border-[#E8E6E3] pt-4 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                {listing.description}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('advisory_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {advisory ? (
                <>
                  <p className="font-display text-xl font-bold text-[#0A1628] dark:text-white">
                    {formatMoney(advisory.suggestedPriceMin, 'MZN', locale)} –{' '}
                    {formatMoney(advisory.suggestedPriceMax, 'MZN', locale)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {t('advisory_confidence', { score: advisory.confidenceScore })}
                  </p>
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{t('advisory_notice')}</p>
                </>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('advisory_unavailable')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('opportunity_matching_vehicles')}</CardTitle>
            </CardHeader>
            <CardContent>
              {fitting.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('opportunity_none_match')}</p>
              ) : (
                <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                  {fitting.map((vehicle) => (
                    <li key={vehicle.vehicleId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                      <span className="font-medium text-[#0A1628] dark:text-white">{vehicle.registrationNumber}</span>
                      <span className="text-zinc-600 dark:text-zinc-400">{t(`vehicle_${vehicle.type}`)}</span>
                      <span className="ml-auto text-zinc-500 dark:text-zinc-400">
                        {formatWeight(vehicle.capacityWeightKg, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {existingQuotation ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t('opportunities_quoted_heading')}</CardTitle>
            <Badge variant={offerStatusVariant(existingQuotation.status)}>
              {t(`offer_status_${existingQuotation.status}`)}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('opportunity_already_quoted_notice')}</p>
            {existingQuotation.status === 'SUBMITTED' ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('quotation_amend_notice')}</p>
            ) : null}
            <Link
              href={`/${locale}/transporter/quotations`}
              className="mt-2 inline-block text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
            >
              {t('view_all_quotations')}
            </Link>
          </CardContent>
        </Card>
      ) : fitting.length > 0 ? (
        <QuotationForm
          listingId={listing.listingId}
          earliestPickup={listing.timeWindow.earliestPickup}
          latestDelivery={listing.timeWindow.latestDelivery}
          vehicles={fitting.map((vehicle) => ({
            vehicleId: vehicle.vehicleId,
            registrationNumber: vehicle.registrationNumber,
            type: vehicle.type,
            capacityWeightKg: vehicle.capacityWeightKg,
            capacityVolumeM3: vehicle.capacityVolumeM3,
          }))}
        />
      ) : null}
    </div>
  );
}
