// NexCargo MOD-003 — Tracking State Machine
// Wave 2 — Stage 2B, Increment 1 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-003 §4.2 (Shipment Status State), §5 (Lifecycle Model)
//
// Shipment lifecycle per MOD-003 §5:
//   Created -> Booked -> AwaitingPickup -> PickupAcknowledged -> InTransit -> [BorderCheckpoint] -> Delivered -> Completed
//   Any active state -> Cancelled (external trigger)
//   Multiple states -> Delayed (exception state, recovers to parent state)

import { ShipmentStatus } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

/** Extended shipment status — adds CANCELLED beyond shared ShipmentStatus */
export type TrackingStatus = `${ShipmentStatus}` | 'CANCELLED';

const CANCELLED = 'CANCELLED' as const;

// ============================================================
// Valid transition map — single source of truth per MOD-003 §5
// AT_BORDER is optional (geofencing). IN_TRANSIT -> DELIVERED
// works for non-border-crossing shipments.
// ============================================================

const VALID_TRANSITIONS: Record<TrackingStatus, TrackingStatus[]> = {
  [ShipmentStatus.CREATED]: [
    ShipmentStatus.BOOKED,
    ShipmentStatus.DELAYED,
  ],
  [ShipmentStatus.BOOKED]: [
    ShipmentStatus.AWAITING_PICKUP,
    CANCELLED,
    ShipmentStatus.DELAYED,
  ],
  [ShipmentStatus.AWAITING_PICKUP]: [
    ShipmentStatus.PICKUP_ACKNOWLEDGED,
    CANCELLED,
    ShipmentStatus.DELAYED,
  ],
  [ShipmentStatus.PICKUP_ACKNOWLEDGED]: [
    ShipmentStatus.IN_TRANSIT,
    CANCELLED,
    ShipmentStatus.DELAYED,
  ],
  [ShipmentStatus.IN_TRANSIT]: [
    ShipmentStatus.AT_BORDER,
    ShipmentStatus.DELIVERED,
    CANCELLED,
    ShipmentStatus.DELAYED,
  ],
  [ShipmentStatus.AT_BORDER]: [
    ShipmentStatus.IN_TRANSIT,
    CANCELLED,
    ShipmentStatus.DELAYED,
  ],
  /** Delayed recovers to any state the parent could reach */
  [ShipmentStatus.DELAYED]: [
    ShipmentStatus.AWAITING_PICKUP,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.AT_BORDER,
    ShipmentStatus.DELIVERED,
    CANCELLED,
  ],
  [ShipmentStatus.DELIVERED]: [
    ShipmentStatus.COMPLETED,
    CANCELLED,
  ],
  [ShipmentStatus.COMPLETED]: [],
  [CANCELLED]: [],
};

// ============================================================
// Helper: get allowed transitions for a given status
// ============================================================

function getAllowedTransitions(status: TrackingStatus): TrackingStatus[] {
  return [...VALID_TRANSITIONS[status]];
}

// ============================================================
// validateTrackingTransition — throws ValidationError if invalid
// Per MOD-003 §7.1: "A shipment MUST have exactly one current state."
// Per MOD-003 §7.2: "State transitions MUST originate from recorded events."
// ============================================================

export function validateTrackingTransition(
  currentStatus: TrackingStatus,
  targetStatus: TrackingStatus,
): void {
  const allowed = getAllowedTransitions(currentStatus);

  if (!allowed.includes(targetStatus)) {
    throw new ValidationError(
      `Invalid tracking transition: ${currentStatus} → ${targetStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      { currentStatus, targetStatus, allowedTransitions: allowed },
    );
  }
}

// ============================================================
// applyTrackingTransition — returns validated new state (advisory-only, no persistence)
// This is an advisory-only function — it does NOT persist state or emit events.
// Persistence and event emission are handled by the application layer.
// ============================================================

export function applyTrackingTransition(
  currentStatus: TrackingStatus,
  targetStatus: TrackingStatus,
): TrackingStatus {
  validateTrackingTransition(currentStatus, targetStatus);
  return targetStatus;
}

// ============================================================
// isTrackingTerminal — returns true if no further transitions allowed
// Terminal states: COMPLETED, CANCELLED
// ============================================================

export function isTrackingTerminal(status: TrackingStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}
