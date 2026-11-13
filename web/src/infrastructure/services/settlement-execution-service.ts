// NexCargo Settlement Execution Service — C4 Financial Execution
// Authoritative: MOD-013 §4.3 (SettlementRequestObject), §5.5 (Financial Flow State Machine)
// ESS-001F §6 (Settlement Engine), §7 (Ledger Immutability)
// Executes settlement requests with authoritative amount derivation,
// platform fee calculation, and immutable ledger entry generation.

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/infrastructure/database/supabase';

export interface SettlementExecutionParams {
  settlementId: string;
  userId: string;
  correlationId?: string;
}

export interface SettlementExecutionResult {
  success: boolean;
  action: string;
  settlementId?: string;
  escrowId?: string;
  shipperId: string;
  authoritativeAmount?: number;
  platformFee?: number;
  transporterPayout?: number;
  currency?: string;
  feePercentage?: number;
  escrowStateAfter?: string;
  transactionReference?: string;
  ledgerEntriesCreated?: number;
  message: string;
}

/** Valid trigger events per migration 007 CHECK constraint */
const VALID_TRIGGER_EVENTS = ['PICKUP_CONFIRMED', 'BORDER_CROSSING', 'DELIVERY_CONFIRMED', 'POD_APPROVED'];

/** Valid settlement types */
const VALID_SETTLEMENT_TYPES = ['FULL', 'MILESTONE', 'REFUND'];

export class SettlementExecutionService {
  /**
   * Execute a settlement request.
   - Uses authoritative amounts from escrow/contract records
   - Calculates platform fee/commission from configured percentage
   - Creates immutable double-entry ledger entries
   - Advances escrow state
   - Idempotent: prevents duplicate settlement
   */
  async execute(params: SettlementExecutionParams): Promise<SettlementExecutionResult> {
    // Step 1: Verify settlement request exists and is approved/pending
    const supabase = await createClient();
    const { data: settlement, error: fetchError } = await supabase
      .schema('financial_schema')
      .from('settlement_requests')
      .select('id, escrow_id, approval_status, settlement_type, settlement_amount, trigger_event')
      .eq('id', params.settlementId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !settlement) {
      return {
        success: false,
        action: 'settlement_not_found',
        shipperId: '',
        message: `Settlement request not found: ${params.settlementId}`,
      };
    }

    // Validate approval status — ONLY APPROVED settlements may execute.
    // PENDING must be explicitly approved via approve_settlement() SECDEF.
    if (settlement.approval_status !== 'APPROVED') {
      return {
        success: false,
        action: 'settlement_not_approved',
        shipperId: '',
        message: `Settlement must be APPROVED before execution, got: ${settlement.approval_status}`,
      };
    }

    // Validate settlement type
    if (!VALID_SETTLEMENT_TYPES.includes(settlement.settlement_type)) {
      return {
        success: false,
        action: 'invalid_settlement_type',
        shipperId: '',
        message: `Invalid settlement type: ${settlement.settlement_type}`,
      };
    }

    // Validate trigger event
    if (!VALID_TRIGGER_EVENTS.includes(settlement.trigger_event)) {
      return {
        success: false,
        action: 'invalid_trigger_event',
        shipperId: '',
        message: `Invalid trigger event: ${settlement.trigger_event}`,
      };
    }

    // Validate approval status — ONLY APPROVED settlements may execute.
    // PENDING must be explicitly approved via approve_settlement() SECDEF.
    if (settlement.approval_status !== 'APPROVED') {
      return {
        success: false,
        action: 'settlement_not_approved',
        shipperId: '',
        message: `Settlement must be APPROVED before execution, got: ${settlement.approval_status}`,
      };
    }

    // Validate settlement type
    if (!VALID_SETTLEMENT_TYPES.includes(settlement.settlement_type)) {
      return {
        success: false,
        action: 'invalid_settlement_type',
        shipperId: '',
        message: `Invalid settlement type: ${settlement.settlement_type}`,
      };
    }

    // Validate trigger event
    if (!VALID_TRIGGER_EVENTS.includes(settlement.trigger_event)) {
      return {
        success: false,
        action: 'invalid_trigger_event',
        shipperId: '',
        message: `Invalid trigger event: ${settlement.trigger_event}`,
      };
    }

    // Step 2: Call SECDEF function for atomic settlement execution
    const { data, error } = await supabase.rpc('execute_settlement', {
      p_settlement_id: params.settlementId,
      p_correlation_id: params.correlationId || null,
    });

    if (error) {
      const errMsg = error.message;

      // Map specific errors to structured responses
      if (errMsg.includes('SETTLEMENT_EXCEEDS_ESCROW')) {
        return {
          success: false,
          action: 'settlement_exceeds_escrow',
          shipperId: '',
          message: errMsg,
        };
      }

      if (errMsg.includes('NEGATIVE_PAYOUT')) {
        return {
          success: false,
          action: 'negative_payout',
          shipperId: '',
          message: errMsg,
        };
      }

      if (errMsg.includes('UNAUTHORIZED')) {
        return {
          success: false,
          action: 'unauthorized',
          shipperId: '',
          message: 'Unauthorized: no authenticated user in SECDEF context',
        };
      }

      if (errMsg.includes('NEGATIVE_PAYOUT')) {
        return {
          success: false,
          action: 'negative_payout',
          shipperId: '',
          message: errMsg,
        };
      }

      if (errMsg.includes('UNAUTHORIZED')) {
        return {
          success: false,
          action: 'unauthorized',
          shipperId: '',
          message: 'Unauthorized: no authenticated user in SECDEF context',
        };
      }

      throw new Error(`Settlement execution failed: ${errMsg}`);
    }

    return data as SettlementExecutionResult;
  }

