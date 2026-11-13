// NexCargo I-5 §3D — the Transporter's driver register.
//
// A Driver here is a row in the Transporter's own fleet register (logistics_schema.drivers), never a
// marketplace account: the register form has no email, no role and no platform-account field, because the
// route refuses `platformUserId` outright. Linking a person to a platform account is the I-2 operational
// delegation mechanism, which is a separate, bounded and revocable act — so it is not offered here.
// Status vocabularies are the MOD-014 §4.3 sets the live CHECK constraints accept. Client-side checks are
// feedback only; the same rules re-run on the server, which re-checks fleet ownership under the caller's session.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/shared/ui';
import { callFleetApi } from './fleet-api';
import { inputClass, labelClass, Outcome, useMutation } from './form-mutation';
import { DRIVER_AVAILABILITY_STATES, DRIVER_CERTIFICATION_STATUSES } from './presentation';
import type { FleetOption } from './fleet-manager';

export interface DriverStatusView {
  driverId: string;
  certificationStatus: string;
  availabilityState: string;
  licenseExpiryDate: string | null;
}

interface DriverDraft {
  fleetId: string;
  firstName: string;
  lastName: string;
  licenseType: string;
  licenseNumber: string;
  licenseExpiryDate: string;
  contactNumber: string;
  certificationStatus: string;
  availabilityState: string;
}

const EMPTY_DRIVER: DriverDraft = {
  fleetId: '',
  firstName: '',
  lastName: '',
  licenseType: '',
  licenseNumber: '',
  licenseExpiryDate: '',
  contactNumber: '',
  certificationStatus: 'PENDING',
  availabilityState: 'AVAILABLE',
};

