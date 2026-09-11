// NexCargo MOD-003 — Driver Identity Verification Repository (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module
// Pre-handover verification per MOD-003 §4.7/§7.6

import { createClient } from '@/lib/supabase/server';

interface DriverIdentityVerificationRow {
  id: string;
  tracking_id: string;
  booking_id: string;
  driver_id: string;
  method: string;
  status: string;
  attempt_count: number;
  failure_reason: string | null;
  risk_score: number | null;
  verified_at: string | null;
  created_at: string;
}

export interface DriverIdentityVerificationApiShape {
  id: string;
  trackingId: string;
  bookingId: string;
  driverId: string;
  method: string;
  status: string;
  attemptCount: number;
  failureReason: string | undefined;
  riskScore: number | undefined;
  verifiedAt: string | undefined;
  createdAt: string;
}

export interface CreateDriverIdentityVerificationParams {
  trackingId: string;
  bookingId: string;
  driverId: string;
  method: string;
  riskScore?: number;
}

export interface UpdateDriverIdentityVerificationStatusParams {
  id: string;
  status: string;
  failureReason?: string;
  verifiedAt?: string;
}

/**
 * Repository for driver identity verifications persistence via Supabase.
 */
export class DriverIdentityVerificationRepository {
  private readonly schema = 'logistics_schema';
  private readonly table = 'driver_identity_verifications';

  async create(params: CreateDriverIdentityVerificationParams): Promise<DriverIdentityVerificationApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .insert({
        tracking_id: params.trackingId,
        booking_id: params.bookingId,
        driver_id: params.driverId,
        method: params.method,
        attempt_count: 1,
        risk_score: params.riskScore ?? null,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create driver identity verification: ${result.error.message}`);
    }

    return this.toApiShape(result.data as DriverIdentityVerificationRow);
  }

  async getById(id: string): Promise<DriverIdentityVerificationApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('id', id)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get driver identity verification: ${result.error.message}`);
    }

    return this.toApiShape(result.data as DriverIdentityVerificationRow);
  }

  async getByTrackingId(trackingId: string): Promise<DriverIdentityVerificationApiShape[]> {
    const supabase = await createClient();
    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .select('*')
      .eq('tracking_id', trackingId)
      .order('created_at', { ascending: false });

    if (result.error) {
      throw new Error(`Failed to get driver identity verifications by trackingId: ${result.error.message}`);
    }

    return (result.data as DriverIdentityVerificationRow[]).map(row => this.toApiShape(row));
  }

  async updateStatus(params: UpdateDriverIdentityVerificationStatusParams): Promise<void> {
    const supabase = await createClient();
    const updateData: Record<string, unknown> = {
      status: params.status,
      updated_at: new Date().toISOString(),
    };

    if (params.failureReason !== undefined) {
      updateData.failure_reason = params.failureReason;
    }

    if (params.verifiedAt !== undefined) {
      updateData.verified_at = params.verifiedAt;
    }

    const result = await supabase
      .from(`${this.schema}.${this.table}`)
      .update(updateData)
      .eq('id', params.id);

    if (result.error) {
      throw new Error(`Failed to update driver identity verification status: ${result.error.message}`);
    }

    const updatedRows = result.data as unknown as DriverIdentityVerificationRow[];
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(`Driver identity verification not found`);
    }
  }

  private toApiShape(row: DriverIdentityVerificationRow): DriverIdentityVerificationApiShape {
    return {
      id: row.id,
      trackingId: row.tracking_id,
      bookingId: row.booking_id,
      driverId: row.driver_id,
      method: row.method,
      status: row.status,
      attemptCount: row.attempt_count,
      failureReason: row.failure_reason ?? undefined,
      riskScore: row.risk_score ?? undefined,
      verifiedAt: row.verified_at ?? undefined,
      createdAt: row.created_at,
    };
  }
}
