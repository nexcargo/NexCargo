// NexCargo I-5 §3C — fleet and vehicle management.
//
// Three client components, each writing through the MOD-014 routes: POST /api/fleet registers a fleet,
// POST /api/fleet/vehicles registers a vehicle and PATCH /api/fleet/vehicles/[id] declares its status. The
// fleet reference is always one of the caller's own fleets — the page renders the list from the session, the
// form submits the selected id, and the server re-checks ownership under that same session, so no screen can
// be pointed at another Transporter's fleet. Client-side checks are feedback only: every rule re-runs on the
// server. Field vocabularies are the existing MOD-014 enums, so no new status appears in the UI.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Textarea } from '@/shared/ui';
import { callFleetApi } from './fleet-api';
import { inputClass, labelClass, Outcome, useMutation } from './form-mutation';
import { PERMIT_STATUSES, VEHICLE_AVAILABILITY_STATES, VEHICLE_TYPES } from './presentation';

export interface FleetOption {
  fleetId: string;
  name: string;
}

export interface VehicleDraft {
  fleetId: string;
  type: string;
  registrationNumber: string;
  capacityWeightKg: string;
  capacityVolumeM3: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceValidUntil: string;
  licenceJurisdiction: string;
  licencesValidNationwide: boolean;
  crossBorderPermitStatus: string;
  complianceNotes: string;
}

