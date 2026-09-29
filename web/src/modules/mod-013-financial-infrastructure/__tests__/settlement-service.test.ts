// NexCargo C4-III — Settlement Service Tests
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Scope: ValidateSettlement creation validation, state machine enforcement, milestone checks.

import { describe, it, expect } from 'vitest';
import { validateSettlementCreation } from '@/modules/mod-013-financial-infrastructure/domain/services/settlement-service';
import { EscrowState } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

describe('validateSettlementCreation', () => {
  const baseInput = {
    escrowId: 'escrow-001',
    triggerEvent: 'DELIVERY_CONFIRMED' as const,
    settlementType: 'FULL' as const,
    settlementAmount: 5000,
  };

  it('accepts valid input with FUNDS_LOCKED escrow', () => {
    expect(() => validateSettlementCreation(baseInput, EscrowState.FUNDS_LOCKED))
      .not.toThrow();
  });

  it('accepts valid input with PARTIAL_RELEASE escrow', () => {
    expect(() => validateSettlementCreation(baseInput, EscrowState.PARTIAL_RELEASE))
      .not.toThrow();
  });

  it('rejects negative amount', () => {
    expect(() => validateSettlementCreation({ ...baseInput, settlementAmount: -100 }, EscrowState.FUNDS_LOCKED))
      .toThrow(ValidationError);
  });

  it('rejects zero amount', () => {
    expect(() => validateSettlementCreation({ ...baseInput, settlementAmount: 0 }, EscrowState.FUNDS_LOCKED))
      .toThrow(ValidationError);
  });

  it('rejects invalid trigger event', () => {
    expect(() => validateSettlementCreation({ ...baseInput, triggerEvent: 'INVALID_EVENT' as any }, EscrowState.FUNDS_LOCKED))
      .toThrow(ValidationError);
  });

  it('rejects invalid settlement type', () => {
    expect(() => validateSettlementCreation({ ...baseInput, settlementType: 'INVALID' as any }, EscrowState.FUNDS_LOCKED))
      .toThrow(ValidationError);
  });

  it('rejects PENDING_CREATION escrow state', () => {
    expect(() => validateSettlementCreation(baseInput, EscrowState.PENDING_CREATION))
      .toThrow(ValidationError);
  });

  it('rejects ESCROW_CLOSED escrow state', () => {
    expect(() => validateSettlementCreation(baseInput, EscrowState.ESCROW_CLOSED))
      .toThrow(ValidationError);
  });

  it('rejects DISPUTE_HOLD escrow state', () => {
    expect(() => validateSettlementCreation(baseInput, EscrowState.DISPUTE_HOLD))
      .toThrow(ValidationError);
  });

  it('allows FULL → FINAL_RELEASE transition', () => {
    expect(() => validateSettlementCreation(
      { ...baseInput, settlementType: 'FULL' },
      EscrowState.FUNDS_LOCKED
    )).not.toThrow();
  });

  it('allows MILESTONE → PARTIAL_RELEASE transition', () => {
    expect(() => validateSettlementCreation(
      { ...baseInput, settlementType: 'MILESTONE' },
      EscrowState.FUNDS_LOCKED
    )).not.toThrow();
  });

  it('allows REFUND → PARTIAL_RELEASE transition from FUNDS_LOCKED', () => {
    expect(() => validateSettlementCreation(
      { ...baseInput, settlementType: 'REFUND' },
      EscrowState.FUNDS_LOCKED
    )).not.toThrow();
  });
});
