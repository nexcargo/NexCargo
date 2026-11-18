// NexCargo — assignment-scoped Driver operational identity (PRE-I-6 FINAL COMPLETION DIRECTIVE Item 3).
//
// A Driver is a MOD-014 asset record subordinate to a Transporter, not an account class. A platform
// account optionally linked to a driver row (drivers.platform_user_id) may operate on a shipment only
// while that driver holds a PLANNED/ACTIVE asset_assignments row for the specific tracking record.
//
// This resolves the link under the caller's OWN session, so the existing self-read RLS policies
// ("Driver views own profile", "Driver views own assignments") govern the reads. It returns null when
// there is no linked driver or no active assignment, which the calling routes treat as a denial. The
// database predicates (migration 070) independently enforce the same assignment scope plus the
// role-less boundary; this helper is the application half of that gate, not a substitute for it.

import { createClient } from '@/lib/supabase/server';

export interface DriverAssignment {
  driverId: string;
  assignmentId: string;
}

export async function resolveDriverAssignment(
  userId: string,
  trackingId: string,
): Promise<DriverAssignment | null> {
  const supabase = await createClient();

  const { data: driver, error: driverError } = await supabase
    .schema('logistics_schema')
    .from('drivers')
    .select('id')
    .eq('platform_user_id', userId)
    .maybeSingle();

  if (driverError || !driver) {
    return null;
  }

  const { data: assignment, error: assignmentError } = await supabase
    .schema('logistics_schema')
    .from('asset_assignments')
    .select('id')
    .eq('driver_id', driver.id)
    .eq('shipment_tracking_id', trackingId)
    .in('status', ['PLANNED', 'ACTIVE'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignmentError || !assignment) {
    return null;
  }

  return { driverId: driver.id, assignmentId: assignment.id };
}