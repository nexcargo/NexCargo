// C1 Hardened Repository: No silent-failure or fake-success fallbacks.
// Supabase/Postgres failures produce real errors.

import { createClient } from '@/lib/supabase/server';

interface BookingRow {
  id: string;
  booking_id: string;
  listing_id: string;
  selected_offer_id: string;
  shipper_id: string;
  transporter_id: string;
  status: string;
  confirmation_timestamp: string | null;
  origin_address: string;
  origin_latitude: number | null;
  origin_longitude: number | null;
  destination_address: string;
  destination_latitude: number | null;
  destination_longitude: number | null;
  cargo_description: string;
  cargo_type: string;
  weight_kg: number;
  volume_m3: number | null;
  special_handling: string[] | null;
  offer_price: number;
  vehicle_type: string;
  declared_weight_kg: number | null;
  declared_volume_m3: number | null;
  currency: string;
  availability_window_start: string | null;
  availability_window_end: string | null;
  contract_id: string | null;
  correlation_id: string | null;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BookingApiShape {
  bookingId: string;
  listingId: string;
  selectedOfferId: string;
  shipperId: string;
  transporterId: string;
  status: string;
  confirmationTimestamp: string | undefined;
  originAddress: string;
  originLatitude: number | undefined;
  originLongitude: number | undefined;
  destinationAddress: string;
  destinationLatitude: number | undefined;
  destinationLongitude: number | undefined;
  cargoDescription: string;
  cargoType: string;
  weightKg: number;
  volumeM3: number | undefined;
  specialHandling: string[] | undefined;
  offerPrice: number;
  vehicleType: string;
  declaredWeightKg: number | undefined;
  declaredVolumeM3: number | undefined;
  currency: string;
  availabilityWindowStart: string | undefined;
  availabilityWindowEnd: string | undefined;
  contractId: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingParams {
  bookingId: string;
  listingId: string;
  selectedOfferId: string;
  shipperId: string;
  transporterId: string;
  status: string;
  originAddress: string;
  originLatitude?: number;
  originLongitude?: number;
  destinationAddress: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  cargoDescription: string;
  cargoType: string;
  weightKg: number;
  volumeM3?: number;
  specialHandling?: string[];
  offerPrice: number;
  vehicleType: string;
  declaredWeightKg?: number;
  declaredVolumeM3?: number;
  currency?: string;
  availabilityWindowStart?: string;
  availabilityWindowEnd?: string;
  contractId?: string;
  correlationId?: string;
}

/**
 * Repository for booking persistence via Supabase.
 * C1 Hardened: All DB failures propagate as errors (no silent stubs).
 */
export class BookingsRepository {
  private readonly schema = 'logistics_schema';
  private readonly table = 'bookings';

  async create(params: CreateBookingParams): Promise<BookingApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .insert({
        booking_id: params.bookingId,
        listing_id: params.listingId,
        selected_offer_id: params.selectedOfferId,
        shipper_id: params.shipperId,
        transporter_id: params.transporterId,
        status: params.status,
        origin_address: params.originAddress,
        origin_latitude: params.originLatitude ?? null,
        origin_longitude: params.originLongitude ?? null,
        destination_address: params.destinationAddress,
        destination_latitude: params.destinationLatitude ?? null,
        destination_longitude: params.destinationLongitude ?? null,
        cargo_description: params.cargoDescription,
        cargo_type: params.cargoType,
        weight_kg: params.weightKg,
        volume_m3: params.volumeM3 ?? null,
        special_handling: params.specialHandling ?? null,
        offer_price: params.offerPrice,
        vehicle_type: params.vehicleType,
        declared_weight_kg: params.declaredWeightKg ?? null,
        declared_volume_m3: params.declaredVolumeM3 ?? null,
        currency: params.currency ?? 'MZN',
        availability_window_start: params.availabilityWindowStart ?? null,
        availability_window_end: params.availabilityWindowEnd ?? null,
        contract_id: params.contractId ?? null,
        correlation_id: params.correlationId ?? null,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create booking: ${result.error.message}`);
    }

    return this.toApiShape(result.data as BookingRow);
  }

  async getById(id: string): Promise<BookingApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get booking: ${result.error.message}`);
    }

    return this.toApiShape(result.data as BookingRow);
  }

  async getByIdByStatus(bookingId: string): Promise<BookingApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('booking_id', bookingId)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get booking by ID: ${result.error.message}`);
    }

    return this.toApiShape(result.data as BookingRow);
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
      throw new Error(`Failed to update booking status: ${result.error.message}`);
    }
  }

  async confirmBooking(id: string): Promise<void> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .update({
        status: 'CONFIRMED' as string,
        confirmation_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to confirm booking: ${result.error.message}`);
    }
  }

  async listByShipper(shipperId: string): Promise<BookingApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('shipper_id', shipperId)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to list bookings by shipper: ${result.error.message}`);
    }

    return (result.data as BookingRow[]).map(row => this.toApiShape(row));
  }

  async listByTransporter(transporterId: string): Promise<BookingApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('transporter_id', transporterId)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to list bookings by transporter: ${result.error.message}`);
    }

    return (result.data as BookingRow[]).map(row => this.toApiShape(row));
  }

  private toApiShape(row: BookingRow): BookingApiShape {
    return {
      bookingId: row.id,
      listingId: row.listing_id,
      selectedOfferId: row.selected_offer_id,
      shipperId: row.shipper_id,
      transporterId: row.transporter_id,
      status: row.status,
      confirmationTimestamp: row.confirmation_timestamp ?? undefined,
      originAddress: row.origin_address,
      originLatitude: row.origin_latitude ?? undefined,
      originLongitude: row.origin_longitude ?? undefined,
      destinationAddress: row.destination_address,
      destinationLatitude: row.destination_latitude ?? undefined,
      destinationLongitude: row.destination_longitude ?? undefined,
      cargoDescription: row.cargo_description,
      cargoType: row.cargo_type,
      weightKg: row.weight_kg,
      volumeM3: row.volume_m3 ?? undefined,
      specialHandling: row.special_handling ?? undefined,
      offerPrice: row.offer_price,
      vehicleType: row.vehicle_type,
      declaredWeightKg: row.declared_weight_kg ?? undefined,
      declaredVolumeM3: row.declared_volume_m3 ?? undefined,
      currency: row.currency,
      availabilityWindowStart: row.availability_window_start ?? undefined,
      availabilityWindowEnd: row.availability_window_end ?? undefined,
      contractId: row.contract_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
