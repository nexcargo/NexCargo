// NexCargo MOD-003 — Tracking State Machine Tests
// Wave 2 — Stage 2B, Increment 1 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)

import { describe, it, expect } from 'vitest';
import { ShipmentStatus } from '@/shared/types/enums';
import { validateTrackingTransition, applyTrackingTransition, isTrackingTerminal, type TrackingStatus } from '../domain/services/tracking-state-machine';

const CANCELLED = 'CANCELLED';
const COMPLETED = ShipmentStatus.COMPLETED;

describe('MOD-003 Tracking State Machine — Valid Transitions', () => {
  describe('Created -> Booked or Delayed', () => {
    it('allows Created to Booked transition (from MOD-002 contract signing)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.BOOKED)).not.toThrow();
    });

    it('allows Created to Delayed transition (exception)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.DELAYED)).not.toThrow();
    });

    it('rejects Created directly to InTransit (skips Booking and Pickup)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.IN_TRANSIT))
        .toThrow(/Invalid tracking transition/);
    });
  });

  describe('Booked -> AwaitingPickup / Cancelled / Delayed', () => {
    it('allows Booked to AwaitingPickup transition (driver en route)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.BOOKED, ShipmentStatus.AWAITING_PICKUP)).not.toThrow();
    });

    it('allows Booked to Cancelled (external termination)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.BOOKED, CANCELLED)).not.toThrow();
    });

    it('allows Booked to Delayed (exception)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.BOOKED, ShipmentStatus.DELAYED)).not.toThrow();
    });

    it('rejects Booked to Delivered (must go through pickup and transit first)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.BOOKED, ShipmentStatus.DELIVERED))
        .toThrow(/Invalid tracking transition/);
    });
  });

  describe('AwaitingPickup -> PickupAcknowledged / Cancelled / Delayed', () => {
    it('allows AwaitingPickup to PickupAcknowledged (driver verified + cargo collected)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.AWAITING_PICKUP, ShipmentStatus.PICKUP_ACKNOWLEDGED)).not.toThrow();
    });

    it('allows AwaitingPickup to Cancelled', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.AWAITING_PICKUP, CANCELLED)).not.toThrow();
    });

    it('allows AwaitingPickup to Delayed', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.AWAITING_PICKUP, ShipmentStatus.DELAYED)).not.toThrow();
    });

    it('rejects AwaitingPickup to InTransit (must pass through PickupAcknowledged)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.AWAITING_PICKUP, ShipmentStatus.IN_TRANSIT))
        .toThrow(/Invalid tracking transition/);
    });
  });

  describe('PickupAcknowledged -> InTransit / Cancelled / Delayed', () => {
    it('allows PickupAcknowledged to InTransit (first GPS update after pickup)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.PICKUP_ACKNOWLEDGED, ShipmentStatus.IN_TRANSIT)).not.toThrow();
    });

    it('allows PickupAcknowledged to Cancelled', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.PICKUP_ACKNOWLEDGED, CANCELLED)).not.toThrow();
    });

    it('allows PickupAcknowledged to Delayed', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.PICKUP_ACKNOWLEDGED, ShipmentStatus.DELAYED)).not.toThrow();
    });
  });

  describe('InTransit -> AtBorder / Delivered / Cancelled / Delayed', () => {
    it('allows InTransit to AtBorder (border crossing geofence entry)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.AT_BORDER)).not.toThrow();
    });

    it('allows InTransit to Delivered (destination reached without border crossing)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED)).not.toThrow();
    });

    it('allows InTransit to Cancelled', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.IN_TRANSIT, CANCELLED)).not.toThrow();
    });

    it('allows InTransit to Delayed', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELAYED)).not.toThrow();
    });
  });

  describe('AtBorder -> InTransit / Cancelled / Delayed', () => {
    it('allows AtBorder back to InTransit (exits border post)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.AT_BORDER, ShipmentStatus.IN_TRANSIT)).not.toThrow();
    });

    it('allows AtBorder to Cancelled', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.AT_BORDER, CANCELLED)).not.toThrow();
    });

    it('allows AtBorder to Delayed', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.AT_BORDER, ShipmentStatus.DELAYED)).not.toThrow();
    });

    it('rejects AtBorder to Delivered (still at border, must resume transit first)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.AT_BORDER, ShipmentStatus.DELIVERED))
        .toThrow(/Invalid tracking transition/);
    });
  });

  describe('Delayed -> recovery paths', () => {
    it('allows Delayed back to InTransit (resumption after delay clears during transit)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.DELAYED, ShipmentStatus.IN_TRANSIT)).not.toThrow();
    });

    it('allows Delayed back to AwaitingPickup (delay at pickup resolved)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.DELAYED, ShipmentStatus.AWAITING_PICKUP)).not.toThrow();
    });

    it('allows Delayed to Delivered (delay cleared at destination)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.DELAYED, ShipmentStatus.DELIVERED)).not.toThrow();
    });

    it('allows Delayed to BorderCrossing path via InTransit round-trip', () => {
      // Delayed -> IN_TRANSIT -> AT_BORDER should work (tested separately)
      expect(() => validateTrackingTransition(ShipmentStatus.DELAYED, ShipmentStatus.IN_TRANSIT)).not.toThrow();
      expect(() => validateTrackingTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.AT_BORDER)).not.toThrow();
    });

    it('allows Delayed to Cancelled', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.DELAYED, CANCELLED)).not.toThrow();
    });
  });

  describe('Delivered -> Completed / Cancelled', () => {
    it('allows Delivered to Completed (POD verified)', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.DELIVERED, ShipmentStatus.COMPLETED)).not.toThrow();
    });

    it('allows Delivered to Cancelled', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.DELIVERED, CANCELLED)).not.toThrow();
    });
  });
});

