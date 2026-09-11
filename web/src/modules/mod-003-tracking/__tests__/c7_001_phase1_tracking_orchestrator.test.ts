// NexCargo MOD-003 — Tracking Orchestrator State Machine Tests (C7-001 Phase 1)
import { describe, it, expect } from 'vitest';
import { applyTrackingTransition } from '@/modules/mod-003-tracking/domain/services/tracking-state-machine';
import { ShipmentStatus } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

describe('TrackingOrchestratorService state transitions', () => {
  it('transitions CREATED → BOOKED successfully', () => {
    const result = applyTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.BOOKED);
    expect(result).toBe(ShipmentStatus.BOOKED);
  });

  it('transitions AWAITING_PICKUP → PICKUP_ACKNOWLEDGED', () => {
    const result = applyTrackingTransition(ShipmentStatus.AWAITING_PICKUP, ShipmentStatus.PICKUP_ACKNOWLEDGED);
    expect(result).toBe(ShipmentStatus.PICKUP_ACKNOWLEDGED);
  });

  it('rejects invalid transition from CREATED to COMPLETED directly', () => {
    try {
      applyTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.COMPLETED);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });

  it('marks DELIVERED as transitable to COMPLETED', () => {
    const result = applyTrackingTransition(ShipmentStatus.DELIVERED, ShipmentStatus.COMPLETED);
    expect(result).toBe(ShipmentStatus.COMPLETED);
  });
});
