-- NexCargo Migration 024 — C7 Final Corrective Implementation
-- Fixes:
--   DEFECT-003: atomic_tracking_status_update() enforces authoritative state-transition matrix
--   DEFECT-004: Dispatcher UPDATE restricted to delegated-Transporter scope

CREATE OR REPLACE FUNCTION public.atomic_tracking_status_update(
    p_tracking_id UUID,
    p_target_status VARCHAR(20),
    p_source_module VARCHAR(20) DEFAULT 'MOD-003',
    p_caller_user_id UUID DEFAULT NULL::uuid
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

    -- Resolve caller role from platform_roles
    SELECT pr.role INTO v_role
    FROM app.platform_roles pr
    WHERE pr.user_id = v_caller
    LIMIT 1;

    -- Validate role + scope based on role hierarchy
    IF v_role = 'ADMIN' OR v_role = 'SUPER_ADMIN' THEN
        NULL;
    ELSIF v_role = 'MODERATOR' THEN
        NULL;
    ELSIF v_role = 'DISPATCHER' THEN
        IF logistics_schema.transporterscope(v_caller) IS NULL THEN
            RAISE EXCEPTION 'FORBIDDEN: dispatcher must have assigned_transporter_id';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM logistics_schema.bookings b
            JOIN logistics_schema.shipment_tracking_records tr ON tr.booking_id = b.id
            JOIN app.platform_roles pd ON pd.user_id = v_caller
            WHERE tr.id = p_tracking_id AND b.transporter_id = pd.assigned_transporter_id AND b.is_deleted = FALSE
        ) THEN
            RAISE EXCEPTION 'FORBIDDEN: dispatcher cannot update another transporter''s tracking';
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
$$;

-- RLS FIX: Dispatcher UPDATE → delegated-Transporter scope
DROP POLICY IF EXISTS "Dispatcher updates tracking records" ON logistics_schema.shipment_tracking_records;

CREATE POLICY "Dispatcher Transporter-scope updates tracking"
  ON logistics_schema.shipment_tracking_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL));
