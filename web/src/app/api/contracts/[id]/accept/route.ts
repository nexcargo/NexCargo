// NexCargo MOD-002 — PATCH /api/contracts/[id]/accept — Contract Acceptance Endpoint
// Authorized directive: HAO-AUTH-WORKSTREAM-A-C3C7-HANDOFF
// Purpose: Runtime contract signing path that invokes trusted SECDEF for atomic accept+tracking
//
// Rules:
//   - Caller must be authenticated (Supabase session required)
//   - Caller identity comes from auth.uid() — no arbitrary signerId accepted
//   - Authorization (shipper/transporter party validation) handled inside SECDEF via contract ownership
//   - First signature records acceptance but does NOT initialize tracking
//   - Second (final) signature transitions contract to ACTIVE and atomically creates tracking
//   - Idempotent: retrying a recorded signature returns correct state without side effects
//   - Tracking initialization happens ONLY via the SECDEF composite function (not HTTP endpoint)

import { NextRequest, NextResponse } from 'next/server';
import { resolveCorrelationId, createCorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { wrapInContractFramework } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import { createClient } from '@/lib/supabase/server';

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

    // Verify caller has a valid Supabase session
    // Actual authorization (contract-party ownership) is enforced inside the SECDEF function
    const supabaseSession = await createClient();
    const { data: { user }, error: authError } = await supabaseSession.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        wrapInContractFramework({ error: 'Unauthorized', code: 'ERR_3002' }, correlationId),
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Invoke composite SECDEF function atomically
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

      return NextResponse.json(
        wrapInContractFramework({ error: 'Contract acceptance failed', details: errMsg, code: 'ERR_3099' }, correlationId),
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
