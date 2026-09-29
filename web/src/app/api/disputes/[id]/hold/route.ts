// NexCargo C4-III — POST /api/disputes/[escrowId]/hold (Dispute Hold Trigger)
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-005 §4.4 (DisputeRecord), §5.1 (Escrow Lifecycle with DISPUTE_HOLD path)
//            C4 Readiness AC-008 (Dispute triggers hold)
// Scope: Minimal dispute/hold signal interface. Does NOT own MOD-015 dispute workflow.
//        Validates escrow is in FUNDS_LOCKED, enforces DISPUTE_HOLD transition.

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { resolveCorrelationId, createCorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { createAdminClient } from '@/infrastructure/database/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  createCorrelationContext({ correlationId });

  try {
    // SHIPPER or TRANSPORTER can raise dispute on their contracts; ADMIN/MODERATOR can raise any
    await assertApiAuthorization(request, 'disputes', 'create');

    const { id: escrowId } = await params;
    if (!escrowId || typeof escrowId !== 'string') {
      throw new ValidationError('escrowId is required');
    }

    const body = await request.json();
    const reason = String(body?.reason ?? '');

    if (reason.length < 3) {
      throw new ValidationError('Dispute reason must be at least 3 characters');
    }

    // Query current escrow state
    const supabase = createAdminClient();
    const { data: escrow, error: escrowError } = await supabase
      .schema('financial_schema').from('escrow_records')
      .select('id, state')
      .eq('id', escrowId)
      .single();

    if (escrowError || !escrow) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Escrow not found', code: 'ERR_1002' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Validate source state — only FUNDS_LOCKED can transition to DISPUTE_HOLD
    if (escrow.state !== 'FUNDS_LOCKED') {
      throw new ValidationError(
        `Cannot initiate dispute hold on escrow in state ${escrow.state}. Only FUNDS_LOCKED can transition to DISPUTE_HOLD.`,
      );
    }

    // Update escrow to DISPUTE_HOLD
    const { error: updateError } = await supabase
      .schema('financial_schema').from('escrow_records')
      .update({
        state: 'DISPUTE_HOLD',
        version: (escrow as Record<string, unknown>).version ? (Number((escrow as Record<string, unknown>).version) + 1) : 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId);

    if (updateError) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Failed to apply dispute hold', code: 'ERR_1000' }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    return NextResponse.json(
      wrapInContractFramework({
        escrowId,
        previousState: 'FUNDS_LOCKED',
        newState: 'DISPUTE_HOLD',
        reason,
        message: 'Dispute hold applied — all release transitions now blocked until resolution',
      }, correlationId),
      { status: 200, headers: { 'x-correlation-id': correlationId } },
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