describe('MOD-003 Tracking State Machine — Terminal States', () => {
  it('COMPLETED has no outgoing transitions', () => {
    expect(() => validateTrackingTransition(COMPLETED, ShipmentStatus.IN_TRANSIT))
      .toThrow(/terminal/);
  });

  it('CANCELLED has no outgoing transitions', () => {
    expect(() => validateTrackingTransition(CANCELLED, ShipmentStatus.IN_TRANSIT))
      .toThrow(/terminal/);
  });

  it('no terminal state allows self-transition', () => {
    expect(() => validateTrackingTransition(COMPLETED, COMPLETED))
      .toThrow(/terminal/);
    expect(() => validateTrackingTransition(CANCELLED, CANCELLED))
      .toThrow(/terminal/);
  });
});

describe('MOD-003 Tracking State Machine — Terminal Detection', () => {
  it('isTrackingTerminal returns true for COMPLETED', () => {
    expect(isTrackingTerminal(COMPLETED)).toBe(true);
  });

  it('isTrackingTerminal returns true for CANCELLED', () => {
    expect(isTrackingTerminal(CANCELLED)).toBe(true);
  });

  it('isTrackingTerminal returns false for non-terminal states', () => {
    expect(isTrackingTerminal(ShipmentStatus.CREATED)).toBe(false);
    expect(isTrackingTerminal(ShipmentStatus.BOOKED)).toBe(false);
    expect(isTrackingTerminal(ShipmentStatus.AWAITING_PICKUP)).toBe(false);
    expect(isTrackingTerminal(ShipmentStatus.PICKUP_ACKNOWLEDGED)).toBe(false);
    expect(isTrackingTerminal(ShipmentStatus.IN_TRANSIT)).toBe(false);
    expect(isTrackingTerminal(ShipmentStatus.AT_BORDER)).toBe(false);
    expect(isTrackingTerminal(ShipmentStatus.DELAYED)).toBe(false);
    expect(isTrackingTerminal(ShipmentStatus.DELIVERED)).toBe(false);
  });
});

