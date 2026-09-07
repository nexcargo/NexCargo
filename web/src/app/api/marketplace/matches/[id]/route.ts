// NexCargo MOD-001 — Match Proposal API Route (Item)
// C2-Increment 002 Auth Migration: Pattern B (header-based) → Pattern A (session-based)
// C2-Increment 003 Handoff Wiring: Accept route invokes executeMOD002Handoff() for
//   atomic Match→Listing→Booking transition with alignment-first validation.
// Authorized by HAO-WAVE1-005 + HAO C2-003 Authorization (2026-09-07)
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
import { executeMOD002Handoff, HandoffResult } from '@/modules/mod-002-booking/domain/services/booking-orchestration';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';
import type { AuthContext } from '@/lib/supabase/api-auth';

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
 *
 * C2-003 Handoff: On accept, executes executeMOD002Handoff() which:
 *   1. Validates offer-listing alignment (pre-acceptance gate)
 *   2. If alignment fails: zero state changes, returns 400
 *   3. If alignment succeeds: atomic PROPOSED→ACCEPTED + PUBLISHED→BOOKED 
 *      + ALIGNMENT_CHECKED booking creation via PostgreSQL RPC
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
    const authCtx: AuthContext = await assertApiAuthorization(request, 'matching', 'execute');

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

    // Build base response fields shared by both accept and reject paths
    const baseResponse: Record<string, unknown> = {
      matchId: id,
      previousStatus: currentStatus,
      newStatus: validatedStatus,
      isTerminal: terminal,
      action,
    };

    // ACCEPT path: Execute C2-003 handoff orchestrator
    if (action === 'accept') {
      if (!body.listingId || !body.offerId) {
        recordMarketplaceMetric('matches.accepted_failed', 1, 'count', {
          reason: 'missing_listing_or_offer_id',
          listingId: body.listingId,
          offerId: body.offerId,
        });
        return NextResponse.json(
          wrapInContractFramework({ error: 'Accept requires listingId and offerId' }, correlationId),
          { status: 400, headers: { 'x-correlation-id': correlationId } },
        );
      }

      recordMarketplaceMetric('matches.accepting', 1, 'count', {
        listingId: body.listingId,
        offerId: body.offerId,
      });

      try {
        const handoffResult: HandoffResult = await executeMOD002Handoff({
          userId: authCtx.userId,
          email: authCtx.email,
          role: authCtx.role,
          listingId: body.listingId,
          offerId: body.offerId,
          transporterId: body.transporterId ?? '',
          shipperId: authCtx.userId,
        });

        baseResponse.handoffConfirmed = true;
        baseResponse.bookingId = handoffResult.bookingId ?? (handoffResult as unknown as Record<string, unknown>).booking_id;
        baseResponse.bookingStatus = handoffResult.status;
        baseResponse.successfulHandoff = handoffResult.success;

        recordMarketplaceMetric('matches.accepted_handoff_success', 1, 'count', {
          bookingId: handoffResult.bookingId ?? (handoffResult as unknown as Record<string, unknown>).booking_id,
          status: handoffResult.status,
        });

        return NextResponse.json(
          wrapInContractFramework(baseResponse, correlationId),
          {
            status: 200,
            headers: {
              'x-correlation-id': correlationId,
              'x-trace-id': context.traceId ?? '',
            },
          },
        );
      } catch (handoffError) {
        // Alignment validation failed or RPC error — handoff aborted, zero state changes
        let errorMessage: string;
        let statusCode = 500;

        if (handoffError instanceof ValidationError) {
          errorMessage = handoffError.message;
          if (handoffError.details?.code === 'ALIGNMENT_FAILED') {
            statusCode = 400;
          }
        } else if (handoffError instanceof Error) {
          errorMessage = handoffError.message;
        } else {
          errorMessage = 'Handoff execution failed';
        }

        recordMarketplaceMetric('matches.accepted_handoff_failure', 1, 'count', {
          reason: errorMessage,
          listingId: body.listingId,
          offerId: body.offerId,
        });

        return NextResponse.json(
          wrapInContractFramework({ error: errorMessage }, correlationId),
          {
            status: statusCode,
            headers: { 'x-correlation-id': correlationId },
          },
        );
      }
    }

    // REJECT path: Standard advisory rejection (no handoff needed)
    recordMarketplaceMetric('matches.rejected', 1, 'count', {
      listingId: body.listingId ?? '',
    });

    return NextResponse.json(
      wrapInContractFramework(baseResponse, correlationId),
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
