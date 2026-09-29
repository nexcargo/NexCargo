// NexCargo — Spinner Component
// C6-II UI Primitives Layer
// Implements loading spinner per PROMPT 5 Loading System

import React from 'react';
import { cn } from '../utils';

export interface SpinnerProps extends React.HTMLAttributes<SVGSVGElement> {}

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, 'aria-label': ariaLabel = 'Loading', ...props }, ref) => (
    <svg
      ref={ref}
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label={ariaLabel}
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
);

Spinner.displayName = 'Spinner';
