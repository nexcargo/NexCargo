// NexCargo C4 — GET /api/payments/[id]/status (Payment Status Inquiry)
// Authoritative: MOD-005 §4.2 (Payment Intent)
// Returns payment intent status with escrow context.
// Authenticated users can view their own payment intents via escrow/contract relationship.

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { resolveCorrelationId, createCorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { PaymentInitiationService } from '@/infrastructure/services/payment-initiation-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  createCorrelationContext({ correlationId });

  try {
    // Require authorization (any authenticated user can query their own payments)
    await assertApiAuthorization(_request, 'financial', 'read');

    const { id } = await params;

    if (!id || typeof id !== 'string') {
      throw new ValidationError('paymentIntentId is required');
    }

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new ValidationError('Invalid paymentIntentId format');
    }

    // Get payment status via service
    const service = new PaymentInitiationService();
    const result = await service.getStatus(id);

    return NextResponse.json(
      wrapInContractFramework(result, correlationId),
      { status: result.success ? 200 : 404, headers: { 'x-correlation-id': correlationId } },
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
      wrapInContractFramework({ error: 'Internal server error', code: 'ERR_1099' }, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
