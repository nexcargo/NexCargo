// NexCargo MOD-005 — Escrow & Payment Management Module Local Enums
// Wave 2 — Phase 2A, Increment 1 — Authorized per HAO-MOD005-INC1
// Reference: MOD-005 §4.x (Core Domain Entities), §5.x (Lifecycle Models)
//
// Shared enums (EscrowState, PaymentMethod, CurrencyCode, UserRole) are imported from @/shared/types/enums.
// Only enums NOT present in the shared set require local definition.

/** Dispute resolution outcome per MOD-005 §4.4 */
export enum DisputeResolutionOutcomeEnum {
  RELEASE_TO_TRANSPORTER = 'RELEASE_TO_TRANSPORTER',
  REFUND_TO_SHIPPER = 'REFUND_TO_SHIPPER',
  SPLIT_SETTLEMENT = 'SPLIT_SETTLEMENT',
}

/** Settlement release milestone per MOD-005 §4.3 */
export enum ReleaseMilestoneEnum {
  PICKUP_CONFIRMED = 'PICKUP_CONFIRMED',
  BORDER_CROSSING = 'BORDER_CROSSING',
  DELIVERY_CONFIRMED = 'DELIVERY_CONFIRMED',
  POD_APPROVED = 'POD_APPROVED',
}

/** Reconciliation mismatch status per MOD-005 §4.5 */
export type MismatchStatus = 'ALIGNED' | 'MISMATCH_DETECTED';

/** Wallet type per MOD-005 §4.6 */
export enum WalletType {
  SHIPPER = 'SHIPPER',
  TRANSPORTER = 'TRANSPORTER',
}

/** Payment intent status states per MOD-005 §4.2 */
export enum PaymentIntentStatus {
  INITIATED = 'INITIATED',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

/** Settlement status values per MOD-005 §4.3 */
export enum SettlementStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}

/** Dispute status values per MOD-005 §4.4 */
export enum DisputeStatus {
  RAISED = 'RAISED',
  HOLD_INSTRUCTED = 'HOLD_INSTRUCTED',
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
  RESOLVED = 'RESOLVED',
}

/** Resolution status for reconciliation mismatches per MOD-005 §4.5 */
export enum ResolutionStatus {
  PENDING = 'PENDING',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
}
