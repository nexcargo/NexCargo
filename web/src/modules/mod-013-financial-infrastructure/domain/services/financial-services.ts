// NexCargo MOD-013 — Financial Domain Services
// Wave 2 — Phase 2A, Increment 2 — Authorized per HAO-MOD013-INC2
// Reference: MOD-013 §6 Responsibilities (6.1–6.7)
//
// Services cover:
// 6.1 Financial State Modeling — escrow lifecycle structures
// 6.2 Settlement Structuring — payout request format validation
// 6.3 Ledger Mirror Definition — reconciliation integrity
// 6.4 Payment Flow Abstraction — payment event validation
// 6.5 Fee & Commission Structuring — fee record validation
// 6.6 Dispute & Refund Structuring — refund instruction validation
// 6.7 Financial Audit & Reporting — audit record validation

import type {
  SettlementRequestObject, FinancialLedgerMirrorObject, CurrencyConversionRecord,
  RefundInstructionObject, TransactionFeeRecord, PayoutInstructionObject, FinancialAuditRecord,
} from '../types/entities';
import type { SettlementType, DebitCreditType, LedgerEntryType } from '../enums';
import type { RecipientChannel } from '../enums';
import type { AuditType, AuditVerificationStatus } from '../enums';
import type { EscrowState, CurrencyCode } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Settlement Request Validation (6.2)
// Per MOD-013 §4.3: approvalStatus must follow PENDING→APPROVED→EXECUTED|FAILED path
// ============================================================

export interface CreateSettlementInput {
  escrowId: string;
  triggerEvent: string; // ReleaseMilestoneEnum value
  settlementAmount: number;
  settlementType: SettlementType;
}

/** Validate settlement request structure */
export function validateSettlementRequest(input: CreateSettlementInput): void {
  if (!input.escrowId || input.escrowId.trim() === '') {
    throw new ValidationError('escrowId is required for settlement request');
  }
  if (input.settlementAmount <= 0) {
    throw new ValidationError(`Settlement amount must be positive: ${input.settlementAmount}`);
  }
  const validTypes = ['FULL', 'MILESTONE', 'REFUND'];
  if (!validTypes.includes(input.settlementType)) {
    throw new ValidationError(
      `Invalid settlement type: ${input.settlementType}. Allowed: ${validTypes.join(', ')}`,
    );
  }
}

// ============================================================
// Double-Entry Ledger Validation (6.3)
// Per MOD-013 §4.4 & §7.3: every transaction must be double-entry recorded;
// ledger is immutable per MOD-010 governance.
// ============================================================

export interface CreateLedgerEntryInput {
  transactionReference: string;
  debitCreditType: DebitCreditType;
  amount: number;
  currency: CurrencyCode;
  source: string;
  destination: string;
  entryType: LedgerEntryType;
}

/** Validate double-entry ledger entry */
export function validateLedgerEntry(input: CreateLedgerEntryInput): void {
  if (!input.transactionReference || input.transactionReference.trim() === '') {
    throw new ValidationError('transactionReference is required for ledger entry');
  }
  if (input.amount <= 0) {
    throw new ValidationError(`Ledger amount must be positive: ${input.amount}`);
  }
  const validDCTypes = ['DEBIT', 'CREDIT'];
  if (!validDCTypes.includes(input.debitCreditType)) {
    throw new ValidationError(
      `Invalid debit/credit type: ${input.debitCreditType}. Allowed: ${validDCTypes.join(', ')}`,
    );
  }
  if (!input.source || input.source.trim() === '') {
    throw new ValidationError('source is required for ledger entry');
  }
  if (!input.destination || input.destination.trim() === '') {
    throw new ValidationError('destination is required for ledger entry');
  }
  const validEntryTypes = ['ESCROW', 'PAYMENT', 'SETTLEMENT', 'FEE', 'REFUND'];
  if (!validEntryTypes.includes(input.entryType)) {
    throw new ValidationError(
      `Invalid entry type: ${input.entryType}. Allowed: ${validEntryTypes.join(', ')}`,
    );
  }
}

// ============================================================
// Currency Conversion Validation (6.4)
// Per MOD-013 §4.5: exchange rates must be time-stamped and transparent.
// ============================================================

export interface CreateCurrencyConversionInput {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  rateSource: string;
}

/** Validate currency conversion record */
export function validateCurrencyConversion(input: CreateCurrencyConversionInput): void {
  if (input.fromCurrency === input.toCurrency) {
    throw new ValidationError('fromCurrency must differ from toCurrency');
  }
  if (input.amount <= 0) {
    throw new ValidationError(`Original amount must be positive: ${input.amount}`);
  }
  if (input.convertedAmount < 0) {
    throw new ValidationError(`Converted amount must not be negative: ${input.convertedAmount}`);
  }
  if (input.exchangeRate <= 0) {
    throw new ValidationError(`Exchange rate must be positive: ${input.exchangeRate}`);
  }
}

