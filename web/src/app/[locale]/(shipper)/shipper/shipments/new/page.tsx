// NexCargo I-4 §3B — Shipment creation and publication.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getShipperContext } from '../../../shipper-session';
import { ShipmentForm } from '../../../shipment-form';

export const dynamic = 'force-dynamic';

export default async function NewShipmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('ShipperDashboard');
  const ctx = await getShipperContext();
  if (!ctx) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/shipper/shipments`}
          className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
        >
          ← {t('back_to_shipments')}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0A1628] dark:text-white">
          {t('new_shipment_title')}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('new_shipment_subtitle')}</p>
      </div>

      <ShipmentForm locale={locale} />
    </div>
  );
}
