// NexCargo MOD-013 — Core Domain Entities
// Wave 2 — Phase 2A, Increment 2 — Authorized per HAO-MOD013-INC2
// Reference: MOD-013 §4 Core Domain Entities (4.1–4.9)
//
// Entities extend BaseEntity. Shared enums (EscrowState, CurrencyCode, PaymentMethod) from @/shared/types/enums.
// Module-local enums imported from ../enums. BC interfaces imported from ./bc-contract.

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type { EscrowState, CurrencyCode, PaymentMethod } from '@/shared/types/enums';
import type {
  TransactionType, LedgerEntryType, DebitCreditType, SettlementType,
  PayoutStatus, RefundType, FeeType, AuditType, AuditVerificationStatus, RecipientChannel,
} from '../enums';
import type { ReleaseMilestoneEnum } from '@/modules/mod-005-escrow/domain/enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Bank reference for external system linkage */
export interface BankReference {
  bankReferenceId: string;
  bankExecutionReference?: string;
}

/** Amount with currency context */
export interface AmountWithCurrency {
  amount: number;
  currency: CurrencyCode;
}

/** Exchange rate metadata */
export interface ExchangeRateMetadata {
  exchangeRate: number;
  rateTimestamp: Date;
  rateSource: string;
}

/** Financial transaction metadata */
export interface TransactionMetadata {
  correlationId?: string;
  externalProviderReference?: string;
  feeAmount?: number;
}

// ============================================================
// Entity types (extend BaseEntity)
// ============================================================

/**
 * Escrow Account Object (§4.1)
 * Logical escrow state representation (NOT actual funds).
 * Uses shared EscrowState enum values.
 */
export interface EscrowAccountObject extends BaseEntity {
  /** Unique escrow identifier */
  escrowId: string;
  /** Shipment reference (MOD-003) */
  shipmentId: string;
  /** Contract reference (MOD-002) */
  contractId: string;
  /** Shipper user ID */
  payerId: string;
  /** Transporter user ID */
  payeeId: string;
  /** Current escrow status from shared enum */
  escrowStatus: EscrowState;
  /** Total amount held in escrow */
  totalAmount: number;
  /** Currency code (MZN/USD/ZAR) */
  currency: CurrencyCode;
  /** Funding source reference (MOD-011 integration) */
  fundingSource?: string;
  /** External bank system reference only (authoritative) */
  bankReferenceId: string;
  /** Milestone-based release schedule as JSON */
  milestoneReleaseSchedule?: string;
}

/**
 * Payment Transaction Object (§4.2)
 * Represents payment event abstraction across the financial layer.
 */
export interface PaymentTransactionObject extends BaseEntity {
  /** Unique transaction identifier */
  transactionId: string;
  /** Transaction type classification */
  transactionType: TransactionType;
  /** Transaction amount */
  amount: number;
  /** Currency code */
  currency: CurrencyCode;
  /** Payment channel identifier */
  paymentChannel: PaymentMethod;
  /** Transaction status */
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';
  /** Request correlation identifier */
  correlationId?: string;
  /** External provider reference */
  externalProviderReference?: string;
  /** Idempotency key for duplicate prevention */
  idempotencyKey: string;
  /** Platform fee deducted (if applicable) */
  feeAmount?: number;
}

/**
 * Settlement Request Object (§4.3)
 * Payout execution trigger structure initiated by operational confirmation.
 */
export interface SettlementRequestObject extends BaseEntity {
  /** Unique settlement identifier */
  settlementId: string;
  /** Source escrow account */
  escrowId: string;
  /** Triggering operational event */
  triggerEvent: ReleaseMilestoneEnum;
  /** Module that originated the trigger */
  requestedByModule: 'MOD-003';
  /** Approval workflow status */
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  /** Bank execution reference */
  bankExecutionReference?: string;
  /** Settlement type classification */
  settlementType: SettlementType;
  /** Total settlement amount */
  settlementAmount: number;
  /** ISO 8601 timestamp of request */
  requestedAt: Date;
  /** Optional ISO 8601 timestamp of completion */
  executedAt?: Date;
  /** Retry counter for failed settlements */
  retryCount: number;
}

/**
 * Financial Ledger Mirror Object (§4.4)
 * Internal read-only financial state mirror following double-entry accounting.
 */