export function DriverRegistrar({ fleets }: { fleets: FleetOption[] }) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();
  const [draft, setDraft] = useState<DriverDraft>({ ...EMPTY_DRIVER, fleetId: fleets[0]?.fleetId ?? '' });

  function set<K extends keyof DriverDraft>(key: K, value: DriverDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const missing = draft.fleetId === '' || draft.firstName.trim() === '' || draft.lastName.trim() === '';

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (missing) return;
    const optional = (value: string) => (value.trim() === '' ? null : value.trim());
    void run(
      () =>
        callFleetApi('/api/fleet/drivers', 'POST', {
          fleetId: draft.fleetId,
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          licenseType: optional(draft.licenseType),
          licenseNumber: optional(draft.licenseNumber),
          licenseExpiryDate: optional(draft.licenseExpiryDate),
          contactNumber: optional(draft.contactNumber),
          certificationStatus: draft.certificationStatus,
          availabilityState: draft.availabilityState,
        }),
      t('driver_created'),
      () => setDraft({ ...EMPTY_DRIVER, fleetId: draft.fleetId }),
    );
  }

  if (fleets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('register_driver_heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">{t('register_driver_needs_fleet')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('register_driver_heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{t('register_driver_hint')}</p>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Outcome error={error} done={done} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="driver-fleet" className={labelClass}>{t('field_fleet')}</label>
              <Select id="driver-fleet" className={inputClass} required value={draft.fleetId}
                onChange={(e) => set('fleetId', e.target.value)}>
                {fleets.map((fleet) => (
                  <option key={fleet.fleetId} value={fleet.fleetId}>{fleet.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="driver-contact" className={labelClass}>{t('field_contact_number')}</label>
              <Input id="driver-contact" className={inputClass} maxLength={30} value={draft.contactNumber}
                placeholder={t('field_contact_number_placeholder')}
                onChange={(e) => set('contactNumber', e.target.value)} />
            </div>
            <div>
              <label htmlFor="driver-first-name" className={labelClass}>{t('field_first_name')}</label>
              <Input id="driver-first-name" className={inputClass} required maxLength={100}
                value={draft.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div>
              <label htmlFor="driver-last-name" className={labelClass}>{t('field_last_name')}</label>
              <Input id="driver-last-name" className={inputClass} required maxLength={100}
                value={draft.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
            <div>
              <label htmlFor="driver-license-type" className={labelClass}>{t('field_license_type')}</label>
              <Input id="driver-license-type" className={inputClass} maxLength={50} value={draft.licenseType}
                onChange={(e) => set('licenseType', e.target.value)} />
            </div>
            <div>
              <label htmlFor="driver-license-number" className={labelClass}>{t('field_license_number')}</label>
              <Input id="driver-license-number" className={inputClass} maxLength={100}
                value={draft.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} />
            </div>
            <div>
              <label htmlFor="driver-license-expiry" className={labelClass}>{t('field_license_expiry_date')}</label>
              <Input id="driver-license-expiry" type="date" className={inputClass}
                value={draft.licenseExpiryDate} onChange={(e) => set('licenseExpiryDate', e.target.value)} />
            </div>
            <div>
              <label htmlFor="driver-certification" className={labelClass}>{t('field_certification_status')}</label>
              <Select id="driver-certification" className={inputClass} value={draft.certificationStatus}
                onChange={(e) => set('certificationStatus', e.target.value)}>
                {DRIVER_CERTIFICATION_STATUSES.map((status) => (
                  <option key={status} value={status}>{t(`driver_cert_${status}`)}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="driver-availability" className={labelClass}>{t('field_driver_availability')}</label>
              <Select id="driver-availability" className={inputClass} value={draft.availabilityState}
                onChange={(e) => set('availabilityState', e.target.value)}>
                {DRIVER_AVAILABILITY_STATES.map((state) => (
                  <option key={state} value={state}>{t(`driver_state_${state}`)}</option>
                ))}
              </Select>
            </div>
          </div>

          <Button type="submit" size="sm" isLoading={busy} disabled={busy || missing}>
            {busy ? t('registering_driver') : t('register_driver_submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * The three driver attributes the governed PATCH accepts. A Driver whose licence has no recorded expiry
 * starts the field empty; submitting it blank clears the date rather than keeping the old one.
 */
export function DriverStatusEditor({ driver }: { driver: DriverStatusView }) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();
  const [certificationStatus, setCertificationStatus] = useState(driver.certificationStatus);
  const [availabilityState, setAvailabilityState] = useState(driver.availabilityState);
  const [expiry, setExpiry] = useState(driver.licenseExpiryDate ?? '');

  const unchanged =
    certificationStatus === driver.certificationStatus &&
    availabilityState === driver.availabilityState &&
    expiry === (driver.licenseExpiryDate ?? '');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (unchanged) return;
    void run(
      () =>
        callFleetApi(`/api/fleet/drivers/${driver.driverId}`, 'PATCH', {
          certificationStatus,
          availabilityState,
          licenseExpiryDate: expiry === '' ? null : expiry,
        }),
      t('driver_updated'),
    );
  }

  return (
    <form className="space-y-2" onSubmit={submit} noValidate>
      <Outcome error={error} done={done} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <label htmlFor={`${driver.driverId}-cert`} className={labelClass}>{t('field_certification_status')}</label>
          <Select id={`${driver.driverId}-cert`} className={inputClass} value={certificationStatus}
            onChange={(e) => setCertificationStatus(e.target.value)}>
            {DRIVER_CERTIFICATION_STATUSES.map((status) => (
              <option key={status} value={status}>{t(`driver_cert_${status}`)}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${driver.driverId}-availability`} className={labelClass}>{t('field_driver_availability')}</label>
          <Select id={`${driver.driverId}-availability`} className={inputClass} value={availabilityState}
            onChange={(e) => setAvailabilityState(e.target.value)}>
            {DRIVER_AVAILABILITY_STATES.map((state) => (
              <option key={state} value={state}>{t(`driver_state_${state}`)}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${driver.driverId}-expiry`} className={labelClass}>{t('field_license_expiry_date')}</label>
          <Input id={`${driver.driverId}-expiry`} type="date" className={inputClass} value={expiry}
            onChange={(e) => setExpiry(e.target.value)} />
        </div>
      </div>
      <Button type="submit" size="sm" variant="outline" isLoading={busy} disabled={busy || unchanged}>
        {busy ? t('updating_driver') : t('update_driver_submit')}
      </Button>
    </form>
  );
}
