// NexCargo I-5 §3A/§4 — Transporter experience layout.
// Membership-gated shell for the authenticated TRANSPORTER journey. The gate resolves the marketplace
// role from the Supabase session through effective_marketplace_role(); user_metadata and
// client-supplied role claims carry no authority here.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, LanguageSwitcher, NexCargoLogo, SkipNav } from '@/shared/ui';
import { getTransporterContext } from './transporter-session';
import { TransporterMobileNav, TransporterSidebar } from './transporter-nav';

export const dynamic = 'force-dynamic';

export default async function TransporterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('TransporterDashboard');
  const nav = await getTranslations('Navigation');
  const ctx = await getTransporterContext();

  if (!ctx) {
    redirect(`/${locale}/sign-in`);
  }

  if (ctx.marketplaceRole !== 'TRANSPORTER') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F6F3] px-6 dark:bg-[#0A1628]">
        <div className="w-full max-w-md rounded-2xl border border-[#E8E6E3] bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="font-display text-xl font-bold text-[#0A1628] dark:text-white">{t('not_transporter_title')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t('not_transporter_desc')}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button href={`/${locale}`} variant="outline" size="sm">{t('back_to_home')}</Button>
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="ghost" size="sm">{nav('sign_out')}</Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const memberSince = ctx.memberSince ? new Date(ctx.memberSince) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6F3] dark:bg-[#0A1628]">
      <SkipNav />

      <header className="relative z-30 sticky top-0 border-b border-[#E8E6E3] bg-white dark:border-zinc-800 dark:bg-[#0A1628]">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <TransporterMobileNav />
          <Link href={`/${locale}/transporter/dashboard`} aria-label="NexCargo" className="shrink-0">
            <NexCargoLogo />
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <Badge variant="info">{t('membership_role_transporter')}</Badge>
            <LanguageSwitcher initialLocale={locale} />
            <div className="hidden text-right sm:block">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('signed_in_as')}</p>
              <p className="max-w-[16rem] truncate text-sm font-medium text-[#0A1628] dark:text-white">{ctx.email}</p>
            </div>
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="ghost" size="sm">{nav('sign_out')}</Button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-stretch">
        <TransporterSidebar />
        <main id="main-content" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <section aria-label={t('membership_heading')} className="mb-6 rounded-xl border border-[#E8E6E3] bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('membership_role')}</dt>
                  <dd className="font-medium text-[#0A1628] dark:text-white">{t('membership_role_transporter')}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('membership_account')}</dt>
                  <dd className="truncate font-medium text-[#0A1628] dark:text-white">{ctx.email}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('membership_member_since')}</dt>
                  <dd className="font-medium text-[#0A1628] dark:text-white">
                    {memberSince ? memberSince.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'en-GB') : t('summary_none')}
                  </dd>
                </div>
              </dl>
            </section>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
