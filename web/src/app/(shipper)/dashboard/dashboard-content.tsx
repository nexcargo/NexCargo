// NexCargo — Shipper Dashboard Page
// C6-III Exemplar Dashboard — Shipper Role
// Renders inside the C6-II authenticated shell (sidebar + topbar)
// Follows ESS-008 §3.3 layout (sidebar → top bar → main content cards/tables)
// Uses i18n for all user-facing strings (ESS-008 §17)
// Implements minimum viable shipper UX per MOD-007 §5.1
// Dynamic rendering: session-dependent layout requires live cookies
// Do not remove export const dynamic = 'force-dynamic'; — it prevents static-generation failures

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Table, Spinner, ToastProvider, useToast } from '@/shared/ui';
import type { ListingStatus, CargoType, PricingModel } from '@/modules/mod-001-marketplace/domain/enums';

interface MarketListing {
  id: string;
  title: string;
  description: string;
  originAddress: string;
  destinationAddress: string;
  cargoType: CargoType;
  weightKg: number;
  status: ListingStatus;
  pricingModel: PricingModel;
  createdAt: string;
}

interface DashboardStats {
  activeListings: number;
  totalOffers: number;
  pendingMatches: number;
  bookingsInProgress: number;
}

const placeholderShipments = [
  {
    id: 'placeholder-1',
    title: 'Bulk Container — Maputo to Johannesburg',
    originAddress: 'Maputo, Mozambique',
    destinationAddress: 'Johannesburg, South Africa',
    cargoType: 'BULK_CARGO' as CargoType,
    weightKg: 25000,
    status: 'PUBLISHED' as ListingStatus,
    pricingModel: 'FIXED' as PricingModel,
    createdAt: new Date().toISOString(),
  },
];

