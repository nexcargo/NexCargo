// NexCargo MOD-003 — POD Submission Service (C7-001 Phase 1)
// Owner: MOD-003 Tracking & Visibility Module
// Validates POD evidence + coordinates Supabase Storage upload references

import { PodRepository } from '../../infrastructure/repositories/pod-repository';
import type { CreatePodParams, PodApiShape } from '../../infrastructure/repositories/pod-repository';
import { TrackingOrchestratorService } from './tracking-orchestrator-service';
import { ValidationError } from '@/shared/errors/app-errors';
import { ShipmentStatus } from '@/shared/types/enums';

/**
 * Service for handling POD submission including validation.
 */
export class PodSubmissionService {
  private readonly podRepo = new PodRepository();
  private readonly trackingOrchestrator = new TrackingOrchestratorService();

  /**
   * Submit POD evidence with validation against MOD-003 §4.6/§7.5.
   * 
   * Business rules enforced:
   * - POD is mandatory before shipment can reach Completed state
   * - Signature reference required
   * - At least one photograph required
   * - GPS coordinates required at delivery location
   */
  async submitPOD(params: Omit<CreatePodParams, 'submissionMethod'>): Promise<PodApiShape> {
    // Validate required fields
    this.validatePODPayload(params);

    const now = new Date().toISOString();

    // Insert POD record with PENDING verification status
    const pod = await this.podRepo.create({
      ...params,
      submissionMethod: 'ONLINE',
    });

    return pod;
  }

  /**
   * Verify or reject a submitted POD.
   * Only MODERATOR+ roles can call this via API layer.
   * 
   * @param podId - The POD identifier
   * @param verify - true = approve (set VERIFIED), false = reject (set REJECTED)
   * @param adminOverride - Whether admin override was applied
   */
  async verifyPOD(podId: string, verify: boolean, adminOverride?: boolean): Promise<void> {
    await this.podRepo.verify({ podId, verify, adminOverride });
  }

  /**
   * Complete tracking after successful POD verification.
   * Per MOD-003 §7.5: POD verified → shipment transitions to COMPLETED.
   */
  async completeAfterPODVVerification(podId: string): Promise<void> {
    const pod = await this.podRepo.getById(podId);
    if (!pod) {
      throw new ValidationError(`POD ${podId} not found`);
    }

    // Mark tracking as completed
    await this.trackingOrchestrator.updateTrackingStatus(pod.trackingId, ShipmentStatus.COMPLETED, 'MOD-003');
  }

  private validatePODPayload(params: Omit<CreatePodParams, 'submissionMethod'>): void {
    const errors: string[] = [];

    if (!params.trackingId || params.trackingId.trim().length === 0) {
      errors.push('trackingId is required');
    }

    if (!params.bookingId || params.bookingId.trim().length === 0) {
      errors.push('bookingId is required');
    }

    if (!params.recipientName || params.recipientName.trim().length === 0) {
      errors.push('recipientName is required');
    }

    if (!params.signatureRef || params.signatureRef.trim().length === 0) {
      errors.push('signatureRef is required');
    }

    if (!params.photoRefs || params.photoRefs.length < 1) {
      errors.push('At least one photo reference is required');
    }

    if (typeof params.gpsLat !== 'number' || params.gpsLat < -90 || params.gpsLat > 90) {
      errors.push('gpsLat must be between -90 and 90');
    }

    if (typeof params.gpsLon !== 'number' || params.gpsLon < -180 || params.gpsLon > 180) {
      errors.push('gpsLon must be between -180 and 180');
    }

    if (errors.length > 0) {
      throw new ValidationError('POD validation failed', { errors });
    }
  }
}
