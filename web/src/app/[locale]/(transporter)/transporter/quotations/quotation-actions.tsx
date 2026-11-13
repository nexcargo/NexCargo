// NexCargo I-5 §3F — withdraw and resubmit a quotation through the existing MOD-001 route.
// The body carries only the explicit lifecycle transition; the route re-validates it against the offer
// state machine and the offers RLS policy decides whether the row belongs to this session. So a state the
// lifecycle forbids, or another transporter's row, is refused server-side rather than hidden here.
// Amendment is deliberately absent: MOD-001 allows a submitted offer to be withdrawn, not edited.

'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui';
import { useMutation, Outcome } from '../../form-mutation';
import { callMarketplaceApi } from '../../marketplace-api';

export function QuotationActions({ offerId, status }: { offerId: string; status: string }) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();

  if (status !== 'SUBMITTED' && status !== 'WITHDRAWN') return null;

  const withdrawing = status === 'SUBMITTED';
  const targetStatus = withdrawing ? 'WITHDRAWN' : 'SUBMITTED';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant={withdrawing ? 'outline' : 'primary'}
        isLoading={busy}
        onClick={() => {
          if (withdrawing && !window.confirm(t('confirm_withdraw'))) return;
          void run(
            () =>
              callMarketplaceApi(`/api/marketplace/offers/${offerId}`, 'PATCH', {
                currentStatus: status,
                targetStatus,
              }),
            withdrawing ? t('quotation_withdrawn') : t('quotation_resubmitted'),
          );
        }}
      >
        {busy ? t('submitting') : withdrawing ? t('withdraw_quotation') : t('resubmit_quotation')}
      </Button>
      <Outcome error={error} done={done} />
    </div>
  );
}
