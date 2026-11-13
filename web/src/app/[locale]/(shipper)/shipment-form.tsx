// NexCargo I-4 §3B — Shipment creation and publication form.
// Client-side validation mirrors the MOD-001 §5.1 canonical rules; the server re-validates
// through validateListingRequiredFields / validateTimeWindow, so the client copy is feedback only.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardHeader, CardTitle, ErrorBanner, Input, Select, Textarea } from '@/shared/ui';
import { CargoType } from '@/modules/mod-001-marketplace/domain/enums';
import { VehicleType } from '@/shared/types/enums';

export interface ShipmentDraft {
  title: string;
  description: string;
  origin: { address: string; latitude: number | null; longitude: number | null };
  destination: { address: string; latitude: number | null; longitude: number | null };
  cargoType: string;
  weightKg: number | null;
  volumeM3: number | null;
  pricingModel: string;
  earliestPickup: string;
  latestDelivery: string;
  acceptedVehicleTypes: string[];
}

const EMPTY_DRAFT: ShipmentDraft = {
  title: '',
  description: '',
  origin: { address: '', latitude: null, longitude: null },
  destination: { address: '', latitude: null, longitude: null },
  cargoType: CargoType.GENERAL,
  weightKg: null,
  volumeM3: null,
  pricingModel: 'FIXED',
  earliestPickup: '',
  latestDelivery: '',
  acceptedVehicleTypes: [],
};

interface ShipmentFormProps {
  locale: string;
  listingId?: string;
  initial?: ShipmentDraft;
}

