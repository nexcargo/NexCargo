// NexCargo Dispatcher — Exceptions
// Per PROMPT 4 route structure: /dispatcher/exceptions
// Capability: Manage fleet activities, resolve operational incidents and delays (nexcargo-ai-eprs.md §4.4)
// C7 Integration: Wired to support tickets API for exception/incident management
// C6-04: i18n — useTranslations for all user-facing strings

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Table } from '@/shared/ui/components/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/components/card';
import { Badge } from '@/shared/ui/components/badge';
import { Spinner, ErrorBanner } from '@/shared/ui';

interface ExceptionRow {
  id: string;
  ticketId?: string;
  category?: string;
  priorityLevel?: string;
  status?: string;
  description?: string;
}

export default function ExceptionsPage() {
  const t = useTranslations('DispatcherExceptions');
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/support/tickets')
      .then((res) => {
        if (!res.ok) {
          console.warn('Failed to fetch exceptions:', res.status);
          return [];
        }
        return res.json().then((d) => Array.isArray(d?.data) ? d.data : []);
      })
      .then((data) => setExceptions(data))
      .catch(() => setError(t('error_message')))
      .finally(() => setIsLoading(false));
  }, [t]);

  const columns = [
    { key: 'ticketId', header: t('ticket_id_col') || 'Ticket ID' },
    { key: 'category', header: t('category_col') || 'Category' },
    {
      key: 'priorityLevel',
      header: t('priority_col'),
      render: (_val: unknown, row: Record<string, unknown>) => {
        const p = String(row.priorityLevel ?? '').toUpperCase();
        const variant: 'danger' | 'warning' | 'info' | 'neutral' =
          p === 'CRITICAL' || p === 'HIGH' ? 'danger' : p === 'MEDIUM' ? 'warning' : 'info';
        return <Badge variant={variant} size="sm">{p}</Badge>;
      },
    },
    {
      key: 'status',
      header: t('status_col'),
      render: (_val: unknown, row: Record<string, unknown>) => (
        <Badge variant={(row.status as string) === t('resolved').toUpperCase() ? 'success' : 'info'} size="sm">{(row.status as string) || t('open_default')}</Badge>
      ),
    },
    {
      key: 'description',
      header: t('description_col'),
      render: (_val: unknown, row: Record<string, unknown>) => (
        <span className="text-sm text-muted-foreground truncate max-w-xs block" title={String(row.description ?? '')}>
          {String(row.description ?? t('no_details'))}
        </span>
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
            <Table columns={columns} data={exceptions} isLoading={isLoading} emptyMessage={t('no_active_exceptions')} striped hoverable />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
