// NexCargo — Public Landing Page (C6 — Production)
// Full information architecture with 11 sections.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SkipNav, Button, PublicHeader, PublicFooter } from '@/shared/ui';
import { cn } from '@/shared/ui/utils';

export const dynamic = 'force-dynamic';

/* ─── Shared Primitives ─── */

function MarketplacePreviewCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-[#E8E6E3] bg-white p-6 shadow-sm hover:shadow-md transition-shadow dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="font-semibold text-[#0A1628] dark:text-white mb-2">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{desc}</p>
    </div>
  );
}

function FeatureCard({
  name,
  desc,
  iconPath,
}: {
  name: string;
  desc: string;
  iconPath: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A5C9E]/10 dark:bg-blue-500/20">
        {iconPath}
      </div>
      <h3 className="font-semibold text-[#0A1628] dark:text-white">{name}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
    </div>
  );
}

function RoleCard({
  roleTitle,
  roleDesc,
  features,
  ctaLabel,
  href,
  highlight,
}: {
  roleTitle: string;
  roleDesc: string;
  features: string[];
  ctaLabel: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'flex flex-col rounded-2xl border p-6 lg:p-8',
      highlight
        ? 'border-[#1A5C9E] bg-[#1A5C9E]/[0.04] dark:border-blue-500/30 dark:bg-blue-500/[0.08]'
        : 'border-[#E8E6E3] bg-white dark:border-zinc-700 dark:bg-zinc-900'
    )}>
      <h3 className="font-display font-bold text-xl text-[#0A1628] dark:text-white mb-2">
        {roleTitle}
      </h3>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 mb-6">
        {roleDesc}
      </p>
      <ul className="space-y-2 mb-auto" aria-label={roleTitle}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <svg className="h-4 w-4 shrink-0 mt-0.5 text-[#1A5C9E] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 pt-6 border-t border-[#E8E6E3] dark:border-zinc-700">
        <Link href={href}>
          <Button variant={highlight ? 'primary' : 'outline'} size="lg">
            {ctaLabel}
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ─── Product Demonstration Card ─── */

interface DemoListing {
  origin: string;
  destination: string;
  cargoTypeKey: string;
  weight: string;
  statusKey: string;
  statusColor: string;
}

const demoListings: DemoListing[] = [
  { origin: 'Maputo', destination: 'Matola', cargoTypeKey: 'demo_listing_0_cargo', weight: '18,000 kg', statusKey: 'demo_listing_0_status', statusColor: 'bg-teal-500' },
  { origin: 'Beira', destination: 'Harare', cargoTypeKey: 'demo_listing_1_cargo', weight: '25,000 kg', statusKey: 'demo_listing_1_status', statusColor: 'bg-[#1A5C9E]' },
  { origin: 'Nampula', destination: 'Cuamba', cargoTypeKey: 'demo_listing_2_cargo', weight: '12,500 kg', statusKey: 'demo_listing_2_status', statusColor: 'bg-teal-500' },
];

