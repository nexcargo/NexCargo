// NexCargo C4-III — Financial Ledger Entries Repository Interface
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-013 §4.4 (Financial Ledger Mirror), ESS-001F §7.3 (Immutability Rule)
// Scope: Type-safe data access for financial_schema.financial_ledger_entries. Append-only: inserts only, no updates on financial fields.

import { BaseEntity } from '@/shared/base-classes/base-entity';
import type { CurrencyCode } from '@/shared/types/enums';
import type { SupabaseBaseRepository } from '@/infrastructure/repositories/base-repository';

/**
 * Ledger entry record shape matching financial_schema.financial_ledger_entries table columns.
 */
export interface FinancialLedgerEntryRecord extends BaseEntity {
  transaction_reference: string;
  entry_sequence: number; // 1 = debit, 2 = credit
  debit_credit_type: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: CurrencyCode;
  source: string;
  destination: string;
  entry_type: 'ESCROW' | 'PAYMENT' | 'SETTLEMENT' | 'FEE' | 'REFUND';
  reconciliation_status: 'PENDING' | 'ALIGNED' | 'MISMATCH_DETECTED';
  external_ledger_reference?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  correlation_id?: string | null;
  is_deleted: boolean;
}

/**
 * Repository interface for financial_schema.financial_ledger_entries persistence.
 * 
 * IMPORTANT: Per ESS-001F §7.3, ledger entries are append-only. Never update financial columns.
 */
export interface IFinancialLedgerRepository extends SupabaseBaseRepository<FinancialLedgerEntryRecord> {
  /**
   * Create a single ledger entry.
   * Must be called in pairs (debit + credit) with same transaction_reference and sequential entry_sequence.
   */
  create(entry: Omit<FinancialLedgerEntryRecord, 'id' | 'created_at' | 'updated_at'>): Promise<FinancialLedgerEntryRecord>;

  /**
   * Create a double-entry pair atomically.
   */
  createPair(
    transactionReference: string,
    debitEntry: Omit<FinancialLedgerEntryRecord, 'id' | 'created_at' | 'updated_at' | 'transaction_reference'>,
    creditEntry: Omit<FinancialLedgerEntryRecord, 'id' | 'created_at' | 'updated_at' | 'transaction_reference'>,
  ): Promise<[FinancialLedgerEntryRecord, FinancialLedgerEntryRecord]>;

  /**
   * Find all ledger entries for a given transaction reference.
   */
  findByTransactionReference(transactionReference: string): Promise<FinancialLedgerEntryRecord[]>;

  /**
   * Find all entries for a given escrow's payment intents and settlements.
   */
  findByEscrow(escrowId: string): Promise<FinancialLedgerEntryRecord[]>;

  /**
   * Update reconciliation status (non-financial column only).
   */
  updateReconciliationStatus(
    id: string,
    newStatus: 'PENDING' | 'ALIGNED' | 'MISMATCH_DETECTED',
  ): Promise<FinancialLedgerEntryRecord>;
}
