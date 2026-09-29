// NexCargo C4-III — POST /api/settlements (Settlement Request Creation)
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-013 §4.3 (SettlementRequestObject), §5.5 (Financial Flow State Machine)
//            ESS-001F §6 (Settlement Engine), §6.3 (Settlement Rules)
// Scope: Accept milestone trigger → validate escrow state → create SettlementRequest(PENDING).

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { createAdminClient } from '@/infrastructure/database/supabase';

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  createCorrelationContext({ correlationId });

  try {
    // Require authorization — SHIPPER or ADMIN can initiate settlements on their contracts
    const ctx = await assertApiAuthorization(request, 'financial', 'create');

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

    const validatedTriggerEvent = ['PICKUP_CONFIRMED', 'BORDER_CROSSING', 'DELIVERY_CONFIRMED', 'POD_APPROVED']
      .includes(triggerEvent as string)
      ? (triggerEvent as 'PICKUP_CONFIRMED' | 'BORDER_CROSSING' | 'DELIVERY_CONFIRMED' | 'POD_APPROVED')
      : null;
    
    if (!validatedTriggerEvent) {
      throw new ValidationError(
        `Invalid triggerEvent: ${triggerEvent}. Allowed: PICKUP_CONFIRMED, BORDER_CROSSING, DELIVERY_CONFIRMED, POD_APPROVED`,
      );
    }

    const validatedSettlementType = ['FULL', 'MILESTONE', 'REFUND'].includes(settlementType as string)
      ? (settlementType as 'FULL' | 'MILESTONE' | 'REFUND')
      : 'FULL';

    // Query current escrow state
    const supabase = createAdminClient();
    const { data: escrow, error: escrowError } = await supabase
      .schema('financial_schema').from('escrow_records')
      .select('id, state, amount, currency')
      .eq('id', escrowId as string)
      .single();

    if (escrowError || !escrow) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Escrow not found', code: 'ERR_1002' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Validate escrow state — only FUNDS_LOCKED and PARTIAL_RELEASE can accept settlement
    const validEscrowStates = ['FUNDS_LOCKED', 'PARTIAL_RELEASE'];
    if (!validEscrowStates.includes(escrow.state)) {
      throw new ValidationError(
        `Escrow must be in FUNDS_LOCKED or PARTIAL_RELEASE to accept settlement, got: ${escrow.state}`,
      );
    }

    // Determine target state based on settlement type
    const finalStateMap: Record<string, string> = {
      FULL: 'FINAL_RELEASE',
      MILESTONE: 'PARTIAL_RELEASE',
      REFUND: 'PARTIAL_RELEASE',
    };
    const targetState = finalStateMap[validatedSettlementType] ?? 'FINAL_RELEASE';

    // Create settlement request record
    const { data: settlementRecord, error: insertError } = await supabase
      .schema('financial_schema').from('settlement_requests')
      .insert({
        escrow_id: escrowId,
        trigger_event: validatedTriggerEvent,
        requested_by_module: 'MOD-003',
        approval_status: 'PENDING',
        settlement_type: validatedSettlementType,
        settlement_amount: settlementAmount,
        retry_count: 0,
        correlation_id: correlationId,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        wrapInContractFramework(
          { error: 'Failed to create settlement request', code: 'ERR_1000' },
          correlationId,
        ),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    return NextResponse.json(
      wrapInContractFramework(
        {
          settlementId: settlementRecord.id,
          escrowId,
          triggerEvent: validatedTriggerEvent,
          settlementType: validatedSettlementType,
          settlementAmount,
          approvalStatus: 'PENDING',
          createdAt: settlementRecord.created_at,
        },
        correlationId,
      ),
      { status: 201, headers: { 'x-correlation-id': correlationId } },
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
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message, code: 'ERR_1004' }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
