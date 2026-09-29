// NexCargo C4-III — Settlement Request Repository Interface
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-013 §4.3 (SettlementRequestObject), C4 Readiness R6
// Scope: Type-safe data access for financial_schema.settlement_requests.

import { BaseEntity } from '@/shared/base-classes/base-entity';
import type { CurrencyCode, EscrowState } from '@/shared/types/enums';
import type { SupabaseBaseRepository } from '@/infrastructure/repositories/base-repository';

/**
 * Settlement request record shape matching financial_schema.settlement_requests table columns.
 */
export interface SettlementRequestRecord extends BaseEntity {
  escrow_id: string;
  trigger_event: 'PICKUP_CONFIRMED' | 'BORDER_CROSSING' | 'DELIVERY_CONFIRMED' | 'POD_APPROVED';
  requested_by_module: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  settlement_type: 'FULL' | 'MILESTONE' | 'REFUND';
  settlement_amount: number;
  bank_execution_reference?: string | null;
  retry_count: number;
  failure_reason?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  correlation_id?: string | null;
  is_deleted: boolean;
}

/**
 * Repository interface for financial_schema.settlement_requests persistence.
 */
export interface ISettlementRequestRepository extends SupabaseBaseRepository<SettlementRequestRecord> {
  /**
   * Create a new settlement request.
   */
  create(request: Omit<SettlementRequestRecord, 'id' | 'created_at' | 'updated_at'>): Promise<SettlementRequestRecord>;

  /**
   * Find settlement requests by escrow, optionally filtered by status.
   */
  findByEscrow(escrowId: string, statuses?: SettlementRequestRecord['approval_status'][]): Promise<SettlementRequestRecord[]>;

  /**
   * Update settlement request status through its lifecycle.
   */
  updateStatus(
    id: string,
    currentStatus: SettlementRequestRecord['approval_status'],
    targetStatus: SettlementRequestRecord['approval_status'],
  ): Promise<SettlementRequestRecord>;

  /**
   * Mark settlement request as executed with bank reference.
   */
  confirmExecution(
    id: string,
    bankExecutionReference: string,
  ): Promise<SettlementRequestRecord>;
}
