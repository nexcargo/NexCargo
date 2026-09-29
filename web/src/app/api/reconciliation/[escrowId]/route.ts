// NexCargo C4-III — GET /api/reconciliation/:escrowId (On-Demand Reconciliation)
// Authorized by: HAO C4-III Authorization (2026-09-08)
// Authority: MOD-013 §6.3, MOD-005 §7.6 (Reconciliation Rule), C4 Readiness R11
// Scope: Compare internal financial records (payment intents, ledger entries, settlement requests)
//        against each other to detect alignment/mismatch.

import { NextRequest, NextResponse } from 'next/server';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { resolveCorrelationId, createCorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { createAdminClient } from '@/infrastructure/database/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ escrowId: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  createCorrelationContext({ correlationId });

  try {
    // Require auth — SHIPPER can view reconciliation on their own escrows, ADMIN/all roles full access
    await assertApiAuthorization(_request, 'financial', 'read');

    const { escrowId } = await params;

    if (!escrowId || typeof escrowId !== 'string') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'escrowId is required', code: 'ERR_1001' }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const supabase = createAdminClient();

    // Fetch payment intents for this escrow
    const { data: paymentIntents, error: piError } = await supabase
      .schema('financial_schema').from('payment_intents')
      .select('*')
      .eq('escrow_id', escrowId)
      .eq('is_deleted', false);

    if (piError) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Failed to query payment intents', code: 'ERR_1000' }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Fetch settlement requests for this escrow
    const { data: settlementRequests, error: srError } = await supabase
      .schema('financial_schema').from('settlement_requests')
      .select('*')
      .eq('escrow_id', escrowId)
      .eq('is_deleted', false);

    if (srError) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Failed to query settlement requests', code: 'ERR_1000' }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Fetch ledger entries referenced by payment intents and settlements
    const paymentRefs = (paymentIntents ?? []).map((pi: { id: string }) => `pay-${pi.id}`);
    const settlementRefs = (settlementRequests ?? []).map((sr: { id: string }) => `settle-${sr.id}`);
    const allRefs = [...new Set([...paymentRefs, ...settlementRefs])];

    let ledgerEntries: Record<string, unknown>[] = [];
    if (allRefs.length > 0) {
      const { data: leData, error: leError } = await supabase
        .schema('financial_schema').from('financial_ledger_entries')
        .select('*')
        .in('transaction_reference', allRefs)
        .eq('is_deleted', false);
      if (!leError) {
        ledgerEntries = leData ?? [];
      }
    }

    // Compute reconciliation
    const totalPaymentAmount = (paymentIntents ?? []).reduce((sum: number, pi: Record<string, unknown>) => sum + (Number(pi.amount) || 0), 0);
    const confirmedPayments = (paymentIntents ?? []).filter((pi: Record<string, unknown>) => pi.status === 'CONFIRMED');
    const totalConfirmedAmount = confirmedPayments.reduce((sum: number, pi: Record<string, unknown>) => sum + (Number(pi.amount) || 0), 0);
    const totalSettlementAmount = (settlementRequests ?? []).reduce((sum: number, sr: Record<string, unknown>) => sum + (Number(sr.settlement_amount) || 0), 0);
    const executedSettlements = (settlementRequests ?? []).filter((sr: Record<string, unknown>) => sr.approval_status === 'EXECUTED');
    const totalExecutedAmount = executedSettlements.reduce((sum: number, sr: Record<string, unknown>) => sum + (Number(sr.settlement_amount) || 0), 0);

    // Check for mismatches
    const mismatches: Array<{ type: string; description: string }> = [];

    // Each CONFIRMED payment should have a debit+credit pair
    for (const pi of confirmedPayments) {
      const txRef = `pay-${(pi as Record<string, unknown>).id}`;
      const entriesForTx = (ledgerEntries as Array<Record<string, unknown>>).filter(e => e.transaction_reference === txRef);
      
      if (entriesForTx.length === 0) {
        mismatches.push({
          type: 'UNRECORDED_PAYMENT',
          description: `Confirmed payment ${txRef} has no ledger entries`,
        });
      } else if (entriesForTx.length < 2) {
        mismatches.push({
          type: 'INCOMPLETE_LEDGER_PAIR',
          description: `Confirmed payment ${txRef} has ${entriesForTx.length}/2 ledger entries`,
        });
      } else {
        const entrySum = entriesForTx.reduce((sum: number, e: Record<string, unknown>) => sum + (Number(e.amount) || 0), 0);
        const expectedPairSum = (Number((pi as Record<string, unknown>).amount) || 0) * 2;
        if (Math.abs(entrySum - expectedPairSum) > 0.01) {
          mismatches.push({
            type: 'AMOUNT_DISCREPANCY',
            description: `Payment ${txRef}: expected pair sum ${expectedPairSum.toFixed(2)}, got ${entrySum.toFixed(2)}`,
          });
        }
      }
    }

    // Determine alignment
    let alignment: 'ALIGNED' | 'MISMATCH_DETECTED' | 'PENDING';
    if (mismatches.length > 0) {
      alignment = 'MISMATCH_DETECTED';
    } else if ((paymentIntents ?? []).some((pi: { status: string }) => pi.status === 'INITIATED' || pi.status === 'PENDING')) {
      alignment = 'PENDING';
    } else {
      alignment = 'ALIGNED';
    }

    return NextResponse.json(
      wrapInContractFramework({
        escrowId,
        alignment,
        totalPaymentAmount,
        totalConfirmedAmount,
        totalSettlementAmount,
        totalExecutedAmount,
        mismatchCount: mismatches.length,
        mismatches,
      }, correlationId),
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
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
