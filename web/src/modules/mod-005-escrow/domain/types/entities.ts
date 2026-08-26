// NexCargo MOD-005 — Core Domain Entities
// Wave 2 — Phase 2A, Increment 1 — Authorized per HAO-MOD005-INC1
// Reference: MOD-005 §4 Core Domain Entities
//
// Entities extend BaseEntity. Shared enums (EscrowState, PaymentMethod, CurrencyCode, UserRole) from @/shared/types/enums.
// Module-local enums imported from ../enums.

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type { EscrowState, PaymentMethod, CurrencyCode, UserRole } from '@/shared/types/enums';
import type { MismatchStatus, WalletType, ReleaseMilestoneEnum, DisputeResolutionOutcomeEnum, DisputeStatus, SettlementStatus, PaymentIntentStatus, ResolutionStatus } from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Geo-location for settlement destination */
export interface LocationReference {
  address?: string;
  city?: string;
  province?: string;
  country?: string;
}

/** Amount with currency context */
export interface AmountWithCurrency {
  amount: number;
  currency: CurrencyCode;
}

/** Bank reference for external system linkage */
export interface BankReference {
  bankReferenceId: string;
  bankTransactionId?: string;
  bankHoldReferenceId?: string;
}

// ============================================================
// Entity types (extend BaseEntity)
// ============================================================

/**
 * Escrow Account (Logical Representation)
 * Per MOD-005 §4.1
 * State machine: PENDING_CREATION → FUNDS_INITIATED → FUNDS_LOCKED → PARTIAL_RELEASE | FINAL_RELEASE | DISPUTE_HOLD → ESCROW_CLOSED
 */
export interface EscrowAccount extends BaseEntity {
  escrowId: string;
  contractId: string; // From MOD-002 Contract
  payerId: string;    // Shipper user ID
  payeeId: string;    // Transporter user ID
  amount: number;
  currency: CurrencyCode;
  escrowStatus: EscrowState;
  bankReferenceId: string; // External system reference only (authoritative source)
  createdAt: Date;
  updatedAt: Date;
  /** Linked booking reference */
  bookingId?: string;
  /** Milestone release schedule (JSON serialization of ReleaseMilestone[]) */
  milestoneReleaseSchedule?: string;
}

/**
 * Payment Intent
 * Per MOD-005 §4.2
 * States: INITIATED → PENDING → CONFIRMED | FAILED | REFUNDED
 */
export interface PaymentIntent extends BaseEntity {
  paymentIntentId: string;
  escrowId: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethodType: PaymentMethod;
  status: PaymentIntentStatus;
  providerReferenceId?: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Settlement Record
 * Per MOD-005 §4.3
 * States: REQUESTED → APPROVED → EXECUTED | FAILED
 */
export interface SettlementRecord extends BaseEntity {
  settlementId: string;
  escrowId: string;
  settlementStatus: SettlementStatus;
  releaseAmount: number;
  releaseMilestone: ReleaseMilestoneEnum;
  bankTransactionId?: string;
  timestamp: Date;
}

/**
 * Dispute Record
 * Per MOD-005 §4.4
 * States: RAISED → HOLD_INSTRUCTED → UNDER_INVESTIGATION → RESOLVED
 */
export interface DisputeRecord extends BaseEntity {
  disputeId: string;
  escrowId: string;
  raisedBy: UserRole; // shipper or transporter
  disputeReason: string;
  disputeStatus: DisputeStatus;
  bankHoldReferenceId?: string;
  resolutionOutcome?: DisputeResolutionOutcomeEnum;
  resolvedBy?: UserRole; // moderator or admin
  resolvedAt?: Date;
  comments?: string;
}

/**
 * Reconciliation Record
 * Per MOD-005 §4.5
 */
export interface ReconciliationRecord extends BaseEntity {
  reconciliationId: string;
  escrowId: string;
  internalLedgerState: string; // JSON of internal ledger state snapshot
  externalBankState: string;   // JSON of external bank state snapshot
  paymentProviderState?: string; // JSON of payment provider state
  mismatchStatus: MismatchStatus;
  resolutionStatus: ResolutionStatus;
  mismatchDetails?: string;
  lastReconciledAt: Date;
}

/** Resolution status for reconciliation mismatches — imported from ../enums */
// (ResolutionStatus defined in domain/enums.ts)

/**
 * Digital Wallet (Non-Custodial Ledger)
 * Per MOD-005 §4.6
 */
export interface DigitalWallet extends BaseEntity {
  walletId: string;
  userId: string;
  walletType: WalletType;
  balance: number;
  currency: CurrencyCode;
  pendingTransactions: TransactionReference[];
  lastSyncTimestamp: Date;
}

/** Reference to a pending transaction in the digital wallet */
export interface TransactionReference {
  transactionId: string;
  direction: 'INCOMING' | 'OUTGOING';
  amount: number;
  currency: CurrencyCode;
  status: 'PENDING' | 'CONFIRMED' | 'REVERSED';
  timestamp: Date;
}
