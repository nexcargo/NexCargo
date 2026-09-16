// NexCargo — Public Landing Page
// C6-I / C6-III Public Web Entry Point
// C6-05: i18n, SkipNav, LanguageSwitcher, consistent container/heading conventions

import Link from "next/link";
import { useTranslations } from 'next-intl';
import { SkipNav } from '@/shared/ui';

export default function Home() {
  const t = useTranslations('Home');

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F6F3] font-sans dark:bg-[#0A1628]">
      <SkipNav />
      <main className="flex flex-1 w-full max-w-5xl mx-auto flex-col items-center justify-between py-24 px-8 sm:px-16">
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center gap-8 max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight text-[#0A1628] dark:text-white">
            {t('brand')}
          </h1>
          <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400">
            {t('hero_subtitle')}
          </p>
          <p className="max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t('hero_body')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Link
              href="/sign-in"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#1A5C9E] px-8 text-white transition-colors hover:bg-[#164878] md:w-auto"
            >
              {t('cta_signin')}
            </Link>
            <Link
              href="/register"
              className="flex h-12 items-center justify-center rounded-full border border-[#E8E6E3] px-8 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 md:w-auto"
            >
              {t('cta_register')}
            </Link>
          </div>
        </section>

        {/* Value Proposition Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full">
          <div className="rounded-xl border border-[#E8E6E3] p-6 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="font-semibold text-[#0A1628] dark:text-white mb-2">{t('prop1_title')}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('prop1_desc')}
            </p>
          </div>
          <div className="rounded-xl border border-[#E8E6E3] p-6 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="font-semibold text-[#0A1628] dark:text-white mb-2">{t('prop2_title')}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('prop2_desc')}
            </p>
          </div>
          <div className="rounded-xl border border-[#E8E6E3] p-6 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="font-semibold text-[#0A1628] dark:text-white mb-2">{t('prop3_title')}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('prop3_desc')}
            </p>
          </div>
        </section>

        {/* Trust Signals */}
        <section className="mt-16 w-full text-center">
          <p className="text-xs text-[#8A8782] uppercase tracking-wider mb-4">
            {t('trust_header')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-[#8A8782]">
            <span>{t('trust_no_custody')}</span>
            <span className="hidden sm:inline">•</span>
            <span>{t('trust_mozambique')}</span>
            <span className="hidden sm:inline">•</span>
            <span>{t('trust_multilang')}</span>
          </div>
        </section>

        {/* Bottom CTAs */}
        <section className="mt-16 w-full text-center border-t border-[#E8E6E3] pt-12 dark:border-zinc-700">
          <h2 className="text-2xl font-display font-semibold text-[#0A1628] dark:text-white mb-4">{t('bottom_title')}</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">{t('bottom_desc')}</p>
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#1A5C9E] px-8 text-white transition-colors hover:bg-[#164878]"
          >
            {t('cta_start')}
          </Link>
        </section>
      </main>
    </div>
  );
}
