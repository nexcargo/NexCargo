// NexCargo I-4 — Shipper navigation
// Locale-prefixed links: LocaleAwareLink only prefixes the public auth routes, so the shipper
// area builds its own prefixed hrefs from the active locale.

'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/shared/ui/utils';

const ITEMS = [
  { href: '/shipper/dashboard', labelKey: 'nav_overview' },
  { href: '/shipper/shipments', labelKey: 'shipper_nav_shipments' },
  { href: '/shipper/shipments/new', labelKey: 'shipper_nav_create' },
  { href: '/shipper/bookings', labelKey: 'shipper_nav_bookings' },
] as const;

/** The longest matching prefix wins, so /shipper/shipments/new does not also light up /shipper/shipments. */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of ITEMS) {
    if (pathname === item.href || pathname.startsWith(item.href + '/')) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('ShipperDashboard');
  const locale = useLocale();
  const active = activeHref(usePathname());

  return (
    <>
      {ITEMS.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={`/${locale}${item.href}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[#1A5C9E]/10 text-[#1A5C9E] dark:bg-blue-500/20 dark:text-blue-300'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-[#0A1628] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white',
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </>
  );
}

export function ShipperSidebar() {
  const t = useTranslations('ShipperDashboard');
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[#E8E6E3] bg-white lg:block dark:border-zinc-800 dark:bg-[#0A1628]">
      <nav aria-label={t('title')} className="flex flex-col gap-1 p-3">
        <NavLinks />
      </nav>
    </aside>
  );
}

export function ShipperMobileNav() {
  const t = useTranslations('ShipperDashboard');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="shipper-nav-mobile"
        aria-label={open ? t('close_navigation') : t('open_navigation')}
        className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
        </svg>
      </button>

      {open && (
        <div id="shipper-nav-mobile" className="absolute inset-x-0 top-full z-40 border-b border-[#E8E6E3] bg-white p-3 shadow-md lg:hidden dark:border-zinc-800 dark:bg-[#0A1628]">
          <nav aria-label={t('title')} className="flex flex-col gap-1">
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      )}
    </>
  );
}
