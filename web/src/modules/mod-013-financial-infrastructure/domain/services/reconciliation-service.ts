// NexCargo C4-III — Reconciliation Service (On-Demand)
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-013 §6.3, MOD-005 §7.6 (Reconciliation Rule), C4 Readiness R11
// Scope: On-demand reconciliation comparing internal financial records with available provider confirmations.
//        Does NOT do scheduled batch reconciliation (deferred per ESS-001F §8.2).

import { CurrencyCode, PaymentMethod } from '@/shared/types/enums';
import type { FinancialLedgerEntryRecord } from '@/modules/mod-013-financial-infrastructure/infrastructure/repositories/financial-ledger-repository';
import type { SettlementRequestRecord } from '@/modules/mod-013-financial-infrastructure/infrastructure/repositories/settlement-request-repository';
import type { PaymentIntentRecord } from '@/modules/mod-005-escrow/infrastructure/repositories/payment-intent-repository';

// ============================================================
// Types
// ============================================================

export interface ReconciliationResult {
  escrowId: string;
  alignment: 'ALIGNED' | 'MISMATCH_DETECTED' | 'PENDING';
  totalPaymentAmount: number;
  totalConfirmedAmount: number;
  totalSettlementAmount: number;
  totalExecutedAmount: number;
  mismatchCount: number;
  mismatches: ReconciliationMismatch[];
}

export interface ReconciliationMismatch {
  type: 'UNRECORDED_PAYMENT' | 'UNCONFIRMED_LEDGER_ENTRY' | 'AMOUNT_DISCREPANCY' | 'SETTLEMENT_MISMATCH';
  description: string;
  expected?: number;
  actual?: number;
  currency?: string;
  referenceId?: string;
}

/**
 * Performs on-demand reconciliation for a given escrow.
 * Compares:
 *   - Payment intents (confirmed vs unconfirmed)
 *   - Ledger entries (created vs expected pairs)
 *   - Settlement requests (executed vs pending)
 */
export function reconcileEscrow(
  escrowId: string,
  paymentIntents: PaymentIntentRecord[],
  ledgerEntries: FinancialLedgerEntryRecord[],
  settlementRequests: SettlementRequestRecord[],
): ReconciliationResult {
  const mismatches: ReconciliationMismatch[] = [];

  // Calculate totals
  const totalPaymentAmount = paymentIntents.reduce((sum, p) => sum + p.amount, 0);
  const totalConfirmedAmount = paymentIntents
    .filter(p => p.status === 'CONFIRMED')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalSettlementAmount = settlementRequests.reduce((sum, s) => sum + s.settlement_amount, 0);
  const totalExecutedAmount = settlementRequests
    .filter(s => s.approval_status === 'EXECUTED')
    .reduce((sum, s) => sum + s.settlement_amount, 0);

  // Check 1: Every CONFIRMED payment should have corresponding ledger entries
  const confirmedPayments = paymentIntents.filter(p => p.status === 'CONFIRMED');
  for (const pi of confirmedPayments) {
    const txRef = `pay-${pi.id}`;
    const relatedEntries = ledgerEntries.filter(e => e.transaction_reference === txRef);
    
    if (relatedEntries.length === 0) {
      mismatches.push({
        type: 'UNRECORDED_PAYMENT',
        description: `Confirmed payment ${pi.id} has no ledger entries`,
        expected: 2, // debit + credit pair
        actual: 0,
        currency: pi.currency,
        referenceId: pi.id,
      });
    } else if (relatedEntries.length < 2) {
      mismatches.push({
        type: 'UNRECORDED_PAYMENT',
        description: `Confirmed payment ${pi.id} has incomplete ledger pair (${relatedEntries.length}/2 entries)`,
        expected: 2,
        actual: relatedEntries.length,
        currency: pi.currency,
        referenceId: pi.id,
      });
    } else {
      // Verify amounts match
      const pairSum = relatedEntries.reduce((sum, e) => sum + e.amount, 0);
      if (pairSum !== pi.amount * 2) {
        mismatches.push({
          type: 'AMOUNT_DISCREPANCY',
          description: `Payment amount ${pi.amount} does not match ledger pair sum ${pairSum / 2}`,
          expected: pi.amount,
          actual: pairSum / 2,
          currency: pi.currency,
          referenceId: pi.id,
        });
      }
    }
  }

  // Check 2: EXECUTED settlements should have corresponding ledger entries
  const executedSettlements = settlementRequests.filter(s => s.approval_status === 'EXECUTED');
  for (const sr of executedSettlements) {
    const txRef = `settle-${sr.id}`;
    const relatedEntries = ledgerEntries.filter(e => e.transaction_reference === txRef);
    
    if (relatedEntries.length === 0) {
      mismatches.push({
        type: 'SETTLEMENT_MISMATCH',
        description: `Executed settlement ${sr.id} has no ledger entries`,
        expected: 2,
        actual: 0,
        currency: sr.settlement_amount > 0 ? 'same as settlement' : undefined,
        referenceId: sr.id,
      });
    }
  }

  // Determine overall alignment
  const hasActiveConflicts = mismatches.some(m => m.type !== 'UNCONFIRMED_LEDGER_ENTRY');
  let alignment: 'ALIGNED' | 'MISMATCH_DETECTED' | 'PENDING';
  
  if (hasActiveConflicts && mismatches.length > 0) {
    alignment = 'MISMATCH_DETECTED';
  } else if (paymentIntents.some(p => p.status === 'INITIATED' || p.status === 'PENDING')) {
    alignment = 'PENDING';
  } else {
    alignment = 'ALIGNED';
  }

  return {
    escrowId,
    alignment,
    totalPaymentAmount,
    totalConfirmedAmount,
    totalSettlementAmount,
    totalExecutedAmount,
    mismatchCount: mismatches.length,
    mismatches,
  };
}
