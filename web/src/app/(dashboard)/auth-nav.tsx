// NexCargo — AuthNav (Mobile Navigation Shell)
// C6-03 Responsive Mobile Authentication Shell
// Renders role-aware navigation with hamburger toggle for <lg breakpoints
// Server component reads role; this client component handles open/close state
// C6-04: i18n — useTranslations for nav labels

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/ui/utils';

interface RoleNavItems {
  items: Array<{ href: string; labelKey: string }>;
  emptyMessage?: string;
}

export interface AuthNavProps {
  role: string | null;
  currentPath?: string;
}

function NavItems({ items, emptyMessage }: RoleNavItems) {
  const t = useTranslations('Navigation');
  return (
    <>
      {emptyMessage && <p className="px-3 py-2 text-xs text-muted-foreground">{emptyMessage}</p>}
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label={`Navigate to ${t(item.labelKey)}`}
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </>
  );
}

export function AuthNav({ role, currentPath }: AuthNavProps) {
  const t = useTranslations('Navigation');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Build nav items based on role
  let roleItems: RoleNavItems = { items: [] };

  if (role === 'SHIPPER') {
    roleItems = { items: [{ href: '/shipper/dashboard', labelKey: 'shipper_dashboard' }] };
  } else if (role === 'TRANSPORTER') {
    roleItems = { items: [{ href: '/transporter', labelKey: 'transporter_portal' }] };
  } else if (role === 'DRIVER' || !role) {
    roleItems = {
      items: [{ href: '/', labelKey: 'public' }],
      emptyMessage: t('no_role_selected'),
    };
  } else {
    roleItems = {
      items: [
        { href: '/dispatcher/live-ops', labelKey: 'live_ops' },
        { href: '/dispatcher/assignments', labelKey: 'assignments' },
        { href: '/dispatcher/tracking', labelKey: 'tracking' },
        { href: '/dispatcher/exceptions', labelKey: 'exceptions' },
      ],
    };
  }

  return (
    <>
      {/* Hamburger toggle — visible on mobile */}
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="ml-auto rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:hidden"
        aria-expanded={mobileOpen}
        aria-controls="auth-sidebar-mobile"
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

      {/* Desktop sidebar — unchanged from existing */}
      <aside className="hidden w-64 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:block">
        <nav className="flex flex-col gap-1 p-4" aria-label="Navigation">
          <NavItems {...roleItems} />
        </nav>
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside
            id="auth-sidebar-mobile"
            className="fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <span className="font-bold text-lg">NexCargo</span>
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
            <nav className="flex flex-col gap-1 p-4" aria-label="Mobile navigation">
              <NavItems {...roleItems} />
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