const placeholderBookings = [
  {
    id: 'booking-placeholder-1',
    shipmentId: 'placeholder-1',
    status: 'ALIGNMENT_CHECKED',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export function DashboardContent() {
  const t = useTranslations('ShipperDashboard');
  const supabase = createClient();
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [bookings, setBookings] = useState(placeholderBookings.length);
  const [stats, setStats] = useState<DashboardStats>({
    activeListings: 0,
    totalOffers: 0,
    pendingMatches: 0,
    bookingsInProgress: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const [role] = useState(() => 'SHIPPER');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setIsLoading(true);

        // Fetch marketplace listings via existing API (real data binding)
        const response = await fetch('/api/marketplace/listings', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = '/sign-in';
            return;
          }
          throw new Error(`API returned ${response.status}`);
        }

        const result = await response.json();
        const data = result?.data ?? [];

        if (!cancelled) {
          setListings(data);
          setStats((prev) => ({ ...prev, activeListings: data.length }));
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error('Dashboard fetch error:', err);
          setError(t('error_loading'));
          addToast(msg, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const listingColumns = [
    { key: 'title', header: t('recent_shipments'), sortable: true },
    { key: 'originAddress', header: t('origin'), sortable: true },
    { key: 'destinationAddress', header: t('destination'), sortable: true },
    {
      key: 'cargoType',
      header: t('cargo_type'),
      render: (value: unknown) => <Badge variant="info" size="sm">{String(value)}</Badge>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (value: unknown) => {
        const statusBadge: Record<string, 'success' | 'warning' | 'default' | 'danger' | 'info' | 'neutral'> = {
          PUBLISHED: 'success',
          DRAFT: 'default',
          EXPIRED: 'danger',
          BOOKED: 'info',
          CANCELLED: 'neutral',
        };
        return <Badge variant={statusBadge[String(value)] ?? 'neutral'} size="sm">{String(value)}</Badge>;
      },
    },
    {
      key: 'weightKg',
      header: t('weight_kg'),
      render: (value: unknown) => `${Number(value)?.toLocaleString() ?? '\u2014'} kg`,
    },
  ];

  const handleRetry = () => {
    setError(null);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground dark:text-zinc-400 mt-1">
            {t('overview')}
          </p>
        </div>
          <Button variant="primary" size="md">
            {t('create_shipment_title')}
          </Button>
      </div>

      {/* Error banner — visible when API fetch fails */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{t('error_loading')}</p>
              <button
                onClick={handleRetry}
                className="mt-2 text-sm font-medium underline text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                {t('retry')}
              </button>
            </div>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 rounded p-1 text-red-600 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-950/50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              aria-label="Dismiss error"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('active_shipments')}
          value={isLoading ? '...' : String(stats.activeListings)}
          icon="shipments"
          variant="default"
        />
        <StatCard
          label={t('offers')}
          value={isLoading ? '...' : String(stats.totalOffers)}
          icon="offers"
          variant="info"
        />
        <StatCard
          label={t('pending_matches')}
          value={isLoading ? '...' : String(stats.pendingMatches)}
          icon="matches"
          variant="warning"
        />
        <StatCard
          label={t('booking_status')}
          value={isLoading ? '...' : String(bookings)}
          icon="bookings"
          variant="success"
        />
      </div>

      {/* Recent Shipments Table */}
      <section aria-labelledby="shipments-heading">
        <h2 id="shipments-heading" className="mb-3 text-lg font-semibold">
          {t('recent_shipments')}
        </h2>
        <Table
          columns={listingColumns}
          data={isLoading ? placeholderShipments : listings}
          isLoading={isLoading}
          emptyMessage={t('no_recent_shipments')}
        />
      </section>

      {/* Booking & Escrow Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Booking Status */}
        <section aria-labelledby="bookings-heading">
          <Card>
            <CardHeader>
              <CardTitle>{t('booking_status')}</CardTitle>
              <CardDescription>Current booking pipeline status</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="space-y-3">
                  <Spinner className="mx-auto block" />
                  <p className="text-center text-sm text-muted-foreground">{t('loading_data')}</p>
                </div>
              )}
              {!isLoading && bookings > 0 && (
                <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-700">
                  <Badge variant="info" size="md">{t('status_booked')}</Badge>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Active bookings are managed through the Marketplace → Booking flow.
                  </p>
                </div>
              )}
              {!isLoading && bookings === 0 && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {t('no_bookings')}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Escrow Summary (Display Area Only — Per HAO scope rules) */}
        <section aria-labelledby="escrow-heading">
          <Card>
            <CardHeader>
              <CardTitle>{t('escrow_summary')}</CardTitle>
              <CardDescription>Funds held by regulated banking partners</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-md bg-green-50 px-4 py-3 dark:bg-green-950/20">
                  <span className="text-sm font-medium">{t('escrow_locked')}</span>
                  <Badge variant="success" size="sm">
                    {t('escrow_locked')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-md bg-blue-50 px-4 py-3 dark:bg-blue-950/20">
                  <span className="text-sm font-medium">{t('escrow_released')}</span>
                  <Badge variant="info" size="sm">
                    {t('escrow_released')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  NexCargo does not hold funds. All payments are processed through regulated banking partners.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Quick Actions */}
      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="mb-3 text-lg font-semibold">
          {t('quick_actions')}
        </h2>
        <p className="text-sm text-muted-foreground">
          Additional quick action links will appear here once available.
        </p>
      </section>
    </div>
  );
}

// C6-III: ToastProvider wrapper — renders DashboardContent inside the toast notification context
export function ShipperDashboardWithToast() {
  return (
    <ToastProvider position="top-right">
      <DashboardContent />
    </ToastProvider>
  );
}
interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  variant: 'default' | 'info' | 'warning' | 'success';
}

function StatCard({ label, value, icon, variant }: StatCardProps) {
  const bgStyles: Record<string, string> = {
    default: 'bg-white dark:bg-zinc-900',
    info: 'bg-blue-50 dark:bg-blue-950/20',
    warning: 'bg-amber-50 dark:bg-amber-950/20',
    success: 'bg-green-50 dark:bg-green-950/20',
  };

  return (
    <div className={cn(
      'rounded-lg border border-zinc-200 p-4 dark:border-zinc-700',
      bgStyles[variant]
    )}>
      <p className="text-sm font-medium text-muted-foreground dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
