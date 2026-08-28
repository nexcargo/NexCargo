// NexCargo MOD-003 — Tracking & Visibility Module Domain Types
// Wave 2 — Stage 2B, Increment 1 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-003 §4 Core Domain Entities (4.1–4.8)

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type { ShipmentStatus } from '@/shared/types/enums';
import type {
  TrackingEventType, GpsUpdateSource, VerificationMethod, VerificationStatus,
  PodSubmissionMethod, PodVerificationStatus, BorderNotificationSent, VisibilityLevel,
} from '../enums';

// ============================================================
// Extended shipment status including CANCELLED
// MOD-003 spec §4.2 defines CANCELLED state not present in shared ShipmentStatus
// ============================================================

/** Extended shipment status — adds CANCELLED to shared ShipmentStatus values */
export type ShipmentStatusExtended = ShipmentStatus | 'CANCELLED';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** GPS coordinates with metadata per MOD-003 §4.5 */
export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  timestamp: string; // ISO 8601
  speedKmh?: number;
  headingDegrees?: number;
  accuracyMetres?: number;
}

/** Abstract location descriptor per MOD-003 §4.4 */
export interface LocationDescriptor {
  name: string; // e.g., "Lusaka", "Border Post", "En route"
  city?: string;
  province?: string;
  country?: string;
}

// ============================================================
// Entity types (extend BaseEntity)
// ============================================================

/**
 * ShipmentTrackingRecord — the visibility object for a shipment.
 * Per MOD-003 §4.1
 * Initialised only after ContractSigned event received from MOD-002.
 * Immutable except for status updates (which are event-driven).
 */
export interface ShipmentTrackingRecord extends BaseEntity {
  trackingId: string;
  bookingId: string;
  contractId: string;
  trackingActivatedAt: string; // ISO 8601 timestamp when tracking was initialised
  currentStatus: ShipmentStatusExtended;
  lastKnownState: ShipmentStatusExtended;
  visibilityLevel: VisibilityLevel;
  lastUpdatedTimestamp: string;
  completedAt?: string; // ISO 8601 timestamp when tracking was completed
}

/**
 * TrackingEvent — structured change in shipment state or significant operational occurrence.
 * Per MOD-003 §4.3
 * Immutable once recorded; append-only; no updates or deletions permitted.
 */
export interface TrackingEvent extends BaseEntity {
  eventId: string;
  trackingId: string;
  eventType: TrackingEventType;
  eventTimestamp: string; // ISO 8601
  eventSourceModule: 'DRIVER_APP' | 'TELEMATICS' | 'MANUAL' | 'SYSTEM';
  stateTransition?: {
    from: ShipmentStatusExtended;
    to: ShipmentStatusExtended;
  };
  metadataPayload: Record<string, unknown>;
}

/**
 * VisibilitySnapshot — point-in-time view of shipment status.
 * Per MOD-003 §4.4
 * Generated after each state transition or significant GPS update.
 * Stored for historical audit; filtered by visibilityLevel and user role.
 */
export interface VisibilitySnapshot extends BaseEntity {
  snapshotId: string;
  trackingId: string;
  status: ShipmentStatusExtended;
  locationDescriptor: LocationDescriptor;
  gpsCoordinates?: LocationCoordinates;
  timestamp: string; // ISO 8601
  derivedFromEventId: string;
  estimatedArrival?: string; // AI-generated ETA (advisory)
}

/**
 * GPSLocationUpdate — periodic location update from driver's mobile device or telematics source.
 * Per MOD-003 §4.5
 * Optimisation rules: 15 min moving / 60 min stationary intervals.
 * Offline coordinates stored locally and synced chronologically on reconnection.
 */
export interface GpsLocationUpdate extends BaseEntity {
  updateId: string;
  trackingId: string;
  latitude: number;
  longitude: number;
  timestamp: string; // ISO 8601
  speedKmh?: number;
  headingDegrees?: number;
  accuracyMetres?: number;
  source: GpsUpdateSource;
  isOffline: boolean;
  batteryLevel?: number; // percentage 0-100
  networkType?: string; // e.g., "LTE", "3G", "WiFi"
}

/**
 * ProofOfDelivery — legally admissible evidence confirming successful cargo delivery.
 * Per MOD-003 §4.6
 * Required before shipment can transition to Completed.
 * May be captured offline and uploaded automatically when connectivity returns.
 * Immutable once submitted.
 */
export interface ProofOfDelivery extends BaseEntity {
  podId: string;
  trackingId: string;
  bookingId: string;
  recipientName: string;
  recipientSignature: string; // digital signature image reference or hash
  deliveryPhotographs: string[]; // array of image references
  gpsCoordinates: LocationCoordinates;
  timestamp: string; // ISO 8601
  submissionMethod: PodSubmissionMethod;
  verificationStatus: PodVerificationStatus;
  adminOverride?: boolean; // optional authorisation for manual completion
}

/**
 * DriverIdentityVerificationEvent — verification of driver's identity before cargo handover.
 * Per MOD-003 §4.7
 * Verification methods configurable based on shipment risk level.
 * Failed attempts logged and may generate security alerts.
 */
export interface DriverIdentityVerificationEvent extends BaseEntity {
  verificationId: string;
  trackingId: string;
  bookingId: string;
  assignedDriverId: string; // reference to transporter's nominated driver
  verificationMethod: VerificationMethod;
  verificationStatus: VerificationStatus;
  attemptCount: number;
  failureReason?: string;
  timestamp: string; // ISO 8601
  riskScore?: number; // AI-assigned risk level for this shipment
}

/**
 * BorderCrossingEvent — shipment's arrival at or passage through a border post.
 * Per MOD-003 §4.8
 * Triggered by geofencing; immediately forces GPS location update.
 * Duplicate events for same crossing prevented.
 */
export interface BorderCrossingEvent extends BaseEntity {
  borderEventId: string;
  trackingId: string;
  borderPostId: string;
  entryTimestamp: string; // ISO 8601
  exitTimestamp?: string; // optional when departure detected
  geofenceRadius?: number; // configurable metres (default 5000m / 5km)
  notificationSent: BorderNotificationSent;
}
