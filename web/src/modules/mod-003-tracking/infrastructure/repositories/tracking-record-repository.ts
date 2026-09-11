// NexCargo MOD-003 — Tracking Record Repository (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module

import { createClient } from '@/lib/supabase/server';

interface TrackingRecordRow {
  id: string;
  tracking_ref: string;
  booking_id: string;
  contract_id: string | null;
  status: string;
  visibility_level: string;
  activated_at: string;
  completed_at: string | null;
  last_updated: string;
  correlation_id: string | null;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TrackingRecordApiShape {
  id: string;
  trackingRef: string;
  bookingId: string;
  contractId: string | undefined;
  status: string;
  visibilityLevel: string;
  activatedAt: string;
  completedAt: string | undefined;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrackingRecordParams {
  trackingRef: string;
  bookingId: string;
  contractId?: string | null;
  visibilityLevel?: string;
}

/**
 * Repository for shipment tracking record persistence via Supabase.
 * All DB failures propagate as errors (no silent stubs).
 */
export class TrackingRecordRepository {
  private readonly schema = 'logistics_schema';
  private readonly table = 'shipment_tracking_records';

  async create(params: CreateTrackingRecordParams): Promise<TrackingRecordApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .insert({
        tracking_ref: params.trackingRef,
        booking_id: params.bookingId,
        contract_id: params.contractId ?? null,
        visibility_level: params.visibilityLevel ?? 'RESTRICTED',
        activated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create tracking record: ${result.error.message}`);
    }

    return this.toApiShape(result.data as TrackingRecordRow);
  }

  async getById(id: string): Promise<TrackingRecordApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get tracking record: ${result.error.message}`);
    }

    return this.toApiShape(result.data as TrackingRecordRow);
  }

  async getByBookingId(bookingId: string): Promise<TrackingRecordApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('booking_id', bookingId)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get tracking record by bookingId: ${result.error.message}`);
    }

    return this.toApiShape(result.data as TrackingRecordRow);
  }

  async updateStatus(id: string, targetStatus: string): Promise<void> {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .update({ status: targetStatus, last_updated: now, updated_at: now })
      .eq('id', id)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to update tracking record status: ${result.error.message}`);
    }
  }

  async markCompleted(id: string): Promise<void> {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .update({ status: 'COMPLETED', completed_at: now, last_updated: now, updated_at: now })
      .eq('id', id)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to mark tracking record as completed: ${result.error.message}`);
    }
  }

  async listByShipper(shipperId: string, limit = 50, offset = 0): Promise<TrackingRecordApiShape[]> {
    const supabase = await createClient();
    // Query tracking records directly (RLS policies handle access control)
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('is_deleted', false)
      .order('last_updated', { ascending: false })
      .range(offset, offset + limit - 1);

    if (result.error) {
      throw new Error(`Failed to list tracking records by shipper: ${result.error.message}`);
    }

    return (result.data as unknown as TrackingRecordRow[]).map(row => this.toApiShape(row));
  }

  async listByTransporter(transporterId: string, limit = 50, offset = 0): Promise<TrackingRecordApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('is_deleted', false)
      .order('last_updated', { ascending: false })
      .range(offset, offset + limit - 1);

    if (result.error) {
      throw new Error(`Failed to list tracking records by transporter: ${result.error.message}`);
    }

    return (result.data as TrackingRecordRow[]).map(row => this.toApiShape(row));
  }

  private toApiShape(row: TrackingRecordRow): TrackingRecordApiShape {
    return {
      id: row.id,
      trackingRef: row.tracking_ref,
      bookingId: row.booking_id,
      contractId: row.contract_id ?? undefined,
      status: row.status,
      visibilityLevel: row.visibility_level,
      activatedAt: row.activated_at,
      completedAt: row.completed_at ?? undefined,
      lastUpdated: row.last_updated,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