export function FleetRegistrar() {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim() === '') return;
    void run(
      () => callFleetApi('/api/fleet', 'POST', { name: name.trim(), region: region.trim() === '' ? null : region.trim() }),
      t('fleet_created'),
      () => {
        setName('');
        setRegion('');
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('create_fleet_heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{t('create_fleet_hint')}</p>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Outcome error={error} done={done} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fleet-name" className={labelClass}>{t('field_fleet_name')}</label>
              <Input id="fleet-name" className={inputClass} required value={name} maxLength={200}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="fleet-region" className={labelClass}>{t('field_fleet_region')}</label>
              <Input id="fleet-region" className={inputClass} value={region} maxLength={100}
                placeholder={t('field_fleet_region_placeholder')}
                onChange={(e) => setRegion(e.target.value)} />
            </div>
          </div>
          <Button type="submit" size="sm" isLoading={busy} disabled={busy || name.trim() === ''}>
            {busy ? t('creating_fleet') : t('create_fleet_submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const EMPTY_VEHICLE: VehicleDraft = {
  fleetId: '',
  type: VEHICLE_TYPES[0],
  registrationNumber: '',
  capacityWeightKg: '',
  capacityVolumeM3: '',
  insuranceProvider: '',
  insurancePolicyNumber: '',
  insuranceValidUntil: '',
  licenceJurisdiction: '',
  licencesValidNationwide: true,
  crossBorderPermitStatus: 'NONE',
  complianceNotes: '',
};

export function VehicleRegistrar({ fleets }: { fleets: FleetOption[] }) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();
  const [draft, setDraft] = useState<VehicleDraft>({ ...EMPTY_VEHICLE, fleetId: fleets[0]?.fleetId ?? '' });

  function set<K extends keyof VehicleDraft>(key: K, value: VehicleDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const weight = Number(draft.capacityWeightKg);
  const missing =
    draft.fleetId === '' ||
    draft.registrationNumber.trim() === '' ||
    draft.capacityWeightKg.trim() === '' ||
    !Number.isFinite(weight) ||
    weight <= 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (missing) return;
    const jurisdictionIsMozambique = draft.licenceJurisdiction.trim().toLowerCase() === 'mozambique';
    void run(
      () =>
        callFleetApi('/api/fleet/vehicles', 'POST', {
          fleetId: draft.fleetId,
          type: draft.type,
          registrationNumber: draft.registrationNumber.trim(),
          capacityWeightKg: weight,
          capacityVolumeM3: draft.capacityVolumeM3.trim() === '' ? null : Number(draft.capacityVolumeM3),
          insuranceProvider: draft.insuranceProvider.trim() === '' ? null : draft.insuranceProvider.trim(),
          insurancePolicyNumber: draft.insurancePolicyNumber.trim() === '' ? null : draft.insurancePolicyNumber.trim(),
          insuranceValidUntil: draft.insuranceValidUntil === '' ? null : draft.insuranceValidUntil,
          licenceJurisdiction: draft.licenceJurisdiction.trim() === '' ? null : draft.licenceJurisdiction.trim(),
          // MOD-014 §4.2: a Mozambique licence is valid nationwide, so the rule is enforced before the call.
          licencesValidNationwide: jurisdictionIsMozambique ? true : draft.licencesValidNationwide,
          crossBorderPermitStatus: draft.crossBorderPermitStatus,
          complianceNotes: draft.complianceNotes.trim() === '' ? null : draft.complianceNotes.trim(),
        }),
      t('vehicle_registered'),
      () => setDraft({ ...EMPTY_VEHICLE, fleetId: draft.fleetId }),
    );
  }

  if (fleets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('register_vehicle_heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">{t('register_vehicle_needs_fleet')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('register_vehicle_heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Outcome error={error} done={done} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vehicle-fleet" className={labelClass}>{t('field_fleet')}</label>
              <Select id="vehicle-fleet" className={inputClass} value={draft.fleetId} required
                onChange={(e) => set('fleetId', e.target.value)}>
                {fleets.map((fleet) => (
                  <option key={fleet.fleetId} value={fleet.fleetId}>{fleet.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="vehicle-type" className={labelClass}>{t('field_vehicle_type')}</label>
              <Select id="vehicle-type" className={inputClass} value={draft.type}
                onChange={(e) => set('type', e.target.value)}>
                {VEHICLE_TYPES.map((type) => (
                  <option key={type} value={type}>{t(`vehicle_${type}`)}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="vehicle-registration" className={labelClass}>{t('field_registration_number')}</label>
              <Input id="vehicle-registration" className={inputClass} required maxLength={50}
                value={draft.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} />
            </div>
            <div>
              <label htmlFor="vehicle-weight" className={labelClass}>{t('field_capacity_weight_kg')}</label>
              <Input id="vehicle-weight" type="number" min="0" step="any" className={inputClass} required
                value={draft.capacityWeightKg} onChange={(e) => set('capacityWeightKg', e.target.value)} />
            </div>
            <div>
              <label htmlFor="vehicle-volume" className={labelClass}>{t('field_capacity_volume_m3')}</label>
              <Input id="vehicle-volume" type="number" min="0" step="any" className={inputClass}
                value={draft.capacityVolumeM3} onChange={(e) => set('capacityVolumeM3', e.target.value)} />
            </div>
            <div>
              <label htmlFor="vehicle-permit" className={labelClass}>{t('field_permit_status')}</label>
              <Select id="vehicle-permit" className={inputClass} value={draft.crossBorderPermitStatus}
                onChange={(e) => set('crossBorderPermitStatus', e.target.value)}>
                {PERMIT_STATUSES.map((status) => (
                  <option key={status} value={status}>{t(`permit_${status}`)}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="vehicle-insurer" className={labelClass}>{t('field_insurance_provider')}</label>
              <Input id="vehicle-insurer" className={inputClass} maxLength={200}
                value={draft.insuranceProvider} onChange={(e) => set('insuranceProvider', e.target.value)} />
            </div>
            <div>
              <label htmlFor="vehicle-policy" className={labelClass}>{t('field_insurance_policy_number')}</label>
              <Input id="vehicle-policy" className={inputClass} maxLength={100}
                value={draft.insurancePolicyNumber} onChange={(e) => set('insurancePolicyNumber', e.target.value)} />
            </div>
            <div>
              <label htmlFor="vehicle-insurance-until" className={labelClass}>{t('field_insurance_valid_until')}</label>
              <Input id="vehicle-insurance-until" type="date" className={inputClass}
                value={draft.insuranceValidUntil} onChange={(e) => set('insuranceValidUntil', e.target.value)} />
            </div>
            <div>
              <label htmlFor="vehicle-jurisdiction" className={labelClass}>{t('field_licence_jurisdiction')}</label>
              <Input id="vehicle-jurisdiction" className={inputClass} maxLength={100}
                value={draft.licenceJurisdiction} onChange={(e) => set('licenceJurisdiction', e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 text-[#1A5C9E] dark:border-zinc-600"
              checked={draft.licencesValidNationwide}
              onChange={(e) => set('licencesValidNationwide', e.target.checked)}
            />
            {t('field_licences_valid_nationwide')}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('mozambique_licence_hint')}</p>

          <div>
            <label htmlFor="vehicle-notes" className={labelClass}>{t('field_compliance_notes')}</label>
            <Textarea id="vehicle-notes" rows={2} className={inputClass} value={draft.complianceNotes}
              onChange={(e) => set('complianceNotes', e.target.value)} />
          </div>

          <Button type="submit" size="sm" isLoading={busy} disabled={busy || missing}>
            {busy ? t('registering_vehicle') : t('register_vehicle_submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export interface VehicleStatusView {
  vehicleId: string;
  availabilityState: string;
  crossBorderPermitStatus: string;
  complianceNotes: string;
}

export function VehicleStatusEditor({ vehicle }: { vehicle: VehicleStatusView }) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();
  const [availabilityState, setAvailabilityState] = useState(vehicle.availabilityState);
  const [permit, setPermit] = useState(vehicle.crossBorderPermitStatus);
  const [notes, setNotes] = useState(vehicle.complianceNotes);

  const unchanged =
    availabilityState === vehicle.availabilityState &&
    permit === vehicle.crossBorderPermitStatus &&
    notes.trim() === vehicle.complianceNotes.trim();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (unchanged) return;
    void run(() =>
      callFleetApi(`/api/fleet/vehicles/${vehicle.vehicleId}`, 'PATCH', {
        availabilityState,
        crossBorderPermitStatus: permit,
        complianceNotes: notes.trim(),
      }), t('vehicle_updated'));
  }

  return (
    <form className="space-y-2" onSubmit={submit} noValidate>
      <Outcome error={error} done={done} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${vehicle.vehicleId}-state`} className={labelClass}>{t('field_availability_state')}</label>
          <Select id={`${vehicle.vehicleId}-state`} className={inputClass} value={availabilityState}
            onChange={(e) => setAvailabilityState(e.target.value)}>
            {VEHICLE_AVAILABILITY_STATES.map((state) => (
              <option key={state} value={state}>{t(`vehicle_state_${state}`)}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${vehicle.vehicleId}-permit`} className={labelClass}>{t('field_permit_status')}</label>
          <Select id={`${vehicle.vehicleId}-permit`} className={inputClass} value={permit}
            onChange={(e) => setPermit(e.target.value)}>
            {PERMIT_STATUSES.map((status) => (
              <option key={status} value={status}>{t(`permit_${status}`)}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <label htmlFor={`${vehicle.vehicleId}-notes`} className={labelClass}>{t('field_compliance_notes')}</label>
        <Input id={`${vehicle.vehicleId}-notes`} className={inputClass} value={notes}
          onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" size="sm" variant="outline" isLoading={busy} disabled={busy || unchanged}>
        {busy ? t('updating_vehicle') : t('update_vehicle_submit')}
      </Button>
    </form>
  );
}
