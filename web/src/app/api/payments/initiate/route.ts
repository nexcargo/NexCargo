// NexCargo C4 — POST /api/payments/initiate (Payment Initiation)
// Authoritative: MOD-005 §4.2 (Payment Intent), ESS-001F §4 (Payment Channels)
// Creates a payment intent tied to an escrow record.
// Derives amount/currency from authoritative escrow record — never trusts client input.
// Generates idempotency key. Invokes provider adapter.

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { resolveCorrelationId, createCorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { PaymentInitiationService } from '@/infrastructure/services/payment-initiation-service';
import type { PaymentMethodType } from '@/infrastructure/payment-providers';

/** Valid payment method types */
const VALID_PAYMENT_METHODS: PaymentMethodType[] = ['MPESA', 'MKESH', 'EMOLA', 'CARD', 'PAYPAL', 'BANK_TRANSFER'];

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  createCorrelationContext({ correlationId });

  try {
    // Require authorization
    const ctx = await assertApiAuthorization(request, 'financial', 'create');

    const body = await request.json();
    const { escrowId, paymentMethod, customerIdentifier } = body as Record<string, unknown>;

    // Validate required fields
    if (!escrowId || typeof escrowId !== 'string' || escrowId.trim() === '') {
      throw new ValidationError('escrowId is required');
    }
    if (!paymentMethod || typeof paymentMethod !== 'string') {
      throw new ValidationError('paymentMethod is required');
    }
    if (!customerIdentifier || typeof customerIdentifier !== 'string') {
      throw new ValidationError('customerIdentifier is required (e.g., phone number for mobile money)');
    }

    // Validate payment method
    const validatedMethod = VALID_PAYMENT_METHODS.includes(paymentMethod as PaymentMethodType)
      ? (paymentMethod as PaymentMethodType)
      : null;

    if (!validatedMethod) {
      throw new ValidationError(
        `Invalid paymentMethod: ${paymentMethod}. Allowed: ${VALID_PAYMENT_METHODS.join(', ')}`,
      );
    }

    // Generate idempotency key from request context
    const idempotencyKey = `${ctx.userId}-${validatedMethod}-${Date.now()}`;

    // Execute payment initiation via service
    const service = new PaymentInitiationService();
    const result = await service.initiate({
      escrowId: escrowId as string,
      paymentMethod: validatedMethod,
      customerIdentifier: customerIdentifier as string,
      userId: ctx.userId,
      correlationId,
    });

    return NextResponse.json(
      wrapInContractFramework(result, correlationId),
      { status: result.success ? 201 : 400, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message, code: error.code }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized', code: 'ERR_1003' }, correlationId),
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return NextResponse.json(
      wrapInContractFramework({ error: 'Internal server error', details: (error as Error).message, code: 'ERR_1099' }, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
