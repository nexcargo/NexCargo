// NexCargo Escrow Repository — Persistence layer for financial_schema.escrow_records
// Per HAO-C3 Authorization: C3 establishes Contract → Escrow operational linkage.
// Scope: Read/update escrow records only (no payment initiation or provider execution).
// Payment execution is C4 scope per HAO C3/C4 boundary.

import { createClient } from '@/lib/supabase/server';
import { EscrowState } from '@/shared/types/enums';

interface EscrowRow {
  id: string;
  contract_id: string;
  amount: number;
  currency: string;
  state: string;
  payment_method: string | null;
  external_transaction_ref: string | null;
  bank_confirmation_status: string | null;
  created_by: string;
  updated_by: string | null;
  correlation_id: string | null;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface EscrowApiShape {
  escrowId: string;
  contractId: string;
  amount: number;
  currency: string;
  state: string;
  paymentMethod: string | undefined;
  externalTransactionRef: string | undefined;
  bankConfirmationStatus: string | undefined;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEscrowParams {
  contractId: string;
  amount: number;
  currency?: string;
  createdBy: string;
  correlationId?: string;
}

/**
 * Repository for escrow persistence via Supabase.
 * C3 scope: read and update escrows only. No payment initiation.
 */
export class EscrowRepository {
  private readonly schema = 'financial_schema';
  private readonly table = 'escrow_records';

  /** Create initial PENDING_CREATION escrow record linked to a contract */
  async create(params: CreateEscrowParams): Promise<EscrowApiShape> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.table)
      .insert({
        contract_id: params.contractId,
        amount: params.amount,
        currency: params.currency ?? 'MZN',
        state: 'PENDING_CREATION',
        created_by: params.createdBy,
        correlation_id: params.correlationId ?? null,
        is_deleted: false,
        version: 1,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create escrow: ${result.error.message}`);
    }

    return this.toApiShape(result.data as EscrowRow);
  }

  /** Get escrow by ID with soft-delete exclusion */
  async getById(escrowId: string): Promise<EscrowApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.table)
      .select('*')
      .eq('id', escrowId)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get escrow: ${result.error.message}`);
    }

    return this.toApiShape(result.data as EscrowRow);
  }

  /** Get escrow by contract ID */
  async getByContractId(contractId: string): Promise<EscrowApiShape | null> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.table)
      .select('*')
      .eq('contract_id', contractId)
      .eq('is_deleted', false)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to get escrow by contract: ${result.error.message}`);
    }

    return this.toApiShape(result.data as EscrowRow);
  }

  /** Update escrow state with optimistic concurrency (version check) */
  async updateState(escrowId: string, currentVersion: number, targetState: string): Promise<void> {
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.table)
      .update({
        state: targetState,
        updated_at: new Date().toISOString(),
        version: currentVersion + 1,
      })
      .eq('id', escrowId)
      .eq('version', currentVersion)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to update escrow state: ${result.error.message}`);
    }
    if (!result.data || (result.data as unknown[]).length === 0) {
      throw new Error(`Escrow not found or version mismatch: ${escrowId}`);
    }
  }

  /** List active escrows filtered by contract IDs */
  async listByContractIds(contractIds: string[]): Promise<EscrowApiShape[]> {
    if (contractIds.length === 0) return [];
    
    const supabase = await createClient();
    const result = await supabase
      .schema(this.schema).from(this.table)
      .select('*')
      .in('contract_id', contractIds)
      .eq('is_deleted', false);

    if (result.error) {
      throw new Error(`Failed to list escrows by contracts: ${result.error.message}`);
    }

    return (result.data as EscrowRow[]).map(row => this.toApiShape(row));
  }

  private toApiShape(row: EscrowRow): EscrowApiShape {
    return {
      escrowId: row.id,
      contractId: row.contract_id,
      amount: row.amount,
      currency: row.currency,
      state: row.state,
      paymentMethod: row.payment_method ?? undefined,
      externalTransactionRef: row.external_transaction_ref ?? undefined,
      bankConfirmationStatus: row.bank_confirmation_status ?? undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