describe('MOD-003 Tracking State Machine — Full Lifecycle Chain', () => {
  it('runs through primary path: Created -> Booked -> AwaitingPickup -> PickupAcknowledged -> InTransit', () => {
    let status: TrackingStatus = ShipmentStatus.CREATED;
    status = applyTrackingTransition(status, ShipmentStatus.BOOKED);
    status = applyTrackingTransition(status, ShipmentStatus.AWAITING_PICKUP);
    status = applyTrackingTransition(status, ShipmentStatus.PICKUP_ACKNOWLEDGED);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);
    expect(status).toBe(ShipmentStatus.IN_TRANSIT);
  });

  it('completes full lifecycle with border crossing: Created -> ... -> InTransit -> AtBorder -> InTransit -> Delivered -> Completed', () => {
    let status: TrackingStatus = ShipmentStatus.CREATED;
    status = applyTrackingTransition(status, ShipmentStatus.BOOKED);
    status = applyTrackingTransition(status, ShipmentStatus.AWAITING_PICKUP);
    status = applyTrackingTransition(status, ShipmentStatus.PICKUP_ACKNOWLEDGED);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);
    status = applyTrackingTransition(status, ShipmentStatus.AT_BORDER);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);
    status = applyTrackingTransition(status, ShipmentStatus.DELIVERED);
    status = applyTrackingTransition(status, ShipmentStatus.COMPLETED);
    expect(status).toBe(ShipmentStatus.COMPLETED);
    expect(isTrackingTerminal(status)).toBe(true);
  });

  it('completes direct lifecycle without border crossing: InTransit -> Delivered -> Completed', () => {
    let status: TrackingStatus = ShipmentStatus.CREATED;
    status = applyTrackingTransition(status, ShipmentStatus.BOOKED);
    status = applyTrackingTransition(status, ShipmentStatus.AWAITING_PICKUP);
    status = applyTrackingTransition(status, ShipmentStatus.PICKUP_ACKNOWLEDGED);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);
    status = applyTrackingTransition(status, ShipmentStatus.DELIVERED);
    status = applyTrackingTransition(status, ShipmentStatus.COMPLETED);
    expect(status).toBe(ShipmentStatus.COMPLETED);
    expect(isTrackingTerminal(status)).toBe(true);
  });

  it('supports border checkpoint round-trip multiple times', () => {
    let status: TrackingStatus = ShipmentStatus.CREATED;
    status = applyTrackingTransition(status, ShipmentStatus.BOOKED);
    status = applyTrackingTransition(status, ShipmentStatus.AWAITING_PICKUP);
    status = applyTrackingTransition(status, ShipmentStatus.PICKUP_ACKNOWLEDGED);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);

    // First border crossing
    status = applyTrackingTransition(status, ShipmentStatus.AT_BORDER);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);

    // Second border crossing
    status = applyTrackingTransition(status, ShipmentStatus.AT_BORDER);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);

    expect(status).toBe(ShipmentStatus.IN_TRANSIT);
  });

  it('handles delayed exception during transit, recovers via InTransit', () => {
    let status: TrackingStatus = ShipmentStatus.CREATED;
    status = applyTrackingTransition(status, ShipmentStatus.BOOKED);
    status = applyTrackingTransition(status, ShipmentStatus.AWAITING_PICKUP);
    status = applyTrackingTransition(status, ShipmentStatus.PICKUP_ACKNOWLEDGED);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);

    // Exception delay
    status = applyTrackingTransition(status, ShipmentStatus.DELAYED);
    // Recovery: resume transit
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);
    status = applyTrackingTransition(status, ShipmentStatus.AT_BORDER);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);
    status = applyTrackingTransition(status, ShipmentStatus.DELIVERED);
    status = applyTrackingTransition(status, ShipmentStatus.COMPLETED);

    expect(status).toBe(ShipmentStatus.COMPLETED);
  });

  it('handles delayed exception recovered at destination', () => {
    let status: TrackingStatus = ShipmentStatus.CREATED;
    status = applyTrackingTransition(status, ShipmentStatus.BOOKED);
    status = applyTrackingTransition(status, ShipmentStatus.AWAITING_PICKUP);
    status = applyTrackingTransition(status, ShipmentStatus.PICKUP_ACKNOWLEDGED);
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);

    // Exception delay, then cleared at destination
    status = applyTrackingTransition(status, ShipmentStatus.DELAYED);
    status = applyTrackingTransition(status, ShipmentStatus.DELIVERED);
    status = applyTrackingTransition(status, ShipmentStatus.COMPLETED);

    expect(status).toBe(ShipmentStatus.COMPLETED);
  });
});
