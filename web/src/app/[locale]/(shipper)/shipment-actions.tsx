// NexCargo I-4 §3C — Shipment lifecycle actions.
// Mutations go through the existing REST routes with same-origin credentials, so authorization,
// ownership and transition rules are enforced by the one implementation that already exists.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ErrorBanner } from '@/shared/ui';

interface ShipmentActionsProps {
  listingId: string;
  status: string;
}

export function ShipmentActions({ listingId, status }: ShipmentActionsProps) {
  const t = useTranslations('ShipperDashboard');
  const router = useRouter();
  const [busy, setBusy] = useState<'publish' | 'cancel' | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function patch(body: Record<string, unknown>) {
    const response = await fetch(`/api/marketplace/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.data?.error ?? payload?.error ?? `HTTP ${response.status}`);
    }
    return payload;
  }

  async function run(action: 'publish' | 'cancel', body: Record<string, unknown>, successText: string) {
    setBusy(action);
    setNotice(null);
    try {
      await patch(body);
      setNotice({ kind: 'success', text: successText });
      router.refresh();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  }

  if (status !== 'DRAFT' && status !== 'PUBLISHED') return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === 'DRAFT' && (
          <Button
            size="sm"
            isLoading={busy === 'publish'}
            onClick={() => run('publish', { action: 'publish' }, t('published_success'))}
          >
            {busy === 'publish' ? t('publishing') : t('action_publish')}
          </Button>
        )}
        {status === 'PUBLISHED' && (
          <Button
            size="sm"
            variant="danger"
            isLoading={busy === 'cancel'}
            onClick={() => {
              if (window.confirm(t('cancel_confirm'))) {
                void run('cancel', { targetStatus: 'CANCELLED' }, t('cancelled_success'));
              }
            }}
          >
            {busy === 'cancel' ? t('cancelling') : t('action_cancel')}
          </Button>
        )}
      </div>

      {notice?.kind === 'success' && (
        <p role="status" className="text-sm text-[#0F8B7A] dark:text-teal-400">{notice.text}</p>
      )}
      {notice?.kind === 'error' && <ErrorBanner message={notice.text} />}
    </div>
  );
}
