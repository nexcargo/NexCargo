// NexCargo — Driver Route Group Layout
// C7-001 Phase 2 — Tracking UI / Driver Experience
// C6-04: i18n — useTranslations for app label
// C6-07: Added SkipNav (ESS-008 §13) + main landmark id

import type { Metadata } from 'next';
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { SkipNav } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'NexCargo — Driver App',
  description: 'Driver app for NexCargo logistics marketplace',
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('AuthPortal');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <SkipNav />
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-14 items-center justify-between px-3 sm:px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-base">
            NexCargo
          </Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('driver_app')}</span>
        </div>
      </header>
      <main id="main-content" className="p-3 sm:p-4 pb-20">
        {children}
      </main>
    </div>
  );
}