export function ShipmentForm({ locale, listingId, initial }: ShipmentFormProps) {
  const t = useTranslations('ShipperDashboard');
  const router = useRouter();
  const isEdit = Boolean(listingId);

  const [draft, setDraft] = useState<ShipmentDraft>(initial ?? EMPTY_DRAFT);
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'draft' | 'publish'>(null);

  function set<K extends keyof ShipmentDraft>(key: K, value: ShipmentDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setPoint(which: 'origin' | 'destination', key: 'address' | 'latitude' | 'longitude', value: string) {
    setDraft((prev) => {
      const point = { ...prev[which] };
      if (key === 'address') {
        point.address = value;
      } else {
        const parsed = value === '' ? null : Number(value);
        point[key] = parsed !== null && Number.isFinite(parsed) ? parsed : null;
      }
      return { ...prev, [which]: point };
    });
  }

  function toggleVehicle(vehicle: string) {
    setDraft((prev) => ({
      ...prev,
      acceptedVehicleTypes: prev.acceptedVehicleTypes.includes(vehicle)
        ? prev.acceptedVehicleTypes.filter((v) => v !== vehicle)
        : [...prev.acceptedVehicleTypes, vehicle],
    }));
  }

  /** Mirrors validateListingRequiredFields + validateTimeWindow. Returns localized messages. */
  function validate(): string[] {
    const found: string[] = [];
    const completePoint = (p: ShipmentDraft['origin']) =>
      p.address.trim() !== '' && p.latitude !== null && p.longitude !== null;

    if (!completePoint(draft.origin)) found.push(t('validation_origin'));
    if (!completePoint(draft.destination)) found.push(t('validation_destination'));
    if (!draft.cargoType) found.push(t('validation_cargo_type'));
    if ((draft.weightKg ?? 0) <= 0 && (draft.volumeM3 ?? 0) <= 0) found.push(t('validation_weight_or_volume'));
    if (!draft.earliestPickup || !draft.latestDelivery) {
      found.push(t('validation_time_window'));
    } else if (new Date(draft.earliestPickup).getTime() >= new Date(draft.latestDelivery).getTime()) {
      found.push(t('validation_time_window'));
    }
    return found;
  }

  function payload() {
    return {
      title: draft.title.trim(),
      description: draft.description.trim(),
      origin: {
        address: draft.origin.address.trim(),
        latitude: draft.origin.latitude,
        longitude: draft.origin.longitude,
      },
      destination: {
        address: draft.destination.address.trim(),
        latitude: draft.destination.latitude,
        longitude: draft.destination.longitude,
      },
      cargoType: draft.cargoType,
      // Sent as null, not 0, when the shipper left it blank: MOD-001 §5.1 requires at least one of
      // weight or volume, and a coerced 0 would satisfy the server rule by accident.
      weightKg: draft.weightKg,
      volumeM3: draft.volumeM3,
      pricingModel: draft.pricingModel,
      timeWindow: {
        earliestPickup: new Date(draft.earliestPickup).toISOString(),
        latestDelivery: new Date(draft.latestDelivery).toISOString(),
      },
      acceptedVehicleTypes: draft.acceptedVehicleTypes,
    };
  }

  async function submit(publish: boolean) {
    setServerError(null);
    const found = validate();
    setErrors(found);
    if (found.length > 0) return;

    setBusy(publish ? 'publish' : 'draft');
    try {
      const body = payload();
      let id = listingId;

      if (isEdit) {
        const response = await fetch(`/api/marketplace/listings/${listingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', ...body }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
      } else {
        const response = await fetch('/api/marketplace/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const created = await response.json().catch(() => null);
        if (!response.ok) throw new Error(created?.data?.error ?? `HTTP ${response.status}`);
        id = created?.data?.listingId as string | undefined;
      }

      if (publish && id) {
        const response = await fetch(`/api/marketplace/listings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'publish' }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
      }

      router.push(id ? `/${locale}/shipper/shipments/${id}` : `/${locale}/shipper/shipments`);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : String(error));
      setBusy(null);
    }
  }

  async function errorMessage(response: Response): Promise<string> {
    const parsed = await response.json().catch(() => null);
    return parsed?.data?.error ?? parsed?.error ?? `HTTP ${response.status}`;
  }

  const inputClass = 'block w-full';
  const labelClass = 'block text-sm font-medium text-[#0A1628] dark:text-white mb-1';

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
      noValidate
    >
      {errors.length > 0 && (
        <ErrorBanner
          message={
            <span>
              <strong className="block">{t('form_errors_title')}</strong>
              <ul className="mt-1 list-disc pl-5">
                {errors.map((message) => <li key={message}>{message}</li>)}
              </ul>
            </span>
          }
        />
      )}
      {serverError && <ErrorBanner message={serverError} />}

      <Card>
        <CardHeader><CardTitle>{t('section_route')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="title" className={labelClass}>{t('field_title')}</label>
            <Input id="title" className={inputClass} value={draft.title} placeholder={t('field_title_placeholder')}
              onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>{t('field_description')}</label>
            <Textarea id="description" rows={3} className={inputClass} value={draft.description}
              placeholder={t('field_description_placeholder')}
              onChange={(e) => set('description', e.target.value)} />
          </div>

          {(['origin', 'destination'] as const).map((which) => (
            <fieldset key={which} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <legend className={labelClass}>
                {which === 'origin' ? t('summary_origin') : t('summary_destination')}
              </legend>
              <div className="sm:col-span-3">
                <label htmlFor={`${which}-address`} className={labelClass}>
                  {which === 'origin' ? t('field_origin_address') : t('field_destination_address')}
                </label>
                <Input id={`${which}-address`} className={inputClass} value={draft[which].address} required
                  onChange={(e) => setPoint(which, 'address', e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${which}-lat`} className={labelClass}>
                  {which === 'origin' ? t('field_origin_latitude') : t('field_destination_latitude')}
                </label>
                <Input id={`${which}-lat`} type="number" step="any" className={inputClass} required
                  value={draft[which].latitude ?? ''}
                  onChange={(e) => setPoint(which, 'latitude', e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${which}-lon`} className={labelClass}>
                  {which === 'origin' ? t('field_origin_longitude') : t('field_destination_longitude')}
                </label>
                <Input id={`${which}-lon`} type="number" step="any" className={inputClass} required
                  value={draft[which].longitude ?? ''}
                  onChange={(e) => setPoint(which, 'longitude', e.target.value)} />
              </div>
            </fieldset>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('section_cargo')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="cargoType" className={labelClass}>{t('field_cargo_type')}</label>
            <Select id="cargoType" className={inputClass} value={draft.cargoType} required
              onChange={(e) => set('cargoType', e.target.value)}>
              {Object.values(CargoType).map((value) => (
                <option key={value} value={value}>{t(`cargo_${value}`)}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="weightKg" className={labelClass}>{t('field_weight_kg')}</label>
            <Input id="weightKg" type="number" min="0" step="any" className={inputClass}
              value={draft.weightKg ?? ''}
              onChange={(e) => set('weightKg', e.target.value === '' ? null : Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="volumeM3" className={labelClass}>{t('field_volume_m3')}</label>
            <Input id="volumeM3" type="number" min="0" step="any" className={inputClass}
              value={draft.volumeM3 ?? ''}
              onChange={(e) => set('volumeM3', e.target.value === '' ? null : Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="pricingModel" className={labelClass}>{t('field_pricing_model')}</label>
            <Select id="pricingModel" className={inputClass} value={draft.pricingModel}
              onChange={(e) => set('pricingModel', e.target.value)}>
              {['FIXED', 'AUCTION', 'NEGOTIATED'].map((value) => (
                <option key={value} value={value}>{t(`pricing_${value}`)}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('section_schedule')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="earliestPickup" className={labelClass}>{t('field_earliest_pickup')}</label>
            <Input id="earliestPickup" type="datetime-local" className={inputClass} required
              value={draft.earliestPickup}
              onChange={(e) => set('earliestPickup', e.target.value)} />
          </div>
          <div>
            <label htmlFor="latestDelivery" className={labelClass}>{t('field_latest_delivery')}</label>
            <Input id="latestDelivery" type="datetime-local" className={inputClass} required
              value={draft.latestDelivery}
              onChange={(e) => set('latestDelivery', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('section_vehicles')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{t('vehicles_hint')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(VehicleType).map((vehicle) => {
              const value = String(vehicle);
              const checked = draft.acceptedVehicleTypes.includes(value);
              return (
                <label key={value} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 text-[#1A5C9E] dark:border-zinc-600"
                    checked={checked} onChange={() => toggleVehicle(value)} />
                  {t(`vehicle_${value}`)}
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={busy === 'draft'} disabled={busy !== null}>
          {busy === 'draft' ? t('saving') : t('save_draft')}
        </Button>
        {!isEdit && (
          <Button type="button" variant="secondary" isLoading={busy === 'publish'} disabled={busy !== null}
            onClick={() => void submit(true)}>
            {busy === 'publish' ? t('publishing') : t('save_and_publish')}
          </Button>
        )}
      </div>
    </form>
  );
}
