// NexCargo MOD-003 — Tracking Validation Services
// Wave 2 — Stage 2B, Increment 1 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-003 §4 Core Domain Entities validation rules

import { ShipmentStatus } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';
import type {
  ShipmentTrackingRecord, GpsLocationUpdate, ProofOfDelivery,
  DriverIdentityVerificationEvent, BorderCrossingEvent, VisibilitySnapshot,
} from '../types/entities';
import type { PodSubmissionMethod, PodVerificationStatus, VerificationMethod, VerificationStatus, VisibilityLevel } from '../enums';

// ============================================================
// GPS Constants for validation per MOD-003 §4.5
// ============================================================

const MAX_LATITUDE = 90;
const MIN_LATITUDE = -90;
const MAX_LONGITUDE = 180;
const MIN_LONGITUDE = -180;
const MIN_ACCURACY_METRES = 0;
const MAX_SPEED_KMH = 250;
const MIN_BATTERY_PERCENTAGE = 0;
const MAX_BATTERY_PERCENTAGE = 100;
const DEFAULT_GEOFENCE_RADIUS_METRES = 5000; // 5km

// ============================================================
// validateShipmentTrackingRecord — validates a new tracking record creation
// Per MOD-003 §4.1: "A tracking record is initialised only after a contract is signed in MOD-002"
// ============================================================

export function validateShipmentTrackingRecord(input: {
  bookingId: string;
  contractId: string;
  visibilityLevel: VisibilityLevel;
}): void {
  if (!input.bookingId || input.bookingId.trim().length === 0) {
    throw new ValidationError('bookingId is required', { field: 'bookingId' });
  }
  if (!input.contractId || input.contractId.trim().length === 0) {
    throw new ValidationError('contractId is required', { field: 'contractId' });
  }
}

// ============================================================
// validateGpsLocationUpdate — validates GPS coordinate ranges and metadata
// Per MOD-003 §4.5: Coordinates must include valid timestamp, invalid coordinates rejected
// ============================================================