export interface FinancialLedgerMirrorObject extends BaseEntity {
  /** Unique ledger entry identifier */
  ledgerEntryId: string;
  /** Reference to the originating transaction */
  transactionReference: string;
  /** Debit or credit classification */
  debitCreditType: DebitCreditType;
  /** Entry amount */
  amount: number;
  /** Entry currency */
  currency: CurrencyCode;
  /** Source entity or account */
  source: string;
  /** Destination entity or account */
  destination: string;
  /** Entry timestamp */
  timestamp: Date;
  /** Reconciliation alignment status */
  reconciliationStatus: 'PENDING' | 'ALIGNED' | 'MISMATCH_DETECTED';
  /** External ledger reference for traceability */
  externalLedgerReference?: string;
  /** Entry type classification */
  entryType: LedgerEntryType;
}

/**
 * Currency Conversion Record (§4.5)
 * Multi-currency conversion tracking with time-stamped rates.
 */
export interface CurrencyConversionRecord extends BaseEntity {
  /** Unique conversion identifier */
  conversionId: string;
  /** Original currency code */
  fromCurrency: CurrencyCode;
  /** Target currency code */
  toCurrency: CurrencyCode;
  /** Original amount */
  amount: number;
  /** Converted amount */
  convertedAmount: number;
  /** Exchange rate at time of conversion */
  exchangeRate: number;
  /** Time-stamp of rate retrieval */
  rateTimestamp: Date;
  /** Rate source identifier */
  rateSource: string;
  /** Associated transaction reference */
  transactionId?: string;
}

/**
 * Refund Instruction Object (§4.6)
 * Financial resolution directive for disputed or rejected transactions.
 */
export interface RefundInstructionObject extends BaseEntity {
  /** Unique refund instruction identifier */
  refundId: string;
  /** Associated escrow account */
  escrowId: string;
  /** Source dispute reference */
  disputeId?: string;
  /** Refund type classification */
  refundType: RefundType;
  /** Refund amount */
  amount: number;
  /** Refund currency */
  currency: CurrencyCode;
  /** Fund recipient identifier */
  recipientId: string;
  /** Resolution outcome determination */
  resolutionOutcome?: string;
  /** Approving moderator/administrator reference */
  approvedBy?: string;
  /** Bank execution reference */
  bankExecutionReference?: string;
  /** Processing status */
  status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'FAILED';
  /** Optional execution timestamp */
  executedAt?: Date;
}

/**
 * Transaction Fee Record (§4.7)
 * Platform fee calculation and recording for each transaction flow.
 */
export interface TransactionFeeRecord extends BaseEntity {
  /** Unique fee record identifier */
  feeId: string;
  /** Associated transaction reference */
  transactionId: string;
  /** Fee type classification */
  feeType: FeeType;
  /** Fee amount */
  feeAmount: number;
  /** Fee currency */
  feeCurrency: CurrencyCode;
  /** Percentage basis (if percentage-based fee) */
  feePercentage?: number;
  /** Calculation methodology basis */
  calculationBasis?: string;
  /** Corridor identifier (for corridor-based variations) */
  corridorId?: string;
  /** Calculation timestamp */
  timestamp: Date;
}

/**
 * Payout Instruction Object (§4.8)
 * Final payout execution directive sent to banking/payment providers.
 */
export interface PayoutInstructionObject extends BaseEntity {
  /** Unique payout instruction identifier */
  payoutId: string;
  /** Associated settlement reference */
  settlementId: string;
  /** Fund recipient identifier */
  recipientId: string;
  /** Destination channel */
  recipientChannel: RecipientChannel;
  /** Payout amount */
  amount: number;
  /** Payout currency */
  currency: CurrencyCode;
  /** Processing status */
  status: PayoutStatus;
  /** Bank execution reference */
  bankExecutionReference?: string;
  /** Retry counter for failed payouts */
  retryCount: number;
  /** Initial request timestamp */
  requestedAt: Date;
  /** Optional completion timestamp */
  executedAt?: Date;
  /** Optional failure reason */
  failureReason?: string;
}

/**
 * Financial Audit Record (§4.9)
 * Regulatory-grade reporting structure for compliance and audit requirements.
 */
export interface FinancialAuditRecord extends BaseEntity {
  /** Unique audit record identifier */
  auditId: string;
  /** Audit type classification */
  auditType: AuditType;
  /** Report period start */
  periodStart: Date;
  /** Report period end */
  periodEnd: Date;
  /** Structured report data payload */
  reportData: Record<string, unknown>;
  /** Generation timestamp */
  generatedAt: Date;
  /** Generating module/system reference */
  generatedBy: string;
  /** Verification workflow status */
  verificationStatus: AuditVerificationStatus;
  /** Optional external auditor reference */
  externalReference?: string;
}
