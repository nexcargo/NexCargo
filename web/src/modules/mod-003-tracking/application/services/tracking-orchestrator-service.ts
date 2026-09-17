// NexCargo MOD-003 — Tracking Orchestrator Service (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module
// Wires state machine validation + repository persistence for tracking initialization
// C7-002: Atomic status updates via public.atomic_tracking_status_update() RPC

import { TrackingRecordRepository } from '../../infrastructure/repositories/tracking-record-repository';
import { TrackingEventRepository } from '../../infrastructure/repositories/tracking-event-repository';
import type { CreateTrackingRecordParams, TrackingRecordApiShape } from '../../infrastructure/repositories/tracking-record-repository';
import type { CreateTrackingEventParams } from '../../infrastructure/repositories/tracking-event-repository';
import { applyTrackingTransition, isTrackingTerminal } from '@/modules/mod-003-tracking/domain/services/tracking-state-machine';
import { ValidationError } from '@/shared/errors/app-errors';
import { ShipmentStatus } from '@/shared/types/enums';
import { createClient } from '@/lib/supabase/server';

/**
 * Service that orchestrates tracking record initialization from a confirmed booking.
 */
export class TrackingOrchestratorService {
  private readonly trackingRecordRepo = new TrackingRecordRepository();
  private readonly trackingEventRepo = new TrackingEventRepository();

  /**
   * Initialize tracking record when a booking reaches CONFIRMED status.
   * This is the operational trigger for C7-001.
   * When contract pipeline becomes operational, this will receive an optional contractId parameter.
   * 
   * @param bookingId - The confirmed booking ID
   * @param transportContractId - Optional contract reference (nullable until contract pipeline operational)
   */
  async initializeTracking(bookingId: string, transportContractId?: string | null): Promise<TrackingRecordApiShape> {
    // Validate booking exists first
    const existingRecord = await this.trackingRecordRepo.getByBookingId(bookingId);
    if (existingRecord) {
      throw new ValidationError(`Tracking record already exists for booking ${bookingId}`);
    }

    // Generate tracking reference
    const trackingRef = `TRK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create tracking record with CREATED status
    const params: CreateTrackingRecordParams = {
      trackingRef,
      bookingId,
      contractId: transportContractId ?? null,
    };

    const record = await this.trackingRecordRepo.create(params);

    // Create first event: TrackingInitialized
    await this.createInternalEvent({
      trackingId: record.id,
      eventType: 'TRACKING_INITIALISED',
      source: 'SYSTEM',
      stateFrom: undefined,
      stateTo: ShipmentStatus.CREATED,
      metadata: { bookingId },
    });

    return record;
  }

  /**
   * Update tracking status after validating transition against state machine.
   * Uses atomic_tracking_status_update() RPC for transaction integrity:
   * both status UPDATE and event INSERT execute as one DB unit of work.
   */
  async updateTrackingStatus(trackingId: string, targetStatus: string, sourceModule: string): Promise<void> {
    // Get current state
    const record = await this.trackingRecordRepo.getById(trackingId);
    if (!record) {
      throw new ValidationError(`Tracking record ${trackingId} not found`);
    }

    const currentState = record.status as `${ShipmentStatus}`;

    // Validate transition against state machine
    try {
      applyTrackingTransition(currentState, targetStatus as `${ShipmentStatus}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid state transition: ${currentState} → ${targetStatus}`);
    }

    // Execute atomic status + event persistence via Supabase client
    const supabase = await createClient();
    
    const { error } = await supabase.rpc('atomic_tracking_status_update', {
      p_tracking_id: trackingId,
      p_target_status: targetStatus,
      p_source_module: sourceModule || 'MOD-003',
    });

    if (error) {
      throw new Error(`Failed to update tracking status: ${error.message}`);
    }

    // If completing, mark record as completed at timestamp (separate RPC)
    const isTerminal = targetStatus === 'COMPLETED' || targetStatus === 'CANCELLED';
    if (isTerminal && targetStatus === 'COMPLETED') {
      await this.trackingRecordRepo.markCompleted(trackingId);
    }
  }

  /**
   * Internal method to create a tracking event without external API call overhead.
   */
  private async createInternalEvent(params: Omit<CreateTrackingEventParams, 'source'> & { source?: string }): Promise<void> {
    await this.trackingEventRepo.create({
      ...params,
      source: params.source || 'SYSTEM',
    });
  }
}