function ProductDemo() {
  const t = useTranslations('Home');

  return (
    <section className="bg-white py-16 sm:py-20 dark:bg-zinc-950" aria-labelledby="product-demo-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 id="product-demo-title" className="text-2xl sm:text-3xl font-display font-bold text-[#0A1628] dark:text-white mb-3">
            {t('product_demo_title')}
          </h2>
          <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            {t('product_demo_desc')}
          </p>
        </div>

        {/* Product Preview Frame */}
        <div className="max-w-4xl mx-auto rounded-2xl border border-[#E8E6E3] bg-white shadow-lg overflow-hidden dark:border-zinc-700 dark:bg-zinc-900">
          {/* Fake browser chrome */}
          <div className="border-b border-[#E8E6E3] px-4 py-3 flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 ml-4 rounded-md bg-white dark:bg-zinc-700 px-3 py-1 text-xs text-zinc-400 dark:text-zinc-500">
              nexcargo.com/marketplace
            </div>
          </div>

          {/* Marketplace Listing Table */}
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-[#0A1628] dark:text-white text-base">{t('demo_table_title')}</h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('demo_listings_count')}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-[#E8E6E3] dark:border-zinc-700">
                    <th className="text-left py-2.5 px-3 font-semibold text-[#0A1628] dark:text-white text-xs uppercase tracking-wider">{t('demo_col_origin')}</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-[#0A1628] dark:text-white text-xs uppercase tracking-wider hidden sm:table-cell">{t('demo_col_destination')}</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-[#0A1628] dark:text-white text-xs uppercase tracking-wider hidden md:table-cell">{t('demo_col_cargo_type')}</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-[#0A1628] dark:text-white text-xs uppercase tracking-wider">{t('demo_col_weight')}</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-[#0A1628] dark:text-white text-xs uppercase tracking-wider">{t('demo_col_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {demoListings.map((listing, i) => (
                    <tr key={i} className="border-b border-[#E8E6E3] last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors dark:border-zinc-700">
                      <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300 font-medium">{listing.origin}</td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 hidden sm:table-cell">{listing.destination}</td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 hidden md:table-cell">{t(listing.cargoTypeKey)}</td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">{listing.weight}</td>
                      <td className="py-3 px-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white', listing.statusColor)}>
                          {t(listing.statusKey)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CTA below preview */}
          <div className="px-4 sm:px-6 pb-6">
            <Link href="/register">
              <Button variant="outline" size="sm">
                {t('product_demo_cta')} →
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Two-Sided Journey ─── */

function JourneyStep({
  num,
  label,
  desc,
  pathColor,
}: {
  num: number;
  label: string;
  desc: string;
  pathColor: string;
}) {
  return (
    <div className="flex flex-col items-center text-center px-2">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold text-sm ${pathColor}`}>
        {num}
      </div>
      <h3 className="font-semibold text-[#0A1628] dark:text-white mt-3 mb-1">{label}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-[200px] leading-relaxed">{desc}</p>
    </div>
  );
}

function HowItWorks() {
  const t = useTranslations('Home');

  return (
    <section className="bg-[#F8F6F3] py-16 sm:py-20 dark:bg-[#0A1628]" aria-labelledby="how-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 id="how-title" className="text-2xl sm:text-3xl font-display font-bold text-[#0A1628] dark:text-white mb-3">
            {t('how_title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Path A — Dono de Carga */}
          <div className="rounded-2xl border border-[#1A5C9E]/20 bg-white p-6 sm:p-8 dark:border-blue-500/20 dark:bg-zinc-900">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-3 w-3 rounded-full bg-[#1A5C9E]" />
              <h3 className="font-display font-bold text-lg text-[#0A1628] dark:text-white">{t('how_shipper_path_label')}</h3>
            </div>
            <div className="relative">
              {/* Connector line */}
              <div className="hidden sm:block absolute top-5 left-[20px] right-[20px] h-px bg-gradient-to-r from-[#1A5C9E]/40 via-[#1A5C9E]/30 to-transparent" />
              <div className="grid grid-cols-3 gap-2 sm:gap-4 relative z-10">
                <JourneyStep num={1} label={t('how_step_shipper_1')} desc={t('how_step_shipper_1_desc')} pathColor="bg-[#1A5C9E]" />
                <JourneyStep num={2} label={t('how_step_shipper_2')} desc={t('how_step_shipper_2_desc')} pathColor="bg-[#1A5C9E]" />
                <JourneyStep num={3} label={t('how_step_shipper_3')} desc={t('how_step_shipper_3_desc')} pathColor="bg-[#1A5C9E]" />
              </div>
            </div>
          </div>

          {/* Path B — Transportador */}
          <div className="rounded-2xl border border-[#0F8B7A]/20 bg-white p-6 sm:p-8 dark:border-teal-500/20 dark:bg-zinc-900">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-3 w-3 rounded-full bg-[#0F8B7A]" />
              <h3 className="font-display font-bold text-lg text-[#0A1628] dark:text-white">{t('how_transporter_path_label')}</h3>
            </div>
            <div className="relative">
              {/* Connector line */}
              <div className="hidden sm:block absolute top-5 left-[20px] right-[20px] h-px bg-gradient-to-r from-[#0F8B7A]/40 via-[#0F8B7A]/30 to-transparent" />
              <div className="grid grid-cols-3 gap-2 sm:gap-4 relative z-10">
                <JourneyStep num={1} label={t('how_step_transporter_1')} desc={t('how_step_transporter_1_desc')} pathColor="bg-[#0F8B7A]" />
                <JourneyStep num={2} label={t('how_step_transporter_2')} desc={t('how_step_transporter_2_desc')} pathColor="bg-[#0F8B7A]" />
                <JourneyStep num={3} label={t('how_step_transporter_3')} desc={t('how_step_transporter_3_desc')} pathColor="bg-[#0F8B7A]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Mozambique Section ─── */

function MozambiqueSection() {
  const t = useTranslations('Home');

  return (
    <section className="bg-white py-16 sm:py-20 dark:bg-zinc-950" aria-labelledby="moz-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#EE8426]/10 dark:bg-orange-500/20 mb-6">
            <svg className="h-8 w-8 text-[#EE8426]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <h2 id="moz-title" className="text-2xl sm:text-3xl font-display font-bold text-[#0A1628] dark:text-white mb-4">
            {t('moz_title')}
          </h2>
          <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
            {t('moz_desc')}
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <svg className="h-4 w-4 text-[#0F8B7A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t('moz_countries')}
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <svg className="h-4 w-4 text-[#0F8B7A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t('moz_sadc')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Capability Icons ─── */

const CargoIcon = () => (
  <svg className="h-5 w-5 text-[#1A5C9E] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const MatchingIcon = () => (
  <svg className="h-5 w-5 text-[#1A5C9E] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const TrackingIcon = () => (
  <svg className="h-5 w-5 text-[#1A5C9E] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PaymentIcon = () => (
  <svg className="h-5 w-5 text-[#1A5C9E] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const AiIcon = () => (
  <svg className="h-5 w-5 text-[#1A5C9E] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="h-5 w-5 text-[#1A5C9E] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const NotificationIcon = () => (
  <svg className="h-5 w-5 text-[#1A5C9E] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const LangIcon = () => (
  <svg className="h-5 w-5 text-[#1A5C9E] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
  </svg>
);

/* ─── Home Page ─── */

export default function Home() {
  const t = useTranslations('Home');
  const locale = typeof window !== 'undefined' ? (window.location.pathname.split('/')[1] || 'en') : 'en';

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6F3] font-sans dark:bg-[#0A1628]">
      <SkipNav />

      {/* Section 0: Public Header */}
      <PublicHeader locale={locale} />

      {/* Section 1: Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0A1628] via-[#0f1f3d] to-[#162448] py-20 sm:py-28 lg:py-36">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-xs sm:text-sm font-medium tracking-widest uppercase text-[#EE8426]">
              {t('tagline')}
            </p>
            <p className="mb-4 text-xs sm:text-sm text-zinc-400 font-medium tracking-wide">
              {t('product_descriptor')}
            </p>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.1]">
              {t('hero_subtitle')}
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed text-zinc-300">
              {t('hero_body')}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full">
                  {t('hero_cta_primary')}
                </Button>
              </Link>
              <Link href="/register" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full border border-zinc-600 bg-transparent text-white hover:bg-white/10">
                  {t('hero_cta_secondary')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Product Demonstration */}
      <ProductDemo />

      {/* Section 3: How It Works — two-sided journey */}
      <HowItWorks />

      {/* Section 4 & 5: For Shippers / Transporters */}
      <section className="bg-white py-16 sm:py-20 dark:bg-[#0A1628]" aria-label="Marketplace participants">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* Shipper */}
            <RoleCard
              roleTitle={t('for_shipper_title')}
              roleDesc={t('for_shipper_desc')}
              features={[
                t('shipper_features_publish'),
                t('shipper_features_offers'),
                t('shipper_features_compare'),
                t('shipper_features_book'),
              ]}
              ctaLabel={t('shipper_cta')}
              href="/register"
              highlight
            />
            {/* Transporter */}
            <RoleCard
              roleTitle={t('for_transporter_title')}
              roleDesc={t('for_transporter_desc')}
              features={[
                t('transporter_features_discover'),
                t('transporter_features_submit'),
                t('transporter_features_book'),
                t('transporter_features_operations'),
              ]}
              ctaLabel={t('transporter_cta')}
              href="/register"
            />
          </div>
        </div>
      </section>

      {/* Section 6: Platform Capabilities — expanded to represent full product proposition */}
      <section className="bg-[#F8F6F3] py-16 sm:py-20 dark:bg-zinc-950" aria-labelledby="features-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 id="features-title" className="text-2xl sm:text-3xl font-display font-bold text-[#0A1628] dark:text-white mb-3">
              {t('features_title')}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard name={t('feature_listings_name')} desc={t('feature_listings_desc')} iconPath={<CargoIcon />} />
            <FeatureCard name={t('feature_matching_name')} desc={t('feature_matching_desc')} iconPath={<MatchingIcon />} />
            <FeatureCard name={t('feature_tracking_name')} desc={t('feature_tracking_desc')} iconPath={<TrackingIcon />} />
            <FeatureCard name={t('feature_payment_name')} desc={t('feature_payment_desc')} iconPath={<PaymentIcon />} />
            <FeatureCard name={t('feature_ai_name')} desc={t('feature_ai_desc')} iconPath={<AiIcon />} />
            <FeatureCard name={t('feature_documents_name')} desc={t('feature_documents_desc')} iconPath={<DocumentIcon />} />
            <FeatureCard name={t('feature_notifications_name')} desc={t('feature_notifications_desc')} iconPath={<NotificationIcon />} />
            <FeatureCard name={t('feature_multilang_name')} desc={t('feature_multilang_desc')} iconPath={<LangIcon />} />
          </div>
        </div>
      </section>

      {/* Section 7: Trust & Operating Model */}
      <section className="bg-white py-16 sm:py-20 dark:bg-[#0A1628]" aria-labelledby="trust-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 id="trust-title" className="text-2xl sm:text-3xl font-display font-bold text-[#0A1628] dark:text-white mb-3">
              {t('trust_title')}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MarketplacePreviewCard title={t('trust_no_custody')} desc={t('trust_no_custody_desc')} />
            <MarketplacePreviewCard title={t('trust_responsibility')} desc={t('trust_responsibility_desc')} />
            <MarketplacePreviewCard title={t('trust_no_custody_funds')} desc={t('trust_no_custody_funds_desc')} />
            <MarketplacePreviewCard title={t('trust_region')} desc={t('trust_region_desc')} />
          </div>
        </div>
      </section>

      {/* Section 8: Mozambique & Regional Positioning */}
      <MozambiqueSection />

      {/* Section 9: Final Dual Conversion */}
      <section className="bg-gradient-to-br from-[#1A5C9E] to-[#0F8B7A] py-16 sm:py-20" aria-label="Get started">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">
              {t('final_section_title')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Shipper CTA */}
            <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur p-6 sm:p-8 text-center">
              <h3 className="font-display font-bold text-xl text-white mb-2">{t('shipper_cta_heading')}</h3>
              <p className="text-sm text-white/80 mb-6">{t('final_shipper_line')}</p>
              <Link href="/register" className="block w-full">
                <Button variant="secondary" size="lg" className="w-full border-none">
                  {t('final_shipper_cta')}
                </Button>
              </Link>
            </div>
            {/* Transporter CTA */}
            <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur p-6 sm:p-8 text-center">
              <h3 className="font-display font-bold text-xl text-white mb-2">{t('transporter_cta_heading')}</h3>
              <p className="text-sm text-white/80 mb-6">{t('final_transporter_line')}</p>
              <Link href="/register" className="block w-full">
                <Button variant="secondary" size="lg" className="w-full border-none">
                  {t('final_transporter_cta')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 10: Public Footer */}
      <PublicFooter locale={locale} />
    </div>
  );
}
