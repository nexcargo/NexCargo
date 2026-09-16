// NexCargo Dispatcher — Live Operations
// Per PROMPT 4 §5 route structure: /dispatcher/live-ops
// Capability: Monitor active shipments and driver locations (architecture spec nexcargo-ai-eprs.md §4.4)
// C7 Integration: Wired to tracking API and fleet drivers API
// C6-04: i18n — useTranslations for all user-facing strings

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Table } from '@/shared/ui/components/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/components/card';
import { TrackingStatusBadge } from '@/shared/ui/components/tracking/status-badge';
import { Badge } from '@/shared/ui/components/badge';
import { Spinner, ErrorBanner } from '@/shared/ui';

interface ShipmentRow {
  trackingId: string;
  trackingRef: string;
  status: string;
  bookingId: string;
}

interface DriverRow {
  id: string;
  name: string;
  phone: string;
  status: string;
}

export default function LiveOpsPage() {
  const t = useTranslations('DispatcherLiveOps');
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [shipRes, driverRes] = await Promise.all([
          fetch('/api/tracking/all'),
          fetch('/api/fleet/drivers'),
        ]);

        if (shipRes.ok) {
          const shipData = await shipRes.json();
          setShipments(Array.isArray(shipData) ? shipData : []);
        } else {
          console.warn('Failed to fetch shipments:', shipRes.status);
        }

        if (driverRes.ok) {
          const driverJson = await driverRes.json();
          setDrivers(Array.isArray(driverJson?.data) ? driverJson.data : []);
        } else {
          console.warn('Failed to fetch drivers:', driverRes.status);
        }
      } catch {
        setError(t('error_message'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [t]);

  const shipmentColumns = [
    { key: 'trackingRef', header: t('ref_column') },
    {
      key: 'status',
      header: t('status_column'),
      render: (_val: unknown, row: Record<string, unknown>) => <TrackingStatusBadge status={String(row.status ?? '')} />,
    },
    { key: 'bookingId', header: t('booking_id_column') },
    {
      key: 'actions',
      header: t('actions_column'),
      render: (_val: unknown, row: Record<string, unknown>) => (
        <Link href={`/tracking/${String(row.trackingId ?? '')}`} className="text-sm text-blue-600 hover:underline">{t('view_details')}</Link>
      ),
    },
  ];

  const driverColumns = [
    { key: 'name', header: t('name_column') },
    { key: 'phone', header: t('phone_column') },
    {
      key: 'status',
      header: t('status_column'),
      render: (_val: unknown, row: Record<string, unknown>) => (
        <Badge variant={(row.status as string) === 'ACTIVE' ? 'success' : 'neutral'} size="sm">{(row.status as string) || 'Unknown'}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dispatcher" className="text-sm text-muted-foreground hover:text-foreground">
          {t('back_to_dashboard')}
        </Link>
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
      </div>

      {error && (
        <ErrorBanner message={error} onRetry={() => window.location.reload()} />
      )}

      {/* Active Shipments */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{t('active_shipments_card')}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t('active_shipments_desc')}</p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 flex items-center gap-3"><Spinner /><span className="text-sm text-muted-foreground">{t('loading_title')}</span></div>
          ) : (
            <Table columns={shipmentColumns} data={shipments} isLoading={isLoading} emptyMessage={t('no_active_shipments')} striped hoverable />
          )}
        </CardContent>
      </Card>

      {/* Fleet Drivers */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{t('fleet_drivers_card')}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t('fleet_drivers_desc')}</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table columns={driverColumns} data={drivers} isLoading={isLoading} emptyMessage={t('no_drivers_recorded')} striped hoverable />
        </CardContent>
      </Card>
    </div>
  );
}
