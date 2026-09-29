// NexCargo — SkipNav Accessibility Component
// C6-02 Canonical UI Foundation
// Complies with ESS-008 §13 (keyboard-accessible controls, readable hierarchy)
// Provides keyboard users a way to bypass navigation and jump to main content

'use client';

import Link from 'next/link';

export function SkipNav({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <Link
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white dark:focus:bg-white dark:focus:text-zinc-900"
    >
      Skip to main content
    </Link>
  );
}
