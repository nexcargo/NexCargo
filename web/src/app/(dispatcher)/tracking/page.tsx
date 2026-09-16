// NexCargo — Dispatcher Active Shipments View
// C7-001 Phase 2 — Tracking UI / Driver Experience
// C6-04: i18n — useTranslations for all user-facing strings

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Table } from '@/shared/ui/components/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/components/card';
import { Input, Select } from '@/shared/ui/components/form-controls';
import { Spinner, ErrorBanner } from '@/shared/ui';
import { TrackingStatusBadge } from '@/shared/ui/components/tracking/status-badge';

interface ShipmentRow {
  trackingId: string;
  trackingRef: string;
  status: string;
  bookingId: string;
  contractId?: string;
}

export default function DispatcherTrackingPage() {
  const t = useTranslations('DispatcherTracking');
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllShipments();
  }, []);

  const fetchAllShipments = async () => {
    try {
      const res = await fetch('/api/tracking/all');
      if (!res.ok) {
        console.warn('Failed to fetch tracking data:', res.status);
        return;
      }
      const data = await res.json();
      setShipments(Array.isArray(data) ? data : []);
    } catch {
      setError(t('error_message'));
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = shipments.filter((s) => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (searchQuery && !s.trackingRef.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const columns = [
    { key: 'trackingRef', header: t('ref_column') || 'Reference' },
    {
      key: 'status',
      header: t('status_column'),
      render: (_val: unknown, row: Record<string, unknown>) => <TrackingStatusBadge status={String(row.status ?? '')} />,
    },
    { key: 'bookingId', header: t('booking_id_column') || 'Booking ID' },
    {
      key: 'actions',
      header: '',
      render: (_val: unknown, row: Record<string, unknown>) => (
        <Link href={`/tracking/${String(row.trackingId ?? '')}`} className="text-sm text-blue-600 hover:underline">{t('view_details')}</Link>
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

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{t('card_title')}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('card_desc')}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
            <Input
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={filterStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
            >
              <option value="">{t('all_statuses')}</option>
              <option value="CREATED">{t('created')}</option>
              <option value="BOOKED">{t('booked')}</option>
              <option value="AWAITING_PICKUP">{t('awaiting_pickup')}</option>
              <option value="IN_TRANSIT">{t('in_transit')}</option>
              <option value="DELIVERED">{t('delivered')}</option>
              <option value="COMPLETED">{t('completed')}</option>
            </Select>
          </div>

          {isLoading ? (
            <div className="p-6 flex items-center gap-3"><Spinner /><span className="text-sm text-muted-foreground">{t('loading')}</span></div>
          ) : (
            <Table
              columns={columns}
              data={filtered}
              emptyMessage={t('no_matching')}
              striped
              hoverable
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
