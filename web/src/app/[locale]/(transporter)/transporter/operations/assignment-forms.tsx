// NexCargo I-5 §3C/§3H — assigning this Transporter's own vehicle and driver to an operation.
// The options are the fleet rows the session can already read, and the identifiers sent are the vehicles.id /
// drivers.id primary keys the asset_assignments foreign keys reference. The PATCH goes to the existing MOD-014
// route, whose RLS policy admits an assignment only when the vehicle or driver belongs to a fleet this user
// owns — so assigning another Transporter's asset is refused by the database, not hidden here.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ErrorBanner, Input, Select, Textarea } from '@/shared/ui';
import { callFleetApi } from '../../fleet-api';
import { Outcome, inputClass, labelClass, useMutation } from '../../form-mutation';

export interface AssignmentVehicleOption {
  id: string;
  registrationNumber: string;
  type: string;
}

export interface AssignmentDriverOption {
  id: string;
  name: string;
}

export function AssignmentForm({
  trackingId,
  vehicles,
  drivers,
}: {
  trackingId: string;
  vehicles: AssignmentVehicleOption[];
  drivers: AssignmentDriverOption[];
}) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();

  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [problems, setProblems] = useState<string[]>([]);

  if (vehicles.length === 0 && drivers.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('assignment_needs_assets')}</p>;
  }

  async function submit() {
    const found: string[] = [];
    if (!vehicleId && !driverId) found.push(t('validation_assignment_asset'));
    if (start && end && !(start <= end)) found.push(t('validation_assignment_window'));
    setProblems(found);
    if (found.length > 0) return;

    await run(
      () =>
        callFleetApi('/api/fleet/assignments', 'PATCH', {
          action: 'create',
          shipmentTrackingId: trackingId,
          vehicleId: vehicleId || undefined,
          driverId: driverId || undefined,
          scheduledStart: start ? new Date(start).toISOString() : undefined,
          scheduledEnd: end ? new Date(end).toISOString() : undefined,
          notes: notes.trim() || undefined,
        }),
      t('assignment_created'),
      () => {
        setVehicleId('');
        setDriverId('');
        setStart('');
        setEnd('');
        setNotes('');
      },
    );
  }

  return (
    <form
      className="space-y-4 border-t border-[#E8E6E3] pt-4 dark:border-zinc-800"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) void submit();
      }}
    >
      <p className="text-sm font-medium text-[#0A1628] dark:text-white">{t('assignment_create_heading')}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="assignment-vehicle">
            {t('field_vehicle')}
          </label>
          <Select
            id="assignment-vehicle"
            className={inputClass}
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            <option value="">{t('assignment_no_vehicle')}</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registrationNumber} — {t(`vehicle_${vehicle.type}`)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className={labelClass} htmlFor="assignment-driver">
            {t('field_driver')}
          </label>
          <Select
            id="assignment-driver"
            className={inputClass}
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          >
            <option value="">{t('assignment_no_driver')}</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className={labelClass} htmlFor="assignment-start">
            {t('field_scheduled_start')}
          </label>
          <Input
            id="assignment-start"
            className={inputClass}
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="assignment-end">
            {t('field_scheduled_end')}
          </label>
          <Input
            id="assignment-end"
            className={inputClass}
            type="datetime-local"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="assignment-notes">
          {t('field_notes')}
        </label>
        <Textarea
          id="assignment-notes"
          className={inputClass}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {problems.length > 0 && (
        <ErrorBanner
          message={
            <span>
              <strong className="block">{t('form_errors_title')}</strong>
              <ul className="mt-1 list-disc pl-5">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </span>
          }
        />
      )}

      <Outcome error={error} done={done} />

      <Button type="submit" size="sm" isLoading={busy}>
        {busy ? t('creating_assignment') : t('create_assignment_submit')}
      </Button>
    </form>
  );
}

export function AssignmentStatusForm({
  assignmentId,
  options,
}: {
  assignmentId: string;
  options: string[];
}) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();
  const [target, setTarget] = useState(options[0] ?? '');

  if (options.length === 0) return null;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !target) return;
        void run(
          () => callFleetApi('/api/fleet/assignments', 'PATCH', { action: 'update', id: assignmentId, status: target }),
          t('assignment_updated'),
        );
      }}
    >
      <div>
        <label className={labelClass} htmlFor={`assignment-status-${assignmentId}`}>
          {t('field_assignment_status')}
        </label>
        <Select
          id={`assignment-status-${assignmentId}`}
          className={inputClass}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {t(`assignment_status_${option}`)}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="sm" variant="outline" isLoading={busy}>
        {busy ? t('updating_assignment') : t('update_assignment_submit')}
      </Button>
      <Outcome error={error} done={done} />
    </form>
  );
}