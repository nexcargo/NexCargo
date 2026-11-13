// NexCargo I-5 §3H — an authorized tracking transition.
// The options are the ones the MOD-003 state machine permits from the current state, and the POST goes to the
// existing route, which re-validates the transition and calls the SECURITY DEFINER RPC that checks this
// session is the booking's transporter and writes the audit event. Nothing here can set an arbitrary status.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Select } from '@/shared/ui';
import { callMarketplaceApi } from '../../marketplace-api';
import { Outcome, inputClass, labelClass, useMutation } from '../../form-mutation';

export function StatusUpdateForm({
  trackingId,
  options,
}: {
  trackingId: string;
  options: string[];
}) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();
  const [target, setTarget] = useState(options[0] ?? '');

  if (options.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('operation_no_transitions')}</p>;
  }

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !target) return;
        void run(
          () =>
            callMarketplaceApi(`/api/tracking/${trackingId}/status`, 'POST', {
              targetStatus: target,
              sourceModule: 'MOD-003',
            }),
          t('operation_status_updated'),
        );
      }}
    >
      <div>
        <label className={labelClass} htmlFor="operation-target-status">
          {t('field_target_status')}
        </label>
        <Select
          id="operation-target-status"
          className={inputClass}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {t(`tracking_status_${option}`)}
            </option>
          ))}
        </Select>
      </div>

      <Outcome error={error} done={done} />

      <Button type="submit" size="sm" isLoading={busy}>
        {busy ? t('updating_status') : t('update_status_submit')}
      </Button>
    </form>
  );
}