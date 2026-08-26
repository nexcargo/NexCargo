// NexCargo MOD-013 — Local Enums
// Wave 2 — Phase 2A, Increment 2 — Authorized per HAO-MOD013-INC2
// Reference: MOD-013 §4 Core Domain Entities

/** Financial transaction type per MOD-013 §4.2 */
export enum TransactionType {
  FUNDING = 'FUNDING',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
  FEE = 'FEE',
}

/** Financial entry type per MOD-013 §4.4 */
export enum LedgerEntryType {
  ESCROW = 'ESCROW',
  PAYMENT = 'PAYMENT',
  SETTLEMENT = 'SETTLEMENT',
  FEE = 'FEE',
  REFUND = 'REFUND',
}

/** Debit/Credit type per MOD-013 §4.4 */
export enum DebitCreditType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

/** Settlement type per MOD-013 §4.3 */
export enum SettlementType {
  FULL = 'FULL',
  MILESTONE = 'MILESTONE',
  REFUND = 'REFUND',
}

/** Payout status per MOD-013 §4.8 */
export enum PayoutStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/** Refund type per MOD-013 §4.6 */
export enum RefundType {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
  SPLIT_SETTLEMENT = 'SPLIT_SETTLEMENT',
}

/** Fee type per MOD-013 §4.7 */
export enum FeeType {
  PLATFORM_COMMISSION = 'PLATFORM_COMMISSION',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  CURRENCY_CONVERSION = 'CURRENCY_CONVERSION',
}

/** Audit type per MOD-013 §4.9 */
export enum AuditType {
  DAILY_RECONCILIATION = 'DAILY_RECONCILIATION',
  MONTHLY_REPORT = 'MONTHLY_REPORT',
  REGULATORY_SUBMISSION = 'REGULATORY_SUBMISSION',
}

/** Reconciliation status values for audit records */
export enum AuditVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  SUBMITTED = 'SUBMITTED',
}

/** Recipient channel for payouts per MOD-013 §4.8 */
export enum RecipientChannel {
  MOBILE_MONEY = 'MOBILE_MONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
}
