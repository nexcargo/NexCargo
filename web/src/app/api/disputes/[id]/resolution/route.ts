// NexCargo C4-III — POST /api/disputes/[escrowId]/resolution (Dispute Resolution Handler)
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-005 §4.4, §5.1 (DISPUTE_HOLD → release transitions)
// Scope: Accept externally supplied resolution outcome, enforce state transition from DISPUTE_HOLD.
//        Does NOT perform investigation or moderation — those are MOD-015 responsibilities.

import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { resolveCorrelationId, createCorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { createAdminClient } from '@/infrastructure/database/supabase';

const VALID_OUTCOMES = ['RELEASE_TO_TRANSPORTER', 'REFUND_TO_SHIPPER', 'SPLIT_SETTLEMENT'];

/** Maps outcome to target escrow state */
const OUTCOME_TO_STATE: Record<string, string> = {
  RELEASE_TO_TRANSPORTER: 'FINAL_RELEASE',
  REFUND_TO_SHIPPER: 'PARTIAL_RELEASE',
  SPLIT_SETTLEMENT: 'PARTIAL_RELEASE',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  createCorrelationContext({ correlationId });

  try {
    // Only ADMIN/MODERATOR can approve dispute resolutions
    await assertApiAuthorization(request, 'disputes', 'update');

    const { id: escrowId } = await params;
    if (!escrowId || typeof escrowId !== 'string') {
      throw new ValidationError('escrowId is required');
    }

    const body = await request.json();
    const outcome = String(body?.outcome ?? '');

    // Validate outcome value
    if (!VALID_OUTCOMES.includes(outcome)) {
      throw new ValidationError(
        `Invalid outcome: ${outcome}. Allowed: ${VALID_OUTCOMES.join(', ')}`,
      );
    }

    // Query current escrow state
    const supabase = createAdminClient();
    const { data: escrow, error: escrowError } = await supabase
      .schema('financial_schema').from('escrow_records')
      .select('id, state, version')
      .eq('id', escrowId)
      .single();

    if (escrowError || !escrow) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Escrow not found', code: 'ERR_1002' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Must be in DISPUTE_HOLD state to apply resolution
    if (escrow.state !== 'DISPUTE_HOLD') {
      throw new ValidationError(
        `Cannot apply resolution on escrow in state ${escrow.state}. Only DISPUTE_HOLD can be resolved.`,
      );
    }

    const targetState = OUTCOME_TO_STATE[outcome];

    // Apply resolution
    const { error: updateError } = await supabase
      .schema('financial_schema').from('escrow_records')
      .update({
        state: targetState,
        version: (escrow.version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId);

    if (updateError) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Failed to apply dispute resolution', code: 'ERR_1000' }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    return NextResponse.json(
      wrapInContractFramework({
        escrowId,
        previousState: 'DISPUTE_HOLD',
        newState: targetState,
        resolutionOutcome: outcome,
        message: `Dispute resolved: funds will be ${outcome === 'RELEASE_TO_TRANSPORTER' ? 'released to transporter' : 'refunded/split'} per resolution`,
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
