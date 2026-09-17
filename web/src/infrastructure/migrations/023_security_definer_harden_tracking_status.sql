-- NexCargo Migration 023 — SECURITY DEFINER Hardening for Tracking Status Update (DEFECT-002)
-- Fixes critical vulnerability in public.atomic_tracking_status_update():
--   The function only checked p_caller_user_id IS NOT NULL, accepting a caller-supplied UUID as identity.
--   EXECUTE granted to 'authenticated'. Any user could invoke the function directly via .rpc()
--   and modify ANY tracking record's status without role or scope verification.
--
-- Fix: Derive identity from auth.uid(). Reject if NULL. Validate role + scope
--      inside the SECURITY DEFINER boundary. Preserve atomic transaction semantics.
--
-- Does NOT change:
-- - C7 mutation endpoint API routes
-- - Existing RLS policies
-- - Role/scope model established by HAO
-- - Business logic, state machine, tracking lifecycle

CREATE OR REPLACE FUNCTION public.atomic_tracking_status_update(
    p_tracking_id UUID,
    p_target_status VARCHAR(20),
    p_source_module VARCHAR(20) DEFAULT 'MOD-003',
    p_caller_user_id UUID DEFAULT NULL::uuid
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_caller            UUID;
    v_record            logistics_schema.shipment_tracking_records%ROWTYPE;
    v_current_state     VARCHAR(20);
    v_role              TEXT;
BEGIN
    -- Step 1: Derive identity from auth context, NOT caller-supplied parameter
    v_caller := auth.uid();

    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user session';
    END IF;

    -- Step 2: If caller-supplied ID was passed, verify it matches auth context
    IF p_caller_user_id IS NOT NULL AND p_caller_user_id <> v_caller THEN
        RAISE EXCEPTION 'FORBIDDEN: caller identity mismatch';
    END IF;

    -- Step 3: Verify target status is a known value
    IF p_target_status NOT IN ('CREATED','BOOKED','AWAITING_PICKUP','PICKUP_ACKNOWLEDGED',
                                'IN_TRANSIT','AT_BORDER','DELIVERED','COMPLETED','CANCELLED','DELAYED') THEN
        RAISE EXCEPTION 'INVALID_STATUS: % is not a valid tracking status', p_target_status;
    END IF;

    -- Step 4: Read current tracking record
    SELECT * INTO v_record
    FROM logistics_schema.shipment_tracking_records
    WHERE id = p_tracking_id AND is_deleted = FALSE;

    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'TRACKING_RECORD_NOT_FOUND: tracking % not found or deleted', p_tracking_id;
    END IF;

    v_current_state := v_record.status;

    -- Step 5: Resolve caller role
    SELECT pr.role INTO v_role
    FROM app.platform_roles pr
    WHERE pr.user_id = v_caller
    LIMIT 1;

    -- Step 6: Validate role + scope based on role hierarchy
    IF v_role = 'ADMIN' OR v_role = 'SUPER_ADMIN' THEN
        -- Full administrative authority
        NULL;
    ELSIF v_role = 'DISPATCHER' OR v_role = 'MODERATOR' THEN
        -- Platform operational/governance authority
        NULL;
    ELSIF v_role = 'TRANSPORTER' THEN
        -- Scoped to their own booking
        IF NOT EXISTS (
            SELECT 1 FROM logistics_schema.bookings b
            JOIN logistics_schema.shipment_tracking_records tr ON tr.booking_id = b.id
            WHERE tr.id = p_tracking_id AND b.transporter_id = v_caller AND b.is_deleted = FALSE
        ) THEN
            RAISE EXCEPTION 'FORBIDDEN: transporter cannot update another entity''s tracking';
        END IF;
    ELSE
        -- SHIPPER, DRIVER, unassigned, unknown — denied
        RAISE EXCEPTION 'FORBIDDEN: role ''%'' is not authorized for tracking status updates', COALESCE(v_role, 'unassigned');
    END IF;

    -- Step 7: Atomic status UPDATE + event INSERT within single DB transaction
    BEGIN
        UPDATE logistics_schema.shipment_tracking_records
        SET status = p_target_status,
            last_updated = NOW(),
            updated_at = NOW(),
            version = COALESCE(version, 1) + 1
        WHERE id = p_tracking_id
          AND is_deleted = FALSE;

        INSERT INTO logistics_schema.tracking_events (
            tracking_id,
            event_type,
            event_timestamp,
            source,
            state_from,
            state_to,
            metadata
        ) VALUES (
            p_tracking_id,
            'SHIPMENT_' || UPPER(p_target_status),
            NOW(),
            p_source_module,
            v_current_state,
            p_target_status,
            jsonb_build_object('caller_user_id', v_caller, 'previous_status', v_current_state)
        );

    EXCEPTION WHEN OTHERS THEN
        -- Implicit rollback on any error
        RAISE;
    END;

END;
$function$;
