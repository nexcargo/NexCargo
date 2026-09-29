// NexCargo C4-III — Settlement Orchestration Service
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-013 §4.3 (SettlementRequestObject), §5.5 (Financial Flow State Machine)
//            ESS-001F §6 (Settlement Engine), §6.3 (Settlement Rules)
//            C4 Readiness R9 (Settlement request API), R10 (Settlement confirmation)
// Scope: Minimal settlement lifecycle: PENDING → EXECUTED/FAILED with escrow state advancement.

import { EscrowState } from '@/shared/types/enums';
import { validateEscrowTransition } from '@/modules/mod-005-escrow/domain/services/escrow-state-machine';
import { ValidationError } from '@/shared/errors/app-errors';
import type { PaymentIntentStatus } from '@/modules/mod-005-escrow/domain/enums';

// ============================================================
// Types
// ============================================================

export interface CreateSettlementInput {
  escrowId: string;
  triggerEvent: 'PICKUP_CONFIRMED' | 'BORDER_CROSSING' | 'DELIVERY_CONFIRMED' | 'POD_APPROVED';
  settlementType: 'FULL' | 'MILESTONE' | 'REFUND';
  settlementAmount: number;
}

export interface SettlementExecutionResult {
  success: boolean;
  message: string;
  settlementReferenceId?: string;
}

/** Valid escrow states that can accept a settlement request */
const VALID_SETTLEMENT_STATES = [
  EscrowState.FUNDS_LOCKED,
  EscrowState.PARTIAL_RELEASE,
];

/** Valid escrow states after settlement execution depends on settlement type */
const FINAL_SETTLEMENT_STATE: Record<string, EscrowState> = {
  FULL: EscrowState.FINAL_RELEASE,
  MILESTONE: EscrowState.PARTIAL_RELEASE,
  REFUND: EscrowState.PARTIAL_RELEASE,
};

// ============================================================
// createSettlementRequest — Core settlement initiation
// ============================================================

/**
 * Validates input and performs state checks BEFORE creating settlement request.
 * Does NOT persist — caller must use repository to save.
 */
export function validateSettlementCreation(
  input: CreateSettlementInput,
  currentEscrowState: EscrowState,
): void {
  // Validate amount
  if (typeof input.settlementAmount !== 'number' || input.settlementAmount <= 0) {
    throw new ValidationError(`settlementAmount must be positive: ${input.settlementAmount}`);
  }

  // Validate trigger event per MOD-013 §4.3
  const validTriggers = ['PICKUP_CONFIRMED', 'BORDER_CROSSING', 'DELIVERY_CONFIRMED', 'POD_APPROVED'];
  if (!validTriggers.includes(input.triggerEvent)) {
    throw new ValidationError(
      `Invalid trigger_event: ${input.triggerEvent}. Allowed: ${validTriggers.join(', ')}`,
    );
  }

  // Validate settlement type per MOD-013 §4.3
  const validTypes = ['FULL', 'MILESTONE', 'REFUND'];
  if (!validTypes.includes(input.settlementType)) {
    throw new ValidationError(
      `Invalid settlement_type: ${input.settlementType}. Allowed: ${validTypes.join(', ')}`,
    );
  }

  // Validate escrow is in an appropriate state for settlement
  if (!VALID_SETTLEMENT_STATES.includes(currentEscrowState)) {
    throw new ValidationError(
      `Escrow must be in FUNDS_LOCKED or PARTIAL_RELEASE to accept settlement, got: ${currentEscrowState}`,
    );
  }

  // Verify state transition is valid for this settlement type
  const expectedFinalState = FINAL_SETTLEMENT_STATE[input.settlementType] ?? EscrowState.FINAL_RELEASE;
  try {
    validateEscrowTransition(currentEscrowState, expectedFinalState);
  } catch (e) {
    throw new ValidationError(
      `State transition ${currentEscrowState} → ${expectedFinalState} invalid for ${input.settlementType} settlement`,
    );
  }
}