  /**
   * Approve a settlement request (Super Admin only).
   - Transitions PENDING → APPROVED.
   - Idempotent: already-approved settlements return without side effects.
   */
  async approveRequest(settlementId: string, userId: string, correlationId?: string): Promise<{ success: boolean; message: string; approvalStatus?: string }> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('approve_settlement', {
      p_settlement_id: settlementId,
      p_correlation_id: correlationId || null,
    });

    if (error) {
      const errMsg = error.message;

      if (errMsg.includes('UNAUTHORIZED')) {
        return { success: false, message: 'Unauthorized: no authenticated user in SECDEF context' };
      }

      if (errMsg.includes('ACCESS_DENIED_APPROVAL')) {
        return { success: false, message: 'Only SUPER_ADMIN may approve settlement requests' };
      }

      if (errMsg.includes('SETTLEMENT_NOT_FOUND')) {
        return { success: false, message: `Settlement request not found: ${settlementId}` };
      }

      throw new Error(`Settlement approval failed: ${errMsg}`);
    }

    return {
      success: true,
      message: 'Settlement approved successfully',
      approvalStatus: 'APPROVED',
    };
  }

  /**
   * Create a settlement request.
   - Validates escrow state
   - Derives authoritative amount (never trusts client input for final calculation)
   - Creates settlement request record
   */
  async createRequest(params: {
    escrowId: string;
    triggerEvent: string;
    settlementType: 'FULL' | 'MILESTONE' | 'REFUND';
    settlementAmount: number;
    userId: string;
    correlationId?: string;
  }): Promise<{ success: boolean; settlementId?: string; message: string }> {
    // Validate trigger event
    if (!VALID_TRIGGER_EVENTS.includes(params.triggerEvent)) {
      return {
        success: false,
        message: `Invalid trigger event: ${params.triggerEvent}. Allowed: ${VALID_TRIGGER_EVENTS.join(', ')}`,
      };
    }

    // Validate settlement type
    if (!VALID_SETTLEMENT_TYPES.includes(params.settlementType)) {
      return {
        success: false,
        message: `Invalid settlement type: ${params.settlementType}`,
      };
    }

    // Get current escrow state
    const adminClient = createAdminClient();
    const { data: escrow, error: escrowError } = await adminClient
      .schema('financial_schema')
      .from('escrow_records')
      .select('id, state, amount, currency')
      .eq('id', params.escrowId)
      .eq('is_deleted', false)
      .single();

    if (escrowError || !escrow) {
      return { success: false, message: 'Escrow not found' };
    }

    // Validate escrow state can accept settlement
    const validStates = ['FUNDS_LOCKED', 'RELEASE_ELIGIBLE'];
    if (!validStates.includes(escrow.state)) {
      return {
        success: false,
        message: `Escrow must be in ${validStates.join(' or ')}, got: ${escrow.state}`,
      };
    }

    // For MILESTONE/REFUND, validate amount does not exceed escrow amount
    if (params.settlementType !== 'FULL' && params.settlementAmount > Number(escrow.amount)) {
      return {
        success: false,
        message: `Settlement amount ${params.settlementAmount} exceeds escrow amount ${escrow.amount}`,
      };
    }

    // Create settlement request via RPC (authorizes and validates server-side)
    const supabase = await createClient();
    const { data: result, error: insertError } = await supabase.rpc('create_settlement_request', {
      p_escrow_id: params.escrowId,
      p_trigger_event: params.triggerEvent,
      p_settlement_type: params.settlementType,
      p_settlement_amount: params.settlementAmount,
      p_correlation_id: params.correlationId || null,
    });

    if (insertError) {
      // If RPC doesn't exist yet, fall back to direct insert (migration 030 adds this RPC)
      const { data: inserted, error: directError } = await adminClient
        .schema('financial_schema')
        .from('settlement_requests')
        .insert({
          escrow_id: params.escrowId,
          trigger_event: params.triggerEvent,
          requested_by_module: 'MOD-003',
          approval_status: 'PENDING',
          settlement_type: params.settlementType,
          settlement_amount: params.settlementAmount,
          retry_count: 0,
          created_by: params.userId,
          correlation_id: params.correlationId || null,
        })
        .select()
        .single();

      if (directError) {
        return { success: false, message: `Failed to create settlement: ${directError.message}` };
      }

      return {
        success: true,
        settlementId: inserted.id,
        message: 'Settlement request created successfully',
      };
    }

    return {
      success: true,
      settlementId: String(result?.settlementId ?? ''),
      message: 'Settlement request created and ready for execution',
    };
  }
}
