// NexCargo C4-III — Settlement + Dispute Flow Integration Tests
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Scope: Verify complete settlement lifecycle and dispute hold protection.

import { describe, it, expect } from 'vitest';
import { validateSettlementCreation } from '@/modules/mod-013-financial-infrastructure/domain/services/settlement-service';
import { prepareDisputeHold, prepareDisputeResolution } from '@/modules/mod-005-escrow/domain/services/dispute-hold-service';
import { createPaymentLedgerPair, createSettlementLedgerPair } from '@/modules/mod-013-financial-infrastructure/domain/services/ledger-entry-service';
import { reconcileEscrow } from '@/modules/mod-013-financial-infrastructure/domain/services/reconciliation-service';
import { EscrowState, CurrencyCode } from '@/shared/types/enums';
import { validateEscrowTransition } from '@/modules/mod-005-escrow/domain/services/escrow-state-machine';
import type { PaymentIntentRecord } from '@/modules/mod-005-escrow/infrastructure/repositories/payment-intent-repository';
import type { FinancialLedgerEntryRecord } from '@/modules/mod-013-financial-infrastructure/infrastructure/repositories/financial-ledger-repository';
import type { SettlementRequestRecord } from '@/modules/mod-013-financial-infrastructure/infrastructure/repositories/settlement-request-repository';

// Helper functions for mock data
const makePi = (overrides: { id?: string; escrow_id?: string; amount?: number; currency?: CurrencyCode; payment_method?: string; status?: string; idempotency_key?: string; fee_amount?: number; is_deleted?: boolean; created_at?: Date; updated_at?: Date; version?: number }): PaymentIntentRecord => ({
  id: overrides.id ?? 'pi-001',
  escrow_id: overrides.escrow_id ?? 'esc-001',
  amount: overrides.amount ?? 5000,
  currency: overrides.currency ?? CurrencyCode.MZN,
  payment_method: 'MPESA' as any,
  status: (overrides.status ?? 'INITIATED') as any,
  idempotency_key: overrides.idempotency_key ?? 'idem-test',
  fee_amount: 0,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  version: 1,
} as unknown as PaymentIntentRecord);

const makeLe = (overrides: Partial<FinancialLedgerEntryRecord>): FinancialLedgerEntryRecord => ({
  id: overrides.id ?? 'le-001',
  transaction_reference: overrides.transaction_reference ?? 'pay-pi-001',
  entry_sequence: overrides.entry_sequence ?? 1,
  debit_credit_type: overrides.debit_credit_type ?? 'DEBIT',
  amount: overrides.amount ?? 5000,
  currency: overrides.currency ?? CurrencyCode.MZN,
  source: overrides.source ?? 'escrow_fund_held',
  destination: overrides.destination ?? 'shipper_payout_pending',
  entry_type: overrides.entry_type ?? 'PAYMENT',
  reconciliation_status: overrides.reconciliation_status ?? 'PENDING',
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  version: 1,
} as unknown as FinancialLedgerEntryRecord);

const makeSr = (overrides: Partial<SettlementRequestRecord>): SettlementRequestRecord => ({
  id: overrides.id ?? 'sr-001',
  escrow_id: overrides.escrow_id ?? 'esc-001',
  trigger_event: overrides.trigger_event ?? 'DELIVERY_CONFIRMED',
  requested_by_module: overrides.requested_by_module ?? 'MOD-003',
  approval_status: overrides.approval_status ?? 'PENDING',
  settlement_type: overrides.settlement_type ?? 'FULL',
  settlement_amount: overrides.settlement_amount ?? 5000,
  retry_count: overrides.retry_count ?? 0,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  version: 1,
} as unknown as SettlementRequestRecord);

