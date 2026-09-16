// NexCargo C4-III — Dispute Hold Service Tests
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Scope: Validate DISPUTE_HOLD transitions, state machine enforcement, resolution handling.

import { describe, it, expect } from 'vitest';
import { prepareDisputeHold, prepareDisputeResolution } from '@/modules/mod-005-escrow/domain/services/dispute-hold-service';
import { ValidationError } from '@/shared/errors/app-errors';

describe('prepareDisputeHold', () => {
  it('accepts valid FUNDS_LOCKED signal', () => {
    expect(() => prepareDisputeHold({ escrowId: 'escrow-001', reason: 'Delivered goods damaged' }))
      .not.toThrow();
  });

  it('rejects short reason (< 3 chars)', () => {
    expect(() => prepareDisputeHold({ escrowId: 'escrow-001', reason: 'ab' }))
      .toThrow(ValidationError);
  });

  it('rejects empty escrowId', () => {
    expect(() => prepareDisputeHold({ escrowId: '', reason: 'test' }))
      .toThrow(ValidationError);
  });

  it('rejects whitespace-only escrowId', () => {
    expect(() => prepareDisputeHold({ escrowId: '   ', reason: 'test' }))
      .toThrow(ValidationError);
  });
});

describe('prepareDisputeResolution', () => {
  it('accepts RELEASE_TO_TRANSPORTER outcome', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'escrow-001', outcome: 'RELEASE_TO_TRANSPORTER' }))
      .not.toThrow();
  });

  it('accepts REFUND_TO_SHIPPER outcome', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'escrow-001', outcome: 'REFUND_TO_SHIPPER' }))
      .not.toThrow();
  });

  it('accepts SPLIT_SETTLEMENT outcome', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'escrow-001', outcome: 'SPLIT_SETTLEMENT' }))
      .not.toThrow();
  });

  it('rejects invalid outcome', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'escrow-001', outcome: 'INVALID' as any }))
      .toThrow(ValidationError);
  });

  it('rejects empty escrowId', () => {
    expect(() => prepareDisputeResolution({ escrowId: '', outcome: 'RELEASE_TO_TRANSPORTER' }))
      .toThrow(ValidationError);
  });
});