// ============================================================
// Refund Instruction Validation (6.6)
// Per MOD-013 §4.6: funds remain locked during disputes;
// moderator decisions determine release direction.
// ============================================================

export interface CreateRefundInstructionInput {
  escrowId: string;
  refundType: 'FULL' | 'PARTIAL' | 'SPLIT_SETTLEMENT';
  amount: number;
  currency: string;
  recipientId: string;
  resolutionOutcome?: string;
  approvedBy?: string;
}

/** Validate refund instruction structure */
export function validateRefundInstruction(input: CreateRefundInstructionInput): void {
  if (!input.escrowId || input.escrowId.trim() === '') {
    throw new ValidationError('escrowId is required for refund instruction');
  }
  if (input.amount <= 0) {
    throw new ValidationError(`Refund amount must be positive: ${input.amount}`);
  }
  const validTypes = ['FULL', 'PARTIAL', 'SPLIT_SETTLEMENT'];
  if (!validTypes.includes(input.refundType)) {
    throw new ValidationError(
      `Invalid refund type: ${input.refundType}. Allowed: ${validTypes.join(', ')}`,
    );
  }
  if (!input.recipientId || input.recipientId.trim() === '') {
    throw new ValidationError('recipientId is required for refund instruction');
  }
}

// ============================================================
// Fee Record Validation (6.5)
// Per MOD-013 §4.7: fee structure configurable by admin;
// transparent breakdown required per transaction.
// ============================================================

export interface CreateFeeRecordInput {
  transactionId: string;
  feeType: string; // PLATFORM_COMMISSION | PAYMENT_PROCESSING | CURRENCY_CONVERSION
  feeAmount: number;
  feeCurrency: string;
  feePercentage?: number;
  corridorId?: string;
}

/** Validate transaction fee record */
export function validateFeeRecord(input: CreateFeeRecordInput): void {
  if (!input.transactionId || input.transactionId.trim() === '') {
    throw new ValidationError('transactionId is required for fee record');
  }
  if (input.feeAmount < 0) {
    throw new ValidationError(`Fee amount must not be negative: ${input.feeAmount}`);
  }
  const validFeeTypes = ['PLATFORM_COMMISSION', 'PAYMENT_PROCESSING', 'CURRENCY_CONVERSION'];
  if (!validFeeTypes.includes(input.feeType)) {
    throw new ValidationError(
      `Invalid fee type: ${input.feeType}. Allowed: ${validFeeTypes.join(', ')}`,
    );
  }
}

// ============================================================
// Payout Instruction Validation (6.4 / §4.8)
// Per MOD-013 §4.8: payout triggered only after confirmed delivery;
// banking cut-off times respected; retry mechanism required.
// ============================================================

export interface CreatePayoutInstructionInput {
  settlementId: string;
  recipientId: string;
  recipientChannel: RecipientChannel;
  amount: number;
  currency: string;
}

/** Validate payout instruction structure */
export function validatePayoutInstruction(input: CreatePayoutInstructionInput): void {
  if (!input.settlementId || input.settlementId.trim() === '') {
    throw new ValidationError('settlementId is required for payout instruction');
  }
  if (!input.recipientId || input.recipientId.trim() === '') {
    throw new ValidationError('recipientId is required for payout instruction');
  }
  if (input.amount <= 0) {
    throw new ValidationError(`Payout amount must be positive: ${input.amount}`);
  }
  const validChannels = ['MOBILE_MONEY', 'BANK_TRANSFER'];
  if (!validChannels.includes(input.recipientChannel)) {
    throw new ValidationError(
      `Invalid recipient channel: ${input.recipientChannel}. Allowed: ${validChannels.join(', ')}`,
    );
  }
}

// ============================================================
// Audit Record Validation (6.7)
// Per MOD-013 §4.9: reports must include all transaction history;
// must support external audits; immutable audit logs required.
// ============================================================

export interface CreateAuditRecordInput {
  auditType: string; // DAILY_RECONCILIATION | MONTHLY_REPORT | REGULATORY_SUBMISSION
  periodStart: Date;
  periodEnd: Date;
  reportData: Record<string, unknown>;
  generatedBy: string;
}

/** Validate financial audit record */
export function validateAuditRecord(input: CreateAuditRecordInput): void {
  if (!input.periodStart || !input.periodEnd) {
    throw new ValidationError('periodStart and periodEnd are required for audit record');
  }
  if (input.periodStart >= input.periodEnd) {
    throw new ValidationError('periodStart must be before periodEnd');
  }
  if (!input.reportData) {
    throw new ValidationError('reportData is required for audit record');
  }
  const validTypes = ['DAILY_RECONCILIATION', 'MONTHLY_REPORT', 'REGULATORY_SUBMISSION'];
  if (!validTypes.includes(input.auditType)) {
    throw new ValidationError(
      `Invalid audit type: ${input.auditType}. Allowed: ${validTypes.join(', ')}`,
    );
  }
  if (!input.generatedBy || input.generatedBy.trim() === '') {
    throw new ValidationError('generatedBy is required for audit record');
  }
}
