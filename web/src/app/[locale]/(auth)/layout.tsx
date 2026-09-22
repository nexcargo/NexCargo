// NexCargo Auth Routes Layout — Per PROMPT 4 + PROMPT 7
// Contains: login, signup, forgot-password, reset-password

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NexCargo — Authentication',
  description: 'Sign in or create your NexCargo account',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
