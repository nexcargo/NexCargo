// NexCargo MOD-003 — Read-Only Driver Assignment Repository (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module (READ-ONLY)
// driver_assignments is owned by MOD-002 per HAO D-7 decision.
// MOD-003 may ONLY read assignment data; no CREATE/UPDATE/DELETE operations.

import { createClient } from '@/lib/supabase/server';

interface DriverAssignmentRow {
  id: string;
  booking_id: string;
  tracking_id: string | null;
  driver_id: string;
  vehicle_id: string | null;
  assigned_by: string;
  scheduled_start: string;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  created_at: string;
}

export interface DriverAssignmentApiShape {
  id: string;
  bookingId: string;
  trackingId: string | undefined;
  driverId: string;
  vehicleId: string | undefined;
  assignedBy: string;
  scheduledStart: string;
  scheduledEnd: string | undefined;
  actualStart: string | undefined;
  actualEnd: string | undefined;
  status: string;
  createdAt: string;
}

/**
 * Read-only repository for driver assignments.
 * Consumes data from MOD-002's driver_assignments table.
 */
export class DriverAssignmentRepository {
  private readonly schema = 'logistics_schema';
  private readonly table = 'driver_assignments';

  async getByBookingId(bookingId: string): Promise<DriverAssignmentApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('booking_id', bookingId);

    if (result.error) {
      throw new Error(`Failed to get driver assignments by bookingId: ${result.error.message}`);
    }

    return (result.data as DriverAssignmentRow[]).map(row => this.toApiShape(row));
  }

  async getAssignmentsByDriver(driverId: string): Promise<DriverAssignmentApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('driver_id', driverId);

    if (result.error) {
      throw new Error(`Failed to get driver assignments by driverId: ${result.error.message}`);
    }

    return (result.data as DriverAssignmentRow[]).map(row => this.toApiShape(row));
  }

  async getAssignmentsByTrackingId(trackingId: string): Promise<DriverAssignmentApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('tracking_id', trackingId);

    if (result.error) {
      throw new Error(`Failed to get driver assignments by trackingId: ${result.error.message}`);
    }

    return (result.data as DriverAssignmentRow[]).map(row => this.toApiShape(row));
  }

  private toApiShape(row: DriverAssignmentRow): DriverAssignmentApiShape {
    return {
      id: row.id,
      bookingId: row.booking_id,
      trackingId: row.tracking_id ?? undefined,
      driverId: row.driver_id,
      vehicleId: row.vehicle_id ?? undefined,
      assignedBy: row.assigned_by,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end ?? undefined,
      actualStart: row.actual_start ?? undefined,
      actualEnd: row.actual_end ?? undefined,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
