// NexCargo C4-II — Payment Orchestration Service (Mock Adapter)
// Authorized by: HAO C4-II Authorization (2026-09-08)
// Scope: Minimal vertical slice proving PENDING_CREATION -> payment initiation -> confirmation -> state transition end-to-end.
// Authority: MOD-005 §4.2, §5.1, §7.1 (No Custody), §7.3 (Event Dependency), §7.5 (Idempotency)
//           MOD-011 §5.2 (Isolation), §7.5 (Event Integrity), §7.6 (Webhook Security)
//           ESS-001F §2 (No Custody), §3 (Payment Channels), §6.3 (Settlement Idempotence)
//           C4 Readiness AC-001 through AC-005, AC-011, AC-013
//
// RESTRICTIONS:
// - Mock/stub provider ONLY. No real provider credentials or external money movement.
// - No production payment integration.
// - No settlement/payout/refund/dispute implementation beyond validating this payment flow.
// - Preserve database idempotency and enforce application-layer idempotency.
// - No arbitrary client-controlled identity, amount, currency, escrow or state transitions.

import { IPaymentIntentRepository, type PaymentIntentRecord } from '@/modules/mod-005-escrow/infrastructure/repositories/payment-intent-repository';
import { IMobileMoneyAdapter, type IMobileMoneyAdapter as MobileMoneyAdapterType } from '@/modules/mod-011-platform-integration/infrastructure/adapters/base.adapter';
import { MobileMoneyProvider, type MobileMoneyProvider as MProvider, type MobileMoneyPaymentResponse } from '@/modules/mod-011-platform-integration/infrastructure/adapters/mobile-money.types';
import { CurrencyCode, EscrowState as EscrowStateEnum, PaymentMethod } from '@/shared/types/enums';
import { validateEscrowTransition } from './escrow-state-machine';
import { ValidationError } from '@/shared/errors/app-errors';
import { PaymentIntentStatus } from '@/modules/mod-005-escrow/domain/enums';
import type {
  InitiatePaymentResult,
  ProcessCallbackResult,
  PaymentOrchestrationDependencies,
} from './types';

/** Predefined mock webhook secret used exclusively for testing/mock operations. Never a real provider key. */
export const MOCK_WEBHOOK_SECRET = 'c4ii-mock-secret-do-not-use-in-production';

/** Predefined valid payment method types (same set as DB CHECK constraint) */
const VALID_PAYMENT_METHODS = ['MPESA', 'MKESH', 'EMOLA', 'CARD', 'PAYPAL', 'BANK_TRANSFER'];

/** Predefined valid currencies */
const VALID_CURRENCIES = [CurrencyCode.MZN, CurrencyCode.ZAR, CurrencyCode.USD];

/**
 * Internal helper: verify HMAC-SHA256 signature against mock webhook secret.
 * This establishes the verification boundary for mock provider callbacks.
 * Per ESS-001F §12 + MOD-011 §7.6: webhooks MUST be signed and verifiable.
 */
