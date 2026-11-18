// NexCargo MOD-002 — PATCH /api/contracts/[id]/accept — Contract Acceptance Endpoint
// Authorized directive: HAO-AUTH-WORKSTREAM-A-C3C7-HANDOFF
// Purpose: Runtime contract signing path that invokes trusted SECDEF for atomic accept+tracking
//
// Rules:
//   - Caller must be authenticated (Supabase session required)
//   - Caller identity comes from auth.uid() — no arbitrary signerId accepted
//   - F-I5-03: party authorization is established BEFORE any contract state is evaluated.
//     The RLS-scoped read below admits exactly the persisted booking parties
//     (contracts_shipper_read / contracts_transporter_read); a non-party and a nonexistent
//     contract are indistinguishable at this gate (consistent 404). The SECDEF RPC was also
//     reordered by migration 065 (party check before state, uniform CONTRACT_NOT_FOUND for
//     non-parties), closing the direct PostgREST path; the gate remains the first layer and
//     the RPC is never invoked for a caller who has not passed it.
//   - First signature records acceptance but does NOT initialize tracking
//   - Second (final) signature transitions contract to ACTIVE and atomically creates tracking
//   - Idempotent: retrying a recorded signature returns correct state without side effects
//   - Tracking initialization happens ONLY via the SECDEF composite function (not HTTP endpoint)

import { NextRequest, NextResponse } from 'next/server';
import { resolveCorrelationId, createCorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { createClient } from '@/lib/supabase/server';
import { InMemoryEventEmitter } from '@/shared/events/emitter';
import { EventClassification, EventCriticality } from '@/shared/types/enums';

/**
 * PATCH /api/contracts/[id]/accept
 * 
 * Authenticated Shipper or Transporter invokes trusted SECDEF RPC for atomic contract finalization
 * with tracking initialization on the final signature.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = resolveCorrelationId(Object.fromEntries(_request.headers.entries()));

  try {
    const { id } = await params;

    // Validate contract UUID format
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Invalid contract ID format', code: 'ERR_3001' }, correlationId),
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Verify caller has a valid Supabase session.
    // Party authorization is established by the RLS-scoped visibility gate below BEFORE the
    // SECDEF is invoked; the SECDEF's own party check remains as an independent inner layer.
    const supabaseSession = await createClient();
    const { data: { user }, error: authError } = await supabaseSession.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized', code: 'ERR_3002' }, correlationId),
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // F-I5-03: establish contract-party authorization before the SECDEF evaluates any state.
    // This read runs under the caller's session, so the live party-scoped SELECT policies
    // (contracts_shipper_read / contracts_transporter_read over the persisted booking parties)
    // decide visibility. A foreign contract — in ANY lifecycle state — is invisible here and
    // answers exactly like a nonexistent one. No state column is selected or returned.
    const { data: visibleContract, error: visibilityError } = await supabaseSession
      .schema('logistics_schema')
      .from('contracts')
      .select('id')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (visibilityError) {
      // Fail closed: a resolution failure must not reach the RPC or disclose contract state.
      console.error('[ContractAccept] Party-visibility resolution failed:', visibilityError.message);
      return NextResponse.json(
        wrapInContractFramework({ error: 'Contract acceptance failed', code: 'ERR_3099' }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!visibleContract) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Contract not found', code: 'ERR_3003' }, correlationId),
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Invoke composite SECDEF function atomically (caller is now a confirmed contract party)
    const { data, error } = await supabaseSession.rpc('accept_and_finalize_contract', {
      p_contract_id_uuid: id,
      p_correlation_id: null,
    });

    if (error) {
      const errMsg = error.message;

      // Map known SECDEF errors to API responses
      if (errMsg.includes('UNAUTHORIZED')) {
        return NextResponse.json(
          wrapInContractFramework({ error: 'Unauthorized: no authenticated user in SECDEF context', code: 'ERR_3002' }, correlationId),
          { status: 401, headers: { 'x-correlation-id': correlationId } },
        );
      }

      if (errMsg.includes('CONTRACT_NOT_FOUND')) {
        return NextResponse.json(
          wrapInContractFramework({ error: 'Contract not found', code: 'ERR_3003' }, correlationId),
          { status: 404, headers: { 'x-correlation-id': correlationId } },
        );
      }

      if (errMsg.includes('CONTRACT_NOT_DRAFT')) {
        return NextResponse.json(
          wrapInContractFramework({ error: 'Contract not in DRAFT state', code: 'ERR_3004' }, correlationId),
          { status: 409, headers: { 'x-correlation-id': correlationId } },
        );
      }

      if (errMsg.includes('ACCESS_DENIED')) {
        return NextResponse.json(
          wrapInContractFramework({ error: 'Access denied: you are not a party to this contract', code: 'ERR_3005' }, correlationId),
          { status: 403, headers: { 'x-correlation-id': correlationId } },
        );
      }

      // F-I5-03: do not echo the raw database error to the caller; it can carry contract
      // state or internal detail. The message is logged server-side only.
      console.error('[ContractAccept] RPC error:', errMsg);
      return NextResponse.json(
        wrapInContractFramework({ error: 'Contract acceptance failed', code: 'ERR_3099' }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!data) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'No response from contract acceptance', code: 'ERR_3098' }, correlationId),
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const result = data as Record<string, unknown>;

    // C5 Increment 1 — Emit contractSigned canonical event (non-blocking)
    try {
      const { getEventBus } = await import('@/shared/events/handler-registry');
      const emitter = InMemoryEventEmitter.createEvent({
        eventType: 'contractSigned',
        sourceModule: 'MOD-002',
        aggregateId: id,
        aggregateType: 'Contract',
        payload: {
          shipper_id: result?.shipper_id ?? '',
        },
        classification: EventClassification.BUSINESS,
        criticality: EventCriticality.CRITICAL,
        correlationId,
      });
      await getEventBus().publish(emitter);
    } catch (emissionErr: unknown) {
      const message = emissionErr instanceof Error ? emissionErr.message : String(emissionErr);
      console.error('[ContractAccept] Event emission failed (non-blocking):', message);
    }

    return NextResponse.json(
      wrapInContractFramework(result, correlationId),
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    console.error('[ContractAccept] Error:', error);
    return NextResponse.json(
      wrapInContractFramework({ error: 'Internal server error', code: 'ERR_3099' }, correlationId),
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
