// NexCargo MOD-003 — Tracking Event Repository (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module
// Append-only immutable event log per MOD-003 §4.3/§7.2

import { createClient } from '@/lib/supabase/server';

interface TrackingEventRow {
  id: string;
  tracking_id: string;
  event_type: string;
  event_timestamp: string;
  source: string;
  state_from: string | null;
  state_to: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TrackingEventApiShape {
  id: string;
  trackingId: string;
  eventType: string;
  eventTimestamp: string;
  source: string;
  stateFrom: string | undefined;
  stateTo: string | undefined;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateTrackingEventParams {
  trackingId: string;
  eventType: string;
  source: string;
  stateFrom?: string;
  stateTo?: string;
  metadata?: Record<string, unknown>;
}

export interface IdempotencyKeyParams {
  idempotencyKey: string;
}

/**
 * Repository for tracking events persistence via Supabase.
 * All writes are INSERT-ONLY (append-only). No UPDATE/DELETE.
 */
export class TrackingEventRepository {
  private readonly schema = 'logistics_schema';
  private readonly table = 'tracking_events';

  async create(params: CreateTrackingEventParams): Promise<TrackingEventApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .insert({
        tracking_id: params.trackingId,
        event_type: params.eventType,
        event_timestamp: new Date().toISOString(),
        source: params.source,
        state_from: params.stateFrom ?? null,
        state_to: params.stateTo ?? null,
        metadata: params.metadata ?? {},
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create tracking event: ${result.error.message}`);
    }

    return this.toApiShape(result.data as TrackingEventRow);
  }

  async getById(id: string): Promise<TrackingEventApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('id', id)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get tracking event: ${result.error.message}`);
    }

    return this.toApiShape(result.data as TrackingEventRow);
  }

  async getHistory(trackingId: string, limit = 100, offset = 0): Promise<TrackingEventApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('tracking_id', trackingId)
      .order('event_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (result.error) {
      throw new Error(`Failed to get tracking event history: ${result.error.message}`);
    }

    return (result.data as TrackingEventRow[]).map(row => this.toApiShape(row));
  }

  async getByTrackingId(trackingId: string): Promise<TrackingEventApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('tracking_id', trackingId)
      .order('event_timestamp', { ascending: true });

    if (result.error) {
      throw new Error(`Failed to get tracking events by trackingId: ${result.error.message}`);
    }

    return (result.data as TrackingEventRow[]).map(row => this.toApiShape(row));
  }

  private toApiShape(row: TrackingEventRow): TrackingEventApiShape {
    return {
      id: row.id,
      trackingId: row.tracking_id,
      eventType: row.event_type,
      eventTimestamp: row.event_timestamp,
      source: row.source,
      stateFrom: row.state_from ?? undefined,
      stateTo: row.state_to ?? undefined,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}
