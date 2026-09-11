// NexCargo MOD-003 — POD Repository (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module
// Proof of Delivery evidence persistence per MOD-003 §4.6/§7.5

import { createClient } from '@/lib/supabase/server';

interface PodRow {
  id: string;
  tracking_id: string;
  booking_id: string;
  recipient_name: string;
  signature_ref: string;
  photo_refs: string[];
  gps_lat: number | null;
  gps_lon: number | null;
  submission_method: string;
  verification_status: string;
  admin_override: boolean;
  submitted_at: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PodApiShape {
  id: string;
  trackingId: string;
  bookingId: string;
  recipientName: string;
  signatureRef: string;
  photoRefs: string[];
  gpsLat: number | undefined;
  gpsLon: number | undefined;
  submissionMethod: string;
  verificationStatus: string;
  adminOverride: boolean;
  submittedAt: string;
  verifiedAt: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePodParams {
  trackingId: string;
  bookingId: string;
  recipientName: string;
  signatureRef: string;
  photoRefs: string[];
  gpsLat: number;
  gpsLon: number;
  submissionMethod: string;
}

export interface VerifyPodParams {
  podId: string;
  verify: boolean; // true = approve, false = reject
  adminOverride?: boolean;
}

/**
 * Repository for proof of delivery persistence via Supabase.
 */
export class PodRepository {
  private readonly schema = 'logistics_schema';
  private readonly table = 'proof_of_delivery';

  async create(params: CreatePodParams): Promise<PodApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .insert({
        tracking_id: params.trackingId,
        booking_id: params.bookingId,
        recipient_name: params.recipientName,
        signature_ref: params.signatureRef,
        photo_refs: params.photoRefs,
        gps_lat: params.gpsLat,
        gps_lon: params.gpsLon,
        submission_method: params.submissionMethod,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create POD: ${result.error.message}`);
    }

    return this.toApiShape(result.data as PodRow);
  }

  async getById(id: string): Promise<PodApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('id', id)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get POD: ${result.error.message}`);
    }

    return this.toApiShape(result.data as PodRow);
  }

  async getByTrackingId(trackingId: string): Promise<PodApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('tracking_id', trackingId);

    if (result.error) {
      throw new Error(`Failed to get PODs by trackingId: ${result.error.message}`);
    }

    return (result.data as PodRow[]).map(row => this.toApiShape(row));
  }

  async verify(params: VerifyPodParams): Promise<void> {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      verification_status: params.verify ? 'VERIFIED' : 'REJECTED',
      verified_at: now,
      updated_at: now,
    };

    if (params.adminOverride !== undefined) {
      updateData.admin_override = params.adminOverride;
    }

    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .update(updateData)
      .eq('id', params.podId)
      .in('verification_status', ['PENDING']); // Only allow verifying PENDING PODs

    if (result.error) {
      throw new Error(`Failed to verify POD: ${result.error.message}`);
    }

    const updatedRows = result.data as unknown as PodRow[];
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(`POD not found or already verified/rejected`);
    }
  }

  async getByBookingId(bookingId: string): Promise<PodApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('booking_id', bookingId);

    if (result.error) {
      throw new Error(`Failed to get PODs by bookingId: ${result.error.message}`);
    }

    return (result.data as PodRow[]).map(row => this.toApiShape(row));
  }

  private toApiShape(row: PodRow): PodApiShape {
    return {
      id: row.id,
      trackingId: row.tracking_id,
      bookingId: row.booking_id,
      recipientName: row.recipient_name,
      signatureRef: row.signature_ref,
      photoRefs: row.photo_refs ?? [],
      gpsLat: row.gps_lat ?? undefined,
      gpsLon: row.gps_lon ?? undefined,
      submissionMethod: row.submission_method,
      verificationStatus: row.verification_status,
      adminOverride: row.admin_override,
      submittedAt: row.submitted_at,
      verifiedAt: row.verified_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
