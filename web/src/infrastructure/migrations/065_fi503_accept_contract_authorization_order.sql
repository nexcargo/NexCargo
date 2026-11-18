-- ============================================================================
-- 065_fi503_accept_contract_authorization_order.sql
-- F-I5-03 (CONTRACT STATE INFORMATION DISCLOSURE) - direct-RPC half.
--
-- AUTHORITY
--   LA AUTHORIZATION - F-I5-03 DIRECT-RPC REMEDIATION, 16 November 2026:
--   "The Lead Architect approves the narrowly scoped direct-RPC remediation
--   for F-I5-03." Target: public.accept_and_finalize_contract(uuid, uuid).
--   Authorized: move booking-party authorization ahead of all contract-state
--   evaluation and disclosure; return uniform CONTRACT_NOT_FOUND for
--   unauthorized parties irrespective of contract existence or state;
--   preserve signature, execution grants, authorized-party behavior,
--   signature ordering, finalization, tracking creation, idempotency and
--   audit behavior. This file is the single authorized CREATE OR REPLACE.
--
-- FINDING (measured live 2026-11-16, rolled-back probe, project cvdggspiudmudbbdkjrc)
--   The function is SECURITY DEFINER with EXECUTE granted to authenticated
--   (migrations 018/019/029), so any authenticated user can call it directly
--   at /rest/v1/rpc/accept_and_finalize_contract, bypassing table RLS.
--   Its original ordering evaluated acceptance_status BEFORE party ownership:
--     1. auth.uid() null            -> UNAUTHORIZED
--     2. row missing / deleted      -> CONTRACT_NOT_FOUND
--     3. acceptance_status <> DRAFT -> CONTRACT_NOT_DRAFT (names the state)
--     4. booking_id IS NULL         -> CONTRACT_NO_BOOKING
--     5. caller not a booking party -> ACCESS_DENIED
--   Live probe as non-party Shipper 666ed3aa:
--     foreign ACTIVE 3b8ff821 -> 'CONTRACT_NOT_DRAFT: contract is in status
--       ACTIVE, cannot accept'  (lifecycle disclosure)
--     nonexistent id          -> 'CONTRACT_NOT_FOUND: contract ... not found
--       or deleted'             (existence distinguishable from the above)
--   The HTTP route half was already corrected (RLS-scoped visibility gate,
--   NXC-I5-IMP-005); this file closes the remaining direct-RPC path.
--
-- EXACT CHANGE (ordering only; no logic, grant or signature change)
--   New ordering:
--     1. auth.uid() null            -> UNAUTHORIZED                (unchanged)
--     2. row missing / deleted      -> CONTRACT_NOT_FOUND          (unchanged)
--     3. booking_id IS NULL         -> CONTRACT_NOT_FOUND (uniform, was
--                                      CONTRACT_NO_BOOKING)
--     4. caller not a booking party -> CONTRACT_NOT_FOUND (uniform, was
--                                      ACCESS_DENIED)
--     5. acceptance_status <> DRAFT -> CONTRACT_NOT_DRAFT          (unchanged,
--                                      now reachable only by authorized parties)
--   All three non-party outcomes (nonexistent, booking-less, foreign) raise
--   the IDENTICAL message text 'CONTRACT_NOT_FOUND: contract % not found or
--   deleted' with the caller-supplied id, so existence, booking linkage and
--   lifecycle state are indistinguishable to an unauthorized caller.
--   The party EXISTS predicates are copied verbatim from the original body
--   (bookings.shipper_id / transporter_id = auth.uid(), is_deleted = FALSE).
--   Everything from v_num_signatories onward is byte-identical to the
--   original: first signature (no activation), second signature (ACTIVE +
--   EXECUTED + tracking creation or tracking-exists), idempotent retry
--   branches, FOR UPDATE row lock, audit columns (updated_by/updated_at).
--
-- WHY THIS IS NOT A WEAKENING
--   Strictly narrower disclosure: an unauthorized caller previously learned
--   state (409-mapped) or non-party status (403-mapped); now it learns nothing
--   beyond the uniform not-found. No authorized-party outcome changes:
--     * A booking party passes step 4 exactly when it passed the original
--       step 5 (identical predicates), then sees the identical state check
--       and identical signing logic.
--     * CONTRACT_NO_BOOKING was unreachable for any authorized party: with
--       booking_id NULL no party EXISTS can be true, so only non-parties ever
--       saw it; they now see the uniform not-found instead.
--     * ACCESS_DENIED was only ever raised for non-parties; same treatment.
--   CREATE OR REPLACE preserves the function oid, signature, RETURNS jsonb,
--   LANGUAGE plpgsql, SECURITY DEFINER, pinned search_path and all ACLs.
--   No policy, grant, schema, table or other function is touched. No
--   financial, escrow, payment or settlement object is referenced.
--
-- PRECONDITIONS (asserted below before the replace)
--   P1 function exists with the exact authorized signature;
--   P2 SECURITY DEFINER and search_path pinned to pg_catalog/public;
--   P3 original vulnerable ordering present (state check before ACCESS_DENIED);
--   P4 EXECUTE held by authenticated, not by anon or PUBLIC.
--
-- POSTCONDITIONS / INVARIANTS (asserted below after the replace)
--   Q1 signature, SECDEF and pinned search_path unchanged;
--   Q2 grants unchanged (authenticated EXECUTE; anon/PUBLIC none);
--   Q3 party authorization (INTO v_is_transporter) precedes the first
--      CONTRACT_NOT_DRAFT occurrence;
--   Q4 exactly three CONTRACT_NOT_FOUND raises; ACCESS_DENIED and
--      CONTRACT_NO_BOOKING no longer present;
--   Q5 UNAUTHORIZED remains the first guard.
--
-- ROLLBACK INSTRUCTIONS
--   Execute the commented original definition in the ROLLBACK section at the
--   bottom of this file (uncomment and run as the migration owner). It is the
--   verbatim pre-change body captured live via pg_get_functiondef(35781) on
--   2026-11-16. CREATE OR REPLACE again preserves oid and grants. Note that
--   rollback re-opens the direct-RPC disclosure; the HTTP visibility gate
--   (NXC-I5-IMP-005) remains in place either way.
--
-- APPLICATION PROCEDURE
--   Established NexCargo procedure: apply via Supabase apply_migration with
--   name 065_fi503_accept_contract_authorization_order, then verify from the
--   catalog (pg_get_functiondef / pg_proc / has_function_privilege) and via
--   rolled-back role-simulated probes. File existence is not proof of
--   application; the journal row and catalog measurements are.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PRECONDITIONS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_def  TEXT;
    v_oid  OID;
