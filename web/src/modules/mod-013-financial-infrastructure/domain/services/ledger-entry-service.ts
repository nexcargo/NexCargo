// NexCargo C4-III — Ledger Entry Creation Utility
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-013 §4.4 (Financial Ledger Mirror), ESS-001F §7 (Ledger System)
// Scope: Generates double-entry debit+credit pairs for payment confirmation and settlement execution.
//        Produces structured data ready for INSERT into financial_ledger_entries table.

import { CurrencyCode } from '@/shared/types/enums';

// ============================================================
// Types
// ============================================================

export interface LedgerEntryPair {
  transactionReference: string;
  entrySequence: number; // 1 = debit, 2 = credit
  debitCreditType: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: CurrencyCode;
  source: string;
  destination: string;
  entryType: 'PAYMENT' | 'SETTLEMENT' | 'ESCROW' | 'FEE' | 'REFUND';
}

/**
 * Creates a double-entry debit+credit pair for payment confirmation.
 * Per MOD-013 §4.4: "Every transaction must be double-entry recorded."
 * 
 * Example: Payment received → DEBIT escrow_fund_held / CREDIT shipper_payout_pending
 */
export function createPaymentLedgerPair(
  paymentIntentId: string,
  amount: number,
  currency: CurrencyCode,
): LedgerEntryPair[] {
  const reference = `pay-${paymentIntentId}`;

  return [
    {
      transactionReference: reference,
      entrySequence: 1,
      debitCreditType: 'DEBIT',
      amount,
      currency,
      source: 'escrow_fund_held',
      destination: 'shipper_payout_pending',
      entryType: 'PAYMENT',
    },
    {
      transactionReference: reference,
      entrySequence: 2,
      debitCreditType: 'CREDIT',
      amount,
      currency,
      source: 'shipper_payout_pending',
      destination: 'escrow_fund_held',
      entryType: 'PAYMENT',
    },
  ];
}

/**
 * Creates a double-entry debit+credit pair for settlement execution.
 * 
 * Example: Settlement released → DEBIT shipper_payout_pending / CREDIT transporter_payable
 */
export function createSettlementLedgerPair(
  settlementRequestId: string,
  amount: number,
  currency: CurrencyCode,
): LedgerEntryPair[] {
  const reference = `settle-${settlementRequestId}`;

  return [
    {
      transactionReference: reference,
      entrySequence: 1,
      debitCreditType: 'DEBIT',
      amount,
      currency,
      source: 'shipper_payout_pending',
      destination: 'transporter_payable',
      entryType: 'SETTLEMENT',
    },
    {
      transactionReference: reference,
      entrySequence: 2,
      debitCreditType: 'CREDIT',
      amount,
      currency,
      source: 'transporter_payable',
      destination: 'shipper_payout_pending',
      entryType: 'SETTLEMENT',
    },
  ];
}
