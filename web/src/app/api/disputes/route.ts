import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { DisputeType } from '@/modules/mod-015-customer-support/domain/enums';

/** Valid dispute types per MOD-015 §3.2, §4.2 */
const VALID_DISPUTE_TYPES = Object.values(DisputeType);

/** Maximum number of results for list queries */
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/** Logistics schema name */
const LOGISTICS_SCHEMA = 'logistics_schema';

// ============================================================
// Helper — parse limit safely
// ============================================================
function parseLimit(val: unknown): number {
  const n = typeof val === 'string' ? parseInt(val, 10) : 0;
  if (isNaN(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
}

// ============================================================
// POST /api/disputes — Create a new dispute case
// ============================================================

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory auth — no session → 401 immediately. No x-user-role fallback. No default roles.
    const authCtx = await assertApiAuthorization(request, 'disputes', 'create');

    const body = await request.json();

    // Validate required fields
    if (!body.relatedShipmentId || typeof body.relatedShipmentId !== 'string') {
      throw new ValidationError('Missing required field: relatedShipmentId');
    }
    if (!body.relatedContractId || typeof body.relatedContractId !== 'string') {
      throw new ValidationError('Missing required field: relatedContractId');
    }
    if (!body.relatedEscrowId || typeof body.relatedEscrowId !== 'string') {
      throw new ValidationError('Missing required field: relatedEscrowId');
    }
    if (!body.disputeType || typeof body.disputeType !== 'string') {
      throw new ValidationError('Missing required field: disputeType');
    }
    if (!body.respondentId || typeof body.respondentId !== 'string') {
      throw new ValidationError('Missing required field: respondentId');
    }

    // Validate disputeType enum value
    const disputeType = body.disputeType.toUpperCase() as DisputeType;
    if (!VALID_DISPUTE_TYPES.includes(disputeType)) {
      throw new ValidationError(
        `Invalid disputeType: ${body.disputeType}. Valid values: ${VALID_DISPUTE_TYPES.join(', ')}.`,
      );
    }

    // Validate evidenceReferences if provided
    if (body.evidenceReferences !== undefined && body.evidenceReferences !== null) {
      if (!Array.isArray(body.evidenceReferences)) {
        throw new ValidationError('evidenceReferences must be an array of strings.');
      }
      for (const ref of body.evidenceReferences) {
        if (typeof ref !== 'string') {
          throw new ValidationError('Each evidenceReference must be a string.');
        }
      }
    }

    const initiatorId = authCtx.userId || body.initiatorId;
    if (!initiatorId) {
      throw new ValidationError('Missing required field: initiatorId');
    }

    // Generate case_number as "DISPUTE-" + first 8 chars of UUID prefix
    const caseUuid = crypto.randomUUID();
    const caseNumber = `DISPUTE-${caseUuid.slice(0, 8)}`;

    // Build evidence references JSON text array
    const evidenceRefs = body.evidenceReferences ?? [];

    const client = (await import('@/infrastructure/database/supabase')).createAdminClient();

    const result = await client
      .from(`${LOGISTICS_SCHEMA}.dispute_cases`)
      .insert({
        case_number: caseNumber,
        related_shipment_id: body.relatedShipmentId,
        related_contract_id: body.relatedContractId,
        related_escrow_id: body.relatedEscrowId,
        dispute_type: disputeType,
        initiator_id: initiatorId,
        respondent_id: body.respondentId,
        evidence_references: evidenceRefs,
        status: 'SUBMITTED',
        created_by: authCtx.userId,
        is_deleted: false,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create dispute case: ${result.error.message}`);
    }

    const inserted = result.data as Record<string, unknown>;

    const response = {
      id: inserted.id as string,
      caseNumber: inserted.case_number as string,
      relatedShipmentId: inserted.related_shipment_id as string,
      relatedContractId: inserted.related_contract_id as string,
      relatedEscrowId: inserted.related_escrow_id as string,
      disputeType: inserted.dispute_type as string,
      initiatorId: inserted.initiator_id as string,
      respondentId: inserted.respondent_id as string,
      evidenceReferences: inserted.evidence_references as string[],
      status: inserted.status as string,
      createdBy: inserted.created_by as string,
      createdAt: inserted.created_at as Date | null | undefined,
      updatedAt: inserted.updated_at as Date | null | undefined,
    };

    return NextResponse.json(
      wrapInContractFramework(response, correlationId),
      { status: 201, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
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

// ============================================================
// GET /api/disputes — List disputes with optional filters
// ============================================================

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory auth — no session → 401 immediately.
    await assertApiAuthorization(request, 'disputes', 'read');

    const url = new URL(request.url);
    const entityType = url.searchParams.get('entityType');
    const entityId = url.searchParams.get('entityId');
    const statusFilter = url.searchParams.get('statusFilter');
    const limit = parseLimit(url.searchParams.get('limit'));
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    const client = (await import('@/infrastructure/database/supabase')).createAdminClient();

    let query = client
      .from(`${LOGISTICS_SCHEMA}.dispute_cases`)
      .select(
        'id, case_number, related_shipment_id, related_contract_id, related_escrow_id, dispute_type, initiator_id, respondent_id, status, created_at, updated_at, created_by',
        { count: 'exact' },
      )
      .eq('is_deleted', false);

    // Apply optional filters
    if (entityType) {
      // Map entityType to related_xxx_id columns
      if (entityType === 'shipment') {
        query = query.not('related_shipment_id', 'is', null);
      } else if (entityType === 'contract') {
        query = query.not('related_contract_id', 'is', null);
      } else if (entityType === 'escrow') {
        query = query.not('related_escrow_id', 'is', null);
      }
    }
    if (entityId) {
      query = query
        .filter('related_shipment_id', 'eq', entityId)
        .or(`related_contract_id.eq.${entityId},related_escrow_id.eq.${entityId}`);
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    // Apply pagination and ordering
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const result = await query;
    if (result.error) {
      throw new Error(`Failed to list disputes: ${result.error.message}`);
    }

    const summaries = ((result.data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        caseNumber: r.case_number as string,
        relatedShipmentId: r.related_shipment_id as string | null,
        relatedContractId: r.related_contract_id as string | null,
        relatedEscrowId: r.related_escrow_id as string | null,
        disputeType: r.dispute_type as string,
        initiatorId: r.initiator_id as string,
        respondentId: r.respondent_id as string,
        status: r.status as string,
        createdAt: r.created_at as Date | null | undefined,
        updatedAt: r.updated_at as Date | null | undefined,
        createdBy: r.created_by as string | null | undefined,
      };
    });

    const response = {
      data: summaries,
      meta: { total: Number(result.count ?? 0), limit, offset },
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
