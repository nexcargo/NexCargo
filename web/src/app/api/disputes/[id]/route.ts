import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

/** Logistics schema name */
const LOGISTICS_SCHEMA = 'logistics_schema';

// ============================================================
// GET /api/disputes/[id] — Get a single dispute by UUID id
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory auth — no session → 401 immediately.
    await assertApiAuthorization(request, 'disputes', 'read');

    const { id } = await params;

    if (!id || typeof id !== 'string') {
      throw new ValidationError('Missing or invalid dispute id parameter.');
    }

    const client = (await import('@/infrastructure/database/supabase')).createAdminClient();

    const result = await client
      .from(`${LOGISTICS_SCHEMA}.dispute_cases`)
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    // PGRST116 means no rows found — return null gracefully
    if (result.error && result.error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch dispute: ${result.error.message}`);
    }

    if (!result.data) {
      // Return null data wrapped (client should handle 404 at framework level if desired)
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 200, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
      );
    }

    const row = result.data as Record<string, unknown>;

    const response = {
      id: row.id as string,
      caseNumber: row.case_number as string,
      relatedShipmentId: row.related_shipment_id as string | null,
      relatedContractId: row.related_contract_id as string | null,
      relatedEscrowId: row.related_escrow_id as string | null,
      disputeType: row.dispute_type as string,
      initiatorId: row.initiator_id as string,
      respondentId: row.respondent_id as string,
      evidenceReferences: row.evidence_references as string[] | null,
      status: row.status as string,
      resolutionOutcome: row.resolution_outcome as string | null,
      decisionMakerId: row.decision_maker_id as string | null,
      decisionTimestamp: row.decision_timestamp as Date | null | undefined,
      resolutionSummary: row.resolution_summary as string | null,
      createdBy: row.created_by as string | null,
      createdAt: row.created_at as Date | null | undefined,
      updatedAt: row.updated_at as Date | null | undefined,
    };

    return NextResponse.json(
      wrapInContractFramework(response, correlationId),
      { status: 200, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), {
        status: 400,
        headers: { 'x-correlation-id': correlationId },
      });
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(wrapInContractFramework({ error: 'Unauthorized: valid session required' }, correlationId), {
        status: 401,
        headers: { 'x-correlation-id': correlationId },
      });
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(wrapInContractFramework({ error: error.message }, correlationId), {
        status: 403,
        headers: { 'x-correlation-id': correlationId },
      });
    }
    return NextResponse.json(wrapInContractFramework(null, correlationId), {
      status: 500,
      headers: { 'x-correlation-id': correlationId },
    });
  }
}
