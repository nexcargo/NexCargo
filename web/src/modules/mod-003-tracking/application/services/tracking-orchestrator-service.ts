// NexCargo MOD-003 — Tracking Orchestrator Service (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module
// Wires state machine validation + repository persistence for tracking initialization

import { TrackingRecordRepository } from '../../infrastructure/repositories/tracking-record-repository';
import { TrackingEventRepository } from '../../infrastructure/repositories/tracking-event-repository';
import type { CreateTrackingRecordParams, TrackingRecordApiShape } from '../../infrastructure/repositories/tracking-record-repository';
import type { CreateTrackingEventParams } from '../../infrastructure/repositories/tracking-event-repository';
import { applyTrackingTransition, isTrackingTerminal } from '@/modules/mod-003-tracking/domain/services/tracking-state-machine';
import { ValidationError } from '@/shared/errors/app-errors';
import { ShipmentStatus } from '@/shared/types/enums';

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

    // Check if transitioning to terminal state
    const isTerminal = targetStatus === 'COMPLETED' || targetStatus === 'CANCELLED';

    // Update record status
    await this.trackingRecordRepo.updateStatus(trackingId, targetStatus);

    // Create event
    await this.createInternalEvent({
      trackingId,
      eventType: `SHIPMENT_${targetStatus.toUpperCase()}`,
      source: sourceModule,
      stateFrom: currentState,
      stateTo: targetStatus,
    });

    // If completing, mark record as completed at timestamp
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
