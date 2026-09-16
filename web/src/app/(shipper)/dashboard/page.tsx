// NexCargo — Shipper Dashboard Server Wrapper
// C6-III Exemplar Dashboard Infrastructure
// Server component that reads session and renders the client-side dashboard content.
// Dynamic rendering: requires live session cookies; cannot be statically generated.

import { createClient } from '@/lib/supabase/server';
import { getUserRoleFromSession } from '../../(dashboard)/user-session';
import { redirect } from 'next/navigation';
import { ShipperDashboardWithToast } from './dashboard-content';

export const dynamic = 'force-dynamic';

export default async function ShipperDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const role = await getUserRoleFromSession(user);

  // Only SHIPPER role can access this page
  if (role !== 'SHIPPER') {
    redirect('/dispatcher');
  }

  return <ShipperDashboardWithToast />;
}
