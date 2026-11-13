// NexCargo I-5 §3F — the Transporter's own quotations.
// The rows come from OffersRepository.listByTransporter, which RLS already pins to
// transporter_id = auth.uid(); nothing here can list another transporter's pricing. Each stored offer is
// rebuilt through the MOD-001 persistence mapper, and the shipment column resolves against the published
// listings the session may read — a shipment that has left the market is named as such rather than guessed.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { ListingsRepository } from '@/infrastructure/repositories/listings-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';
import { toTransportOffer } from '@/modules/mod-001-marketplace/infrastructure/repositories/persistence-mapper';
import { getTransporterContext } from '../../transporter-session';
import { formatDate, formatDateTime, formatMoney, formatWeight, offerStatusVariant } from '../../presentation';
import { QuotationActions } from './quotation-actions';

export const dynamic = 'force-dynamic';

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';

export default async function TransporterQuotationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const [quotations, publishedListings] = await Promise.all([
    new OffersRepository().listByTransporter(ctx.userId),
    new ListingsRepository().listPublished(),
  ]);
  const listingById = new Map(publishedListings.map((listing) => [listing.listingId, listing]));

  const rows = quotations.map((quotation) => ({
    offer: toTransportOffer(quotation),
    quotedAt: quotation.createdAt,
    listing: listingById.get(quotation.listingId) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('quotations_title')}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('quotations_intro')}</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('recent_quotations')}</CardTitle>
          <Link
            href={`/${locale}/transporter/opportunities`}
            className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
          >
            {t('transporter_nav_opportunities')}
          </Link>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('no_quotations')}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('no_quotations_hint')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('quotations_title')}</caption>
                <thead>
                  <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                    <th scope="col" className={TH}>{t('col_shipment')}</th>
                    <th scope="col" className={TH}>{t('col_price')}</th>
                    <th scope="col" className={`hidden md:table-cell ${TH}`}>{t('col_status')}</th>
                    <th scope="col" className={`hidden lg:table-cell ${TH}`}>{t('col_quoted_on')}</th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('col_action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ offer, quotedAt, listing }) => (
                    <tr key={offer.offerId} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800 align-top">
                      <td className="px-3 py-2.5">
                        {listing ? (
                          <Link
                            href={`/${locale}/transporter/opportunities/${listing.listingId}`}
                            className="font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
                          >
                            {listing.title || t('untitled_shipment')}
                          </Link>
                        ) : (
                          <span className="font-medium text-zinc-600 dark:text-zinc-400">{t('quotation_listing_closed')}</span>
                        )}
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {t(`vehicle_${offer.vehicleType}`)} · {formatWeight(offer.declaredCapacity.maxWeightKg, locale)}
                        </span>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDateTime(offer.availabilityWindow.latestPickup, locale)} →{' '}
                          {formatDateTime(offer.availabilityWindow.estimatedDelivery, locale)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">
                        {formatMoney(offer.priceProposal, 'MZN', locale)}
                      </td>
                      <td className="hidden px-3 py-2.5 md:table-cell">
                        <Badge variant={offerStatusVariant(offer.status)}>{t(`offer_status_${offer.status}`)}</Badge>
                      </td>
                      <td className="hidden px-3 py-2.5 text-zinc-600 dark:text-zinc-400 lg:table-cell">
                        {formatDate(quotedAt, locale)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <QuotationActions offerId={offer.offerId} status={offer.status} />
                        {offer.status !== 'SUBMITTED' && offer.status !== 'WITHDRAWN' ? (
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('quotation_terminal')}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('quotation_amend_notice')}</p>
    </div>
  );
}
