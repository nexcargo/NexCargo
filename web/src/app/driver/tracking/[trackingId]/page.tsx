// NexCargo — Driver Tracking Interface
// C7-001 Phase 2 — Tracking UI / Driver Experience
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GPSToggleSwitch } from '@/shared/ui/components/tracking/gps-toggle-switch';
import { PODUploadModal } from '@/shared/ui/components/tracking/pod-upload-modal';
import { TrackingTimeline, type TimelineEvent } from '@/shared/ui/components/tracking/timeline';
import { TrackingStatusBadge } from '@/shared/ui/components/tracking/status-badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/components/card';
import { Button } from '@/shared/ui/components/button';
import { Spinner } from '@/shared/ui/components/spinner';

export default function DriverTrackingPage({ params }: { params: { trackingId: string } }) {
  const [showPOD, setShowPOD] = useState(false);
  const [detail, setDetail] = useState<{ status: string; trackingRef: string; recentEvents: Array<{ eventType: string; stateTo?: string; source?: string; timestamp: string }>; lastKnownLocation: { latitude?: number; longitude?: number; timestamp: string } | null } | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tracking/${params.trackingId}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        setEvents((data.recentEvents || []).map((e: any) => ({ id: `evt-${crypto.randomUUID()}`, ...e })));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [params.trackingId]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Spinner /></div>;
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/driver" className="text-xs text-muted-foreground">← Home</Link>
        {detail && <TrackingStatusBadge status={detail.status} />}
      </div>

      {/* Shipment info */}
      {detail && (
        <div>
          <h2 className="font-semibold text-lg mb-1">{detail.trackingRef}</h2>
          {events.length > 0 && (
            <TrackingTimeline events={events.slice(-5)} isLoading={false} className="mb-4" />
          )}
        </div>
      )}

      {/* GPS Toggle */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">GPS Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <GPSToggleSwitch trackingId={params.trackingId} />
        </CardContent>
      </Card>

      {/* POD Upload */}
      {showPOD ? (
        <PODUploadModal
          trackingId={params.trackingId}
          lastKnownLocation={detail?.lastKnownLocation ?? undefined}
          onClose={() => setShowPOD(false)}
        />
      ) : (
        <Button onClick={() => setShowPOD(true)} variant="primary" className="w-full">
          Submit Proof of Delivery
        </Button>
      )}
    </div>
  );
}
