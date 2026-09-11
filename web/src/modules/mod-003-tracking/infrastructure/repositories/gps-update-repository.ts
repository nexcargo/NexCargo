// NexCargo MOD-003 — GPS Location Update Repository (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module
// Append-only GPS telemetry per MOD-003 §4.5/§7.4

import { createClient } from '@/lib/supabase/server';

interface GpsUpdateRow {
  id: string;
  tracking_id: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  speed_kmh: number | null;
  heading_degrees: number | null;
  accuracy_meters: number | null;
  source: string;
  is_offline: boolean;
  battery_level: number | null;
  created_at: string;
}

export interface GpsUpdateApiShape {
  id: string;
  trackingId: string;
  latitude: number | undefined;
  longitude: number | undefined;
  timestamp: string;
  speedKmh: number | undefined;
  headingDegrees: number | undefined;
  accuracyMeters: number | undefined;
  source: string;
  isOffline: boolean;
  batteryLevel: number | undefined;
  createdAt: string;
}

export interface CreateGpsUpdateParams {
  trackingId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  headingDegrees?: number;
  accuracyMeters?: number;
  source: string;
  isOffline?: boolean;
  batteryLevel?: number;
}

/**
 * Repository for GPS location updates persistence via Supabase.
 * All writes are INSERT-ONLY (append-only). No UPDATE/DELETE.
 */
export class GpsUpdateRepository {
  private readonly schema = 'logistics_schema';
  private readonly table = 'gps_location_updates';

  async create(params: CreateGpsUpdateParams): Promise<GpsUpdateApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .insert({
        tracking_id: params.trackingId,
        latitude: params.latitude,
        longitude: params.longitude,
        timestamp: new Date().toISOString(),
        speed_kmh: params.speedKmh ?? null,
        heading_degrees: params.headingDegrees ?? null,
        accuracy_meters: params.accuracyMeters ?? null,
        source: params.source,
        is_offline: params.isOffline ?? false,
        battery_level: params.batteryLevel ?? null,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create GPS update: ${result.error.message}`);
    }

    return this.toApiShape(result.data as GpsUpdateRow);
  }

  async getHistory(trackingId: string, limit = 200): Promise<GpsUpdateApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('tracking_id', trackingId)
      .order('timestamp', { ascending: true })
      .limit(limit);

    if (result.error) {
      throw new Error(`Failed to get GPS history: ${result.error.message}`);
    }

    return (result.data as GpsUpdateRow[]).map(row => this.toApiShape(row));
  }

  async getLastForTrackingId(trackingId: string): Promise<GpsUpdateApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('tracking_id', trackingId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get last GPS update: ${result.error.message}`);
    }

    return this.toApiShape(result.data as GpsUpdateRow);
  }

  async getById(id: string): Promise<GpsUpdateApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('id', id)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get GPS update: ${result.error.message}`);
    }

    return this.toApiShape(result.data as GpsUpdateRow);
  }

  private toApiShape(row: GpsUpdateRow): GpsUpdateApiShape {
    return {
      id: row.id,
      trackingId: row.tracking_id,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      timestamp: row.timestamp,
      speedKmh: row.speed_kmh ?? undefined,
      headingDegrees: row.heading_degrees ?? undefined,
      accuracyMeters: row.accuracy_meters ?? undefined,
      source: row.source,
      isOffline: row.is_offline,
      batteryLevel: row.battery_level ?? undefined,
      createdAt: row.created_at,
    };
  }
}
