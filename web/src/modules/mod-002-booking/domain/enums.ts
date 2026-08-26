// NexCargo MOD-002 Domain Enums — Canonical type definitions sourced from Primitive Registry
// All modules MUST use these enums. No local redefinitions allowed.

/** Booking lifecycle states per MOD-002 §4.1 */
export enum BookingStatus {
  REQUESTED = 'REQUESTED',
  ALIGNMENT_CHECKED = 'ALIGNMENT_CHECKED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/** Digital signature statuses per MOD-002 §4.2 */
export enum DigitalSignatureStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  EXECUTED = 'EXECUTED',
}

/** Amendment change types per MOD-002 §4.3 */
export enum ChangeType {
  PRICE_ADJUSTMENT = 'PRICE_ADJUSTMENT',
  WINDOW_MODIFICATION = 'WINDOW_MODIFICATION',
  SERVICE_ADDITION = 'SERVICE_ADDITION',
  LIABILITY_REVISION = 'LIABILITY_REVISION',
  CANCELLATION_RULE_UPDATE = 'CANCELLATION_RULE_UPDATE',
}

/** Approval statuses for amendments per MOD-002 §4.3 */
export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Negotiation thread statuses per MOD-002 §4.5 */
export enum NegotiationStatus {
  OPEN = 'OPEN',
  OFFER_SENT = 'OFFER_SENT',
  COUNTER_OFFER_SENT = 'COUNTER_OFFER_SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

/** Validation statuses for booking requests per MOD-002 §4.4 */
export enum ValidationStatus {
  PENDING = 'PENDING',
  ALIGNMENT_OK = 'ALIGNMENT_OK',
  ACCOUNT_ACTIVE = 'ACCOUNT_ACTIVE',
  READY = 'READY',
  REJECTED = 'REJECTED',
}
