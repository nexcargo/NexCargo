-- ============================================================================
-- 066_prei6_ws01_pod_completion_invariant.sql
-- PRE-I-6 WS-01 (POD COMPLETION INVARIANT) - direct-RPC half.
--
-- AUTHORITY
--   QODER DIRECTIVE - PRE-I-6 LA DECISIONS AND REMEDIATION, 16 November 2026.
--   D-WS01-1: NO GENERAL ADMINISTRATIVE BYPASS. Ordinary completion requires a
--     persisted POD in VERIFIED state; a request-body claim, client-supplied
--     status, role claim or administrative privilege alone cannot satisfy it;
--     the same invariant must hold through HTTP routes and direct RPC. No
--     exceptional administrative completion capability is implemented here.
--   D-WS01-2: APPROVED. Implement the minimum database-level correction so the
--     POD completion invariant cannot be bypassed through direct RPC invocation.
--     The function must independently verify the persisted POD state; preserve
--     legitimate transitions and idempotency; introduce no Admin/Super Admin
--     bypass; preserve signatures, grants, SECURITY DEFINER posture, search_path
--     and ownership; smallest appropriate migration; test HTTP and direct RPC.
--
-- FINDING (measured live 2026-11-16, rolled-back owner-class probe, project
--   cvdggspiudmudbbdkjrc; owner-class simulation is NOT RLS proof)
--   The HTTP completion gate lives only in the application layer:
--   TrackingOrchestratorService.updateTrackingStatus() requires
--   pods.some(p => p.verificationStatus === 'VERIFIED') before calling the RPC
--   (tracking-orchestrator-service.ts:88-98), and POST /api/tracking/[id]/status
--   maps that ValidationError to 409. Neither database function checks POD state:
--     * public.atomic_tracking_status_update(uuid,varchar,varchar,uuid) is
--       SECURITY DEFINER with EXECUTE granted to authenticated, so any
--       authenticated user can call it directly at
--       /rest/v1/rpc/atomic_tracking_status_update. It enforces identity, role,
--       scope and the MOD-003 state machine (DELIVERED->COMPLETED is permitted)
--       but never requires a VERIFIED POD.
--     * public.atomic_tracking_complete(uuid,uuid) is SECURITY DEFINER, EXECUTE
--       held by service_role and postgres (anon/authenticated revoked by 033),
--       zero application callers. It checks only a non-null caller and
--       status='DELIVERED', then completes - no POD check, no party scope.
--   Live BEFORE probe on protected I-5 tracking ce28e62d (DELIVERED v6,
--   completed_at NULL, two PENDING PODs afc61a36/a55addcd, no VERIFIED POD),
--   rolled back so nothing persisted:
--     P1 atomic_tracking_complete(ce28e62d, e0fe13fd)        -> SUCCESS, COMPLETED
--     P2 atomic_tracking_status_update(ce28e62d,'COMPLETED',
--        'MOD-003', e0fe13fd) under simulated Transporter JWT -> SUCCESS, COMPLETED
--   Both completed a DELIVERED shipment with no VERIFIED POD: the direct-RPC
--   bypass of the MOD-003 §7.5 invariant. Post-probe re-measure confirmed
--   ce28e62d still DELIVERED v6, completed_at NULL, 6 events, 2 PODs.
--
-- EXACT CHANGE (one predicate added to each function; nothing else altered)
--   A persisted-VERIFIED-POD guard is inserted into both functions:
--     IF NOT EXISTS (SELECT 1 FROM logistics_schema.proof_of_delivery pod
--                    WHERE pod.tracking_id = p_tracking_id
--                      AND pod.verification_status = 'VERIFIED') THEN
--       RAISE EXCEPTION 'POD_REQUIRED: tracking % cannot complete without a
--         persisted VERIFIED proof of delivery (MOD-003 §7.5)', p_tracking_id;
--     END IF;
--   Placement:
--     * atomic_tracking_status_update: after identity/role/scope authorization
--       and after the state-machine + terminal guards, immediately before the
--       atomic UPDATE+INSERT block, and gated on
--       p_target_status='COMPLETED' AND v_current_state<>'COMPLETED' so the
--       idempotent COMPLETED->COMPLETED re-call is NOT a new completion and is
--       left ungated (preserves legitimate repeat-call behavior).
--     * atomic_tracking_complete: after the DELIVERED lifecycle check, before
--       the UPDATE. This function only ever completes, so the guard is
--       unconditional.
--   The predicate mirrors the application gate exactly (verification_status =
--   'VERIFIED'; proof_of_delivery has no is_deleted column). It is role-agnostic:
--   it runs for ADMIN/SUPER_ADMIN/MODERATOR/DISPATCHER/TRANSPORTER alike, so no
--   administrative privilege can satisfy completion without a VERIFIED POD
--   (D-WS01-1). The admin/scope branches above it are byte-identical to the live
--   body; this change adds no bypass and removes no existing authorization.
--
-- WHY THIS IS NOT A WEAKENING
--   Strictly narrower: a completion that previously succeeded with no VERIFIED
--   POD now raises POD_REQUIRED. Every legitimate completion already had a
--   VERIFIED POD (the HTTP gate and PodSubmissionService.completeAfterPODVVerification
--   both require it), so authorized positive behavior is unchanged. Non-completion
--   transitions are untouched (the guard only fires on the COMPLETED target).
--   CREATE OR REPLACE preserves each function oid, signature, RETURNS void,
--   LANGUAGE plpgsql, SECURITY DEFINER, pinned search_path and all ACLs. No
--   policy, grant, schema, table or other function is touched. No financial,
--   escrow, payment or settlement object is referenced.
--
-- PRECONDITIONS (asserted below before the replace)
--   P1 both functions exist with the exact authorized signatures;
--   P2 both SECURITY DEFINER with search_path pinned to pg_catalog/public;
--   P3 neither body yet contains POD_REQUIRED (original vulnerable state);
--   P4 grant layout: complete EXECUTE service_role+postgres, not anon/authenticated/PUBLIC;
--      status_update EXECUTE authenticated+service_role+postgres, not anon/PUBLIC.
--
-- POSTCONDITIONS / INVARIANTS (asserted below after the replace)
--   Q1 both signatures, SECDEF and pinned search_path unchanged;
--   Q2 both grant layouts unchanged;
--   Q3 POD_REQUIRED present in both bodies;
--   Q4 status_update gate sits after authorization and state-machine guards and
--      before the tracking_events INSERT, and carries the idempotency condition
--      v_current_state <> 'COMPLETED';
--   Q5 complete gate sits after CANNOT_COMPLETE and before the UPDATE.
--
-- ROLLBACK INSTRUCTIONS
--   Execute the commented original definitions in the ROLLBACK section at the
--   bottom of this file (uncomment and run as the migration owner). They are the
--   verbatim pre-change bodies captured live via pg_get_functiondef on
--   2026-11-16. CREATE OR REPLACE again preserves oid and grants. Rollback
--   re-opens the direct-RPC POD bypass; the HTTP gate remains in place either way.
--
-- APPLICATION PROCEDURE
--   Established NexCargo procedure: apply via Supabase apply_migration with name
--   066_prei6_ws01_pod_completion_invariant, then verify from the catalog
--   (pg_get_functiondef / pg_proc / has_function_privilege) and via rolled-back
--   role-simulated probes plus a real authenticated-session direct-RPC call.
--   File existence is not proof of application; the journal row and catalog
--   measurements are.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PRECONDITIONS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_oid_c  OID;
    v_oid_s  OID;
    v_def_c  TEXT;
    v_def_s  TEXT;
