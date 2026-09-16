// NexCargo — Shipper Tracking Detail Page
// C7-001 Phase 2 — Tracking UI / Driver Experience
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrackingTimeline, type TimelineEvent } from '@/shared/ui/components/tracking/timeline';
import { TrackingStatusBadge } from '@/shared/ui/components/tracking/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/components/card';
import { Spinner } from '@/shared/ui/components/spinner';
import { Button } from '@/shared/ui/components/button';

interface TrackingDetailData {
  id: string;
  trackingRef: string;
  status: string;
  activatedAt: string;
  lastUpdated: string;
  recentEvents: Array<{ eventType: string; stateTo?: string; source?: string; timestamp: string }>;
  lastKnownLocation: { latitude?: number; longitude?: number; timestamp: string } | null;
}

export default function ShipperTrackingDetail({ params }: { params: { trackingId: string } }) {
  const [data, setData] = useState<TrackingDetailData | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/tracking/${params.trackingId}`);
        if (!res.ok) return;
        const detail = await res.json();
        setData(detail);
        setEvents((detail.recentEvents || []).map((e: { eventType: string; stateTo?: string; source?: string; timestamp: string }) => ({
          id: crypto.randomUUID(),
          ...e,
        })));
      } catch {
        // error handled by fallback UI
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [params.trackingId]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Spinner /></div>;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground mb-4">Tracking record not found.</p>
        <Button href="/shipper/dashboard" variant="outline">Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link href="/shipper/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-block mb-2">
        ← Back to Dashboard
      </Link>

      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{data.trackingRef}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Activated {new Date(data.activatedAt).toLocaleDateString()}</p>
            </div>
            <TrackingStatusBadge status={data.status} />
          </div>
        </CardHeader>
        {data.lastKnownLocation && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Last known: {data.lastKnownLocation.latitude?.toFixed(6)}, {data.lastKnownLocation.longitude?.toFixed(6)}
              {data.lastKnownLocation.timestamp && ` · ${new Date(data.lastKnownLocation.timestamp).toLocaleString()}`}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Timeline */}
      <TrackingTimeline events={events} isLoading={false} />
    </div>
  );
}
