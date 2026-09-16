// NexCargo — Tracking Status Badge Component
// C7-001 Phase 2 — Tracking UI / Driver Experience
// Wraps C6 Badge with TrackingStatus enum → label + color variant mapping

'use client';

import React from 'react';
import { cn } from '@/shared/ui/utils';
import { Badge } from '../badge';
import type { BadgeProps } from '../badge';

export interface TrackingStatusBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  status: string;
}

const statusConfig: Record<string, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  CREATED: { label: 'Created', variant: 'info' },
  BOOKED: { label: 'Booked', variant: 'info' },
  AWAITING_PICKUP: { label: 'Awaiting Pickup', variant: 'warning' },
  PICKUP_ACKNOWLEDGED: { label: 'Pickup Acknowledged', variant: 'success' },
  IN_TRANSIT: { label: 'In Transit', variant: 'info' },
  AT_BORDER: { label: 'At Border', variant: 'warning' },
  DELAYED: { label: 'Delayed', variant: 'warning' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
};

export function TrackingStatusBadge({ status, className, size = 'md', ...props }: TrackingStatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'neutral' };
  return (
    <Badge
      variant={config.variant}
      size={size}
      className={cn('capitalize', className)}
      {...props}
    >
      {config.label}
    </Badge>
  );
}
