// NexCargo MOD-005 — Escrow Domain Services
// Wave 2 — Phase 2A, Increment 1 — Authorized per HAO-MOD005-INC1
// Reference: MOD-005 §6 (Responsibilities)
//
// Services cover:
// 6.1 Financial State Modeling (escrow lifecycle, payment intents)
// 6.2 Settlement Coordination (release instructions)
// 6.3 Reconciliation Structuring (mismatch detection)
// 6.4 Payment Method Orchestration (multi-payment methods)
// 6.5 Dispute Management (holds and resolution)
// 6.6 Digital Wallet Representation

import type { EscrowAccount } from '../types/entities';
import type { PaymentIntentStatus, SettlementStatus, DisputeStatus, ResolutionStatus } from '../enums';
import type { EscrowState, CurrencyCode } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Payment Intent Service
// Per MOD-005 §6.4 — Payment Method Orchestration
// ============================================================

export interface CreatePaymentIntentInput {
  escrowId: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethodType: string; // MPESA/MKESH/EMOLA/CARD/PAYPAL/BANK_TRANSFER
  idempotencyKey: string;
}

/** Validate payment intent creation */
export function validatePaymentIntent(input: CreatePaymentIntentInput): void {
  if (!input.escrowId || input.escrowId.trim() === '') {
    throw new ValidationError('escrowId is required for payment intent creation');
  }
  if (input.amount <= 0) {
    throw new ValidationError(`Payment amount must be positive: ${input.amount}`);
  }
  if (!input.idempotencyKey || input.idempotencyKey.trim() === '') {
    throw new ValidationError('idempotencyKey is required for payment intent creation');
  }
  const validMethods = ['MPESA', 'MKESH', 'EMOLA', 'CARD', 'PAYPAL', 'BANK_TRANSFER'];
  if (!validMethods.includes(input.paymentMethodType)) {
    throw new ValidationError(
      `Invalid payment method: ${input.paymentMethodType}. Allowed: ${validMethods.join(', ')}`,
    );
  }
}

/** Track duplicate payment intent by idempotency key — returns null if unique, or existing intent info if duplicate */
let processedKeys = new Map<string, { escrowId: string; status: string }>();

export function checkIdempotencyKey(idempotencyKey: string): { isUnique: boolean; existingEscrowId?: string } {
  const existing = processedKeys.get(idempotencyKey);
  if (existing) {
    return { isUnique: false, existingEscrowId: existing.escrowId };
  }
  return { isUnique: true };
}

// Register an idempotency key after successful processing
export function registerIdempotencyKey(idempotencyKey: string, escrowId: string): void {
  processedKeys.set(idempotencyKey, { escrowId, status: 'PROCESSED' });
}

// ============================================================
// Settlement Coordination Service
// Per MOD-005 §6.2 — Settlement Coordination Layer
// ============================================================

export interface CreateSettlementInput {
  escrowId: string;
  releaseAmount: number;
  milestone: string; // PICKUP_CONFIRMED | BORDER_CROSSING | DELIVERY_CONFIRMED | POD_APPROVED
}

/** Validate settlement request */
export function validateSettlementRequest(input: CreateSettlementInput): void {
  if (!input.escrowId || input.escrowId.trim() === '') {
    throw new ValidationError('escrowId is required for settlement request');
  }
  if (input.releaseAmount <= 0) {
    throw new ValidationError(`Release amount must be positive: ${input.releaseAmount}`);
  }
  const validMilestones = ['PICKUP_CONFIRMED', 'BORDER_CROSSING', 'DELIVERY_CONFIRMED', 'POD_APPROVED'];
  if (!validMilestones.includes(input.milestone)) {
    throw new ValidationError(
      `Invalid milestone: ${input.milestone}. Allowed: ${validMilestones.join(', ')}`,
    );
  }
}

// ============================================================
// Dispute Management Service
// Per MOD-005 §6.5 — Dispute Management
// ============================================================

export interface CreateDisputeInput {
  escrowId: string;
  raisedBy: string; // SHIPPER or TRANSPORTER
  disputeReason: string;
}

/** Validate dispute creation */
export function validateDisputeCreation(input: CreateDisputeInput): void {
  if (!input.escrowId || input.escrowId.trim() === '') {
    throw new ValidationError('escrowId is required for dispute creation');
  }
  if (!input.raisedBy || !['SHIPPER', 'TRANSPORTER'].includes(input.raisedBy)) {
    throw new ValidationError(`raisedBy must be SHIPPER or TRANSPORTER: ${input.raisedBy}`);
  }
  if (!input.disputeReason || input.disputeReason.trim().length < 5) {
    throw new ValidationError('disputeReason must be at least 5 characters');
  }
}

// ============================================================
// Reconciliation Structuring Service
// Per MOD-005 §6.3 — Reconciliation Structuring
// ============================================================

export interface ReconciliationResult {
  mismatchDetected: boolean;
  internalState: string;
  externalState: string;
  details?: string;
}

/**
 * Compare internal ledger state against external bank state.
 * Returns reconciliation result indicating alignment or mismatch.
 * Bank is the primary source of escrow truth (MOD-005 §7.6).
 */
export function compareStates(internalState: string, externalState: string): ReconciliationResult {
  // Simple JSON comparison for illustration
  try {
    const internalParsed = typeof internalState === 'string' ? JSON.parse(internalState) : internalState;
    const externalParsed = typeof externalState === 'string' ? JSON.parse(externalState) : externalState;
    
    const internalStr = JSON.stringify(internalParsed);
    const externalStr = JSON.stringify(externalParsed);
    
    const mismatchDetected = internalStr !== externalStr;
    
    if (mismatchDetected) {
      return {
        mismatchDetected: true,
        internalState: internalStr,
        externalState: externalStr,
        details: 'Internal ledger state does not match external bank state',
      };
    }
    
    return {
      mismatchDetected: false,
      internalState: internalStr,
      externalState: externalStr,
    };
  } catch {
    return {
      mismatchDetected: true,
      internalState: typeof internalState === 'string' ? internalState : JSON.stringify(internalState),
      externalState: typeof externalState === 'string' ? externalState : JSON.stringify(externalState),
      details: 'Failed to parse states for comparison',
    };
  }
}

// ============================================================
// Digital Wallet Service
// Per MOD-005 §6.6 — Digital Wallet Representation
// ============================================================

/**
 * Calculate wallet balance from escrow state and payout status.
 * Wallet does NOT store real funds — balance is derived from authoritative sources.
 */
export function calculateDerivedBalance(
  escrowLockedAmount: number,
  pendingPayouts: number,
  confirmedIncoming: number,
): number {
  // Balance = locked in escrow + confirmed incoming - pending payouts
  // All values are read-only derivations
  return escrowLockedAmount + confirmedIncoming - pendingPayouts;
}
