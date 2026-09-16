'use client';

import Link from "next/link";
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SkipNav } from '@/shared/ui';

export default function TransporterLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('AuthPortal');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <SkipNav />
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            NexCargo
          </Link>
          <span className="ml-auto flex items-center gap-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400 hidden md:inline-block">{t('transporter_portal')}</span>
            {/* Hamburger toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:hidden"
              aria-expanded={mobileOpen}
              aria-controls="transporter-sidebar-mobile"
              aria-label="Open navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </span>
        </div>
      </header>
      <div className="flex flex-1">
        {/* Desktop sidebar — unchanged */}
        <aside className="hidden w-56 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:block">
          <nav className="flex flex-col gap-1 p-3" aria-label="Transporter Navigation">
            <NavLink href="/active-trips" label="Active Trips" />
            <NavLink href="/transporter/fleet" label="Fleet Registry" />
          </nav>
        </aside>

        {/* Mobile overlay sidebar */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 sm:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside
              id="transporter-sidebar-mobile"
              className="fixed inset-y-0 left-0 z-50 w-56 border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:hidden"
            >
              <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <span className="font-bold text-sm">Navigation</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  aria-label="Close navigation menu"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col gap-1 p-3" aria-label="Mobile Transporter Navigation">
                <NavLink href="/active-trips" label="Active Trips" />
                <NavLink href="/transporter/fleet" label="Fleet Registry" />
              </nav>
            </aside>
          </>
        )}

        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {label}
    </Link>
  );
}