BEGIN
    SELECT p.oid, pg_get_functiondef(p.oid)
      INTO v_oid, v_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'accept_and_finalize_contract'
       AND pg_get_function_identity_arguments(p.oid) = 'p_contract_id_uuid uuid, p_correlation_id uuid';

    IF v_oid IS NULL THEN
        RAISE EXCEPTION 'PRECONDITION P1 FAILED: target function signature not found';
    END IF;

    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
        RAISE EXCEPTION 'PRECONDITION P2 FAILED: function is not SECURITY DEFINER';
    END IF;

    IF position('ACCESS_DENIED' in v_def) = 0
       OR position('CONTRACT_NOT_DRAFT' in v_def) > position('ACCESS_DENIED' in v_def) THEN
        RAISE EXCEPTION 'PRECONDITION P3 FAILED: original state-before-party ordering not present (already migrated or unexpected body)';
    END IF;

    IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_oid, 'EXECUTE')
       OR has_function_privilege('public', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'PRECONDITION P4 FAILED: unexpected EXECUTE grant layout';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- REPLACEMENT (ordering correction only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_and_finalize_contract(p_contract_id_uuid uuid, p_correlation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_row                    logistics_schema.contracts%ROWTYPE;
    v_caller                 UUID;
    v_is_shipper             BOOLEAN;
    v_is_transporter         BOOLEAN;
    v_num_signatories        INTEGER;
    v_tracking_ref           VARCHAR(50);
    v_new_tracking_id        UUID;
    v_first_signatory_count  INTEGER;
BEGIN
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    SELECT * INTO v_row
    FROM logistics_schema.contracts
    WHERE id = p_contract_id_uuid AND is_deleted = FALSE
    FOR UPDATE;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'CONTRACT_NOT_FOUND: contract % not found or deleted', p_contract_id_uuid;
    END IF;

    -- F-I5-03: party authorization is established before any contract state is
    -- evaluated or disclosed. Non-parties receive the uniform not-found error,
    -- identical to a nonexistent contract, regardless of state or booking linkage.
    IF v_row.booking_id IS NULL THEN
        RAISE EXCEPTION 'CONTRACT_NOT_FOUND: contract % not found or deleted', p_contract_id_uuid;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM logistics_schema.bookings b
        WHERE b.id = v_row.booking_id AND b.shipper_id = v_caller AND b.is_deleted = FALSE
    ) INTO v_is_shipper;

    SELECT EXISTS (
        SELECT 1 FROM logistics_schema.bookings b
        WHERE b.id = v_row.booking_id AND b.transporter_id = v_caller AND b.is_deleted = FALSE
    ) INTO v_is_transporter;

    IF NOT v_is_shipper AND NOT v_is_transporter THEN
        RAISE EXCEPTION 'CONTRACT_NOT_FOUND: contract % not found or deleted', p_contract_id_uuid;
    END IF;

    IF v_row.acceptance_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'CONTRACT_NOT_DRAFT: contract is in status %, cannot accept', v_row.acceptance_status;
    END IF;

    v_num_signatories := COALESCE(v_row.num_signatories, 0);

    IF v_num_signatories = 0 THEN
        IF v_is_shipper THEN
            UPDATE logistics_schema.contracts
            SET shipper_accepted_at = now(),
                shipper_accepted_version = 1,
                num_signatories = 1,
                updated_by = v_caller,
                updated_at = now()
            WHERE id = p_contract_id_uuid AND is_deleted = FALSE
            RETURNING * INTO v_row;
        ELSIF v_is_transporter THEN
            UPDATE logistics_schema.contracts
            SET transporter_accepted_at = now(),
                transporter_accepted_version = 1,
                num_signatories = 1,
                updated_by = v_caller,
                updated_at = now()
            WHERE id = p_contract_id_uuid AND is_deleted = FALSE
            RETURNING * INTO v_row;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'first_signature_recorded',
            'contract_id', v_row.id::text,
            'contract_acceptance_status', v_row.acceptance_status,
            'num_signatories', 1,
            'signatory_role', CASE WHEN v_is_shipper THEN 'SHIPPER' ELSE 'TRANSPORTER' END,
            'message', 'First signature recorded. Awaiting second party.'
        );

    ELSIF v_num_signatories = 1 THEN
        IF v_is_shipper AND v_row.shipper_accepted_at IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'action', 'signature_already_recorded',
                'contract_id', v_row.id::text,
                'contract_acceptance_status', v_row.acceptance_status,
                'num_signatories', 1,
                'signatory_role', 'SHIPPER',
                'message', 'Shipper signature already recorded. Waiting for transporter.',
                'is_final', false
            );
        END IF;

        IF v_is_transporter AND v_row.transporter_accepted_at IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'action', 'signature_already_recorded',
                'contract_id', v_row.id::text,
                'contract_acceptance_status', v_row.acceptance_status,
                'num_signatories', 1,
                'signatory_role', 'TRANSPORTER',
                'message', 'Transporter signature already recorded. Waiting for shipper.',
                'is_final', false
            );
        END IF;

        IF v_is_shipper THEN
            UPDATE logistics_schema.contracts
            SET shipper_accepted_at = now(),
                shipper_accepted_version = COALESCE(shipper_accepted_version, 1),
                num_signatories = 2,
                acceptance_status = 'ACTIVE',
                signed_at = now(),
                digital_signature_status = 'EXECUTED',
                updated_by = v_caller,
                updated_at = now()
            WHERE id = p_contract_id_uuid AND is_deleted = FALSE
            RETURNING * INTO v_row;
        ELSIF v_is_transporter THEN
            UPDATE logistics_schema.contracts
            SET transporter_accepted_at = now(),
                transporter_accepted_version = COALESCE(transporter_accepted_version, 1),
                num_signatories = 2,
                acceptance_status = 'ACTIVE',
                signed_at = now(),
                digital_signature_status = 'EXECUTED',
                updated_by = v_caller,
                updated_at = now()
            WHERE id = p_contract_id_uuid AND is_deleted = FALSE
            RETURNING * INTO v_row;
        END IF;

        SELECT COUNT(*) INTO v_first_signatory_count
        FROM logistics_schema.shipment_tracking_records
        WHERE booking_id = v_row.booking_id AND is_deleted = FALSE;

        IF v_first_signatory_count > 0 THEN
            RETURN jsonb_build_object(
                'success', true,
                'action', 'contract_finalized_tracking_exists',
                'contract_id', v_row.id::text,
                'contract_acceptance_status', 'ACTIVE',
                'num_signatories', 2,
                'signed_at', v_row.signed_at::text,
                'message', 'Contract finalized. Tracking record already exists.',
                'is_final', true
            );
        END IF;

        v_tracking_ref := 'TRK-' || to_char(now(), 'YYYYMMDD') || '-' || replace(split_part(gen_random_uuid()::text, '-', 1), '-', '')::varchar(12);

        INSERT INTO logistics_schema.shipment_tracking_records (
            tracking_ref, booking_id, contract_id, status, visibility_level,
            activated_at, correlation_id, created_at, updated_at
        ) VALUES (
            v_tracking_ref, v_row.booking_id, p_contract_id_uuid,
            'CREATED', 'RESTRICTED',
            now(), p_correlation_id, now(), now()
        ) RETURNING id INTO v_new_tracking_id;

        INSERT INTO logistics_schema.tracking_events (
            tracking_id, event_type, source, state_from, state_to, metadata,
            event_timestamp, created_at
        ) VALUES (
            v_new_tracking_id, 'TRACKING_INITIALISED', 'SYSTEM',
            NULL, 'CREATED',
            jsonb_build_object(
                'booking_id', v_row.booking_id::text,
                'contract_id', p_contract_id_uuid::text,
                'trigger', 'CONTRACT_SIGNED_FINAL_SIGNATURE'
            ),
            now(), now()
        );

        RETURN jsonb_build_object(
            'success', true,
            'action', 'contract_finalized_with_tracking',
            'contract_id', v_row.id::text,
            'contract_acceptance_status', 'ACTIVE',
            'num_signatories', 2,
            'signed_at', v_row.signed_at::text,
            'tracking_record_id', v_new_tracking_id::text,
            'tracking_ref', v_tracking_ref,
            'tracking_status', 'CREATED',
            'message', 'Contract finalized and tracking initialized.'
        );

    ELSE
        SELECT COUNT(*) INTO v_first_signatory_count
        FROM logistics_schema.shipment_tracking_records
        WHERE booking_id = v_row.booking_id AND is_deleted = FALSE;

        IF v_first_signatory_count = 0 THEN
            v_tracking_ref := 'TRK-' || to_char(now(), 'YYYYMMDD') || '-' || replace(split_part(gen_random_uuid()::text, '-', 1), '-', '')::varchar(12);

            INSERT INTO logistics_schema.shipment_tracking_records (
                tracking_ref, booking_id, contract_id, status, visibility_level,
                activated_at, correlation_id, created_at, updated_at
            ) VALUES (
                v_tracking_ref, v_row.booking_id, p_contract_id_uuid,
                'CREATED', 'RESTRICTED',
                now(), p_correlation_id, now(), now()
            ) RETURNING id INTO v_new_tracking_id;

            INSERT INTO logistics_schema.tracking_events (
                tracking_id, event_type, source, state_from, state_to, metadata,
                event_timestamp, created_at
            ) VALUES (
                v_new_tracking_id, 'TRACKING_INITIALISED', 'SYSTEM',
                NULL, 'CREATED',
                jsonb_build_object(
                    'booking_id', v_row.booking_id::text,
                    'contract_id', p_contract_id_uuid::text,
                    'trigger', 'CONTRACT_SIGNED_FINAL_SIGNATURE_RETRY'
                ),
                now(), now()
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'contract_already_finalized',
            'contract_id', v_row.id::text,
            'contract_acceptance_status', v_row.acceptance_status,
            'num_signatories', v_num_signatories,
            'signed_at', v_row.signed_at::text,
            'message', 'Contract was already finalized. Result returned idempotently.',
            'is_final', true
        );
    END IF;
