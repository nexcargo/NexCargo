// C1 Hardened Repository: No silent-failure or fake-success fallbacks.
// Supabase/Postgres failures produce real errors.

import { createClient } from '@/lib/supabase/server';

interface ListingRow {
  id: string;
  shipper_id: string;
  title: string | null;
  description: string | null;
  origin_geo: Record<string, unknown>;
  destination_geo: Record<string, unknown>;
  origin_address: string;
  destination_address: string;
  cargo_type: string;
  weight_kg: number;
  volume_m3: number | null;
  time_window: Record<string, unknown>;
  pricing_model: string;
  status: string;
  published_at: string | null;
  accepted_vehicle_types: string[];
  created_by: string | null;
  correlation_id: string | null;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ListingApiShape {
  listingId: string;
  shipperId: string;
  title: string;
  description: string;
  origin: Record<string, unknown>;
  destination: Record<string, unknown>;
  cargoType: string;
  weightKg: number;
  volumeM3: number | null;
  timeWindow: Record<string, unknown>;
  pricingModel: string;
  status: string;
  publishedAt: string | null;
  acceptedVehicleTypes: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Repository for marketplace listing persistence via Supabase.
 * C1 Hardened: All DB failures propagate as errors (no silent stubs).
 */
export class ListingsRepository {
  private readonly schema = 'marketplace_schema';
  private readonly table = 'listings';

  async create(params: {
    shipperId: string;
    title: string;
    description: string;
    originGeo: Record<string, unknown>;
    destinationGeo: Record<string, unknown>;
    originAddress: string;
    destinationAddress: string;
    cargoType: string;
    weightKg: number;
    volumeM3: number | null;
    timeWindow: Record<string, unknown>;
    pricingModel: string;
    correlationId?: string;
  }): Promise<ListingApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .insert({
        shipper_id: params.shipperId,
        title: params.title,
        description: params.description,
        origin_geo: params.originGeo,
        destination_geo: params.destinationGeo,
        origin_address: params.originAddress,
        destination_address: params.destinationAddress,
        cargo_type: params.cargoType,
        weight_kg: params.weightKg,
        volume_m3: params.volumeM3,
        time_window: params.timeWindow,
        pricing_model: params.pricingModel,
        status: 'DRAFT',
        accepted_vehicle_types: [],
        created_by: params.shipperId,
        correlation_id: params.correlationId ?? null,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create listing: ${result.error.message}`);
    }

    return this.toApiShape(result.data as ListingRow);
  }

  async listPublished(): Promise<ListingApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('status', 'PUBLISHED')
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to list listings: ${result.error.message}`);
    }

    return (result.data as ListingRow[]).map(row => this.toApiShape(row));
  }

  async getById(id: string): Promise<ListingApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get listing: ${result.error.message}`);
    }

    return this.toApiShape(result.data as ListingRow);
  }

  async updateStatus(id: string, targetStatus: string): Promise<void> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .update({
        status: targetStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to update listing status: ${result.error.message}`);
    }
  }

  private toApiShape(row: ListingRow): ListingApiShape {
    return {
      listingId: row.id,
      shipperId: row.shipper_id,
      title: row.title ?? '',
      description: row.description ?? '',
      origin: row.origin_geo as Record<string, unknown>,
      destination: row.destination_geo as Record<string, unknown>,
      cargoType: row.cargo_type,
      weightKg: row.weight_kg,
      volumeM3: row.volume_m3,
      timeWindow: row.time_window as Record<string, unknown>,
      pricingModel: row.pricing_model,
      status: row.status,
      publishedAt: row.published_at,
      acceptedVehicleTypes: row.accepted_vehicle_types,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
