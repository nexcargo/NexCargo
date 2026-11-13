// NexCargo I-5 §3H — proof of delivery for an operation.
// The payload is the one the existing MOD-003 route and PodSubmissionService already validate: a recipient,
// a signature reference, at least one photograph reference and a GPS fix. Evidence references point at objects
// already in NexCargo storage; this form does not invent an upload pipeline, because the documents INSERT
// policy does not admit a Transporter upload. Verification stays a platform-role action, so the submitted POD
// is shown as PENDING and nothing here marks it verified or completes the shipment.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ErrorBanner, Input, Textarea } from '@/shared/ui';
import { callMarketplaceApi } from '../../marketplace-api';
import { Outcome, inputClass, labelClass, useMutation } from '../../form-mutation';

export function PodForm({ trackingId, bookingId }: { trackingId: string; bookingId: string }) {
  const t = useTranslations('TransporterDashboard');
  const { busy, error, done, run } = useMutation();

  const [recipientName, setRecipientName] = useState('');
  const [signatureRef, setSignatureRef] = useState('');
  const [photoRefs, setPhotoRefs] = useState('');
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLon, setGpsLon] = useState('');
  const [problems, setProblems] = useState<string[]>([]);

  async function submit() {
    const photos = photoRefs
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const lat = Number(gpsLat);
    const lon = Number(gpsLon);

    const found: string[] = [];
    if (!recipientName.trim()) found.push(t('validation_pod_recipient'));
    if (!signatureRef.trim()) found.push(t('validation_pod_signature'));
    if (photos.length === 0) found.push(t('validation_pod_photos'));
    if (gpsLat.trim() === '' || Number.isNaN(lat) || lat < -90 || lat > 90) found.push(t('validation_pod_latitude'));
    if (gpsLon.trim() === '' || Number.isNaN(lon) || lon < -180 || lon > 180) found.push(t('validation_pod_longitude'));
    setProblems(found);
    if (found.length > 0) return;

    await run(
      () =>
        callMarketplaceApi(`/api/tracking/${trackingId}/pod`, 'POST', {
          bookingId,
          recipientName: recipientName.trim(),
          signatureRef: signatureRef.trim(),
          photoRefs: photos,
          gpsLat: lat,
          gpsLon: lon,
        }),
      t('pod_submitted'),
      () => {
        setRecipientName('');
        setSignatureRef('');
        setPhotoRefs('');
        setGpsLat('');
        setGpsLon('');
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
      <p className="text-sm font-medium text-[#0A1628] dark:text-white">{t('pod_submit_heading')}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="pod-recipient">
            {t('field_pod_recipient')}
          </label>
          <Input
            id="pod-recipient"
            className={inputClass}
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="pod-signature">
            {t('field_pod_signature')}
          </label>
          <Input
            id="pod-signature"
            className={inputClass}
            value={signatureRef}
            onChange={(event) => setSignatureRef(event.target.value)}
            placeholder={t('field_pod_reference_placeholder')}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="pod-lat">
            {t('field_pod_latitude')}
          </label>
          <Input
            id="pod-lat"
            className={inputClass}
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            inputMode="decimal"
            value={gpsLat}
            onChange={(event) => setGpsLat(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="pod-lon">
            {t('field_pod_longitude')}
          </label>
          <Input
            id="pod-lon"
            className={inputClass}
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            inputMode="decimal"
            value={gpsLon}
            onChange={(event) => setGpsLon(event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="pod-photos">
          {t('field_pod_photos')}
        </label>
        <Textarea
          id="pod-photos"
          className={inputClass}
          rows={3}
          value={photoRefs}
          onChange={(event) => setPhotoRefs(event.target.value)}
          placeholder={t('field_pod_photos_placeholder')}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('pod_evidence_hint')}</p>
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
        {busy ? t('submitting_pod') : t('submit_pod')}
      </Button>
    </form>
  );
}