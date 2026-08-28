// NexCargo MOD-003 — MOD-003 BC Coordination Contracts (Design-Time)
// Wave 2 — Stage 2B, Increment 1 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-003 §8 Event Model, §9 Integration Boundaries
//
// Governance note: These are design-time data contracts only. No runtime event emission mechanism.
// They define the interface surface required for BC coordination between MOD-003 and other modules.
// No EventEmitter, EventBus, emit(), or subscribe() calls appear in this file.

/**
 * DeliveryConfirmedSignal — Signal emitted by MOD-003 when delivery is confirmed.
 * CONSUMED BY MOD-002 from MOD-003 signals.
 * Per MOD-003 §8: "DELIVERY_CONFIRMED – triggers contract completion."
 * Triggers: ContractStatus -> COMPLETED in MOD-002.
 */
export interface DeliveryConfirmedSignal {
  /** The tracking record being delivered */
  trackingId: string;
  /** Contract reference from the linked booking */
  contractId: string;
  /** Booking reference linked to this shipment */
  bookingId: string;
  /** POD reference associated with delivery confirmation */
  podId?: string;
  /** ISO 8601 timestamp of delivery confirmation */
  deliveredAt: string;
}

/**
 * TrackingCancelledSignal — Signal emitted by MOD-003 when tracking is cancelled.
 * CONSUMED BY MOD-002 from MOD-003 signals.
 * Per MOD-003 §8: "TRACKING_CANCELLED – triggers contract termination flow."
 */
export interface TrackingCancelledSignal {
  /** The tracking record being cancelled */
  trackingId: string;
  /** Contract reference from the linked booking */
  contractId: string;
  /** Booking reference linked to this shipment */
  bookingId: string;
  /** Reason for cancellation */
  cancellationReason: string;
  /** ISO 8601 timestamp of cancellation */
  cancelledAt: string;
  /** Module initiating the cancellation */
  cancelledByModule: 'MOD-002' | 'MOD-003';
}

/**
 * MilestoneReachedSignal — Signal emitted by MOD-003 when operational milestones occur.
 * CONSUMED BY MOD-005 / MOD-013 from MOD-003 signals.
 * Per MOD-003 §8: Informs MOD-005 financial settlement trigger chain (via ESS-001F).
 * Used to trigger settlement release based on milestones like PICKUP_CONFIRMED,
 * BORDER_CROSSING, DELIVERY_CONFIRMED, POD_APPROVED.
 */
export interface MilestoneReachedSignal {
  /** The tracking record reaching milestone */
  trackingId: string;
  /** Contract reference */
  contractId: string;
  /** Booking reference */
  bookingId: string;
  /** The milestone achieved (maps to MOD-005 ReleaseMilestoneEnum) */
  milestone: 'PICKUP_CONFIRMED' | 'BORDER_CROSSING' | 'DELIVERY_CONFIRMED' | 'POD_APPROVED';
  /** ISO 8601 timestamp of milestone achievement */
  reachedAt: string;
}

/**
 * VisibilitySnapshotRequest — Data shape for querying visibility snapshots.
 * CONSUMED BY MOD-003 from downstream consumers (MOD-007, MOD-008, MOD-012).
 * Per MOD-003 §4.4 / §9: "Snapshots are filtered by visibilityLevel and user role."
 */
export interface VisibilitySnapshotRequest {
  trackingId: string;
  visibilityLevel: 'PUBLIC' | 'RESTRICTED' | 'INTERNAL';
  sinceTimestamp?: string; // ISO 8601 — filter snapshots after this time
  limit?: number; // max snapshots to return
}
