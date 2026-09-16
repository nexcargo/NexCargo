// NexCargo Dispatcher Routes Layout — Per PROMPT 4 §5
// Authorized by HAO-R-002 (Dispatcher Dashboard Approval)
// Derived from: PROMPT 4 route structure, MOD-008 MobileRoleType.DISPATCHER, architecture spec nexcargo-ai-eprs.md §4.4/§7
// Dispatchers are operational coordinators: allocate shipments, coordinate drivers, monitor status, manage fleet activities.
// C6-02: Added SkipNav (ESS-008 §13 accessibility) + canonical container width (ESS-008 §3.2 consistent spacing)

import type { Metadata } from 'next';
import { SkipNav } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'NexCargo — Dispatcher Operations',
  description: 'Dispatcher operations dashboard for managing shipments, coordinating drivers, and monitoring fleet activities.',
};

export default function DispatcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SkipNav />
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </>
  );
}

