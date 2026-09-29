// NexCargo C4-III — Ledger Entry Service + Reconciliation Service Tests
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Scope: Double-entry pair creation, balance integrity, reconciliation alignment detection.

import { describe, it, expect } from 'vitest';
import { createPaymentLedgerPair, createSettlementLedgerPair } from '@/modules/mod-013-financial-infrastructure/domain/services/ledger-entry-service';
import { reconcileEscrow } from '@/modules/mod-013-financial-infrastructure/domain/services/reconciliation-service';
import { CurrencyCode } from '@/shared/types/enums';
import type { PaymentIntentRecord } from '@/modules/mod-005-escrow/infrastructure/repositories/payment-intent-repository';
import type { FinancialLedgerEntryRecord } from '@/modules/mod-013-financial-infrastructure/infrastructure/repositories/financial-ledger-repository';
import type { SettlementRequestRecord } from '@/modules/mod-013-financial-infrastructure/infrastructure/repositories/settlement-request-repository';

describe('createPaymentLedgerPair', () => {
  it('creates debit+credit pair with matching amounts', () => {
    const pairs = createPaymentLedgerPair('pay-001', 5000, CurrencyCode.MZN);
    
    expect(pairs).toHaveLength(2);
    expect(pairs[0].entrySequence).toBe(1);
    expect(pairs[0].debitCreditType).toBe('DEBIT');
    expect(pairs[1].entrySequence).toBe(2);
    expect(pairs[1].debitCreditType).toBe('CREDIT');
    expect(pairs[0].amount).toBe(5000);
    expect(pairs[1].amount).toBe(5000);
    expect(pairs[0].transactionReference).toBe('pay-pay-001');
    expect(pairs[1].transactionReference).toBe('pay-pay-001');
    expect(pairs[0].entryType).toBe('PAYMENT');
  });
});

describe('createSettlementLedgerPair', () => {
  it('creates debit+credit pair for settlement', () => {
    const pairs = createSettlementLedgerPair('settle-001', 3000, CurrencyCode.ZAR);
    
    expect(pairs).toHaveLength(2);
    expect(pairs[0].entrySequence).toBe(1);
    expect(pairs[0].debitCreditType).toBe('DEBIT');
    expect(pairs[0].entryType).toBe('SETTLEMENT');
    expect(pairs[1].entryType).toBe('SETTLEMENT');
    expect(pairs[0].currency).toBe(CurrencyCode.ZAR);
  });
});

describe('reconcileEscrow', () => {
  // Helper to create mock records
  const makePaymentIntent = (overrides: { id?: string; escrow_id?: string; amount?: number; currency?: CurrencyCode; payment_method?: string; status?: string; idempotency_key?: string; fee_amount?: number; is_deleted?: boolean; created_at?: Date; updated_at?: Date; version?: number }): PaymentIntentRecord => ({
    id: overrides.id ?? 'pi-001',
    escrow_id: overrides.escrow_id ?? 'escrow-001',
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

  const makeLedgerEntry = (overrides: Partial<FinancialLedgerEntryRecord>): FinancialLedgerEntryRecord => ({
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

  const makeSettlementRequest = (overrides: Partial<SettlementRequestRecord>): SettlementRequestRecord => ({
    id: overrides.id ?? 'sr-001',
    escrow_id: 'escrow-001',
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

  it('returns ALIGNED when all payments have complete ledger pairs', () => {
    const intents = [makePaymentIntent({ id: 'pi-001', status: 'CONFIRMED', amount: 5000 })];
    const entries = [
      makeLedgerEntry({ transaction_reference: 'pay-pi-001', entry_sequence: 1, amount: 5000 }),
      makeLedgerEntry({ id: 'le-002', transaction_reference: 'pay-pi-001', entry_sequence: 2, amount: 5000 }),
    ];
    const settlements: SettlementRequestRecord[] = [];

    const result = reconcileEscrow('escrow-001', intents, entries, settlements);
    expect(result.alignment).toBe('ALIGNED');
    expect(result.mismatchCount).toBe(0);
    expect(result.totalConfirmedAmount).toBe(5000);
  });

  it('detects UNRECORDED_PAYMENT when confirmed payment has no ledger entries', () => {
    const intents = [makePaymentIntent({ id: 'pi-001', status: 'CONFIRMED', amount: 5000 })];
    const entries: FinancialLedgerEntryRecord[] = [];
    const settlements: SettlementRequestRecord[] = [];

    const result = reconcileEscrow('escrow-001', intents, entries, settlements);
    expect(result.alignment).toBe('MISMATCH_DETECTED');
    expect(result.mismatchCount).toBeGreaterThan(0);
    expect(result.mismatches[0].type).toBe('UNRECORDED_PAYMENT');
  });

  it('detects ledger discrepancy when only one side exists', () => {
    const intents = [makePaymentIntent({ id: 'pi-001', status: 'CONFIRMED', amount: 5000 })];
    const entries = [
      makeLedgerEntry({ id: 'le-incomplete', transaction_reference: 'pay-pi-001', entry_sequence: 1, amount: 5000 }),
    ];
    const settlements: SettlementRequestRecord[] = [];

    const result = reconcileEscrow('escrow-001', intents, entries, settlements);
    expect(result.alignment).toBe('MISMATCH_DETECTED');
    // Mismatch detected (incomplete pair counts as mismatch)
    expect(result.mismatchCount).toBeGreaterThan(0);
  });

  it('returns PENDING when payments are INITIATED but not CONFIRMED', () => {
    const intents = [makePaymentIntent({ id: 'pi-001', status: 'INITIATED', amount: 5000 })];
    const entries: FinancialLedgerEntryRecord[] = [];
    const settlements: SettlementRequestRecord[] = [];

    const result = reconcileEscrow('escrow-001', intents, entries, settlements);
    expect(result.alignment).toBe('PENDING');
  });

  it('detects SETTLEMENT_MISMATCH for executed settlement without ledger entries', () => {
    const intents: PaymentIntentRecord[] = [];
    const entries: FinancialLedgerEntryRecord[] = [];
    const settlements = [makeSettlementRequest({ id: 'sr-001', approval_status: 'EXECUTED', settlement_amount: 3000 })];

    const result = reconcileEscrow('escrow-001', intents, entries, settlements);
    expect(result.alignment).toBe('MISMATCH_DETECTED');
    expect(result.mismatches.some(m => m.type === 'SETTLEMENT_MISMATCH')).toBe(true);
  });

  it('reports correct totals', () => {
    const intents = [
      makePaymentIntent({ id: 'pi-001', status: 'CONFIRMED', amount: 5000 }),
      makePaymentIntent({ id: 'pi-002', status: 'INITIATED', amount: 2000 }),
    ];
    const entries: FinancialLedgerEntryRecord[] = [];
    const settlements = [
      makeSettlementRequest({ id: 'sr-001', approval_status: 'EXECUTED', settlement_amount: 4000 }),
    ];

    const result = reconcileEscrow('escrow-001', intents, entries, settlements);
    expect(result.totalPaymentAmount).toBe(7000);
    expect(result.totalConfirmedAmount).toBe(5000);
    expect(result.totalSettlementAmount).toBe(4000);
    expect(result.totalExecutedAmount).toBe(4000);
  });
});
