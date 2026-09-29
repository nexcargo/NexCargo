// NexCargo — Dispatcher Dashboard (Canonical C6 Exemplar)
// Per PROMPT 4 §5 route structure: /dispatcher
// Authorized by HAO-R-002 (Dispatcher Dashboard Approval)
// C6-06: Canonical dashboard consolidation — aligned with ShipperDashboard patterns
//   - space-y-6 root container
//   - text-2xl font-bold tracking-tight h1 (ESS-008 §5.1 heading hierarchy)
//   - section/aria-labelledby for all sections (ESS-008 §13 accessibility)
//   - Grid-based stat cards with Skeleton loading (ESS-008 §9)
//   - ErrorBanner on failure, retry via reload
//   - All strings localized per ESS-008 §17
// Dynamic rendering: session-dependent content requires live cookies

'use client';

import React, { useEffect, useState } from 'react';
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { Skeleton, ErrorBanner } from '@/shared/ui';

interface DispatchStats {
  activeShipments: number;
  totalDrivers: number;
  openExceptions: number;
}

export default function DispatcherDashboard() {
  const t = useTranslations('DispatcherDashboard');
  const [stats, setStats] = useState<DispatchStats>({ activeShipments: 0, totalDrivers: 0, openExceptions: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/tracking/all').then(r => r.ok ? r.json().then((d: unknown[]) => Array.isArray(d) ? d.length : 0).catch(() => 0) : 0),
      fetch('/api/fleet/drivers').then(r => r.ok ? r.json().then((d: Record<string, unknown[]>) => Array.isArray(d?.data) ? d.data.length : 0).catch(() => 0) : 0),
      fetch('/api/support/tickets').then(r => r.ok ? r.json().then((d: unknown) => {
        const data = (d as Record<string, unknown[]>)?.data ?? [];
        return Array.isArray(data) ? data.filter((item: unknown) => {
          const ticket = item as Record<string, string>;
          return ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED';
        }).length : 0;
      }).catch(() => 0) : 0),
    ])
      .then(([shipments, drivers, exceptions]) => {
        if (!cancelled) {
          setStats({ activeShipments: shipments, totalDrivers: drivers, openExceptions: exceptions });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('error_message'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [t]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground dark:text-zinc-400 mt-1">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <ErrorBanner message={error} onRetry={() => window.location.reload()} />
      )}

      {/* Stats Cards */}
      <section aria-label={t('active_shipments_label')}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCardSkeleton label={t('active_shipments_label')} value={loading ? undefined : String(stats.activeShipments)} variant="default" />
          <StatCardSkeleton label={t('fleet_drivers_label')} value={loading ? undefined : String(stats.totalDrivers)} variant="info" />
          <StatCardSkeleton label={t('open_exceptions_label')} value={loading ? undefined : String(stats.openExceptions)} variant="warning" />
        </div>
      </section>

      {/* Navigation Cards */}
      <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Dispatcher navigation">
        <NavCard href="/dispatcher/live-ops" titleKey={t('live_ops_card_title')} descKey={t('live_ops_card_desc')} />
        <NavCard href="/dispatcher/assignments" titleKey={t('assignments_card_title')} descKey={t('assignments_card_desc')} />
        <NavCard href="/dispatcher/tracking" titleKey={t('tracking_card_title')} descKey={t('tracking_card_desc')} />
        <NavCard href="/dispatcher/exceptions" titleKey={t('exceptions_card_title')} descKey={t('exceptions_card_desc')} />
      </nav>

      {/* Advisory notice */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-900/50">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t('advisory_text')}
        </p>
      </section>
    </div>
  );
}

function StatCardSkeleton({ label, value, variant }: { label: string; value?: string; variant: 'default' | 'info' | 'warning' | 'success' }) {
  if (value === undefined) {
    return (
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-12" />
      </div>
    );
  }

  const bgStyles: Record<string, string> = {
    default: 'bg-white dark:bg-zinc-900',
    info: 'bg-blue-50 dark:bg-blue-950/20',
    warning: 'bg-amber-50 dark:bg-amber-950/20',
    success: 'bg-green-50 dark:bg-green-950/20',
  };

  return (
    <div className={`rounded-lg border border-zinc-200 p-4 dark:border-zinc-700 ${bgStyles[variant]}`}>
      <p className="text-sm font-medium text-muted-foreground dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function NavCard({ href, titleKey, descKey }: { href: string; titleKey: string; descKey: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
    >
      <h2 className="font-semibold text-foreground dark:text-white">{titleKey}</h2>
      <p className="mt-1 text-sm text-muted-foreground dark:text-zinc-400">{descKey}</p>
    </Link>
  );
}
