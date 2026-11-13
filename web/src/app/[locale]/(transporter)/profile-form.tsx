// NexCargo I-5 §3B — the editable half of the Transporter profile.
//
// There is no company table in the schema (the I-5 §7 inspection confirmed this), so the operating identity
// the marketplace carries is the fleet register's own: name, region and MOD-014 §4.1 operational status.
// That is what this form writes, through PATCH /api/fleet/[fleetId], where the server re-checks that the
// fleet belongs to the caller's session. Nothing here touches email, role or membership — those come from
// the account and app.marketplace_memberships and are read-only on the profile screen — and no regulatory
// certification field is invented.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/shared/ui';
import { callFleetApi } from './fleet-api';
import { inputClass, labelClass, Outcome, useMutation } from './form-mutation';
import { FLEET_OPERATIONAL_STATUSES } from './presentation';

export interface FleetProfileView {
  fleetId: string;
  name: string;
  region: string;
  operationalStatus: string;
}

export function FleetProfileEditor({ fleet }: { fleet: FleetProfileView }) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();
  const [name, setName] = useState(fleet.name);
  const [region, setRegion] = useState(fleet.region);
  const [operationalStatus, setOperationalStatus] = useState(fleet.operationalStatus);

  const unchanged =
    name.trim() === fleet.name.trim() &&
    region.trim() === fleet.region.trim() &&
    operationalStatus === fleet.operationalStatus;
  const invalid = name.trim() === '';

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || unchanged) return;
    void run(
      () =>
        callFleetApi(`/api/fleet/${fleet.fleetId}`, 'PATCH', {
          name: name.trim(),
          region: region.trim() === '' ? null : region.trim(),
          operationalStatus,
        }),
      t('profile_updated'),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('edit_fleet_heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{t('edit_fleet_hint')}</p>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Outcome error={error} done={done} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`${fleet.fleetId}-name`} className={labelClass}>{t('field_fleet_name')}</label>
              <Input id={`${fleet.fleetId}-name`} className={inputClass} required maxLength={200} value={name}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${fleet.fleetId}-region`} className={labelClass}>{t('field_fleet_region')}</label>
              <Input id={`${fleet.fleetId}-region`} className={inputClass} maxLength={100} value={region}
                placeholder={t('field_fleet_region_placeholder')}
                onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${fleet.fleetId}-status`} className={labelClass}>{t('field_operational_status')}</label>
              <Select id={`${fleet.fleetId}-status`} className={inputClass} value={operationalStatus}
                onChange={(e) => setOperationalStatus(e.target.value)}>
                {FLEET_OPERATIONAL_STATUSES.map((status) => (
                  <option key={status} value={status}>{t(`fleet_status_${status}`)}</option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="submit" size="sm" isLoading={busy} disabled={busy || invalid || unchanged}>
            {busy ? t('updating_profile') : t('update_profile_submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
