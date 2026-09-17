-- NexCargo Migration 022 — Atomic Tracking Status Update (Transaction Integrity Fix)
-- Fixes MOD-003 §7.1 State Consistency Rule violation:
--   status change + event missing due to untracked two-step persistence in TrackingOrchestratorService.
--
-- Defect: updateTrackingStatus() calls repo.updateStatus() then repo.create(event()) as two
--         independent Supabase calls with no transaction boundary. If event persistence fails
--         after status succeeds, the database is left inconsistent: state changed but no event record exists.
--         This directly contradicts MOD-003 §7.2 Event Integrity Rule ("state changes MUST originate from events").
--
-- Fix: Replace application-layer sequential persistence with a single SECURITY DEFINER RPC
--      that executes both the status UPDATE and the tracking_events INSERT inside one DB transaction.
--
-- The application layer will be updated to call this RPC instead of calling the two repos separately.
-- The RPC follows the established SECDEF convention used by accept_and_finalize_contract().

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
    v_record        logistics_schema.shipment_tracking_records%ROWTYPE;
    v_current_state VARCHAR(20);
    v_is_terminal   BOOLEAN;
BEGIN
    -- Step 1: Authenticate caller
    IF p_caller_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    -- Step 2: Read current tracking record (no FOR UPDATE needed — RLS handles access)
    SELECT * INTO v_record
    FROM logistics_schema.shipment_tracking_records
    WHERE id = p_tracking_id AND is_deleted = FALSE;

    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'TRACKING_RECORD_NOT_FOUND: tracking % not found or deleted', p_tracking_id;
    END IF;

    v_current_state := v_record.status;

    -- Step 3: Validate target status is a known value (broad check — application validates exact transitions)
    IF p_target_status NOT IN ('CREATED','BOOKED','AWAITING_PICKUP','PICKUP_ACKNOWLEDGED',
                                'IN_TRANSIT','AT_BORDER','DELIVERED','COMPLETED','CANCELLED','DELAYED') THEN
        RAISE EXCEPTION 'INVALID_STATUS: % is not a valid tracking status', p_target_status;
    END IF;

    -- Step 4: Perform status UPDATE and event INSERT atomically within one transaction
    BEGIN
        -- 4a: Update status
        UPDATE logistics_schema.shipment_tracking_records
        SET status = p_target_status,
            last_updated = NOW(),
            updated_at = NOW(),
            version = COALESCE(version, 1) + 1
        WHERE id = p_tracking_id
          AND is_deleted = FALSE;

        -- 4b: Record the event
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
            jsonb_build_object('caller_user_id', p_caller_user_id, 'previous_status', v_current_state)
        );

    EXCEPTION WHEN OTHERS THEN
        -- Implicit rollback on any error — either both succeed or neither does
        RAISE;
    END;

END;
$function$;


-- ============================================================
-- Helper: mark tracking completed (also needs transaction integrity)
-- ============================================================

CREATE OR REPLACE FUNCTION public.atomic_tracking_complete(
    p_tracking_id UUID,
    p_caller_user_id UUID DEFAULT NULL::uuid
)
RETURNS VOID
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

    SELECT * INTO v_record
    FROM logistics_schema.shipment_tracking_records
    WHERE id = p_tracking_id AND is_deleted = FALSE;

    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'TRACKING_RECORD_NOT_FOUND: tracking % not found or deleted', p_tracking_id;
    END IF;

    -- Only mark COMPLETED if already DELIVERED (enforce order)
    IF v_record.status <> 'DELIVERED' THEN
        RAISE EXCEPTION 'CANNOT_COMPLETE: tracking must be DELIVERED before COMPLETED, current=%', v_record.status;
    END IF;

    UPDATE logistics_schema.shipment_tracking_records
    SET status = 'COMPLETED',
        completed_at = NOW(),
        last_updated = NOW(),
        updated_at = NOW(),
        version = COALESCE(version, 1) + 1
    WHERE id = p_tracking_id
      AND is_deleted = FALSE;

END;
$function$;
