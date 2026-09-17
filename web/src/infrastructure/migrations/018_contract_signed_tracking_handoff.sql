-- NexCargo Migration 018 — Contract Signed → Tracking Initialization Atomic Handoff (C3 ↔ C7)
-- Authorized by: HAO-AUTH-WORKSTREAM-A-C3C7-HANDOFF
-- Purpose: Provide runtime contract acceptance/signing path with atomic tracking initialization
--          on final signature, using a single SECURITY DEFINER composite RPC function.
--
-- Owner: MOD-002 Booking & Contract Management + MOD-003 Tracking
-- Scope: C3/C7 cross-module boundary only. No other modules affected.
-- Does NOT modify confirm_booking_with_contract() (Migration 005).
-- Does NOT add BookingConfirmed→Tracking trigger.
-- Does NOT create new RLS policies.
-- Does NOT activate general EventBus/InMemoryEventEmitter.

-- ============================================================
-- SECTION 1: COMPOSITE SECURITY DEFINER FUNCTION
-- accept_and_finalize_contract()
-- ============================================================
-- Handles partial signing (first signatory) and final signing (second signatory) in one function.
-- When both parties have signed, transitions contract to ACTIVE and atomically creates:
--   1. A shipment_tracking_records row linked to the booking + contract
--   2. A TRACKING_INITIALISED event in tracking_events
--
-- All operations occur in a single transaction within the SECDEF function.
-- Idempotent: retrying the same signatory action produces correct results.

CREATE OR REPLACE FUNCTION logistics_schema.accept_and_finalize_contract(
    p_contract_id_uuid UUID,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, logistics_schema, public
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
    -- Skip PENDING_APPROVAL: per existing DB precedent, contracts go DRAFT→ACTIVE via signing.
    IF v_row.acceptance_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'CONTRACT_NOT_DRAFT: contract is in status %, cannot accept', v_row.acceptance_status;
    END IF;

    -- Step 4: Verify the contract has a valid booking relationship
    IF v_row.booking_id IS NULL THEN
        RAISE EXCEPTION 'CONTRACT_NO_BOOKING: contract has no associated booking';
    END IF;

    -- Step 5: Identify caller role relative to this contract
    -- Verify shipper_id is non-null and matches caller
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
        -- First signature
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

        -- Return first-signature result — no tracking initialization yet
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
        -- Verify this is the OTHER party signing (not duplicate of same party)
        IF v_is_shipper AND v_row.shipper_accepted_at IS NOT NULL THEN
            -- Shipper already signed — returning same signature is idempotent
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
            -- Transporter already signed — returning same signature is idempotent
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

        -- Step 9: Check if tracking already exists for this booking (idempotency guard)
        SELECT COUNT(*) INTO v_first_signatory_count
        FROM logistics_schema.shipment_tracking_records
        WHERE booking_id = v_row.booking_id AND is_deleted = FALSE;

        IF v_first_signatory_count > 0 THEN
            -- Tracking already exists — return success without re-creating
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

        -- Step 10: Atomic tracking initialization — same transaction
        -- Generate tracking reference
        v_tracking_ref := 'TRK-' || to_char(now(), 'YYYYMMDD') || '-' || upper(gen_random_uuid()::text->>'substring'::text);
        -- Simplified ref: timestamp + random hex suffix
        v_tracking_ref := 'TRK-' || to_char(now(), 'YYYYMMDD') || '-' || replace(split_part(gen_random_uuid()::text, '-', 1), '-', '')::varchar(12);

        INSERT INTO logistics_schema.shipment_tracking_records (
            tracking_ref, booking_id, contract_id, status, visibility_level,
            activated_at, correlation_id, created_at, updated_at
        ) VALUES (
            v_tracking_ref, v_row.booking_id, p_contract_id_uuid,
            'CREATED', 'RESTRICTED',
            now(), p_correlation_id, now(), now()
        ) RETURNING id INTO v_new_tracking_id;

        -- Step 11: Create initial tracking event (TRACKING_INITIALISED)
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

    -- Step 13: Already fully signed — concurrent retry protection
    ELSE
        -- Check if tracking was already created during a prior concurrent attempt
        SELECT COUNT(*) INTO v_first_signatory_count
        FROM logistics_schema.shipment_tracking_records
        WHERE booking_id = v_row.booking_id AND is_deleted = FALSE;

        IF v_first_signatory_count = 0 THEN
            -- Both parties signed but tracking not yet created — race condition resolved
            -- Retry the creation inline here
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

-- ============================================================
-- SECTION 2: EXECUTE PERMISSIONS
-- ============================================================

-- Follow established NexCargo SECDEF pattern: REVOKE PUBLIC, GRANT authenticated only
REVOKE EXECUTE ON FUNCTION logistics_schema.accept_and_finalize_contract(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION logistics_schema.accept_and_finalize_contract(UUID, UUID) TO authenticated;

