// NexCargo MOD-003 — Tracking & Visibility Module Local Enums
// Wave 2 — Stage 2B, Increment 1 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-003 §4 Core Domain Entities, §5 Lifecycle Model

/** Tracking event types per MOD-003 §8 Event Model */
export enum TrackingEventType {
  TRACKING_INITIALISED = 'TRACKING_INITIALISED',
  TRIP_STARTED = 'TRIP_STARTED',
  AWAITING_PICKUP = 'AWAITING_PICKUP',
  PICKUP_CONFIRMED = 'PICKUP_CONFIRMED',
  SHIPMENT_IN_TRANSIT = 'SHIPMENT_IN_TRANSIT',
  BORDER_CHECKPOINT_REACHED = 'BORDER_CHECKPOINT_REACHED',
  BORDER_CHECKPOINT_EXITED = 'BORDER_CHECKPOINT_EXITED',
  SHIPMENT_DELAYED = 'SHIPMENT_DELAYED',
  DELIVERY_CONFIRMED = 'DELIVERY_CONFIRMED',
  POD_SUBMITTED = 'POD_SUBMITTED',
  POD_VERIFIED = 'POD_VERIFIED',
  TRACKING_COMPLETED = 'TRACKING_COMPLETED',
  DRIVER_VERIFIED = 'DRIVER_VERIFIED',
  DRIVER_VERIFICATION_FAILED = 'DRIVER_VERIFICATION_FAILED',
  TRACKING_CANCELLED = 'TRACKING_CANCELLED',
}

/** GPS update source per MOD-003 §4.5 */
export enum GpsUpdateSource {
  GPS = 'GPS',
  NETWORK = 'NETWORK',
  OFFLINE_SYNC = 'OFFLINE_SYNC',
}

/** Verification methods per MOD-003 §4.7 */
export enum VerificationMethod {
  QR_CODE = 'QR_CODE',
  OTP = 'OTP',
  SECURE_PIN = 'SECURE_PIN',
  BIOMETRIC = 'BIOMETRIC',
  DRIVER_LICENSE = 'DRIVER_LICENSE',
}

/** Driver verification status per MOD-003 §4.7 */
export enum VerificationStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

/** Visibility levels for tracking snapshots per MOD-003 §4.4 */
export enum VisibilityLevel {
  PUBLIC = 'PUBLIC',
  RESTRICTED = 'RESTRICTED',
  INTERNAL = 'INTERNAL',
}

/** POD submission method per MOD-003 §4.6 */
export enum PodSubmissionMethod {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

/** POD verification status per MOD-003 §4.6 */
export enum PodVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

/** Border crossing notification status */
export enum BorderNotificationSent {
  NO = 'NO',
  YES = 'YES',
}
