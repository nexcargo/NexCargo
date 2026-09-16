// NexCargo — Tracking Timeline Component
// C7-001 Phase 2 — Tracking UI / Driver Experience
// Vertical timeline rendering event sequence with timestamps, state labels, source indicators

'use client';

import React from 'react';
import { cn } from '@/shared/ui/utils';
import { Card, CardContent } from '../card';
import { Spinner } from '../spinner';
import { Badge } from '../badge';

export interface TimelineEvent {
  id: string;
  eventType: string;
  source?: string;
  stateFrom?: string | undefined;
  stateTo?: string | undefined;
  timestamp: string;
}

export interface TrackingTimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

const eventIcons: Record<string, React.ReactNode> = {
  TRACKING_INITIALISED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  ),
  TRIP_STARTED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ),
  AWAITING_PICKUP: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  PICKUP_CONFIRMED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  SHIPMENT_IN_TRANSIT: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
  ),
  BORDER_CHECKPOINT_REACHED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
  ),
  BORDER_CHECKPOINT_EXITED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15l6 6m1-11V3a1 1 0 00-1-1H6a1 1 0 00-1 1v11l2-2 2 2 2-2 2 2z" /></svg>
  ),
  SHIPMENT_DELAYED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
  ),
  DELIVERY_CONFIRMED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
  ),
  POD_SUBMITTED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  POD_VERIFIED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  TRACKING_COMPLETED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
  ),
  DRIVER_VERIFIED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
  ),
  DRIVER_VERIFICATION_FAILED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
  ),
  TRACKING_CANCELLED: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
  ),
};

const defaultIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

function getEventLabel(eventType: string): string {
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TrackingTimeline({ events, isLoading, emptyMessage = 'No tracking events recorded.', className }: TrackingTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-4 py-2">
            <Spinner />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
              <div className="h-3 w-32 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground dark:text-zinc-400">
        <svg className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map((event, index) => {
            const icon = eventIcons[event.eventType] ?? defaultIcon;
            const isFirst = index === 0;
            return (
              <div key={event.id} className={cn('relative flex items-start gap-4 px-6 py-4 transition-colors', isFirst && 'bg-zinc-50 dark:bg-zinc-800/50')}>
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                    event.source === 'DRIVER' ? 'border-blue-500 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' :
                    event.source === 'MODERATOR' ? 'border-purple-500 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' :
                    'border-zinc-300 bg-white text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400'
                  )}>
                    {icon}
                  </div>
                  {!isFirst && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{getEventLabel(event.eventType)}</span>
                    {event.stateFrom && event.stateTo && (
                      <span className="text-xs text-muted-foreground dark:text-zinc-400">
                        {event.stateFrom} → {event.stateTo}
                      </span>
                    )}
                    {event.source && (
                      <Badge size="sm" variant="neutral">
                        {event.source}
                      </Badge>
                    )}
                  </div>
                  <time className="mt-0.5 text-xs text-muted-foreground dark:text-zinc-500">
                    {formatTimestamp(event.timestamp)}
                  </time>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}
