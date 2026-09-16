// NexCargo — POD Upload Modal Component
// C7-001 Phase 2 — Tracking UI / Driver Experience
// File picker for signature image, photo uploads, GPS confirmation, recipient name input

'use client';

import React, { useState, useRef, type ChangeEvent } from 'react';
import { cn } from '@/shared/ui/utils';
import { Button } from '../button';
import { Card, CardContent, CardHeader, CardTitle } from '../card';
import { useToast } from '../toast';
import { Spinner } from '../spinner';

export interface PODUploadModalProps {
  trackingId: string;
  lastKnownLocation?: { latitude?: number | undefined; longitude?: number | undefined };
  onClose?: () => void;
}

export function PODUploadModal({ trackingId, lastKnownLocation, onClose }: PODUploadModalProps) {
  const [recipientName, setRecipientName] = useState('');
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();
  const signatureRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);

  const handleSignatureChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSignatureFile(file);
  };

  const handlePhotosChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!signatureFile) {
      addToast('Signature image is required.', 'error');
      return;
    }
    if (!recipientName.trim()) {
      addToast('Recipient name is required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('signature', signatureFile.name);
      formData.append('recipientName', recipientName.trim());
      for (const photo of photoFiles) {
        formData.append('photos', photo.name);
      }
      if (lastKnownLocation?.latitude != null && lastKnownLocation?.longitude != null) {
        formData.append('gpsLatitude', String(lastKnownLocation.latitude));
        formData.append('gpsLongitude', String(lastKnownLocation.longitude));
      }

      const res = await fetch(`/api/tracking/${trackingId}/pod`, {
        method: 'POST',
        body: JSON.stringify({
          signatureRef: signatureFile.name,
          recipientName: recipientName.trim(),
          photoRefs: photoFiles.map((f) => f.name),
          gpsLatitude: lastKnownLocation?.latitude ?? null,
          gpsLongitude: lastKnownLocation?.longitude ?? null,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? 'Failed to submit POD');
      }

      addToast('Proof of Delivery submitted successfully.', 'success');
      onClose?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit POD.';
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Submit Proof of Delivery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Recipient Name */}
        <div>
          <label htmlFor="pod-recipient" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Recipient Name *
          </label>
          <input
            id="pod-recipient"
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Full name of receiving party"
            className="w-full h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Signature Image */}
        <div>
          <label htmlFor="pod-signature" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Signature Image *
          </label>
          <input
            ref={signatureRef}
            id="pod-signature"
            type="file"
            accept="image/*"
            onChange={handleSignatureChange}
            className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
          />
          {signatureFile && (
            <p className="mt-1 text-xs text-muted-foreground">{signatureFile.name}</p>
          )}
        </div>

        {/* Photo Uploads */}
        <div>
          <label htmlFor="pod-photos" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Additional Photos
          </label>
          <input
            ref={photosRef}
            id="pod-photos"
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosChange}
            className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
          />
          {photoFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {photoFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded px-2 py-1">
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="text-zinc-400 hover:text-red-500"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GPS Confirmation */}
        {lastKnownLocation?.latitude != null && lastKnownLocation?.longitude != null && (
          <div className="rounded-lg bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <span className="font-medium">GPS Coordinates:</span>{' '}
            {lastKnownLocation.latitude.toFixed(6)}, {lastKnownLocation.longitude.toFixed(6)}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSubmit} disabled={isSubmitting} variant="primary">
            {isSubmitting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Submitting...
              </>
            ) : (
              'Submit POD'
            )}
          </Button>
          {onClose && (
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
