// NexCargo — ErrorBanner Shared Component
// C6-02 Canonical UI Foundation
// Reusable error presentation pattern from existing inline implementations
// Complies with ESS-008 §14 (user-readable errors, retry option)

import React from 'react';
import { cn } from '../../utils';

export interface ErrorBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string | React.ReactNode;
  onRetry?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const ErrorBanner = React.forwardRef<HTMLDivElement, ErrorBannerProps>(
  ({ message, onRetry, dismissible = false, onDismiss, className, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700',
        'dark:border-red-800 dark:bg-red-950/20 dark:text-red-300',
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex-1', dismissible && 'pr-4')}>{message}</span>
        {(dismissible || onRetry) && (
          <div className="flex shrink-0 items-center gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs font-medium underline hover:text-red-900 dark:hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 rounded"
              >
                Retry
              </button>
            )}
            {dismissible && onDismiss && (
              <button
                onClick={onDismiss}
                className="ml-auto rounded p-0.5 text-red-500 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                aria-label="Dismiss"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
);

ErrorBanner.displayName = 'ErrorBanner';