BEGIN
    SELECT p.oid, pg_get_functiondef(p.oid) INTO v_oid_c, v_def_c
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_complete'
       AND pg_get_function_identity_arguments(p.oid) = 'p_tracking_id uuid, p_caller_user_id uuid';

    SELECT p.oid, pg_get_functiondef(p.oid) INTO v_oid_s, v_def_s
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_status_update'
       AND pg_get_function_identity_arguments(p.oid) = 'p_tracking_id uuid, p_target_status character varying, p_source_module character varying, p_caller_user_id uuid';

    IF v_oid_c IS NULL OR v_oid_s IS NULL THEN
        RAISE EXCEPTION 'PRECONDITION P1 FAILED: target function signature(s) not found';
    END IF;

    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid_c)
       OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid_s) THEN
        RAISE EXCEPTION 'PRECONDITION P2 FAILED: a target function is not SECURITY DEFINER';
    END IF;

    IF NOT ((SELECT proconfig FROM pg_proc WHERE oid = v_oid_c) @> ARRAY['search_path=pg_catalog, public']::text[])
       OR NOT ((SELECT proconfig FROM pg_proc WHERE oid = v_oid_s) @> ARRAY['search_path=pg_catalog, public']::text[]) THEN
        RAISE EXCEPTION 'PRECONDITION P2 FAILED: search_path not pinned to pg_catalog/public';
    END IF;

    IF position('POD_REQUIRED' in v_def_c) <> 0 OR position('POD_REQUIRED' in v_def_s) <> 0 THEN
        RAISE EXCEPTION 'PRECONDITION P3 FAILED: POD_REQUIRED already present (already migrated or unexpected body)';
    END IF;

    IF has_function_privilege('anon', v_oid_c, 'EXECUTE')
       OR has_function_privilege('authenticated', v_oid_c, 'EXECUTE')
       OR has_function_privilege('public', v_oid_c, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_oid_c, 'EXECUTE') THEN
        RAISE EXCEPTION 'PRECONDITION P4 FAILED: atomic_tracking_complete grant layout unexpected';
    END IF;

    IF has_function_privilege('anon', v_oid_s, 'EXECUTE')
       OR has_function_privilege('public', v_oid_s, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_oid_s, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_oid_s, 'EXECUTE') THEN
        RAISE EXCEPTION 'PRECONDITION P4 FAILED: atomic_tracking_status_update grant layout unexpected';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- REPLACEMENT 1: atomic_tracking_complete (POD guard only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_tracking_complete(p_tracking_id uuid, p_caller_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_record logistics_schema.shipment_tracking_records%ROWTYPE;
BEGIN
    IF p_caller_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    SELECT * INTO v_record FROM logistics_schema.shipment_tracking_records WHERE id = p_tracking_id AND is_deleted = FALSE;
    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'TRACKING_RECORD_NOT_FOUND: tracking % not found or deleted', p_tracking_id;
    END IF;

    IF v_record.status <> 'DELIVERED' THEN
        RAISE EXCEPTION 'CANNOT_COMPLETE: tracking must be DELIVERED before COMPLETED, current=%', v_record.status;
    END IF;

    -- WS-01 / D-WS01-2: ordinary completion requires a persisted VERIFIED POD (MOD-003 §7.5),
    -- enforced here so a direct RPC call cannot bypass the HTTP-layer gate. Role-agnostic:
    -- no administrative privilege satisfies it (D-WS01-1: no Admin/Super Admin bypass).
    IF NOT EXISTS (
        SELECT 1 FROM logistics_schema.proof_of_delivery pod
        WHERE pod.tracking_id = p_tracking_id AND pod.verification_status = 'VERIFIED'
    ) THEN
        RAISE EXCEPTION 'POD_REQUIRED: tracking % cannot complete without a persisted VERIFIED proof of delivery (MOD-003 §7.5)', p_tracking_id;
    END IF;

    UPDATE logistics_schema.shipment_tracking_records SET status = 'COMPLETED', completed_at = NOW(), last_updated = NOW(), updated_at = NOW(), version = COALESCE(version, 1) + 1 WHERE id = p_tracking_id AND is_deleted = FALSE;
END;
$function$;

-- ---------------------------------------------------------------------------
-- REPLACEMENT 2: atomic_tracking_status_update (POD guard on the completion
-- transition only; identity, role, scope, state machine and atomic block are
-- byte-identical to the live pre-change body)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_tracking_status_update(p_tracking_id uuid, p_target_status character varying, p_source_module character varying DEFAULT 'MOD-003'::character varying, p_caller_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_caller            UUID;
    v_record            logistics_schema.shipment_tracking_records%ROWTYPE;
    v_current_state     VARCHAR(20);
    v_role              TEXT;
    v_key               TEXT;
BEGIN
    -- Derive identity from auth context
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user session';
    END IF;

    -- Validate caller-supplied ID matches auth context
    IF p_caller_user_id IS NOT NULL AND p_caller_user_id <> v_caller THEN
        RAISE EXCEPTION 'FORBIDDEN: caller identity mismatch';
    END IF;

    -- Pre-enforcement guard: target must be known status string
    IF p_target_status NOT IN ('CREATED','BOOKED','AWAITING_PICKUP','PICKUP_ACKNOWLEDGED',
                                'IN_TRANSIT','AT_BORDER','DELIVERED','COMPLETED','CANCELLED','DELAYED') THEN
        RAISE EXCEPTION 'INVALID_STATUS: % is not a valid tracking status', p_target_status;
    END IF;

    -- Read current tracking record
    SELECT * INTO v_record
    FROM logistics_schema.shipment_tracking_records
    WHERE id = p_tracking_id AND is_deleted = FALSE;
    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'TRACKING_RECORD_NOT_FOUND: tracking % not found or deleted', p_tracking_id;
    END IF;
    v_current_state := v_record.status;

    -- I-2 ITEM 1: one role-resolution convention, the same one the policies use. Governance comes from
    -- app.platform_roles through effective_user_role(); marketplace classifications come from
    -- app.marketplace_memberships through effective_marketplace_role(). Both are zero-argument, pinned
    -- SECURITY DEFINER resolvers keyed on auth.uid(), so the subject is this session's JWT sub rather than a
    -- caller-supplied or metadata-supplied claim, and 024's booking-attribution TRANSPORTER branch is reachable.
    SELECT COALESCE(public.effective_user_role(), public.effective_marketplace_role()) INTO v_role;

    -- Validate role + scope based on role hierarchy
    IF v_role = 'ADMIN' OR v_role = 'SUPER_ADMIN' THEN
        NULL;
    ELSIF v_role = 'MODERATOR' THEN
        NULL;
    ELSIF v_role = 'DISPATCHER' OR logistics_schema.delegated_principal() IS NOT NULL THEN
        -- I-2 PART A: authority is the ACTIVE DELEGATION, not a platform_roles row. A legacy DISPATCHER row
        -- with no delegation reaches the inner test and is refused; a delegate with no platform_roles row at
        -- all is admitted on scope and row attribution alone.
        IF NOT (public.has_operational_scope('tracking_update')
                AND logistics_schema.delegated_shipment(p_tracking_id)) THEN
            RAISE EXCEPTION 'FORBIDDEN: tracking % is outside the caller''s delegated Transporter scope, or tracking_update was not delegated', p_tracking_id;
        END IF;
    ELSIF v_role = 'TRANSPORTER' THEN
        IF NOT EXISTS (
            SELECT 1 FROM logistics_schema.bookings b
            JOIN logistics_schema.shipment_tracking_records tr ON tr.booking_id = b.id
            WHERE tr.id = p_tracking_id AND b.transporter_id = v_caller AND b.is_deleted = FALSE
        ) THEN
            RAISE EXCEPTION 'FORBIDDEN: transporter cannot update another entity''s tracking';
        END IF;
    ELSE
        RAISE EXCEPTION 'FORBIDDEN: role ''%'' is not authorized for tracking status updates', COALESCE(v_role, 'unassigned');
    END IF;

    -- STATE MACHINE ENFORCEMENT (DEFECT-003 fix)
    -- Reproduces authoritative VALID_TRANSITIONS from tracking-state-machine.ts
    -- Defense-in-depth: prevents direct RPC abuse bypassing API applyTrackingTransition()
    v_key := v_current_state || '|' || p_target_status;
    IF NOT (
        (v_current_state = 'CREATED' AND p_target_status IN ('BOOKED','DELAYED'))
        OR (v_current_state = 'BOOKED' AND p_target_status IN ('AWAITING_PICKUP','CANCELLED','DELAYED'))
        OR (v_current_state = 'AWAITING_PICKUP' AND p_target_status IN ('PICKUP_ACKNOWLEDGED','CANCELLED','DELAYED'))
        OR (v_current_state = 'PICKUP_ACKNOWLEDGED' AND p_target_status IN ('IN_TRANSIT','CANCELLED','DELAYED'))
        OR (v_current_state = 'IN_TRANSIT' AND p_target_status IN ('AT_BORDER','DELIVERED','CANCELLED','DELAYED'))
        OR (v_current_state = 'AT_BORDER' AND p_target_status IN ('IN_TRANSIT','CANCELLED','DELAYED'))
        OR (v_current_state = 'DELAYED' AND p_target_status IN ('AWAITING_PICKUP','IN_TRANSIT','AT_BORDER','DELIVERED','CANCELLED'))
        OR (v_current_state = 'DELIVERED' AND p_target_status IN ('COMPLETED','CANCELLED'))
        OR (v_current_state IN ('COMPLETED','CANCELLED') AND p_target_status = v_current_state)
    ) THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: % -> % is not permitted per MOD-003', v_current_state, p_target_status;
    END IF;

    -- Terminal state guard (redundant safety)
    IF v_current_state IN ('COMPLETED', 'CANCELLED') AND v_current_state <> p_target_status THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: % is terminal, no outgoing transitions', v_current_state;
    END IF;

    -- WS-01 / D-WS01-2: completion requires a persisted VERIFIED POD (MOD-003 §7.5), enforced here so a
    -- direct RPC call cannot bypass the HTTP-layer gate. Role-agnostic: it runs for ADMIN/SUPER_ADMIN and
    -- every other role alike, so no administrative privilege satisfies completion without a VERIFIED POD
    -- (D-WS01-1: no Admin/Super Admin bypass). The idempotent COMPLETED->COMPLETED re-call is not a new
    -- completion and is left ungated to preserve legitimate repeat-call behavior.
    IF p_target_status = 'COMPLETED' AND v_current_state <> 'COMPLETED' THEN
        IF NOT EXISTS (
            SELECT 1 FROM logistics_schema.proof_of_delivery pod
            WHERE pod.tracking_id = p_tracking_id AND pod.verification_status = 'VERIFIED'
        ) THEN
            RAISE EXCEPTION 'POD_REQUIRED: tracking % cannot complete without a persisted VERIFIED proof of delivery (MOD-003 §7.5)', p_tracking_id;
        END IF;
    END IF;

    -- Atomic UPDATE + INSERT within single DB transaction
    BEGIN
        UPDATE logistics_schema.shipment_tracking_records
        SET status = p_target_status, last_updated = NOW(), updated_at = NOW(), version = COALESCE(version, 1) + 1
        WHERE id = p_tracking_id AND is_deleted = FALSE;

        INSERT INTO logistics_schema.tracking_events (tracking_id, event_type, event_timestamp, source, state_from, state_to, metadata)
        VALUES (p_tracking_id, 'SHIPMENT_' || UPPER(p_target_status), NOW(), p_source_module, v_current_state, p_target_status, jsonb_build_object('caller_user_id', v_caller, 'previous_status', v_current_state));

    EXCEPTION WHEN OTHERS THEN RAISE;
    END;
END;
$function$;

-- ---------------------------------------------------------------------------
-- POSTCONDITIONS / INVARIANTS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_oid_c  OID;
    v_oid_s  OID;
    v_def_c  TEXT;
    v_def_s  TEXT;
BEGIN
    SELECT p.oid, pg_get_functiondef(p.oid) INTO v_oid_c, v_def_c
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_complete'
       AND pg_get_function_identity_arguments(p.oid) = 'p_tracking_id uuid, p_caller_user_id uuid';

    SELECT p.oid, pg_get_functiondef(p.oid) INTO v_oid_s, v_def_s
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_status_update'
       AND pg_get_function_identity_arguments(p.oid) = 'p_tracking_id uuid, p_target_status character varying, p_source_module character varying, p_caller_user_id uuid';

    IF v_oid_c IS NULL OR v_oid_s IS NULL THEN
        RAISE EXCEPTION 'POSTCONDITION Q1 FAILED: function signature lost';
    END IF;

    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid_c)
       OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid_s)
       OR NOT ((SELECT proconfig FROM pg_proc WHERE oid = v_oid_c) @> ARRAY['search_path=pg_catalog, public']::text[])
       OR NOT ((SELECT proconfig FROM pg_proc WHERE oid = v_oid_s) @> ARRAY['search_path=pg_catalog, public']::text[]) THEN
        RAISE EXCEPTION 'POSTCONDITION Q1 FAILED: SECDEF or pinned search_path lost';
    END IF;

    IF has_function_privilege('anon', v_oid_c, 'EXECUTE')
       OR has_function_privilege('authenticated', v_oid_c, 'EXECUTE')
       OR has_function_privilege('public', v_oid_c, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_oid_c, 'EXECUTE') THEN
        RAISE EXCEPTION 'POSTCONDITION Q2 FAILED: atomic_tracking_complete grant layout changed';
    END IF;

    IF has_function_privilege('anon', v_oid_s, 'EXECUTE')
       OR has_function_privilege('public', v_oid_s, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_oid_s, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_oid_s, 'EXECUTE') THEN
        RAISE EXCEPTION 'POSTCONDITION Q2 FAILED: atomic_tracking_status_update grant layout changed';
    END IF;

    IF position('POD_REQUIRED' in v_def_c) = 0 OR position('POD_REQUIRED' in v_def_s) = 0 THEN
        RAISE EXCEPTION 'POSTCONDITION Q3 FAILED: POD_REQUIRED guard missing from a function body';
    END IF;

    IF position('POD_REQUIRED' in v_def_s) < position('is not authorized for tracking status updates' in v_def_s)
       OR position('POD_REQUIRED' in v_def_s) < position('INVALID_TRANSITION' in v_def_s)
       OR position('POD_REQUIRED' in v_def_s) > position('INSERT INTO logistics_schema.tracking_events' in v_def_s)
       OR position('v_current_state <> ''COMPLETED''' in v_def_s) = 0 THEN
        RAISE EXCEPTION 'POSTCONDITION Q4 FAILED: status_update POD guard misplaced or idempotency condition absent';
    END IF;

    IF position('POD_REQUIRED' in v_def_c) < position('CANNOT_COMPLETE' in v_def_c)
       OR position('POD_REQUIRED' in v_def_c) > position('UPDATE logistics_schema.shipment_tracking_records' in v_def_c) THEN
        RAISE EXCEPTION 'POSTCONDITION Q5 FAILED: complete POD guard misplaced';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ROLLBACK (verbatim pre-change definitions, captured live 2026-11-16 via
-- pg_get_functiondef; uncomment and execute as the migration owner to restore
-- the original bodies; grants and oid are preserved by REPLACE)
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.atomic_tracking_complete(p_tracking_id uuid, p_caller_user_id uuid DEFAULT NULL::uuid)
--  RETURNS void
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'pg_catalog', 'public'
-- AS $function$
-- DECLARE
--     v_record logistics_schema.shipment_tracking_records%ROWTYPE;
-- BEGIN
--     IF p_caller_user_id IS NULL THEN
--         RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
--     END IF;
--     SELECT * INTO v_record FROM logistics_schema.shipment_tracking_records WHERE id = p_tracking_id AND is_deleted = FALSE;
--     IF v_record.id IS NULL THEN
--         RAISE EXCEPTION 'TRACKING_RECORD_NOT_FOUND: tracking % not found or deleted', p_tracking_id;
--     END IF;
--     IF v_record.status <> 'DELIVERED' THEN
--         RAISE EXCEPTION 'CANNOT_COMPLETE: tracking must be DELIVERED before COMPLETED, current=%', v_record.status;
--     END IF;
--     UPDATE logistics_schema.shipment_tracking_records SET status = 'COMPLETED', completed_at = NOW(), last_updated = NOW(), updated_at = NOW(), version = COALESCE(version, 1) + 1 WHERE id = p_tracking_id AND is_deleted = FALSE;
-- END;
-- $function$;
--
-- CREATE OR REPLACE FUNCTION public.atomic_tracking_status_update(p_tracking_id uuid, p_target_status character varying, p_source_module character varying DEFAULT 'MOD-003'::character varying, p_caller_user_id uuid DEFAULT NULL::uuid)
--  RETURNS void
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'pg_catalog', 'public'
-- AS $function$
-- DECLARE
--     v_caller            UUID;
--     v_record            logistics_schema.shipment_tracking_records%ROWTYPE;
--     v_current_state     VARCHAR(20);
--     v_role              TEXT;
--     v_key               TEXT;
-- BEGIN
--     v_caller := auth.uid();
--     IF v_caller IS NULL THEN
--         RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user session';
--     END IF;
--     IF p_caller_user_id IS NOT NULL AND p_caller_user_id <> v_caller THEN
--         RAISE EXCEPTION 'FORBIDDEN: caller identity mismatch';
--     END IF;
--     IF p_target_status NOT IN ('CREATED','BOOKED','AWAITING_PICKUP','PICKUP_ACKNOWLEDGED',
--                                 'IN_TRANSIT','AT_BORDER','DELIVERED','COMPLETED','CANCELLED','DELAYED') THEN
--         RAISE EXCEPTION 'INVALID_STATUS: % is not a valid tracking status', p_target_status;
--     END IF;
--     SELECT * INTO v_record
--     FROM logistics_schema.shipment_tracking_records
--     WHERE id = p_tracking_id AND is_deleted = FALSE;
--     IF v_record.id IS NULL THEN
--         RAISE EXCEPTION 'TRACKING_RECORD_NOT_FOUND: tracking % not found or deleted', p_tracking_id;
--     END IF;
--     v_current_state := v_record.status;
--     SELECT COALESCE(public.effective_user_role(), public.effective_marketplace_role()) INTO v_role;
--     IF v_role = 'ADMIN' OR v_role = 'SUPER_ADMIN' THEN
--         NULL;
--     ELSIF v_role = 'MODERATOR' THEN
--         NULL;
--     ELSIF v_role = 'DISPATCHER' OR logistics_schema.delegated_principal() IS NOT NULL THEN
--         IF NOT (public.has_operational_scope('tracking_update')
--                 AND logistics_schema.delegated_shipment(p_tracking_id)) THEN
--             RAISE EXCEPTION 'FORBIDDEN: tracking % is outside the caller''s delegated Transporter scope, or tracking_update was not delegated', p_tracking_id;
--         END IF;
--     ELSIF v_role = 'TRANSPORTER' THEN
--         IF NOT EXISTS (
--             SELECT 1 FROM logistics_schema.bookings b
--             JOIN logistics_schema.shipment_tracking_records tr ON tr.booking_id = b.id
--             WHERE tr.id = p_tracking_id AND b.transporter_id = v_caller AND b.is_deleted = FALSE
--         ) THEN
--             RAISE EXCEPTION 'FORBIDDEN: transporter cannot update another entity''s tracking';
--         END IF;
--     ELSE
--         RAISE EXCEPTION 'FORBIDDEN: role ''%'' is not authorized for tracking status updates', COALESCE(v_role, 'unassigned');
--     END IF;
--     v_key := v_current_state || '|' || p_target_status;
--     IF NOT (
--         (v_current_state = 'CREATED' AND p_target_status IN ('BOOKED','DELAYED'))
--         OR (v_current_state = 'BOOKED' AND p_target_status IN ('AWAITING_PICKUP','CANCELLED','DELAYED'))
--         OR (v_current_state = 'AWAITING_PICKUP' AND p_target_status IN ('PICKUP_ACKNOWLEDGED','CANCELLED','DELAYED'))
--         OR (v_current_state = 'PICKUP_ACKNOWLEDGED' AND p_target_status IN ('IN_TRANSIT','CANCELLED','DELAYED'))
--         OR (v_current_state = 'IN_TRANSIT' AND p_target_status IN ('AT_BORDER','DELIVERED','CANCELLED','DELAYED'))
--         OR (v_current_state = 'AT_BORDER' AND p_target_status IN ('IN_TRANSIT','CANCELLED','DELAYED'))
--         OR (v_current_state = 'DELAYED' AND p_target_status IN ('AWAITING_PICKUP','IN_TRANSIT','AT_BORDER','DELIVERED','CANCELLED'))
--         OR (v_current_state = 'DELIVERED' AND p_target_status IN ('COMPLETED','CANCELLED'))
--         OR (v_current_state IN ('COMPLETED','CANCELLED') AND p_target_status = v_current_state)
--     ) THEN
--         RAISE EXCEPTION 'INVALID_TRANSITION: % -> % is not permitted per MOD-003', v_current_state, p_target_status;
--     END IF;
--     IF v_current_state IN ('COMPLETED', 'CANCELLED') AND v_current_state <> p_target_status THEN
--         RAISE EXCEPTION 'INVALID_TRANSITION: % is terminal, no outgoing transitions', v_current_state;
--     END IF;
--     BEGIN
--         UPDATE logistics_schema.shipment_tracking_records
--         SET status = p_target_status, last_updated = NOW(), updated_at = NOW(), version = COALESCE(version, 1) + 1
--         WHERE id = p_tracking_id AND is_deleted = FALSE;
--         INSERT INTO logistics_schema.tracking_events (tracking_id, event_type, event_timestamp, source, state_from, state_to, metadata)
--         VALUES (p_tracking_id, 'SHIPMENT_' || UPPER(p_target_status), NOW(), p_source_module, v_current_state, p_target_status, jsonb_build_object('caller_user_id', v_caller, 'previous_status', v_current_state));
--     EXCEPTION WHEN OTHERS THEN RAISE;
--     END;
-- END;
-- $function$;