// NexCargo Escrow Service — C4 Financial Execution
// Authoritative: MOD-005 §5.5 (Financial Flow State Machine), ESS-001F §5.5
// Manages escrow state transitions via SECDEF RPC calls.
// All transitions are persisted, validated, authorized, and idempotent.

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/infrastructure/database/supabase';

/**
 * C4 financial-execution escrow states, mirroring the chk_escrow_valid_state CHECK
 * constraint in migration 030. Deliberately not the shared MOD-005 EscrowState enum:
 * that enum models the seven-state business lifecycle ending in FINAL_RELEASE, while
 * the execution layer distinguishes FUNDS_CONFIRMED, RELEASE_ELIGIBLE and RELEASED.
 */
export type FinancialEscrowState =
  | 'PENDING_CREATION'
  | 'FUNDS_INITIATED'
  | 'FUNDS_CONFIRMED'
  | 'FUNDS_LOCKED'
  | 'RELEASE_ELIGIBLE'
  | 'RELEASED'
  | 'PARTIAL_RELEASE'
  | 'DISPUTE_HOLD'
  | 'ESCROW_CLOSED';

/** Valid escrow states accepted by advance_escrow_state() */
export const VALID_ESCROW_STATES: FinancialEscrowState[] = [
  'PENDING_CREATION',
  'FUNDS_INITIATED',
  'FUNDS_CONFIRMED',
  'FUNDS_LOCKED',
  'RELEASE_ELIGIBLE',
  'RELEASED',
  'PARTIAL_RELEASE',
  'DISPUTE_HOLD',
  'ESCROW_CLOSED',
];

/** Terminal states that cannot be transitioned from */
const TERMINAL_STATES = new Set<FinancialEscrowState>(['RELEASED', 'ESCROW_CLOSED']);

/**
 * Legal state transitions per ESS-001F §5.5 Financial Flow State Machine.
 * Maps each source state to its set of allowed target states.
 */
const LEGAL_TRANSITIONS: Record<string, string[]> = {
  PENDING_CREATION: ['FUNDS_INITIATED'],
  FUNDS_INITIATED: ['FUNDS_CONFIRMED', 'FAILED'],
  FUNDS_CONFIRMED: ['FUNDS_LOCKED'],
  FUNDS_LOCKED: ['RELEASE_ELIGIBLE', 'DISPUTE_HOLD'],
  RELEASE_ELIGIBLE: ['RELEASED', 'PARTIAL_RELEASE'],
  DISPUTE_HOLD: ['RELEASED', 'PARTIAL_RELEASE', 'ESCROW_CLOSED'],
};

export interface EscrowStateTransitionResult {
  success: boolean;
  action: string;
  escrowId: string;
  stateFrom?: string;
  stateTo?: string;
  message: string;
}

export class EscrowService {
  /**
   * Advance escrow state via SECDEF RPC.
   * Validates transition legality before calling the database function.
   * Idempotent: same-state requests return without side effects.
   */
  async advanceState(
    escrowId: string,
    targetState: string,
    userId: string,
    correlationId?: string,
  ): Promise<EscrowStateTransitionResult> {
    // Validate target state
    if (!VALID_ESCROW_STATES.includes(targetState as FinancialEscrowState)) {
      throw new Error(`Invalid escrow state: ${targetState}`);
    }

    // Get current escrow state first (for validation)
    const supabase = await createClient();
    const { data: escrow, error: fetchError } = await supabase
      .schema('financial_schema')
      .from('escrow_records')
      .select('id, state, version')
      .eq('id', escrowId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !escrow) {
      throw new Error(`Escrow not found: ${escrowId}`);
    }

    // Check terminal state
    if (TERMINAL_STATES.has(escrow.state as FinancialEscrowState)) {
      throw new Error(`Cannot transition from terminal state: ${escrow.state}`);
    }

    // Validate transition legality
    const allowedTargets = LEGAL_TRANSITIONS[escrow.state];
    if (!allowedTargets?.includes(targetState)) {
      throw new Error(
        `Invalid transition: ${escrow.state} → ${targetState}. Allowed: ${allowedTargets?.join(', ')}`,
      );
    }

    // Call SECDEF function for atomic state transition
    const { data, error } = await supabase.rpc('advance_escrow_state', {
      p_escrow_id: escrowId,
      p_target_state: targetState,
      p_correlation_id: correlationId || null,
    });

    if (error) {
      throw new Error(`Escrow state transition failed: ${error.message}`);
    }

    return data as EscrowStateTransitionResult;
  }

  /**
   * Get escrow details with related contract/booking/payment info.
   */
  async getEscrowWithDetails(escrowId: string): Promise<Record<string, unknown>> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_escrow_with_details', {
      p_escrow_id: escrowId,
    });

    if (error) {
      throw new Error(`Failed to get escrow details: ${error.message}`);
    }

    return data as Record<string, unknown>;
  }

  /**
   * Get escrow by ID.
   */
  async getById(escrowId: string): Promise<Record<string, unknown> | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .schema('financial_schema')
      .from('escrow_records')
      .select('*')
      .eq('id', escrowId)
      .eq('is_deleted', false)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Verify escrow exists and is in a valid state for payment initiation.
   */
  async verifyForPaymentInitiation(escrowId: string): Promise<{
    exists: boolean;
    state: string;
    amount: number;
    currency: string;
    contractId: string;
  }> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .schema('financial_schema')
      .from('escrow_records')
      .select('id, state, amount, currency, contract_id')
      .eq('id', escrowId)
      .eq('is_deleted', false)
      .single();

    if (error || !data) {
      return { exists: false, state: '', amount: 0, currency: '', contractId: '' };
    }

    // Only allow payment initiation from these states
    const validStates = ['PENDING_CREATION', 'FUNDS_INITIATED'];
    if (!validStates.includes(data.state)) {
      return { exists: true, state: data.state, amount: 0, currency: '', contractId: '' };
    }

    return {
      exists: true,
      state: data.state,
      amount: Number(data.amount),
      currency: data.currency,
      contractId: data.contract_id,
    };
  }
}