export function validateGpsLocationUpdate(input: {
  trackingId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  accuracyMetres?: number;
  batteryLevel?: number;
  isOffline: boolean;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.trackingId || input.trackingId.trim().length === 0) {
    errors.push('trackingId is required');
  }

  if (input.latitude < MIN_LATITUDE || input.latitude > MAX_LATITUDE) {
    errors.push(`Latitude must be between ${MIN_LATITUDE} and ${MAX_LATITUDE}, got ${input.latitude}`);
  }

  if (input.longitude < MIN_LONGITUDE || input.longitude > MAX_LONGITUDE) {
    errors.push(`Longitude must be between ${MIN_LONGITUDE} and ${MAX_LONGITUDE}, got ${input.longitude}`);
  }

  if (typeof input.speedKmh === 'number' && (input.speedKmh < 0 || input.speedKmh > MAX_SPEED_KMH)) {
    errors.push(`Speed must be between 0 and ${MAX_SPEED_KMH} km/h, got ${input.speedKmh}`);
  }

  if (typeof input.accuracyMetres === 'number' && input.accuracyMetres < MIN_ACCURACY_METRES) {
    errors.push(`Accuracy must be >= ${MIN_ACCURACY_METRES}m, got ${input.accuracyMetres}`);
  }

  if (typeof input.batteryLevel === 'number') {
    if (input.batteryLevel < MIN_BATTERY_PERCENTAGE || input.batteryLevel > MAX_BATTERY_PERCENTAGE) {
      errors.push(`Battery level must be between ${MIN_BATTERY_PERCENTAGE} and ${MAX_BATTERY_PERCENTAGE}, got ${input.batteryLevel}`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateProofOfDelivery — validates POD evidence completeness
// Per MOD-003 §4.6: POD is mandatory before shipment can transition to Completed
// ============================================================

export function validateProofOfDelivery(input: {
  trackingId: string;
  bookingId: string;
  recipientName: string;
  signatureHashOrReference: string;
  photographCount: number;
  hasCoordinates: boolean;
  submissionMethod: PodSubmissionMethod;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.trackingId || input.trackingId.trim().length === 0) {
    errors.push('trackingId is required');
  }

  if (!input.bookingId || input.bookingId.trim().length === 0) {
    errors.push('bookingId is required');
  }

  if (!input.recipientName || input.recipientName.trim().length === 0) {
    errors.push('recipientName is required');
  }

  if (!input.signatureHashOrReference || input.signatureHashOrReference.trim().length === 0) {
    errors.push('signature reference or hash is required');
  }

  if (input.photographCount <= 0) {
    errors.push('At least one delivery photograph is required');
  }

  if (!input.hasCoordinates) {
    errors.push('GPS coordinates are required for POD');
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// assertPodMandatoryBeforeCompletion — enforces POD requirement per §7.5
// Per MOD-003 §7.5: "POD is mandatory before shipment can reach Completed state."
// Per MOD-003 §7.5: "An administrator may authorise a completion exception in exceptional circumstances."
// ============================================================

export function assertPodMandatoryBeforeCompletion(hasPod: boolean, adminOverride?: boolean): void {
  if (!hasPod && !adminOverride) {
    throw new ValidationError(
      'Proof of Delivery is mandatory before shipment can reach Completed state. ' +
        'Provide valid POD data or set adminOverride to true for exceptional circumstances.',
      { hasPod, adminOverride },
    );
  }
}

// ============================================================
// validateDriverIdentityVerification — validates driver identity check fields
// Per MOD-003 §4.7: Verification occurs before cargo handover at pickup
// ============================================================

export function validateDriverIdentityVerification(input: {
  trackingId: string;
  assignedDriverId: string;
  verificationMethod: VerificationMethod;
  attemptCount: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.trackingId || input.trackingId.trim().length === 0) {
    errors.push('trackingId is required');
  }

  if (!input.assignedDriverId || input.assignedDriverId.trim().length === 0) {
    errors.push('assignedDriverId is required');
  }

  if (!input.verificationMethod) {
    errors.push('verificationMethod is required');
  }

  if (input.attemptCount < 1) {
    errors.push('attemptCount must be >= 1');
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateBorderCrossingEvent — validates border crossing geofencing parameters
// Per MOD-003 §4.8: Duplicate border events for same crossing prevented
// Per MOD-003 §4.8: Default geofenceRadius = 5km (5000m)
// ============================================================

export function validateBorderCrossingEvent(input: {
  trackingId: string;
  borderPostId: string;
  entryTimestamp: string;
  exitTimestamp?: string;
  geofenceRadius?: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.trackingId || input.trackingId.trim().length === 0) {
    errors.push('trackingId is required');
  }

  if (!input.borderPostId || input.borderPostId.trim().length === 0) {
    errors.push('borderPostId is required');
  }

  if (!input.entryTimestamp || input.entryTimestamp.trim().length === 0) {
    errors.push('entryTimestamp is required');
  }

  if (input.exitTimestamp && input.entryTimestamp && input.exitTimestamp <= input.entryTimestamp) {
    errors.push('exitTimestamp must be after entryTimestamp');
  }

  if (typeof input.geofenceRadius === 'number' && input.geofenceRadius <= 0) {
    errors.push(`geofenceRadius must be positive, using default ${DEFAULT_GEOFENCE_RADIUS_METRES}m`);
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateVisibilitySnapshotFilter — validates visibility snapshot query parameters
// Per MOD-003 §4.4 / §7.3: Snapshots filtered by visibilityLevel and user role
// ============================================================

export function validateVisibilitySnapshotRequest(input: {
  trackingId: string;
  visibilityLevel: VisibilityLevel;
  limit?: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.trackingId || input.trackingId.trim().length === 0) {
    errors.push('trackingId is required');
  }

  if (!input.visibilityLevel) {
    errors.push('visibilityLevel is required');
  }

  if (typeof input.limit === 'number' && input.limit < 1) {
    errors.push('limit must be >= 1');
  }

  return { isValid: errors.length === 0, errors };
}