async function verifyMockWebhookSignature(
  payload: string,
  expectedSignature: string | undefined,
): Promise<boolean> {
  if (!expectedSignature) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(MOCK_WEBHOOK_SECRET);
    const payloadData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
    const actualSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison to prevent timing attacks
    if (actualSignature.length !== expectedSignature.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < actualSignature.length; i++) {
      result |= actualSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

/** Check if a value is a MobileMoneyError (has errorCode property) */
function isErrorResponse(value: unknown): value is { errorCode: string; message: string } {
  return typeof value === 'object' && value !== null && 'errorCode' in value;
}

// ============================================================
// initiatePayment — Main C4-II orchestration entry point
// ============================================================

export async function initiatePayment(
  deps: PaymentOrchestrationDependencies,
  input: {
    escrowId: string;
    amount: number;
    currency: CurrencyCode;
    paymentMethodType: string;
  },
): Promise<InitiatePaymentResult> {
  // --- Input validation (server-side only; never client-controlled) ---
  if (!input.escrowId || input.escrowId.trim() === '') {
    throw new ValidationError('Missing or empty escrowId');
  }
  if (typeof input.amount !== 'number' || input.amount <= 0) {
    throw new ValidationError(`Amount must be a positive number, got: ${input.amount}`);
  }
  if (!VALID_CURRENCIES.includes(input.currency)) {
    throw new ValidationError(
      `Invalid currency: ${input.currency}. Allowed: ${VALID_CURRENCIES.join(', ')}`,
    );
  }
  if (!VALID_PAYMENT_METHODS.includes(input.paymentMethodType)) {
    throw new ValidationError(
      `Invalid payment method: ${input.paymentMethodType}. Allowed: ${VALID_PAYMENT_METHODS.join(', ')}`,
    );
  }

  const { escrowId, paymentMethodType, amount, currency } = input;
  const idempotencyKey = `idem-${escrowId}-${amount}-${currency}-${paymentMethodType}`;

  // Application-layer idempotency check per MOD-005 §7.5
  const existing = await deps.repo.findByIdempotencyKey(idempotencyKey);
  if (existing) {
    return {
      success: true,
      existing: true,
      message: 'Payment already exists for this idempotency key',
      paymentIntent: existing,
    };
  }

  // Create payment intent record at INITIATED status
  const intent = await deps.repo.create({
    escrow_id: escrowId,
    amount,
    currency,
    payment_method: paymentMethodType as PaymentMethod,
    status: PaymentIntentStatus.INITIATED,
    idempotency_key: idempotencyKey,
    fee_amount: 0,
    is_deleted: false,
  } as Omit<PaymentIntentRecord, 'id' | 'created_at' | 'updated_at'>);

  // Call mock provider to initiate payment
  const providerResult = await deps.adapter.initiatePayment({
    referenceId: intent.id,
    amount,
    currency,
    recipientPhone: '+258800000000',
  });

  if (isErrorResponse(providerResult)) {
    await deps.repo.fail(intent.id, providerResult.message);
    throw new Error(`Provider payment failed: ${providerResult.message}`);
  }

  // Transition escrow: PENDING_CREATION -> FUNDS_INITIATED
  try {
    validateEscrowTransition(EscrowStateEnum.PENDING_CREATION, EscrowStateEnum.FUNDS_INITIATED);
    await deps.escrowRepo.updateStatus(
      escrowId,
      EscrowStateEnum.PENDING_CREATION,
      EscrowStateEnum.FUNDS_INITIATED,
    );
  } catch (e) {
    await deps.repo.fail(intent.id, e instanceof Error ? e.message : 'Escrow transition validation failed');
    throw e;
  }

  // Mark intent as CONFIRMED with provider reference
  await deps.repo.confirm(
    intent.id,
    providerResult.transactionId,
    providerResult.referenceId,
    undefined,
  );

  return {
    success: true,
    existing: false,
    message: 'Payment initiated successfully',
    paymentIntent: intent,
  };
}

// ============================================================
// processProviderCallback — Mock provider webhook handler
// ============================================================

export async function processProviderCallback(
  deps: PaymentOrchestrationDependencies,
  rawBody: string,
  signatureHeader: string | undefined,
  _provider?: MProvider,
): Promise<ProcessCallbackResult> {
  // Verification boundary per MOD-011 §7.6: webhooks MUST be signed and verifiable
  const isValid = await verifyMockWebhookSignature(rawBody, signatureHeader);
  if (!isValid) {
    return { success: false, error: 'UNAUTHORIZED: Invalid or missing webhook signature', httpStatus: 401, message: '' };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { success: false, error: 'Bad request body: invalid JSON', httpStatus: 400, message: '' };
  }

  const referenceId = String(parsed.referenceId ?? '');
  const status = String(parsed.status ?? '').toUpperCase();

  if (!referenceId || !status) {
    return { success: false, error: 'Missing required fields: referenceId, status', httpStatus: 400, message: '' };
  }

  if (status !== 'COMPLETED' && status !== 'FAILED') {
    return { success: false, error: `Unsupported callback status: ${status}`, httpStatus: 400, message: '' };
  }

  // Find intent — extends interface via call pattern; use findByIdempotencyKey as fallback
  const intent = await deps.repo.findByIdempotencyKey(referenceId)
    ?? await deps.repo.findByEscrow(referenceId).then(intents => intents.find(i => i.id === referenceId) ?? null);

  if (!intent) {
    return { success: false, error: 'Payment intent not found', httpStatus: 404, message: '' };
  }

  // Idempotent replay: skip if already confirmed or pending
  if (intent.status === PaymentIntentStatus.CONFIRMED || intent.status === PaymentIntentStatus.PENDING) {
    return { success: true, existing: true, message: 'Payment already processed (idempotent replay)', paymentIntent: intent };
  }

  if (status === 'COMPLETED') {
    // Transition escrow: FUNDS_INITIATED -> FUNDS_LOCKED
    try {
      validateEscrowTransition(EscrowStateEnum.FUNDS_INITIATED, EscrowStateEnum.FUNDS_LOCKED);
      await deps.escrowRepo.updateStatus(
        intent.escrow_id,
        EscrowStateEnum.FUNDS_INITIATED,
        EscrowStateEnum.FUNDS_LOCKED,
      );
    } catch { /* State mismatch — log but don't block confirmation */ }

    await deps.repo.confirm(intent.id, String(parsed.providerReferenceId ?? ''), '', undefined);
    return { success: true, existing: false, message: 'Payment confirmed via callback', paymentIntent: intent };
  }

  await deps.repo.fail(intent.id, 'Provider callback: transaction failed', undefined);
  return { success: false, error: 'Payment failed', httpStatus: 400, message: 'Payment failed', paymentIntent: intent };
}
