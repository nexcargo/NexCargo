// NexCargo MOD-001 — Match Proposal API Route (Item)
// PRE-I-6 WS-02 match persistence (LA directive 2026-11-18, D-M1/D-M2 approved):
// GET reads the persisted record; PATCH loads it before any transition, treats
// the persisted state as authoritative (409 on conflict), derives party ids from
// stored relationships, and accepts through the unchanged marketplace_book_handoff
// RPC or persists the REJECTED transition. Migration 069 enforces the same
// ownership/state boundaries in the database.
//
// GET    /api/marketplace/matches/[id]     — Get persisted match proposal by ID
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
import { MatchesRepository } from '@/infrastructure/repositories/matches-repository';
import { OffersRepository } from '@/infrastructure/repositories/offers-repository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/marketplace/matches/[id]
 * Returns the persisted match. Session RLS hides foreign records, so nonexistent
 * and inaccessible ids both answer 404 without disclosing foreign metadata.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(request.headers.entries()));
  const context = createCorrelationContext({ correlationId });

  try {
    const { id } = await params;

    await assertApiAuthorization(request, 'matching', 'read');

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        wrapInContractFramework({ error: `Match ${id} not found` }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const matchesRepository = new MatchesRepository();
    const match = await matchesRepository.getById(id);
    if (!match) {
      return NextResponse.json(
        wrapInContractFramework({ error: `Match ${id} not found` }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    recordMarketplaceMetric('matches.viewed', 1, 'count');

    return NextResponse.json(
      wrapInContractFramework(match.toApiShape(), correlationId),
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

    // Load the persisted match before any disclosure or transition (F-I5-03
    // ordering). Session RLS already hides foreign records → uniform 404.
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        wrapInContractFramework({ error: `Match ${id} not found` }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }
    const matchesRepository = new MatchesRepository();
    const match = await matchesRepository.getById(id);
    if (!match) {
      return NextResponse.json(
        wrapInContractFramework({ error: `Match ${id} not found` }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Parse target status based on action
    const targetStatus = action === 'accept' ? MatchStatus.ACCEPTED : MatchStatus.REJECTED;
    const currentStatus = body.currentStatus as MatchStatus;

    if (!currentStatus) {
      throw new ValidationError('currentStatus is required');
    }

    // The persisted state is authoritative; body.currentStatus is only an
    // optimistic-concurrency expectation (WS-02 item 2 precedent → 409).
    if (currentStatus !== match.status) {
      return NextResponse.json(
        wrapInContractFramework(
          { error: `Match status conflict: expected ${currentStatus}, persisted ${match.status}. Refresh and retry.` },
          correlationId,
        ),
        { status: 409, headers: { 'x-correlation-id': correlationId } },
      );
    }
    if (isMatchTerminal(match.status)) {
      return NextResponse.json(
        wrapInContractFramework({ error: `Match already in terminal state ${match.status}` }, correlationId),
        { status: 409, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const validatedStatus = applyMatchTransition(match.status, targetStatus);
    const terminal = isMatchTerminal(validatedStatus);

    // Build base response fields shared by both accept and reject paths
    const baseResponse: Record<string, unknown> = {
      matchId: match.id,
      previousStatus: match.status,
      newStatus: validatedStatus,
      isTerminal: terminal,
      action,
    };

    // ACCEPT path: Execute C2-003 handoff orchestrator on persisted relationships.
    // listingId/offerId/transporterId are derived from stored rows, never from the
    // body; supplied body values are only checked for consistency (409 on drift).
    if (action === 'accept') {
      if ((body.listingId && body.listingId !== match.listingId)
        || (body.offerId && body.offerId !== match.offerId)) {
        recordMarketplaceMetric('matches.accepted_failed', 1, 'count', {
          reason: 'body_relationship_mismatch',
          listingId: match.listingId,
          offerId: match.offerId,
        });
        return NextResponse.json(
          wrapInContractFramework({ error: 'Supplied listingId/offerId does not match the persisted match' }, correlationId),
          { status: 409, headers: { 'x-correlation-id': correlationId } },
        );
      }

      const offersRepository = new OffersRepository();
      const offer = await offersRepository.getById(match.offerId);
      if (!offer) {
        throw new ValidationError('Linked offer is not available');
      }

      recordMarketplaceMetric('matches.accepting', 1, 'count', {
        listingId: match.listingId,
        offerId: match.offerId,
      });

      try {
        const handoffResult: HandoffResult = await executeMOD002Handoff({
          userId: authCtx.userId,
          email: authCtx.email,
          role: authCtx.role,
          matchId: match.id,
          listingId: match.listingId,
          offerId: match.offerId,
          transporterId: offer.transporterId,
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

        // Repeated/concurrent acceptance: the RPC triad or listing guard refuses
        // the second transition after the first committed — a state conflict.
        if (errorMessage.includes('not found or not in PROPOSED state')
          || errorMessage.includes('not found or not in PUBLISHED state')) {
          statusCode = 409;
        }
        if (errorMessage.includes('row-level security')) {
          statusCode = 403;
        }

        recordMarketplaceMetric('matches.accepted_handoff_failure', 1, 'count', {
          reason: errorMessage,
          listingId: match.listingId,
          offerId: match.offerId,
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

    // REJECT path: persist the PROPOSED→REJECTED transition (migration 069's
    // UPDATE policy scopes it to the owning Shipper and the three granted columns).
    try {
      await matchesRepository.reject(match.id, match.version);
    } catch (rejectError) {
      const message = rejectError instanceof Error ? rejectError.message : 'Rejection failed';
      if (message.startsWith('MATCH_STATE_CONFLICT')) {
        return NextResponse.json(
          wrapInContractFramework({ error: 'Match is no longer PROPOSED. Refresh and retry.' }, correlationId),
          { status: 409, headers: { 'x-correlation-id': correlationId } },
        );
      }
      if (message.includes('row-level security')) {
        return NextResponse.json(
          wrapInContractFramework({ error: 'FORBIDDEN: match rejection denied by row-level security' }, correlationId),
          { status: 403, headers: { 'x-correlation-id': correlationId } },
        );
      }
      throw rejectError;
    }

    baseResponse.persisted = true;
    recordMarketplaceMetric('matches.rejected', 1, 'count', {
      listingId: match.listingId,
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
