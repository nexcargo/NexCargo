// NexCargo — Utility functions
// C6-II Shared UI Layer

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine Tailwind classes with conflict resolution.
 * Used across all shared UI components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
