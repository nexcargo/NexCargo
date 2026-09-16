import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import { Channel, Category, Priority } from '@/modules/mod-015-customer-support/domain/enums';
import { generateCaseId, isValidCaseId } from '@/modules/mod-015-customer-support/domain/services/case-id-generator';

/** Valid channel enum values */
const VALID_CHANNELS = Object.values(Channel);

/** Valid category enum values */
const VALID_CATEGORIES = Object.values(Category);

/** Valid priority level enum values */
const VALID_PRIORITIES = Object.values(Priority);

/** Max results for list queries */
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
// POST /api/support/tickets — Create a new support ticket
// ============================================================

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory auth — no session → 401 immediately.
    const authCtx = await assertApiAuthorization(request, 'support_tickets', 'create');

    const body = await request.json();

    // Validate required fields
    if (!body.requesterRole || typeof body.requesterRole !== 'string') {
      throw new ValidationError('Missing required field: requesterRole');
    }
    if (!body.category || typeof body.category !== 'string') {
      throw new ValidationError('Missing required field: category');
    }
    if (!body.priorityLevel || typeof body.priorityLevel !== 'string') {
      throw new ValidationError('Missing required field: priorityLevel');
    }
    if (!body.channel || typeof body.channel !== 'string') {
      throw new ValidationError('Missing required field: channel');
    }
    if (!body.description || typeof body.description !== 'string') {
      throw new ValidationError('Missing required field: description');
    }

    // Validate requesterRole enum value
    const validRequesterRoles = ['SHIPPER', 'TRANSPORTER', 'DRIVER'];
    const requesterRole = body.requesterRole.toUpperCase() as string;
    if (!validRequesterRoles.includes(requesterRole)) {
      throw new ValidationError(
        `Invalid requesterRole: ${body.requesterRole}. Valid values: ${validRequesterRoles.join(', ')}.`,
      );
    }

    // Validate category enum value
    const category = body.category.toUpperCase() as Category;
    if (!VALID_CATEGORIES.includes(category)) {
      throw new ValidationError(
        `Invalid category: ${body.category}. Valid values: ${VALID_CATEGORIES.join(', ')}.`,
      );
    }

    // Validate priorityLevel enum value
    const priorityLevel = body.priorityLevel.toUpperCase() as Priority;
    if (!VALID_PRIORITIES.includes(priorityLevel)) {
      throw new ValidationError(
        `Invalid priorityLevel: ${body.priorityLevel}. Valid values: ${VALID_PRIORITIES.join(', ')}.`,
      );
    }

    // Validate channel enum value
    const channel = body.channel.toUpperCase() as Channel;
    if (!VALID_CHANNELS.includes(channel)) {
      throw new ValidationError(
        `Invalid channel: ${body.channel}. Valid values: ${VALID_CHANNELS.join(', ')}.`,
      );
    }

    // Generate or validate caseId — optional field; auto-generate if omitted
    let caseId: string;
    if (isValidCaseId(body.caseId)) {
      caseId = body.caseId.trim();
    } else {
      caseId = generateCaseId();
    }

    // Generate ticket_id = "TICKET-" + first 8 chars of UUID prefix
    const ticketUuid = crypto.randomUUID();
    const ticketId = `TICKET-${ticketUuid.slice(0, 8)}`;

    const client = (await import('@/infrastructure/database/supabase')).createAdminClient();

    const result = await client
      .from(`${LOGISTICS_SCHEMA}.support_tickets`)
      .insert({
        ticket_id: ticketId,
        requester_id: authCtx.userId || body.requesterId,
        requester_role: requesterRole,
        category: category,
        priority_level: priorityLevel,
        channel: channel,
        case_id: caseId,
        description: body.description.trim(),
        status: 'OPEN',
        sla_breach: false,
        created_by: authCtx.userId,
        is_deleted: false,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create support ticket: ${result.error.message}`);
    }

    const inserted = result.data as Record<string, unknown>;

    const response = {
      id: inserted.id as string,
      ticketId: inserted.ticket_id as string,
      requesterId: inserted.requester_id as string,
      requesterRole: inserted.requester_role as string,
      category: inserted.category as string,
      priorityLevel: inserted.priority_level as string,
      channel: inserted.channel as string,
      caseId: inserted.case_id as string,
      description: inserted.description as string,
      status: inserted.status as string,
      slaBreach: inserted.sla_breach as boolean,
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
// GET /api/support/tickets — List support tickets
// ============================================================

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    // C1 Hardened: Mandatory auth — no session → 401 immediately.
    await assertApiAuthorization(request, 'support_tickets', 'read');

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('statusFilter');
    const categoryFilter = url.searchParams.get('categoryFilter');
    const priorityFilter = url.searchParams.get('priorityFilter');
    const requesterRole = url.searchParams.get('requesterRole');
    const limit = parseLimit(url.searchParams.get('limit'));
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    const client = (await import('@/infrastructure/database/supabase')).createAdminClient();

    let query = client
      .from(`${LOGISTICS_SCHEMA}.support_tickets`)
      .select(
        'id, ticket_id, requester_id, requester_role, category, priority_level, channel, case_id, status, sla_breach, created_at, updated_at, created_by',
        { count: 'exact' },
      )
      .eq('is_deleted', false);

    // Apply optional filters
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    }
    if (priorityFilter) {
      query = query.eq('priority_level', priorityFilter);
    }
    if (requesterRole) {
      query = query.eq('requester_role', requesterRole);
    }

    // Apply pagination and ordering
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const result = await query;
    if (result.error) {
      throw new Error(`Failed to list support tickets: ${result.error.message}`);
    }

    const summaries = ((result.data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        ticketId: r.ticket_id as string,
        requesterId: r.requester_id as string,
        requesterRole: r.requester_role as string,
        category: r.category as string,
        priorityLevel: r.priority_level as string,
        channel: r.channel as string,
        caseId: r.case_id as string,
        status: r.status as string,
        slaBreach: r.sla_breach as boolean,
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
