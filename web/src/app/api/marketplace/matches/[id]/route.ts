// NexCargo MOD-001 — Match Proposal API Route (Item)
// C2-Increment 002 Auth Migration: Pattern B (header-based) → Pattern A (session-based)
// Authorized by HAO-WAVE1-005 — Wave 1 Increment 5: Match Proposals & Quote Generation
// Per MOD-001 §5.3 (Match Proposal) + §3.2 state machine
//
// GET    /api/marketplace/matches/[id]     — Get match proposal by ID
// PATCH  /api/marketplace/matches/[id]     — Accept or reject a match proposal

import { NextRequest, NextResponse } from 'next/server';
import { MatchStatus } from '@/modules/mod-001-marketplace/domain/enums';
import { applyMatchTransition, isMatchTerminal } from '@/modules/mod-001-marketplace/domain/services/match-state-machine';
import { ValidationError } from '@/shared/errors/app-errors';
import { createCorrelationContext, resolveCorrelationId } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework, recordMarketplaceMetric } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { prepareMOD002Handoff } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

/**
 * GET /api/marketplace/matches/[id]
 * Returns a single match proposal by ID.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;

    // Pattern A auth: session-based RBAC, no x-user-role header fallback
    await assertApiAuthorization(_request, 'matching', 'read');

    // Return stub match proposal data (actual DB query in later increment)
    const matchProposal = {
      matchId: id,
      status: MatchStatus.PROPOSED,
    };

    recordMarketplaceMetric('matches.viewed', 1, 'count');

    return NextResponse.json(
      wrapInContractFramework(matchProposal, correlationId),
      {
        status: 200,
        headers: {
          'x-correlation-id': correlationId,
          'x-trace-id': context.traceId ?? '',
        },
      },
    );
  } catch (_error) {
    const resolvedId = typeof _error === 'object' && _error !== null ? '' : '';
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}

/**
 * PATCH /api/marketplace/matches/[id]
 * Accepts or rejects a match proposal.
 * Per MOD-001 §5.3 acceptance rule:
 *   - Accept transitions listing to BOOKED and triggers handoff to MOD-002
 *   - Reject transitions the match to REJECTED
 * Advisory-only: does NOT auto-book or execute financial actions.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;
    const body = await request.json();

    // Pattern A auth: session-based RBAC, no x-user-role header fallback
    await assertApiAuthorization(request, 'matching', 'execute');

    // Determine action: "accept" or "reject"
    const action = body.action as 'accept' | 'reject';
    if (action !== 'accept' && action !== 'reject') {
      throw new ValidationError('Action must be "accept" or "reject"');
    }

    // Parse target status based on action
    const targetStatus = action === 'accept' ? MatchStatus.ACCEPTED : MatchStatus.REJECTED;
    const currentStatus = body.currentStatus as MatchStatus;

    if (!currentStatus) {
      throw new ValidationError('currentStatus is required');
    }

    // Apply state transition validation (advisory only)
    const validatedStatus = applyMatchTransition(currentStatus, targetStatus);
    const terminal = isMatchTerminal(validatedStatus);

    recordMarketplaceMetric('matches.accepted', 1, 'count', {
      action,
      listingId: body.listingId ?? '',
    });

    // Build response — include MOD-002 handoff hint for accepted matches
    const responseData: Record<string, unknown> = {
      matchId: id,
      previousStatus: currentStatus,
      newStatus: validatedStatus,
      isTerminal: terminal,
      action,
    };

    // If accepted, indicate MOD-002 handoff readiness
    if (action === 'accept' && body.listingId && body.offerId) {
      responseData.mod002HandoffReady = true;
    }

    return NextResponse.json(
      wrapInContractFramework(responseData, correlationId),
      {
        status: 200,
        headers: {
          'x-correlation-id': correlationId,
          'x-trace-id': context.traceId ?? '',
        },
      },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized' }, correlationId),
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (error instanceof Error && error.message.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        wrapInContractFramework({ error: error.message }, correlationId),
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return NextResponse.json(
      wrapInContractFramework(null, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
