-- NexCargo Migration 019 — Correct ContractSigned RPC Schema Location (DEFECT-001 Remediation)
-- Authorized by: HAO-CORRECTIVE-DEFECT-001
-- Purpose: Move accept_and_finalize_contract() from logistics_schema → public for PostgREST RPC resolution.
--
-- Root cause: PostgREST only exposes functions in the 'public' schema via .rpc().
--             The application calls supabaseSession.rpc('accept_and_finalize_contract', ...)
--             which cannot resolve the logistics_schema deployment.
--
-- Does NOT modify migration 018. Does NOT change contract-signing logic.
-- Preserves identical behavior, idempotency, security, and atomicity of 018.

-- ============================================================
-- SECTION 1: PUBLIC-SCHEMA FUNCTION (PostgREST-callable)
-- ============================================================
-- Uses exact same logic as logistics_schema version but follows established
-- NexCargo SECDEF convention: search_path = pg_catalog, public (minimal).
-- All cross-schema table references explicitly qualified.

CREATE OR REPLACE FUNCTION public.accept_and_finalize_contract(
    p_contract_id_uuid UUID,
    p_correlation_id UUID DEFAULT NULL::uuid
)
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
    -- Step 1: Authenticate caller via auth.uid() inside SECURITY DEFINER context
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    -- Step 2: Lock the contract row for update
    SELECT * INTO v_row
    FROM logistics_schema.contracts
    WHERE id = p_contract_id_uuid AND is_deleted = FALSE
    FOR UPDATE;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'CONTRACT_NOT_FOUND: contract % not found or deleted', p_contract_id_uuid;
    END IF;

    -- Step 3: Validate current state — only DRAFT can be accepted
    IF v_row.acceptance_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'CONTRACT_NOT_DRAFT: contract is in status %, cannot accept', v_row.acceptance_status;
    END IF;

    -- Step 4: Verify the contract has a valid booking relationship
    IF v_row.booking_id IS NULL THEN
        RAISE EXCEPTION 'CONTRACT_NO_BOOKING: contract has no associated booking';
    END IF;

    -- Step 5: Identify caller role relative to this contract
    SELECT EXISTS (
        SELECT 1 FROM logistics_schema.bookings b
        WHERE b.id = v_row.booking_id AND b.shipper_id = v_caller AND b.is_deleted = FALSE
    ) INTO v_is_shipper;

    SELECT EXISTS (
        SELECT 1 FROM logistics_schema.bookings b
        WHERE b.id = v_row.booking_id AND b.transporter_id = v_caller AND b.is_deleted = FALSE
    ) INTO v_is_transporter;

    IF NOT v_is_shipper AND NOT v_is_transporter THEN
        RAISE EXCEPTION 'ACCESS_DENIED: caller is not a party to this contract''s booking';
    END IF;

    -- Step 6: Read current signatory count
    v_num_signatories := COALESCE(v_row.num_signatories, 0);

    -- Step 7: First signatory — record their acceptance
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

    -- Step 8: Final signatory — both parties now signed
    ELSIF v_num_signatories = 1 THEN
        -- Idempotency guard: same party signing twice
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

        -- Record the second signature
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

        -- Step 9: Idempotency guard for tracking
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

        -- Step 10: Atomic tracking initialization
        v_tracking_ref := 'TRK-' || to_char(now(), 'YYYYMMDD') || '-' || replace(split_part(gen_random_uuid()::text, '-', 1), '-', '')::varchar(12);

        INSERT INTO logistics_schema.shipment_tracking_records (
            tracking_ref, booking_id, contract_id, status, visibility_level,
            activated_at, correlation_id, created_at, updated_at
        ) VALUES (
            v_tracking_ref, v_row.booking_id, p_contract_id_uuid,
            'CREATED', 'RESTRICTED',
            now(), p_correlation_id, now(), now()
        ) RETURNING id INTO v_new_tracking_id;

        -- Step 11: Create initial tracking event
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

        -- Step 12: Return final result
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

    -- Step 13: Already fully signed (num_signatories >= 2)
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

-- Deny public/anon execution; grant only to authenticated users
REVOKE EXECUTE ON FUNCTION public.accept_and_finalize_contract(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_and_finalize_contract(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_and_finalize_contract(UUID, UUID) TO authenticated;

-- ============================================================
-- SECTION 2: RETIRE OBSOLETE LOGISTICS_SCHEMA VERSION
-- ============================================================
-- No triggers, views, or other functions depend on this name.
-- Only the HTTP route calls it via Supabase RPC — which resolves
-- from public schema. Safe to remove after public version is deployed.

DROP FUNCTION IF EXISTS logistics_schema.accept_and_finalize_contract(UUID, UUID);
