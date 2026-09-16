// NexCargo — Button Component
// C6-II UI Primitives Layer
// Implements Button per PROMPT 5 specification
// Variants: primary | secondary | outline | danger | ghost
// States: loading, disabled, active

import React from 'react';
import Link from 'next/link';
import { cn } from '../utils';
import { Spinner } from './spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  asChild?: boolean;
  href?: string;
}

const variantStyles: Record<string, string> = {
  primary: 'bg-[#1A5C9E] text-white hover:bg-[#164878] dark:hover:bg-[#2370B5]',
  secondary: 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600',
  outline: 'border border-zinc-300 bg-transparent hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800',
  danger: 'bg-[#C62828] text-white hover:bg-[#A12121]',
  ghost: 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, asChild, href, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/90 dark:focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-50';
    const finalClasses = cn(
      baseClasses,
      variantStyles[variant],
      sizeStyles[size],
      className
    );

    if (href && !asChild) {
      return (
        <Link
          href={href}
          className={finalClasses}
        >
          {isLoading && <Spinner className="mr-2 h-4 w-4" />}
          {children}
        </Link>
      );
    }

    return (
      <button
        className={finalClasses}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Spinner className="mr-2 h-4 w-4" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
