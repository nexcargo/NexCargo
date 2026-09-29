// NexCargo MOD-005 — Payment Intent Repository Interface (C4-I)
// Authorized by: HAO C4 Authorization (2026-09-08)
// Scope: C4-I Database Foundation — interface only, no runtime API
// Reference: MOD-005 §4.2 (Payment Intent entity), §7.5 (Idempotency Rule)

import { BaseEntity } from '@/shared/base-classes/base-entity';
import { SupabaseBaseRepository } from '@/infrastructure/repositories/base-repository';
import type { PaymentIntentStatus } from '../../domain/enums';
import type { CurrencyCode, PaymentMethod } from '@/shared/types/enums';

/**
 * Payment intent record shape matching financial_schema.payment_intents table columns.
 * Extends BaseEntity for standard audit fields (id, created_at, updated_at, version).
 */
export interface PaymentIntentRecord extends BaseEntity {
  escrow_id: string;
  amount: number;
  currency: CurrencyCode;
  payment_method: PaymentMethod;
  status: PaymentIntentStatus;
  idempotency_key: string;
  provider_reference_id?: string | null;
  external_transaction_ref?: string | null;
  fee_amount: number;
  failure_reason?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  correlation_id?: string | null;
  is_deleted: boolean;
}

/**
 * Repository interface for financial_schema.payment_intents persistence.
 * 
 * C4-I boundary: Interface defined here. No implementation committed yet —
 * payment initiation API (POST /api/payments) is not yet authorized.
 * This interface ensures type-safe data access when the API is implemented in C4-II.
 */
export interface IPaymentIntentRepository extends SupabaseBaseRepository<PaymentIntentRecord> {
  /**
   * Create a new PaymentIntent record.
   * The idempotency_key constraint is enforced at the database level.
   * Throws on duplicate idempotency_key.
   * 
   * Per MOD-005 §7.5: All payment requests MUST be idempotent.
   * Per ESS-001F §3.2: Payments are always pre-escrow funding deposits.
   */
  create(intent: Omit<PaymentIntentRecord, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentIntentRecord>;

  /**
   * Find payment intent by idempotency key — used for deduplication.
   * Returns existing intent if idempotency_key already exists.
   */
  findByIdempotencyKey(key: string): Promise<PaymentIntentRecord | null>;

  /**
   * Find all payment intents for a given escrow, filtered by active statuses.
   * Active = INITIATED, PENDING (not CONFIRMED, FAILED, or REFUNDED).
   */
  findByEscrow(escrowId: string, statuses?: PaymentIntentStatus[]): Promise<PaymentIntentRecord[]>;

  /**
   * Update the status of a payment intent through the state machine.
   */
  updateStatus(
    id: string,
    currentStatus: PaymentIntentStatus,
    targetStatus: PaymentIntentStatus,
    updaterId?: string
  ): Promise<PaymentIntentRecord>;

  /**
   * Mark intent as confirmed with provider reference.
   */
  confirm(
    id: string,
    providerReferenceId: string,
    externalTransactionRef?: string,
    confirmingUserId?: string
  ): Promise<PaymentIntentRecord>;

  /**
   * Mark intent as failed with optional failure reason.
   */
  fail(id: string, reason?: string, failingUserId?: string): Promise<PaymentIntentRecord>;
}
