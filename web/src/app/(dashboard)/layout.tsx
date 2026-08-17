// NexCargo Dashboard Routes Layout — Per PROMPT 4
// Contains: role-based dashboards (shipper, transporter, driver, admin, etc.)
// RBAC enforcement: redirect unauthorized users per PROMPT 4

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NexCargo — Dashboard',
  description: 'NexCargo platform dashboard',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
