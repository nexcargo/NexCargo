import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { EscalationLevel } from '@/modules/mod-015-customer-support/domain/enums';

/** Roles permitted to escalate disputes per MOD-015 governance model */
const ESCALATION_ALLOWED_ROLES = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'];

/** Escalation level to assigned role mapping */
const ESCALATION_LEVEL_TO_ROLE: Record<string, string> = {
  L1_SUPPORT: 'SUPPORT_AGENT',
  L2_SUPERVISOR: 'SUPERVISOR',
  L3_ADMIN_MODERATOR: 'ADMIN_MODERATOR',
};

/** Valid escalation level enum values */
const VALID_ESCALATION_LEVELS = Object.values(EscalationLevel);

/** Logistics schema name */
const LOGISTICS_SCHEMA = 'logistics_schema';

// ============================================================
// PATCH /api/disputes/[id]/escalate — Escalate a dispute to next level
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory auth — no session → 401 immediately.
    const authCtx = await assertApiAuthorization(request, 'disputes', 'update');

    // Governance boundary: only MODERATOR, ADMIN, SUPER_ADMIN can escalate
    if (!authCtx.role || !ESCALATION_ALLOWED_ROLES.includes(authCtx.role)) {
      throw new Error(`FORBIDDEN: Only MODERATOR, ADMIN, or SUPER_ADMIN roles may escalate disputes.`);
    }

    const { id } = await params;

    if (!id || typeof id !== 'string') {
      throw new ValidationError('Missing or invalid dispute id parameter.');
    }

    const body = await request.json();

    // Validate escalationLevel
    if (!body.escalationLevel || typeof body.escalationLevel !== 'string') {
      throw new ValidationError('Missing required field: escalationLevel');
    }

    const escalationLevel = body.escalationLevel.toUpperCase() as EscalationLevel;
    if (!VALID_ESCALATION_LEVELS.includes(escalationLevel)) {
      throw new ValidationError(
        `Invalid escalationLevel: ${body.escalationLevel}. Valid values: ${VALID_ESCALATION_LEVELS.join(', ')}.`,
      );
    }

    // Validate reason
    if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      throw new ValidationError('Missing or empty required field: reason');
    }

    const assignedRole = ESCALATION_LEVEL_TO_ROLE[escalationLevel];
    if (!assignedRole) {
      throw new ValidationError(`No assigned role mapping for escalationLevel: ${escalationLevel}`);
    }

    const client = (await import('@/infrastructure/database/supabase')).createAdminClient();

    // Verify dispute exists
    const disputeResult = await client
      .from(`${LOGISTICS_SCHEMA}.dispute_cases`)
      .select('id, case_number, status')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (disputeResult.error && disputeResult.error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch dispute: ${disputeResult.error.message}`);
    }

    if (!disputeResult.data) {
      return NextResponse.json(
        wrapInContractFramework(null, correlationId),
        { status: 200, headers: { 'x-correlation-id': correlationId, 'x-trace-id': context.traceId ?? '' } },
      );
    }

    const dispute = disputeResult.data as Record<string, unknown>;
    const caseNumber = dispute.case_number as string;

    // Generate escalation_id as "ESCALATION-" + first 8 chars of UUID prefix
    const escalationUuid = crypto.randomUUID();
    const escalationId = `ESCALATION-${escalationUuid.slice(0, 8)}`;

    // Create a NEW row in escalations table
    const escalationResult = await client
      .from(`${LOGISTICS_SCHEMA}.escalations`)
      .insert({
        escalation_id: escalationId,
        source_case_id: caseNumber,
        source_entity_type: 'DISPUTE',
        escalation_level: escalationLevel,
        assigned_role: assignedRole,
        reason: body.reason.trim(),
        sla_timer_started_at: new Date().toISOString(),
        status: 'ACTIVE',
        created_by: authCtx.userId,
        is_deleted: false,
      })
      .select()
      .single();

    if (escalationResult.error) {
      throw new Error(`Failed to create escalation: ${escalationResult.error.message}`);
    }

    const escalation = escalationResult.data as Record<string, unknown>;

    const response = {
      escalation: {
        id: escalation.id as string,
        escalationId: escalation.escalation_id as string,
        sourceCaseId: escalation.source_case_id as string,
        sourceEntityType: escalation.source_entity_type as string,
        escalationLevel: escalation.escalation_level as string,
        assignedRole: escalation.assigned_role as string,
        reason: escalation.reason as string,
        slaTimerStartedAt: escalation.sla_timer_started_at as Date | null | undefined,
        status: escalation.status as string,
        createdBy: escalation.created_by as string,
        createdAt: escalation.created_at as Date | null | undefined,
        updatedAt: escalation.updated_at as Date | null | undefined,
      },
      dispute: {
        id: dispute.id as string,
        caseNumber: caseNumber,
        status: dispute.status as string,
      },
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
