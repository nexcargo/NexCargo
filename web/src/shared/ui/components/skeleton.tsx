// NexCargo — Skeleton Component
// C6-II UI Primitives Layer
// Implements loading skeleton per ESS-008 §9

import React from 'react';
import { cn } from '../utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700',
        className
      )}
      {...props}
    />
  )
);

Skeleton.displayName = 'Skeleton';
