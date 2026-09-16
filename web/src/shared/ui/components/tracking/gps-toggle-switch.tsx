// NexCargo — GPS Toggle Switch Component
// C7-001 Phase 2 — Tracking UI / Driver Experience
// Start/stop indicator with "Last update: X min ago" counter (polling-based, not websocket)

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/shared/ui/utils';
import { Button } from '../button';
import { Badge } from '../badge';
import { Spinner } from '../spinner';
import type { GpsUpdateApiShape } from '@/modules/mod-003-tracking';

export interface GPSToggleSwitchProps {
  trackingId: string;
  className?: string;
}

const POLL_INTERVAL_MS = 60_000; // Poll every 60 seconds for "last update" freshness

export function GPSToggleSwitch({ trackingId, className }: GPSToggleSwitchProps) {
  const [isTracking, setIsTracking] = useState<boolean | null>(null);
  const [lastLocation, setLastLocation] = useState<GpsUpdateApiShape | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(999);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLastLocation = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracking/${trackingId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.lastKnownLocation) {
        setLastLocation(data.lastKnownLocation as GpsUpdateApiShape);
        const ageMs = Date.now() - new Date(data.lastKnownLocation.timestamp).getTime();
        setElapsedMinutes(Math.floor(ageMs / 60_000));
      }
    } catch {
      // Silently fail — polling
    }
  }, [trackingId]);

  useEffect(() => {
    // Initial fetch
    fetchLastLocation();
    // Set up polling
    intervalRef.current = setInterval(fetchLastLocation, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLastLocation]);

  const handleToggle = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const targetStatus = !isTracking ? 'IN_TRANSIT' : 'DELIVERED';
      const res = await fetch(`/api/tracking/${trackingId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus }),
      });
      if (!res.ok) throw new Error('Failed to toggle GPS');
      setIsTracking(!isTracking);
      await fetchLastLocation();
    } catch {
      // Show error via toast from parent
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusText = (): string => {
    if (isTracking === null) return 'Checking status...';
    return isTracking ? 'Tracking Active' : 'Tracking Stopped';
  };

  const getStatusVariant = (): NonNullable<Parameters<typeof Badge>[0]['variant']> => {
    if (isTracking === null) return 'neutral';
    return isTracking ? 'success' : 'warning';
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <Badge variant={getStatusVariant()} size="md">
          {getStatusText()}
        </Badge>
        {lastLocation && elapsedMinutes < 999 && (
          <span className="text-xs text-muted-foreground dark:text-zinc-400">
            Last update: {elapsedMinutes} min ago
          </span>
        )}
      </div>

      {/* Location display */}
      {lastLocation && lastLocation.latitude != null && lastLocation.longitude != null && (
        <div className="rounded-lg bg-zinc-50 px-4 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <span className="font-medium">Location:</span>{' '}
          {lastLocation.latitude.toFixed(6)}, {lastLocation.longitude.toFixed(6)}
          {lastLocation.speedKmh != null && (
            <span className="ml-2 text-muted-foreground">({lastLocation.speedKmh} km/h)</span>
          )}
        </div>
      )}

      {/* Toggle button */}
      <Button
        onClick={handleToggle}
        disabled={isLoading}
        variant={isTracking ? 'danger' : 'primary'}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Spinner className="mr-2 h-4 w-4" />
            {isTracking ? 'Stopping...' : 'Starting...'}
          </>
        ) : isTracking ? (
          'Stop GPS Tracking'
        ) : (
          'Start GPS Tracking'
        )}
      </Button>
    </div>
  );
}
