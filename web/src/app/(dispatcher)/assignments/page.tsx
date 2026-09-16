// NexCargo Dispatcher — Assignments
// Per PROMPT 4 §5 route structure: /dispatcher/assignments
// Capability: Allocate shipments and assign vehicles to transport routes (architecture spec nexcargo-ai-eprs.md §4.4)
// C7 Integration: Wired to fleet assignments API
// C6-04: i18n — useTranslations for all user-facing strings

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Table } from '@/shared/ui/components/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/components/card';
import { Spinner, ErrorBanner } from '@/shared/ui';

interface AssignmentRow {
  id: string;
  bookingId?: string;
  driverName?: string;
  vehiclePlate?: string;
  status?: string;
}

export default function AssignmentsPage() {
  const t = useTranslations('DispatcherAssignments');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/assignments')
      .then((res) => {
        if (!res.ok) {
          console.warn('Failed to fetch assignments:', res.status);
          return [];
        }
        return res.json().then((d) => Array.isArray(d?.data) ? d.data : []);
      })
      .then((data) => setAssignments(data))
      .catch(() => setError(t('error_message')))
      .finally(() => setIsLoading(false));
  }, [t]);

  const columns = [
    { key: 'bookingId', header: t('booking_col') },
    { key: 'driverName', header: t('driver_col') },
    { key: 'vehiclePlate', header: t('vehicle_plate_col') },
    {
      key: 'status',
      header: t('status_col'),
      render: (_val: unknown, row: Record<string, unknown>) => (
        <span className="text-sm">{String(row.status ?? t('unassigned'))}</span>
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
          <p className="mt-1 text-sm text-muted-foreground">{t('card_desc')}</p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 flex items-center gap-3"><Spinner /><span className="text-sm text-muted-foreground">{t('loading')}</span></div>
          ) : (
            <Table columns={columns} data={assignments} isLoading={isLoading} emptyMessage={t('no_active_assignments')} striped hoverable />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
