// NexCargo I-5 §3F — quotation preparation.
// The form only ever POSTs to the existing MOD-001 route, which pins transporter_id to the session and
// forces status SUBMITTED, so nothing here can quote as another transporter or pre-accept anything.
// The vehicle options are the fleet rows that already passed the MOD-001 hard filters server-side; picking
// one supplies the declared capacity, which is what the Transporter is committing to move.

'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, ErrorBanner, Input, Select, Textarea } from '@/shared/ui';
import { toDateTimeLocalValue } from '../../presentation';
import { useMutation, Outcome, labelClass, inputClass } from '../../form-mutation';
import { callMarketplaceApi } from '../../marketplace-api';

export interface QuotationVehicleOption {
  vehicleId: string;
  registrationNumber: string;
  type: string;
  capacityWeightKg: number;
  capacityVolumeM3: number | null;
}

export function QuotationForm({
  listingId,
  earliestPickup,
  latestDelivery,
  vehicles,
}: {
  listingId: string;
  earliestPickup: string;
  latestDelivery: string;
  vehicles: QuotationVehicleOption[];
}) {
  const t = useTranslations('TransporterDashboard');
  const locale = useLocale();
  const router = useRouter();
  const { busy, error, done, run } = useMutation();

  const [price, setPrice] = useState('');
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.vehicleId ?? '');
  // Prefilled from the shipper's own window: the Transporter adjusts it, and MOD-001's availability
  // filters then decide at matching time whether the proposal still meets the deadline.
  const [pickupFrom, setPickupFrom] = useState(toDateTimeLocalValue(earliestPickup));
  const [pickupTo, setPickupTo] = useState(toDateTimeLocalValue(earliestPickup));
  const [deliveryAt, setDeliveryAt] = useState(toDateTimeLocalValue(latestDelivery));
  const [notes, setNotes] = useState('');
  const [problems, setProblems] = useState<string[]>([]);

  function validate(): string[] {
    const found: string[] = [];
    if (!(Number(price) > 0)) found.push(t('validation_price'));
    if (!vehicleId) found.push(t('validation_vehicle'));
    if (!pickupFrom || !pickupTo || !deliveryAt) found.push(t('validation_availability'));
    else if (!(pickupFrom <= pickupTo && pickupTo <= deliveryAt)) found.push(t('validation_availability_order'));
    return found;
  }

  async function submit() {
    const vehicle = vehicles.find((candidate) => candidate.vehicleId === vehicleId);
    const found = validate();
    setProblems(found);
    if (found.length > 0 || !vehicle) return;

    await run(
      () =>
        callMarketplaceApi('/api/marketplace/offers', 'POST', {
          listingId,
          priceProposal: Number(price),
          availabilityWindow: {
            earliestPickup: new Date(pickupFrom).toISOString(),
            latestPickup: new Date(pickupTo).toISOString(),
            estimatedDelivery: new Date(deliveryAt).toISOString(),
          },
          vehicleType: vehicle.type,
          declaredCapacity: { maxWeightKg: vehicle.capacityWeightKg, maxVolumeM3: vehicle.capacityVolumeM3 },
          notes: notes.trim() || undefined,
        }),
      t('quotation_submitted'),
      () => {
        setPrice('');
        setNotes('');
        // The Quotations list is where the stored row, its status and the withdraw action live, so it is
        // the durable success surface; this detail page re-reads and swaps the form for the notice anyway.
        router.replace(`/${locale}/transporter/quotations`);
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('quote_prepare_title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="pb-4 text-sm text-zinc-600 dark:text-zinc-400">{t('quote_prepare_intro')}</p>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void submit();
          }}
        >
          <div>
            <label className={labelClass} htmlFor="quotation-vehicle">
              {t('field_vehicle')}
            </label>
            <Select
              id="quotation-vehicle"
              className={inputClass}
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
                  {vehicle.registrationNumber} — {t(`vehicle_${vehicle.type}`)} ({vehicle.capacityWeightKg} kg
                  {vehicle.capacityVolumeM3 ? ` / ${vehicle.capacityVolumeM3} m³` : ''})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className={labelClass} htmlFor="quotation-price">
              {t('field_price_proposal')} (MZN)
            </label>
            <Input
              id="quotation-price"
              className={inputClass}
              type="number"
              min="1"
              step="1"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="quotation-pickup-from">
                {t('field_availability_earliest_pickup')}
              </label>
              <Input
                id="quotation-pickup-from"
                className={inputClass}
                type="datetime-local"
                value={pickupFrom}
                onChange={(event) => setPickupFrom(event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="quotation-pickup-to">
                {t('field_availability_latest_pickup')}
              </label>
              <Input
                id="quotation-pickup-to"
                className={inputClass}
                type="datetime-local"
                value={pickupTo}
                onChange={(event) => setPickupTo(event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="quotation-delivery">
                {t('field_availability_estimated_delivery')}
              </label>
              <Input
                id="quotation-delivery"
                className={inputClass}
                type="datetime-local"
                value={deliveryAt}
                onChange={(event) => setDeliveryAt(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="quotation-notes">
              {t('field_notes')}
            </label>
            <Textarea
              id="quotation-notes"
              className={inputClass}
              rows={3}
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

          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('time_window_advisory')}</p>

          <Button type="submit" disabled={busy}>
            {busy ? t('submitting') : t('submit_quotation')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
