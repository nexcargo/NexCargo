// NexCargo Public Routes Layout — Per PROMPT 4
// Contains: landing page, public information pages

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NexCargo — Public',
  description: 'AI-native logistics marketplace for SADC region',
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
