// NexCargo I-5 §3G — the Transporter's contract acceptance.
// This is the only booking-related write the Transporter area performs. It calls the existing
// PATCH /api/contracts/[id]/accept, whose accept_and_finalize_contract() SECDEF derives the signer from
// auth.uid(), refuses anyone who is not a party to the contract's booking, and records the second signature
// before the contract becomes ACTIVE. The Transporter cannot sign for the Shipper and cannot skip the
// Shipper's confirmation, because no contract exists until the Shipper confirms the booking.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui';
import { callMarketplaceApi } from '../../marketplace-api';
import { Outcome, useMutation } from '../../form-mutation';

export function ContractAcceptAction({ contractId }: { contractId: string }) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        isLoading={busy}
        onClick={() => {
          if (!window.confirm(t('contract_accept_confirm'))) return;
          setServerMessage(null);
          void run(
            async () => {
              const result = await callMarketplaceApi(`/api/contracts/${contractId}/accept`, 'PATCH', {});
              if (typeof result?.message === 'string') setServerMessage(result.message);
            },
            t('contract_accepted'),
          );
        }}
      >
        {busy ? t('contract_accepting') : t('contract_accept_button')}
      </Button>
      <Outcome error={error} done={done} />
      {serverMessage && <p className="text-sm text-zinc-600 dark:text-zinc-400">{serverMessage}</p>}
    </div>
  );
}