END;
$function$;

-- ---------------------------------------------------------------------------
-- POSTCONDITIONS / INVARIANTS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_def  TEXT;
    v_oid  OID;
    v_cfg  TEXT[];
BEGIN
    SELECT p.oid, pg_get_functiondef(p.oid), p.proconfig
      INTO v_oid, v_def, v_cfg
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'accept_and_finalize_contract'
       AND pg_get_function_identity_arguments(p.oid) = 'p_contract_id_uuid uuid, p_correlation_id uuid';

    IF v_oid IS NULL THEN
        RAISE EXCEPTION 'POSTCONDITION Q1 FAILED: function signature lost';
    END IF;

    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid)
       OR NOT (v_cfg @> ARRAY['search_path=pg_catalog, public']::text[]) THEN
        RAISE EXCEPTION 'POSTCONDITION Q1 FAILED: SECDEF or pinned search_path lost: %', v_cfg;
    END IF;

    IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_oid, 'EXECUTE')
       OR has_function_privilege('public', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'POSTCONDITION Q2 FAILED: EXECUTE grant layout changed';
    END IF;

    IF position('INTO v_is_transporter' in v_def) = 0
       OR position('CONTRACT_NOT_DRAFT' in v_def) < position('INTO v_is_transporter' in v_def) THEN
        RAISE EXCEPTION 'POSTCONDITION Q3 FAILED: party authorization does not precede state evaluation';
    END IF;

    IF (length(v_def) - length(replace(v_def, 'CONTRACT_NOT_FOUND', ''))) / length('CONTRACT_NOT_FOUND') <> 3
       OR position('ACCESS_DENIED' in v_def) <> 0
       OR position('CONTRACT_NO_BOOKING' in v_def) <> 0 THEN
        RAISE EXCEPTION 'POSTCONDITION Q4 FAILED: expected exactly 3 uniform CONTRACT_NOT_FOUND raises and no ACCESS_DENIED / CONTRACT_NO_BOOKING';
    END IF;

    IF position('UNAUTHORIZED' in v_def) = 0
       OR position('UNAUTHORIZED' in v_def) > position('CONTRACT_NOT_FOUND' in v_def) THEN
        RAISE EXCEPTION 'POSTCONDITION Q5 FAILED: UNAUTHORIZED is no longer the first guard';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ROLLBACK (verbatim pre-change definition, captured live 2026-11-16 via
-- pg_get_functiondef(35781); uncomment and execute as the migration owner to
-- restore the original ordering; grants and oid are preserved by REPLACE)
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.accept_and_finalize_contract(p_contract_id_uuid uuid, p_correlation_id uuid DEFAULT NULL::uuid)
--  RETURNS jsonb
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'pg_catalog', 'public'
-- AS $function$
-- DECLARE
--     v_row                    logistics_schema.contracts%ROWTYPE;
--     v_caller                 UUID;
--     v_is_shipper             BOOLEAN;
--     v_is_transporter         BOOLEAN;
--     v_num_signatories        INTEGER;
--     v_tracking_ref           VARCHAR(50);
--     v_new_tracking_id        UUID;
--     v_first_signatory_count  INTEGER;
-- BEGIN
--     v_caller := auth.uid();
--     IF v_caller IS NULL THEN
--         RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
--     END IF;
--
--     SELECT * INTO v_row
--     FROM logistics_schema.contracts
--     WHERE id = p_contract_id_uuid AND is_deleted = FALSE
--     FOR UPDATE;
--
--     IF v_row.id IS NULL THEN
--         RAISE EXCEPTION 'CONTRACT_NOT_FOUND: contract % not found or deleted', p_contract_id_uuid;
--     END IF;
--
--     IF v_row.acceptance_status <> 'DRAFT' THEN
--         RAISE EXCEPTION 'CONTRACT_NOT_DRAFT: contract is in status %, cannot accept', v_row.acceptance_status;
--     END IF;
--
--     IF v_row.booking_id IS NULL THEN
--         RAISE EXCEPTION 'CONTRACT_NO_BOOKING: contract has no associated booking';
--     END IF;
--
--     SELECT EXISTS (
--         SELECT 1 FROM logistics_schema.bookings b
--         WHERE b.id = v_row.booking_id AND b.shipper_id = v_caller AND b.is_deleted = FALSE
--     ) INTO v_is_shipper;
--
--     SELECT EXISTS (
--         SELECT 1 FROM logistics_schema.bookings b
--         WHERE b.id = v_row.booking_id AND b.transporter_id = v_caller AND b.is_deleted = FALSE
--     ) INTO v_is_transporter;
--
--     IF NOT v_is_shipper AND NOT v_is_transporter THEN
--         RAISE EXCEPTION 'ACCESS_DENIED: caller is not a party to this contract''s booking';
--     END IF;
--
--     v_num_signatories := COALESCE(v_row.num_signatories, 0);
--
--     IF v_num_signatories = 0 THEN
--         IF v_is_shipper THEN
--             UPDATE logistics_schema.contracts
--             SET shipper_accepted_at = now(),
--                 shipper_accepted_version = 1,
--                 num_signatories = 1,
--                 updated_by = v_caller,
--                 updated_at = now()
--             WHERE id = p_contract_id_uuid AND is_deleted = FALSE
--             RETURNING * INTO v_row;
--         ELSIF v_is_transporter THEN
--             UPDATE logistics_schema.contracts
--             SET transporter_accepted_at = now(),
--                 transporter_accepted_version = 1,
--                 num_signatories = 1,
--                 updated_by = v_caller,
--                 updated_at = now()
--             WHERE id = p_contract_id_uuid AND is_deleted = FALSE
--             RETURNING * INTO v_row;
--         END IF;
--
--         RETURN jsonb_build_object(
--             'success', true,
--             'action', 'first_signature_recorded',
--             'contract_id', v_row.id::text,
--             'contract_acceptance_status', v_row.acceptance_status,
--             'num_signatories', 1,
--             'signatory_role', CASE WHEN v_is_shipper THEN 'SHIPPER' ELSE 'TRANSPORTER' END,
--             'message', 'First signature recorded. Awaiting second party.'
--         );
--
--     ELSIF v_num_signatories = 1 THEN
--         IF v_is_shipper AND v_row.shipper_accepted_at IS NOT NULL THEN
--             RETURN jsonb_build_object(
--                 'success', true,
--                 'action', 'signature_already_recorded',
--                 'contract_id', v_row.id::text,
--                 'contract_acceptance_status', v_row.acceptance_status,
--                 'num_signatories', 1,
--                 'signatory_role', 'SHIPPER',
--                 'message', 'Shipper signature already recorded. Waiting for transporter.',
--                 'is_final', false
--             );
--         END IF;
--
--         IF v_is_transporter AND v_row.transporter_accepted_at IS NOT NULL THEN
--             RETURN jsonb_build_object(
--                 'success', true,
--                 'action', 'signature_already_recorded',
--                 'contract_id', v_row.id::text,
--                 'contract_acceptance_status', v_row.acceptance_status,
--                 'num_signatories', 1,
--                 'signatory_role', 'TRANSPORTER',
--                 'message', 'Transporter signature already recorded. Waiting for shipper.',
--                 'is_final', false
--             );
--         END IF;
--
--         IF v_is_shipper THEN
--             UPDATE logistics_schema.contracts
--             SET shipper_accepted_at = now(),
--                 shipper_accepted_version = COALESCE(shipper_accepted_version, 1),
--                 num_signatories = 2,
--                 acceptance_status = 'ACTIVE',
--                 signed_at = now(),
--                 digital_signature_status = 'EXECUTED',
--                 updated_by = v_caller,
--                 updated_at = now()
--             WHERE id = p_contract_id_uuid AND is_deleted = FALSE
--             RETURNING * INTO v_row;
--         ELSIF v_is_transporter THEN
--             UPDATE logistics_schema.contracts
--             SET transporter_accepted_at = now(),
--                 transporter_accepted_version = COALESCE(transporter_accepted_version, 1),
--                 num_signatories = 2,
--                 acceptance_status = 'ACTIVE',
--                 signed_at = now(),
--                 digital_signature_status = 'EXECUTED',
--                 updated_by = v_caller,
--                 updated_at = now()
--             WHERE id = p_contract_id_uuid AND is_deleted = FALSE
--             RETURNING * INTO v_row;
--         END IF;
--
--         SELECT COUNT(*) INTO v_first_signatory_count
--         FROM logistics_schema.shipment_tracking_records
--         WHERE booking_id = v_row.booking_id AND is_deleted = FALSE;
--
--         IF v_first_signatory_count > 0 THEN
--             RETURN jsonb_build_object(
--                 'success', true,
--                 'action', 'contract_finalized_tracking_exists',
--                 'contract_id', v_row.id::text,
--                 'contract_acceptance_status', 'ACTIVE',
--                 'num_signatories', 2,
--                 'signed_at', v_row.signed_at::text,
--                 'message', 'Contract finalized. Tracking record already exists.',
--                 'is_final', true
--             );
--         END IF;
--
--         v_tracking_ref := 'TRK-' || to_char(now(), 'YYYYMMDD') || '-' || replace(split_part(gen_random_uuid()::text, '-', 1), '-', '')::varchar(12);
--
--         INSERT INTO logistics_schema.shipment_tracking_records (
--             tracking_ref, booking_id, contract_id, status, visibility_level,
--             activated_at, correlation_id, created_at, updated_at
--         ) VALUES (
--             v_tracking_ref, v_row.booking_id, p_contract_id_uuid,
--             'CREATED', 'RESTRICTED',
--             now(), p_correlation_id, now(), now()
--         ) RETURNING id INTO v_new_tracking_id;
--
--         INSERT INTO logistics_schema.tracking_events (
--             tracking_id, event_type, source, state_from, state_to, metadata,
--             event_timestamp, created_at
--         ) VALUES (
--             v_new_tracking_id, 'TRACKING_INITIALISED', 'SYSTEM',
--             NULL, 'CREATED',
--             jsonb_build_object(
--                 'booking_id', v_row.booking_id::text,
--                 'contract_id', p_contract_id_uuid::text,
--                 'trigger', 'CONTRACT_SIGNED_FINAL_SIGNATURE'
--             ),
--             now(), now()
--         );
--
--         RETURN jsonb_build_object(
--             'success', true,
--             'action', 'contract_finalized_with_tracking',
--             'contract_id', v_row.id::text,
--             'contract_acceptance_status', 'ACTIVE',
--             'num_signatories', 2,
--             'signed_at', v_row.signed_at::text,
--             'tracking_record_id', v_new_tracking_id::text,
--             'tracking_ref', v_tracking_ref,
--             'tracking_status', 'CREATED',
--             'message', 'Contract finalized and tracking initialized.'
--         );
--
--     ELSE
--         SELECT COUNT(*) INTO v_first_signatory_count
--         FROM logistics_schema.shipment_tracking_records
--         WHERE booking_id = v_row.booking_id AND is_deleted = FALSE;
--
--         IF v_first_signatory_count = 0 THEN
--             v_tracking_ref := 'TRK-' || to_char(now(), 'YYYYMMDD') || '-' || replace(split_part(gen_random_uuid()::text, '-', 1), '-', '')::varchar(12);
--
--             INSERT INTO logistics_schema.shipment_tracking_records (
--                 tracking_ref, booking_id, contract_id, status, visibility_level,
--                 activated_at, correlation_id, created_at, updated_at
--             ) VALUES (
--                 v_tracking_ref, v_row.booking_id, p_contract_id_uuid,
--                 'CREATED', 'RESTRICTED',
--                 now(), p_correlation_id, now(), now()
--             ) RETURNING id INTO v_new_tracking_id;
--
--             INSERT INTO logistics_schema.tracking_events (
--                 tracking_id, event_type, source, state_from, state_to, metadata,
--                 event_timestamp, created_at
--             ) VALUES (
--                 v_new_tracking_id, 'TRACKING_INITIALISED', 'SYSTEM',
--                 NULL, 'CREATED',
--                 jsonb_build_object(
--                     'booking_id', v_row.booking_id::text,
--                     'contract_id', p_contract_id_uuid::text,
--                     'trigger', 'CONTRACT_SIGNED_FINAL_SIGNATURE_RETRY'
--                 ),
--                 now(), now()
--             );
--         END IF;
--
--         RETURN jsonb_build_object(
--             'success', true,
--             'action', 'contract_already_finalized',
--             'contract_id', v_row.id::text,
--             'contract_acceptance_status', v_row.acceptance_status,
--             'num_signatories', v_num_signatories,
--             'signed_at', v_row.signed_at::text,
--             'message', 'Contract was already finalized. Result returned idempotently.',
--             'is_final', true
--         );
--     END IF;
-- END;
-- $function$;