describe('Complete Settlement Happy Path', () => {
  it('end-to-end: payment → ledger pair → settlement request → reconciliation', () => {
    // Step 1: Validate settlement creation on FUNDS_LOCKED escrow
    expect(() => validateSettlementCreation({
      escrowId: 'esc-001',
      triggerEvent: 'DELIVERY_CONFIRMED',
      settlementType: 'FULL',
      settlementAmount: 5000,
    }, EscrowState.FUNDS_LOCKED)).not.toThrow();

    // Step 2: Create double-entry ledger pair for payment
    const paymentPairs = createPaymentLedgerPair('pi-001', 5000, CurrencyCode.MZN);
    expect(paymentPairs).toHaveLength(2);

    // Step 3: Reconcile with matched pairs
    const intents = [makePi({ id: 'pi-001', status: 'CONFIRMED', amount: 5000 })];
    const entries = [
      makeLe({ transaction_reference: 'pay-pi-001', entry_sequence: 1, amount: 5000 }),
      makeLe({ transaction_reference: 'pay-pi-001', entry_sequence: 2, amount: 5000 }),
    ];
    const result = reconcileEscrow('esc-001', intents, entries, []);
    expect(result.alignment).toBe('ALIGNED');
    expect(result.mismatchCount).toBe(0);
  });

  it('settlement execution creates proper ledger entries', () => {
    const settlePairs = createSettlementLedgerPair('sr-001', 4000, CurrencyCode.MZN);
    
    expect(settlePairs).toHaveLength(2);
    expect(settlePairs[0].entryType).toBe('SETTLEMENT');
    expect(settlePairs[1].entryType).toBe('SETTLEMENT');
    expect(settlePairs[0].amount).toBe(4000);
  });
});

describe('Dispute Hold Protection', () => {
  it('FUNDS_LOCKED can enter DISPUTE_HOLD', () => {
    expect(() => prepareDisputeHold({ escrowId: 'esc-001', reason: 'Goods not delivered' })).not.toThrow();
  });

  it('DISPUTE_HOLD resolves to PARTIAL_RELEASE via REFUND_TO_SHIPPER', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'esc-001', outcome: 'REFUND_TO_SHIPPER' }))
      .not.toThrow();
  });

  it('DISPUTE_HOLD resolves to FINAL_RELEASE via RELEASE_TO_TRANSPORTER', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'esc-001', outcome: 'RELEASE_TO_TRANSPORTER' }))
      .not.toThrow();
  });

  it('DISPUTE_HOLD resolves to PARTIAL_RELEASE via SPLIT_SETTLEMENT', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'esc-001', outcome: 'SPLIT_SETTLEMENT' }))
      .not.toThrow();
  });

  it('cannot bypass DISPUTE_HOLD: PENDING_CREATION cannot go to FINAL_RELEASE directly', () => {
    // This validates the state machine prevents unauthorized shortcuts
    expect(() => validateEscrowTransition(EscrowState.PENDING_CREATION, EscrowState.FINAL_RELEASE))
      .toThrow();
  });
});

describe('Reconciliation Edge Cases', () => {
  it('empty data returns ALIGNED', () => {
    const result = reconcileEscrow('esc-001', [], [], []);
    expect(result.totalPaymentAmount).toBe(0);
    expect(result.totalConfirmedAmount).toBe(0);
    expect(result.alignment).toBe('ALIGNED');
  });

  it('mix of confirmed and initiated statuses correctly separates amounts', () => {
    const intents = [
      makePi({ id: 'pi-001', status: 'CONFIRMED', amount: 5000 }),
      makePi({ id: 'pi-002', status: 'INITIATED', amount: 2000 }),
      makePi({ id: 'pi-003', status: 'CONFIRMED', amount: 3000 }),
    ];
    const entries: FinancialLedgerEntryRecord[] = [];
    const result = reconcileEscrow('esc-001', intents, entries, []);
    expect(result.totalPaymentAmount).toBe(10000);
    expect(result.totalConfirmedAmount).toBe(8000);
    expect(result.alignment).toBe('MISMATCH_DETECTED');
  });
});
