// NexCargo I-5 §3E — Shipment opportunities.
// The published listings are the ones the RLS policy "All auth users read published listings" already
// admits, so no cross-transporter data is read and no parallel matching engine runs: each row's verdict
// comes from the MOD-001 §6.4.1 hard filters applied to this Transporter's own available vehicles.
// The shipper-side ranking stays authoritative because a Transporter cannot read competing quotations
// (§3E confidentiality), so no score is displayed here.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { toShipmentListing } from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import { vehiclesThatFit } from '../../opportunity-eligibility';
import { getTransporterContext } from '../../transporter-session';
import { formatDate, formatWeight, offerStatusVariant } from '../../presentation';
import type { VehicleApiShape } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';

export const dynamic = 'force-dynamic';

interface OpportunityRow {
  listingId: string;
  title: string;
  origin: string;
  destination: string;
  cargoType: string;
  weightKg: number;
  volumeM3: number | null;
  earliestPickup: string;
  latestDelivery: string;
  publishedAt: string | null;
  fittingVehicles: VehicleApiShape[];
  quotationStatus: string | null;
}

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';

export default async function TransporterOpportunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const fittingLabel = (fit: VehicleApiShape[]) =>
    [...new Set(fit.map((vehicle) => t(`vehicle_${vehicle.type}`)))].join(' · ');

  const [listingRows, vehicles, quotations] = await Promise.all([
    new ListingsRepository().listPublished(),
    new FleetRepository().listVehicles(undefined, undefined, 'AVAILABLE'),
    new OffersRepository().listByTransporter(ctx.userId),
  ]);

  // listByTransporter is ordered newest-first, so the first hit is the live quotation for a listing.
  const quotedByListing = new Map<string, string>();
  for (const offer of quotations) {
    if (!quotedByListing.has(offer.listingId)) quotedByListing.set(offer.listingId, offer.status);
  }

  const rows: OpportunityRow[] = listingRows
    .map((row) => {
      const listing = toShipmentListing(row);
      return {
        listingId: row.listingId,
        title: row.title || t('untitled_shipment'),
        origin: listing.origin.address,
        destination: listing.destination.address,
        cargoType: listing.cargoType,
        weightKg: listing.weightKg,
        volumeM3: listing.volumeM3 ?? null,
        earliestPickup: listing.timeWindow.earliestPickup,
        latestDelivery: listing.timeWindow.latestDelivery,
        publishedAt: row.publishedAt,
        fittingVehicles: vehiclesThatFit(row, vehicles),
        quotationStatus: quotedByListing.get(row.listingId) ?? null,
      };
    })
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  const open = rows.filter((row) => row.quotationStatus === null);
  const eligible = open.filter((row) => row.fittingVehicles.length > 0);
  const outsideCapability = open.filter((row) => row.fittingVehicles.length === 0);
  const quoted = rows.filter((row) => row.quotationStatus !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('opportunities_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('opportunities_intro')}</p>
        </div>
        <Button href={`/${locale}/transporter/quotations`} variant="outline" size="sm">
          {t('transporter_nav_quotations')}
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('fleet_missing_hint')}</p>
            <Link
              href={`/${locale}/transporter/fleet`}
              className="mt-1 inline-block text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
            >
              {t('transporter_nav_fleet')}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="eligible-opportunities">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle id="eligible-opportunities">{t('opportunities_eligible_heading')}</CardTitle>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{eligible.length}</span>
          </CardHeader>
          <CardContent>
            {eligible.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('no_opportunities')}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('no_opportunities_hint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t('opportunities_eligible_heading')}</caption>
                  <thead>
                    <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                      <th scope="col" className={TH}>{t('col_route')}</th>
                      <th scope="col" className={`hidden md:table-cell ${TH}`}>{t('col_cargo')}</th>
                      <th scope="col" className={`hidden sm:table-cell ${TH}`}>{t('col_weight')}</th>
                      <th scope="col" className={TH}>{t('col_pickup')}</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('col_action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligible.map((row) => (
                      <tr key={row.listingId} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
                        <td className="px-3 py-2.5">
                          <span className="block font-medium text-[#0A1628] dark:text-white">{row.title}</span>
                          <span className="block text-zinc-600 dark:text-zinc-400">
                            {row.origin}
                            <span className="mx-1 text-zinc-400">→</span>
                            {row.destination}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2.5 text-zinc-600 dark:text-zinc-400 md:table-cell">
                          {t(`cargo_${row.cargoType}`)}
                        </td>
                        <td className="hidden px-3 py-2.5 text-zinc-600 dark:text-zinc-400 sm:table-cell">
                          {formatWeight(row.weightKg, locale)}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                          {formatDate(row.earliestPickup, locale)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            {fittingLabel(row.fittingVehicles)}
                          </span>
                          <Link
                            href={`/${locale}/transporter/opportunities/${row.listingId}`}
                            className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
                          >
                            {t('submit_quote')}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="quoted-opportunities">
          <Card>
            <CardHeader>
              <CardTitle id="quoted-opportunities">{t('opportunities_quoted_heading')}</CardTitle>
            </CardHeader>
            <CardContent>
              {quoted.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{t('no_quotations')}</p>
              ) : (
                <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                  {quoted.map((row) => (
                    <li key={row.listingId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                      <Link
                        href={`/${locale}/transporter/opportunities/${row.listingId}`}
                        className="font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
                      >
                        {row.title}
                      </Link>
                      <Badge variant={offerStatusVariant(row.quotationStatus ?? '')}>
                        {t(`offer_status_${row.quotationStatus}`)}
                      </Badge>
                      <span className="ml-auto text-zinc-500 dark:text-zinc-400">
                        {formatDate(row.publishedAt, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="outside-capability">
          <Card>
            <CardHeader>
              <CardTitle id="outside-capability">{t('opportunities_outside_heading')}</CardTitle>
            </CardHeader>
            <CardContent>
              {outsideCapability.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{t('opportunities_outside_empty')}</p>
              ) : (
                <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                  {outsideCapability.map((row) => (
                    <li key={row.listingId} className="py-2.5 text-sm">
                      <p className="font-medium text-[#0A1628] dark:text-white">{row.title}</p>
                      <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                        {t(`cargo_${row.cargoType}`)} · {formatWeight(row.weightKg, locale)}
                        {row.volumeM3 ? ` · ${row.volumeM3} m³` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t('opportunity_not_eligible')}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
