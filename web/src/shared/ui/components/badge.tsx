// NexCargo — Badge Component
// C6-II UI Primitives Layer
// Implements Status Badge per ESS-008 §5.2
// Variants: default | success | warning | danger | info | neutral

import React from 'react';
import { cn } from '../utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, string> = {
  default: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100',
  success: 'bg-[#0F8B7A]/10 text-[#0F8B7A] dark:bg-[#0F8B7A]/25 dark:text-[#4FD4C1]',
  warning: 'bg-[#E85D2A]/10 text-[#E85D2A] dark:bg-[#E85D2A]/25 dark:text-[#FB9A6C]',
  danger: 'bg-[#C62828]/10 text-[#C62828] dark:bg-[#C62828]/25 dark:text-[#EF5350]',
  info: 'bg-[#1A5C9E]/10 text-[#1A5C9E] dark:bg-[#1A5C9E]/25 dark:text-[#64B5F6]',
  neutral: 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-medium',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
