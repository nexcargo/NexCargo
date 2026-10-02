// NexCargo C4 — POST /api/settlements (Settlement Request + Execution)
// Authoritative: MOD-013 §4.3 (SettlementRequestObject), §5.5 (Financial Flow State Machine)
// ESS-001F §6 (Settlement Engine), §7 (Ledger Immutability)
// Supports two operations via method/query param:
//   POST → Create settlement request
//   POST with ?execute=true → Execute existing settlement request
// Settlement amounts are derived from authoritative escrow records.
// Platform fees calculated server-side. Ledger entries generated atomically.

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { resolveCorrelationId, createCorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { createAdminClient } from '@/infrastructure/database/supabase';
import { SettlementExecutionService } from '@/infrastructure/services/settlement-execution-service';
import { InMemoryEventEmitter } from '@/shared/events/emitter';
import { EventClassification, EventCriticality } from '@/shared/types/enums';

/** Valid trigger events */
const VALID_TRIGGER_EVENTS = ['PICKUP_CONFIRMED', 'BORDER_CROSSING', 'DELIVERY_CONFIRMED', 'POD_APPROVED'];

/** Valid settlement types */
const VALID_SETTLEMENT_TYPES = ['FULL', 'MILESTONE', 'REFUND'];

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  createCorrelationContext({ correlationId });

  try {
    // Require authorization — SHIPPER or ADMIN can initiate settlements on their contracts
    const ctx = await assertApiAuthorization(request, 'financial', 'create');

    const url = new URL(request.url);
    const shouldExecute = url.searchParams.get('execute') === 'true';
    const shouldApprove = url.searchParams.get('approve') === 'true';

    if (shouldExecute) {
      // EXECUTE mode: execute an existing APPROVED settlement request
      return handleExecution(request, ctx, correlationId);
    }

    if (shouldApprove) {
      // APPROVE mode: approve a PENDING settlement request (Super Admin only)
      return handleApproval(request, ctx, correlationId);
    }

    // CREATE mode: create a new settlement request
    return handleCreation(request, ctx, correlationId);
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

async function handleApproval(request: NextRequest, ctx: { userId: string }, correlationId: string): Promise<NextResponse> {
  const body = await request.json();
  const { settlementId } = body as Record<string, unknown>;

  if (!settlementId || typeof settlementId !== 'string') {
    throw new ValidationError('settlementId is required for approval');
  }

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(settlementId as string)) {
    throw new ValidationError('Invalid settlementId format');
  }

  // Approve settlement via service (enforces Super Admin role)
  const service = new SettlementExecutionService();
  const result = await service.approveRequest(
    settlementId as string,
    ctx.userId,
    correlationId,
  );

  if (!result.success) {
    return NextResponse.json(
      wrapInContractFramework({ error: result.message, code: 'ERR_STL_403' }, correlationId),
      { status: 403, headers: { 'x-correlation-id': correlationId } },
    );
  }

  return NextResponse.json(
    wrapInContractFramework(result, correlationId),
    { status: 200, headers: { 'x-correlation-id': correlationId } },
  );
}

async function handleCreation(request: NextRequest, ctx: { userId: string }, correlationId: string): Promise<NextResponse> {
  const body = await request.json();
  const { escrowId, triggerEvent, settlementType, settlementAmount } = body as Record<string, unknown>;

  // Validate required fields
  if (!escrowId || typeof escrowId !== 'string' || escrowId.trim() === '') {
    throw new ValidationError('escrowId is required');
  }
  if (!triggerEvent || typeof triggerEvent !== 'string') {
    throw new ValidationError('triggerEvent is required');
  }
  if (!settlementAmount || typeof settlementAmount !== 'number' || settlementAmount <= 0) {
    throw new ValidationError('settlementAmount must be a positive number');
  }

  // Validate trigger event
  const validatedTriggerEvent = VALID_TRIGGER_EVENTS.includes(triggerEvent as string)
    ? (triggerEvent as typeof VALID_TRIGGER_EVENTS[number])
    : null;

  if (!validatedTriggerEvent) {
    throw new ValidationError(
      `Invalid triggerEvent: ${triggerEvent}. Allowed: ${VALID_TRIGGER_EVENTS.join(', ')}`,
    );
  }

  // Validate settlement type
  const validatedSettlementType = VALID_SETTLEMENT_TYPES.includes(settlementType as string)
    ? (settlementType as typeof VALID_SETTLEMENT_TYPES[number])
    : 'FULL';

  // Use settlement service for validation and creation
  const service = new SettlementExecutionService();
  const result = await service.createRequest({
    escrowId: escrowId as string,
    triggerEvent: validatedTriggerEvent,
    settlementType: validatedSettlementType,
    settlementAmount,
    userId: ctx.userId,
    correlationId,
  });

  if (!result.success) {
    return NextResponse.json(
      wrapInContractFramework({ error: result.message, code: 'ERR_STL_400' }, correlationId),
      { status: 400, headers: { 'x-correlation-id': correlationId } },
    );
  }

  return NextResponse.json(
    wrapInContractFramework({
      settlementId: result.settlementId,
      message: result.message,
    }, correlationId),
    { status: 201, headers: { 'x-correlation-id': correlationId } },
  );
}

async function handleExecution(request: NextRequest, ctx: { userId: string }, correlationId: string): Promise<NextResponse> {
  const body = await request.json();
  const { settlementId } = body as Record<string, unknown>;

  if (!settlementId || typeof settlementId !== 'string') {
    throw new ValidationError('settlementId is required for execution');
  }

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(settlementId as string)) {
    throw new ValidationError('Invalid settlementId format');
  }

  // Execute settlement via service
  const service = new SettlementExecutionService();
  const result = await service.execute({
    settlementId: settlementId as string,
    userId: ctx.userId,
    correlationId,
  });

  if (!result.success) {
    return NextResponse.json(
      wrapInContractFramework({ error: result.message, code: 'ERR_STL_400' }, correlationId),
      { status: 400, headers: { 'x-correlation-id': correlationId } },
    );
  }

  // C5 Increment 1 — Emit settlementCompleted canonical event (non-blocking)
  try {
    const { getEventBus } = await import('@/shared/events/handler-registry');
    const emitter = InMemoryEventEmitter.createEvent({
      eventType: 'settlementCompleted',
      sourceModule: 'MOD-013',
      aggregateId: settlementId as string,
      aggregateType: 'SettlementRequest',
      payload: {
        shipper_id: result?.shipperId ?? '',
        escrowId: body?.escrowId ?? '',
      },
      classification: EventClassification.FINANCIAL,
      criticality: EventCriticality.CRITICAL,
      correlationId,
    });
    await getEventBus().publish(emitter);
  } catch (emissionErr: unknown) {
    const message = emissionErr instanceof Error ? emissionErr.message : String(emissionErr);
    console.error('[Settlements] Event emission failed (non-blocking):', message);
  }

  return NextResponse.json(
    wrapInContractFramework(result, correlationId),
    { status: 200, headers: { 'x-correlation-id': correlationId } },
  );
}
