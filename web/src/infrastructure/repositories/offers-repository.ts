// C1 Hardened Repository: No silent-failure or fake-success fallbacks.
// Supabase/Postgres failures produce real errors.

import { createClient } from '@/lib/supabase/server';

interface OfferRow {
  id: string;
  transporter_id: string;
  listing_id: string;
  price_proposal: number;
  availability_window: Record<string, unknown>;
  vehicle_type: string;
  declared_capacity: Record<string, unknown>;
  notes: string | null;
  status: string;
  created_by: string | null;
  correlation_id: string | null;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OfferApiShape {
  offerId: string;
  transporterId: string;
  listingId: string;
  priceProposal: number;
  availabilityWindow: Record<string, unknown>;
  vehicleType: string;
  declaredCapacity: Record<string, unknown>;
  status: string;
  notes: string | undefined;
  createdAt: string;
  updatedAt: string;
}

/**
 * Repository for transport offer persistence via Supabase.
 * C1 Hardened: All DB failures propagate as errors (no silent stubs).
 */
export class OffersRepository {
  private readonly schema = 'marketplace_schema';
  private readonly table = 'offers';

  async create(params: {
    transporterId: string;
    listingId: string;
    priceProposal: number;
    availabilityWindow: Record<string, unknown>;
    vehicleType: string;
    declaredCapacity: Record<string, unknown>;
    notes?: string;
    correlationId?: string;
  }): Promise<OfferApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .insert({
        transporter_id: params.transporterId,
        listing_id: params.listingId,
        price_proposal: params.priceProposal,
        availability_window: params.availabilityWindow,
        vehicle_type: params.vehicleType,
        declared_capacity: params.declaredCapacity,
        notes: params.notes ?? null,
        status: 'SUBMITTED',
        created_by: params.transporterId,
        correlation_id: params.correlationId ?? null,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create offer: ${result.error.message}`);
    }

    return this.toApiShape(result.data as OfferRow);
  }

  async listByListing(listingId: string): Promise<OfferApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('listing_id', listingId)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to list offers: ${result.error.message}`);
    }

    return (result.data as OfferRow[]).map(row => this.toApiShape(row));
  }

  async getById(id: string): Promise<OfferApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get offer: ${result.error.message}`);
    }

    return this.toApiShape(result.data as OfferRow);
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
      throw new Error(`Failed to update offer status: ${result.error.message}`);
    }
  }

  private toApiShape(row: OfferRow): OfferApiShape {
    return {
      offerId: row.id,
      transporterId: row.transporter_id,
      listingId: row.listing_id,
      priceProposal: row.price_proposal,
      availabilityWindow: row.availability_window as Record<string, unknown>,
      vehicleType: row.vehicle_type,
      declaredCapacity: row.declared_capacity as Record<string, unknown>,
      status: row.status,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
