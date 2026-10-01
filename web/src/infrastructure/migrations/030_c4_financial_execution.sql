-- NexCargo Migration 030 — C4 Payment → Financial Execution Operational
-- Authorized by: HAO-C4 Authorization
-- Purpose: Make payment and financial execution genuinely operational.
--          Completes escrow lifecycle, implements payment initiation,
--          provider abstraction, settlement execution, and financial ledger.
--
-- Authority: MOD-005 §4.2 (Payment Intent), §5.5 (Financial Flow State Machine)
--            MOD-013 §4.3 (SettlementRequestObject), §4.4 (Ledger Mirror)
--            ESS-001F §4 (Payment Channels), §6 (Settlement Engine), §7 (Ledger Immutability)
--            ESS-006 (Security & Compliance)
--
-- Owner: MOD-005 Financial Operations + MOD-013 Settlement & Ledger
-- Scope: C4 — Payment → Financial Execution Operational
-- Does NOT implement production external provider onboarding.

-- ============================================================
-- SECTION 1: ESCROW STATE MACHINE — CHECK CONSTRAINT
-- ============================================================
-- Adds CHECK constraint to enforce valid escrow state transitions.
-- States per EscrowState enum: PENDING_CREATION, FUNDS_INITIATED,
-- FUNDS_CONFIRMED, FUNDS_LOCKED, RELEASE_ELIGIBLE, RELEASED,
-- PARTIAL_RELEASE, DISPUTE_HOLD, ESCROW_CLOSED.

DO $$ BEGIN
  -- Only add constraint if it does not already exist (idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_escrow_valid_state'
      AND conrelid = 'financial_schema.escrow_records'::regclass
  ) THEN
    ALTER TABLE financial_schema.escrow_records
      ADD CONSTRAINT chk_escrow_valid_state
      CHECK (state IN (
        'PENDING_CREATION',
        'FUNDS_INITIATED',
        'FUNDS_CONFIRMED',
        'FUNDS_LOCKED',
        'RELEASE_ELIGIBLE',
        'RELEASED',
        'PARTIAL_RELEASE',
        'DISPUTE_HOLD',
        'ESCROW_CLOSED'
      ));
  END IF;
END $$;

-- ============================================================
-- SECTION 2: PAYMENT INTENT STATUS CHECK — ENSURE COMPLETE
-- ============================================================
-- Migration 006 already defines the CHECK constraint but verify completeness.
-- Statuses: INITIATED, PENDING, CONFIRMED, FAILED, REFUNDED.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_payment_intent_valid_status'
      AND conrelid = 'financial_schema.payment_intents'::regclass
  ) THEN
    ALTER TABLE financial_schema.payment_intents
      ADD CONSTRAINT chk_payment_intent_valid_status
      CHECK (status IN ('INITIATED', 'PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED'));
  END IF;
END $$;

-- ============================================================
-- SECTION 3: PLATFORM FEE CONFIGURATION
-- ============================================================
-- Platform fee/commission is transporter-side, calculated from authoritative data.
-- Default: 5% of transaction amount (configurable via settings).
-- No client-supplied or moderator-modifiable commission allowed.

CREATE TABLE IF NOT EXISTS financial_schema.platform_fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) NOT NULL UNIQUE DEFAULT 'default_platform_fee',
  fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00 CHECK (fee_percentage >= 0 AND fee_percentage <= 50),
  currency VARCHAR(3) NOT NULL DEFAULT 'MZN',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default platform fee config
INSERT INTO financial_schema.platform_fee_config (key, fee_percentage, currency, created_by)
SELECT 'default_platform_fee', 5.00, 'MZN', COALESCE(NULLIF::uuid, gen_random_uuid())
FROM (SELECT current_setting('request.jwt.claims', true)::json->>'sub' AS uid) subq
WHERE NOT EXISTS (
  SELECT 1 FROM financial_schema.platform_fee_config WHERE key = 'default_platform_fee' AND is_deleted = FALSE
)
LIMIT 1
ON CONFLICT (key) DO NOTHING;

-- Fallback seed if no authenticated user context
INSERT INTO financial_schema.platform_fee_config (key, fee_percentage, currency, created_by)
VALUES ('default_platform_fee', 5.00, 'MZN', gen_random_uuid())
WHERE NOT EXISTS (
  SELECT 1 FROM financial_schema.platform_fee_config WHERE key = 'default_platform_fee' AND is_deleted = FALSE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_platform_fee_config_key ON financial_schema.platform_fee_config(key, is_deleted);

-- ============================================================
-- SECTION 4: SECDEF FUNCTION — advance_escrow_state()
-- ============================================================
-- Validates and executes escrow state transitions atomically.
-- Enforces legal transitions only. Prevents client-side arbitrary changes.
-- Used by: webhook handlers, settlement execution, internal services.

DROP FUNCTION IF EXISTS public.advance_escrow_state(UUID, VARCHAR, UUID);

CREATE OR REPLACE FUNCTION public.advance_escrow_state(
    p_escrow_id UUID,
    p_target_state VARCHAR,
    p_correlation_id UUID DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_row financial_schema.escrow_records%ROWTYPE;
    v_caller UUID;
    v_new_version INTEGER;
BEGIN
    -- Step 1: Authenticate caller
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    -- Step 2: Lock escrow row for update
    SELECT * INTO v_row
    FROM financial_schema.escrow_records
    WHERE id = p_escrow_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'ESCROW_NOT_FOUND: escrow % not found or deleted', p_escrow_id;
    END IF;

    -- Step 3: Validate target state
    IF p_target_state NOT IN (
        'PENDING_CREATION', 'FUNDS_INITIATED', 'FUNDS_CONFIRMED',
        'FUNDS_LOCKED', 'RELEASE_ELIGIBLE', 'RELEASED',
        'PARTIAL_RELEASE', 'DISPUTE_HOLD', 'ESCROW_CLOSED'
    ) THEN
        RAISE EXCEPTION 'INVALID_TARGET_STATE: % is not a valid escrow state', p_target_state;
    END IF;

    -- Step 4: Validate transition from current state
    -- Legal transitions defined per ESS-001F §5.5 Financial Flow State Machine
    CASE v_row.state
        WHEN 'PENDING_CREATION' THEN
            IF p_target_state NOT IN ('FUNDS_INITIATED') THEN
                RAISE EXCEPTION 'INVALID_TRANSITION: cannot go from % to %', v_row.state, p_target_state;
            END IF;
        WHEN 'FUNDS_INITIATED' THEN
            IF p_target_state NOT IN ('FUNDS_CONFIRMED', 'FAILED') THEN
                RAISE EXCEPTION 'INVALID_TRANSITION: cannot go from % to %', v_row.state, p_target_state;
            END IF;
        WHEN 'FUNDS_CONFIRMED' THEN
            IF p_target_state NOT IN ('FUNDS_LOCKED') THEN
                RAISE EXCEPTION 'INVALID_TRANSITION: cannot go from % to %', v_row.state, p_target_state;
            END IF;
        WHEN 'FUNDS_LOCKED' THEN
            IF p_target_state NOT IN ('RELEASE_ELIGIBLE', 'DISPUTE_HOLD') THEN
                RAISE EXCEPTION 'INVALID_TRANSITION: cannot go from % to %', v_row.state, p_target_state;
            END IF;
        WHEN 'RELEASE_ELIGIBLE' THEN
            IF p_target_state NOT IN ('RELEASED', 'PARTIAL_RELEASE') THEN
                RAISE EXCEPTION 'INVALID_TRANSITION: cannot go from % to %', v_row.state, p_target_state;
            END IF;
        WHEN 'DISPUTE_HOLD' THEN
            IF p_target_state NOT IN ('RELEASED', 'PARTIAL_RELEASE', 'ESCROW_CLOSED') THEN
                RAISE EXCEPTION 'INVALID_TRANSITION: cannot go from % to %', v_row.state, p_target_state;
            END IF;
        WHEN 'RELEASED', 'ESCROW_CLOSED' THEN
            RAISE EXCEPTION 'FINAL_STATE_REACHED: escrow is in terminal state %, cannot transition to %', v_row.state, p_target_state;
        ELSE
            RAISE EXCEPTION 'UNKNOWN_STATE: escrow is in unexpected state %', v_row.state;
    END CASE;

    -- Idempotency guard: same state requested?
    IF v_row.state = p_target_state THEN
        RETURN jsonb_build_object(
            'success', true,
            'action', 'escrow_state_already',
            'escrow_id', v_row.id::text,
            'state', p_target_state,
            'message', 'Escrow already in target state. Returned idempotently.'
        );
    END IF;

    -- Step 5: Advance state with optimistic concurrency
    v_new_version := COALESCE(v_row.version, 1) + 1;

    UPDATE financial_schema.escrow_records
    SET state = p_target_state,
        updated_at = now(),
        version = v_new_version,
        updated_by = v_caller,
        correlation_id = p_correlation_id
    WHERE id = p_escrow_id
      AND version = v_row.version
      AND is_deleted = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'VERSION_CONFLICT: escrow version mismatch, retry required';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'escrow_state_advanced',
        'escrow_id', v_row.id::text,
        'state_from', v_row.state,
        'state_to', p_target_state,
        'new_version', v_new_version,
        'updated_at', now()::text
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.advance_escrow_state(UUID, VARCHAR, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.advance_escrow_state(UUID, VARCHAR, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_escrow_state(UUID, VARCHAR, UUID) TO authenticated;

-- ============================================================
-- SECTION 5: SECDEF FUNCTION — confirm_payment_via_webhook()
-- ============================================================
-- Processes payment provider webhook callback.
-- Updates payment intent status and triggers escrow state advancement.
-- Idempotent: duplicate webhooks produce no duplicate financial effects.

DROP FUNCTION IF EXISTS public.confirm_payment_via_webhook(UUID, VARCHAR, VARCHAR, UUID);

CREATE OR REPLACE FUNCTION public.confirm_payment_via_webhook(
    p_payment_intent_id UUID,
    p_provider_reference VARCHAR,
    p_callback_status VARCHAR,
    p_correlation_id UUID DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_intent financial_schema.payment_intents%ROWTYPE;
    v_escrow financial_schema.escrow_records%ROWTYPE;
    v_caller UUID;
    v_new_version INTEGER;
BEGIN
    -- Step 1: Authenticate
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    -- Step 2: Lock payment intent
    SELECT * INTO v_intent
    FROM financial_schema.payment_intents
    WHERE id = p_payment_intent_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_intent.id IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND: payment intent % not found', p_payment_intent_id;
    END IF;

    -- Idempotency: skip if already confirmed
    IF v_intent.status = 'CONFIRMED' THEN
        RETURN jsonb_build_object(
            'success', true,
            'action', 'payment_already_confirmed',
            'payment_intent_id', v_intent.id::text,
            'status', 'CONFIRMED',
            'message', 'Payment already confirmed. Idempotent replay ignored.'
        );
    END IF;

    -- Step 3: Handle failure status
    IF p_callback_status IN ('FAILED', 'CANCELLED', 'REJECTED') THEN
        v_new_version := COALESCE(v_intent.version, 1) + 1;
        UPDATE financial_schema.payment_intents
        SET status = 'FAILED',
            failure_reason = COALESCE(p_callback_status, 'Provider reported failure'),
            updated_at = now(),
            version = v_new_version,
            updated_by = v_caller
        WHERE id = p_payment_intent_id AND is_deleted = FALSE;

        -- Transition escrow back to PENDING_CREATION for retry
        PERFORM public.advance_escrow_state(v_intent.escrow_id, 'PENDING_CREATION', p_correlation_id);

        RETURN jsonb_build_object(
            'success', true,
            'action', 'payment_failed',
            'payment_intent_id', v_intent.id::text,
            'status', 'FAILED',
            'provider_reference', p_provider_reference,
            'message', 'Payment failed per provider callback'
        );
    END IF;

    -- Step 4: Process success/confirmation
    IF p_callback_status NOT IN ('COMPLETED', 'CONFIRMED', 'SUCCESS') THEN
        RAISE EXCEPTION 'INVALID_CALLBACK_STATUS: % is not a valid payment callback status', p_callback_status;
    END IF;

    -- Update payment intent
    v_new_version := COALESCE(v_intent.version, 1) + 1;
    UPDATE financial_schema.payment_intents
    SET status = 'CONFIRMED',
        provider_reference_id = COALESCE(p_provider_reference, provider_reference_id),
        external_transaction_ref = COALESCE(p_provider_reference, external_transaction_ref),
        updated_at = now(),
        version = v_new_version,
        updated_by = v_caller
    WHERE id = p_payment_intent_id AND is_deleted = FALSE;

    -- Step 5: Advance escrow through FUNDS_INITIATED → FUNDS_CONFIRMED → FUNDS_LOCKED
    -- First: PENDING_CREATION/FUNDS_INITIATED → FUNDS_CONFIRMED
    -- Then: FUNDS_CONFIRMED → FUNDS_LOCKED
    -- Each step validates the transition chain.

    -- If escrow is still in PENDING_CREATION, advance to FUNDS_INITIATED first
    SELECT * INTO v_escrow
    FROM financial_schema.escrow_records
    WHERE id = v_intent.escrow_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_escrow.state = 'PENDING_CREATION' THEN
        PERFORM public.advance_escrow_state(v_intent.escrow_id, 'FUNDS_INITIATED', p_correlation_id);
    END IF;

    -- Now advance to FUNDS_CONFIRMED
    PERFORM public.advance_escrow_state(v_intent.escrow_id, 'FUNDS_CONFIRMED', p_correlation_id);

    -- Then to FUNDS_LOCKED
    PERFORM public.advance_escrow_state(v_intent.escrow_id, 'FUNDS_LOCKED', p_correlation_id);

    -- Step 6: Create double-entry ledger entries for payment confirmation
    -- Debit: Shipper payment account → Escrow holding
    -- Credit: Escrow holding → Available for transporter payout
    INSERT INTO financial_schema.financial_ledger_entries (
        transaction_reference, entry_sequence, debit_credit_type,
        amount, currency, source, destination, entry_type,
        reconciliation_status, created_by, correlation_id
    ) VALUES (
        'TXN-PAY-' || p_payment_intent_id::text, 1, 'DEBIT',
        v_intent.amount, v_intent.currency,
        'SHIPPER_PAYMENT_' || v_intent.payment_method,
        'ESCROW_HOLD_' || v_intent.escrow_id::text,
        'PAYMENT', 'ALIGNED',
        v_caller, p_correlation_id
    ), (
        'TXN-PAY-' || p_payment_intent_id::text, 2, 'CREDIT',
        v_intent.amount, v_intent.currency,
        'ESCROW_HOLD_' || v_intent.escrow_id::text,
        'AVAILABLE_FUNDS_' || v_intent.escrow_id::text,
        'PAYMENT', 'ALIGNED',
        v_caller, p_correlation_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'action', 'payment_confirmed_and_escrow_locked',
        'payment_intent_id', v_intent.id::text,
        'escrow_id', v_intent.escrow_id::text,
        'escrow_state', 'FUNDS_LOCKED',
        'provider_reference', p_provider_reference,
        'amount', v_intent.amount,
        'currency', v_intent.currency,
        'ledger_entries_created', 2,
        'message', 'Payment confirmed. Escrow locked. Double-entry ledger recorded.'
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.confirm_payment_via_webhook(UUID, VARCHAR, VARCHAR, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_payment_via_webhook(UUID, VARCHAR, VARCHAR, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_via_webhook(UUID, VARCHAR, VARCHAR, UUID) TO authenticated;

-- ============================================================
-- SECTION 6: SECDEF FUNCTION — execute_settlement()
-- ============================================================
-- Executes a settlement request: calculates fees, creates payout records,
-- generates immutable ledger entries, advances escrow state.
-- Uses authoritative amounts from escrow/contract — never client input.

DROP FUNCTION IF EXISTS public.execute_settlement(UUID, UUID);

CREATE OR REPLACE FUNCTION public.execute_settlement(
    p_settlement_id UUID,
    p_correlation_id UUID DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_settlement financial_schema.settlement_requests%ROWTYPE;
    v_escrow financial_schema.escrow_records%ROWTYPE;
    v_contract logistics_schema.contracts%ROWTYPE;
    v_fee_config financial_schema.platform_fee_config%ROWTYPE;
    v_platform_fee DECIMAL(12,2);
    v_transporter_payout DECIMAL(12,2);
    v_caller UUID;
    v_txn_ref TEXT;
    v_new_version INTEGER;
BEGIN
    -- Step 1: Authenticate
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    -- Step 2: Lock settlement request
    SELECT * INTO v_settlement
    FROM financial_schema.settlement_requests
    WHERE id = p_settlement_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_settlement.id IS NULL THEN
        RAISE EXCEPTION 'SETTLEMENT_NOT_FOUND: settlement request % not found', p_settlement_id;
    END IF;

    -- Validate approval status — ONLY APPROVED settlements may execute.
    -- PENDING must be explicitly approved before execution.
    -- This prevents unauthorized or premature settlement execution.
    IF v_settlement.approval_status <> 'APPROVED' THEN
        RAISE EXCEPTION 'SETTLEMENT_NOT_APPROVED: settlement request % is in status %, must be APPROVED before execution', p_settlement_id, v_settlement.approval_status;
    END IF;

    -- Step 3: Lock escrow record
    SELECT * INTO v_escrow
    FROM financial_schema.escrow_records
    WHERE id = v_settlement.escrow_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_escrow.id IS NULL THEN
        RAISE EXCEPTION 'ESCROW_NOT_FOUND: escrow % not found', v_settlement.escrow_id;
    END IF;

    -- Step 4: Use AUTHORITY amount from escrow — NEVER trust client input
    -- The settlement_amount from the request is advisory; the authoritative
    -- available amount comes from the escrow record.
    DECLARE
        v_authoritative_amount DECIMAL(12,2);
    BEGIN
        -- For FULL settlement, use full escrow amount
        -- For MILESTONE/REFUND, validate against requested amount
        IF v_settlement.settlement_type = 'FULL' THEN
            v_authoritative_amount := v_escrow.amount;
        ELSE
            -- Validate that requested amount does not exceed escrow amount
            IF v_settlement.settlement_amount > v_escrow.amount THEN
                RAISE EXCEPTION 'SETTLEMENT_EXCEEDS_ESCROW: requested % exceeds escrow amount %',
                    v_settlement.settlement_amount, v_escrow.amount;
            END IF;
            v_authoritative_amount := v_settlement.settlement_amount;
        END IF;
    END;

    -- Step 5: Calculate platform fee from authoritative amount
    -- Fee is percentage-based, configured in platform_fee_config
    SELECT * INTO v_fee_config
    FROM financial_schema.platform_fee_config
    WHERE key = 'default_platform_fee' AND is_deleted = FALSE
    ORDER BY effective_from DESC
    LIMIT 1;

    v_platform_fee := ROUND(v_authoritative_amount * COALESCE(v_fee_config.fee_percentage, 5.00) / 100, 2);
    v_transporter_payout := v_authoritative_amount - v_platform_fee;

    -- Ensure payout is non-negative
    IF v_transporter_payout < 0 THEN
        RAISE EXCEPTION 'NEGATIVE_PAYOUT: calculated payout is negative after fees';
    END IF;

    -- Step 6: Generate unique transaction reference
    v_txn_ref := 'TXN-STL-' || p_settlement_id::text;

    -- Step 7: Create immutable double-entry ledger entries
    -- Entry 1 (DEBIT): Available funds → Platform fee account
    -- Entry 2 (CREDIT): Platform fee account → Revenue
    -- Entry 3 (DEBIT): Available funds → Transporter payout account
    -- Entry 4 (CREDIT): Transporter payout account → Transporter payable
    INSERT INTO financial_schema.financial_ledger_entries (
        transaction_reference, entry_sequence, debit_credit_type,
        amount, currency, source, destination, entry_type,
        reconciliation_status, created_by, correlation_id
    ) VALUES
    (v_txn_ref, 1, 'DEBIT', v_platform_fee, v_escrow.currency,
     'AVAILABLE_FUNDS_' || v_escrow.id::text, 'PLATFORM_FEE_ACCOUNT', 'FEE',
     'ALIGNED', v_caller, p_correlation_id),
    (v_txn_ref, 2, 'CREDIT', v_platform_fee, v_escrow.currency,
     'PLATFORM_FEE_ACCOUNT', 'PLATFORM_REVENUE_' || v_escrow.currency, 'FEE',
     'ALIGNED', v_caller, p_correlation_id),
    (v_txn_ref, 3, 'DEBIT', v_transporter_payout, v_escrow.currency,
     'AVAILABLE_FUNDS_' || v_escrow.id::text, 'TRANSPORTER_PAYABLE_' || v_escrow.id::text, 'SETTLEMENT',
     'ALIGNED', v_caller, p_correlation_id),
    (v_txn_ref, 4, 'CREDIT', v_transporter_payout, v_escrow.currency,
     'TRANSPORTER_PAYABLE_' || v_escrow.id::text, 'EXTERNAL_SETTLEMENT_' || v_escrow.currency, 'SETTLEMENT',
     'ALIGNED', v_caller, p_correlation_id);

    -- Step 8: Update settlement request to EXECUTED
    v_new_version := COALESCE(v_settlement.version, 1) + 1;
    UPDATE financial_schema.settlement_requests
    SET approval_status = 'EXECUTED',
        updated_at = now(),
        version = v_new_version,
        updated_by = v_caller
    WHERE id = p_settlement_id AND is_deleted = FALSE;

    -- Step 9: Advance escrow state
    CASE v_settlement.settlement_type
        WHEN 'FULL' THEN
            PERFORM public.advance_escrow_state(v_escrow.id, 'RELEASED', p_correlation_id);
        WHEN 'MILESTONE', 'REFUND' THEN
            PERFORM public.advance_escrow_state(v_escrow.id, 'PARTIAL_RELEASE', p_correlation_id);
        ELSE
            PERFORM public.advance_escrow_state(v_escrow.id, 'RELEASED', p_correlation_id);
    END CASE;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'settlement_executed',
        'settlement_id', v_settlement.id::text,
        'escrow_id', v_escrow.id::text,
        'authoritative_amount', v_authoritative_amount,
        'platform_fee', v_platform_fee,
        'transporter_payout', v_transporter_payout,
        'currency', v_escrow.currency,
        'fee_percentage', COALESCE(v_fee_config.fee_percentage, 5.00),
        'escrow_state_after', CASE
            WHEN v_settlement.settlement_type = 'FULL' THEN 'RELEASED'
            ELSE 'PARTIAL_RELEASE'
        END,
        'transaction_reference', v_txn_ref,
        'ledger_entries_created', 4,
        'message', 'Settlement executed. Fees calculated. Ledger entries created. Escrow state advanced.'
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.execute_settlement(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_settlement(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_settlement(UUID, UUID) TO authenticated;

-- ============================================================
-- SECTION 6-B: SECDEF FUNCTION — approve_settlement()
-- ============================================================
-- Authorizes a PENDING settlement request for execution.
-- Only authenticated users with SUPER_ADMIN role may approve.
-- This is the ONLY path from PENDING → APPROVED.
-- Client input cannot manufacture approval.

DROP FUNCTION IF EXISTS public.approve_settlement(UUID, UUID);

CREATE OR REPLACE FUNCTION public.approve_settlement(
    p_settlement_id UUID,
    p_correlation_id UUID DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_settlement financial_schema.settlement_requests%ROWTYPE;
    v_caller UUID;
    v_user_role TEXT;
    v_new_version INTEGER;
BEGIN
    -- Step 1: Authenticate
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    -- Step 2: Verify caller has SUPER_ADMIN role — only Super Admins may approve settlements
    v_user_role := (auth.jwt()->>'role')::text;
    IF v_user_role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ACCESS_DENIED_APPROVAL: only SUPER_ADMIN may approve settlement requests';
    END IF;

    -- Step 3: Lock settlement request
    SELECT * INTO v_settlement
    FROM financial_schema.settlement_requests
    WHERE id = p_settlement_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_settlement.id IS NULL THEN
        RAISE EXCEPTION 'SETTLEMENT_NOT_FOUND: settlement request % not found', p_settlement_id;
    END IF;

    -- Idempotency: already approved?
    IF v_settlement.approval_status = 'APPROVED' THEN
        RETURN jsonb_build_object(
            'success', true,
            'action', 'settlement_already_approved',
            'settlement_id', v_settlement.id::text,
            'approvalStatus', 'APPROVED',
            'message', 'Settlement already approved. Returned idempotently.'
        );
    END IF;

    -- Only PENDING settlements can be approved
    IF v_settlement.approval_status <> 'PENDING' THEN
        RAISE EXCEPTION 'INVALID_APPROVAL_TARGET: settlement is in status %, cannot approve', v_settlement.approval_status;
    END IF;

    -- Step 4: Approve settlement
    v_new_version := COALESCE(v_settlement.version, 1) + 1;
    UPDATE financial_schema.settlement_requests
    SET approval_status = 'APPROVED',
        updated_at = now(),
        version = v_new_version,
        updated_by = v_caller
    WHERE id = p_settlement_id AND is_deleted = FALSE;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'settlement_approved',
        'settlement_id', v_settlement.id::text,
        'approvalStatus', 'APPROVED',
        'approvedBy', v_caller::text,
        'newVersion', v_new_version,
        'message', 'Settlement approved. Ready for execution.'
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.approve_settlement(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_settlement(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_settlement(UUID, UUID) TO authenticated;

-- ============================================================
-- SECTION 7: SECDEF FUNCTION — initiate_payment_intent()
-- ============================================================
-- Creates a payment intent tied to an escrow record.
-- Derives amount/currency from escrow (authoritative).
-- Generates idempotency key. Selects provider adapter.

DROP FUNCTION IF EXISTS public.initiate_payment_intent(UUID, VARCHAR, UUID);

CREATE OR REPLACE FUNCTION public.initiate_payment_intent(
    p_escrow_id UUID,
    p_payment_method VARCHAR,
    p_correlation_id UUID DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_escrow financial_schema.escrow_records%ROWTYPE;
    v_existing financial_schema.payment_intents%ROWTYPE;
    v_caller UUID;
    v_intent_id UUID;
    v_idempotency_key TEXT;
    v_new_version INTEGER;
BEGIN
    -- Step 1: Authenticate
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    -- Step 2: Validate escrow exists and is in correct state
    SELECT * INTO v_escrow
    FROM financial_schema.escrow_records
    WHERE id = p_escrow_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_escrow.id IS NULL THEN
        RAISE EXCEPTION 'ESCROW_NOT_FOUND: escrow % not found', p_escrow_id;
    END IF;

    -- Escrow must be in PENDING_CREATION or FUNDS_INITIATED to accept new payment
    IF v_escrow.state NOT IN ('PENDING_CREATION', 'FUNDS_INITIATED') THEN
        RAISE EXCEPTION 'ESCROW_NOT_READY: escrow is in state %, cannot initiate new payment', v_escrow.state;
    END IF;

    -- Step 3: Check for existing pending/active payment intent (idempotency)
    SELECT * INTO v_existing
    FROM financial_schema.payment_intents
    WHERE escrow_id = p_escrow_id
      AND status IN ('INITIATED', 'PENDING')
      AND is_deleted = FALSE
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'action', 'existing_payment_intent',
            'payment_intent_id', v_existing.id::text,
            'status', v_existing.status,
            'message', 'Active payment intent already exists for this escrow.'
        );
    END IF;

    -- Step 4: Validate payment method
    IF p_payment_method NOT IN ('MPESA', 'MKESH', 'EMOLA', 'CARD', 'PAYPAL', 'BANK_TRANSFER') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: % is not supported', p_payment_method;
    END IF;

    -- Step 5: Generate idempotency key
    v_idempotency_key := 'IDEMP-' || p_escrow_id::text || '-' || p_payment_method || '-' || replace(now()::text, ':', '-');

    -- Step 6: Create payment intent with authoritative amount from escrow
    -- AUTHORITY: derived from escrow, NOT client input
    INSERT INTO financial_schema.payment_intents (
        escrow_id, amount, currency, payment_method, status,
        idempotency_key, created_by, correlation_id
    ) VALUES (
        p_escrow_id,
        v_escrow.amount,
        v_escrow.currency,
        p_payment_method,
        'INITIATED',
        v_idempotency_key,
        v_caller,
        p_correlation_id
    ) RETURNING id INTO v_intent_id;

    -- Step 7: Advance escrow to FUNDS_INITIATED
    v_new_version := COALESCE(v_escrow.version, 1) + 1;
    UPDATE financial_schema.escrow_records
    SET state = 'FUNDS_INITIATED',
        updated_at = now(),
        version = v_new_version,
        updated_by = v_caller
    WHERE id = p_escrow_id AND is_deleted = FALSE;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'payment_intent_created',
        'payment_intent_id', v_intent_id::text,
        'escrow_id', p_escrow_id::text,
        'amount', v_escrow.amount,
        'currency', v_escrow.currency,
        'payment_method', p_payment_method,
        'status', 'INITIATED',
        'idempotency_key', v_idempotency_key,
        'message', 'Payment intent created. Escrow advanced to FUNDS_INITIATED.'
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.initiate_payment_intent(UUID, VARCHAR, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.initiate_payment_intent(UUID, VARCHAR, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.initiate_payment_intent(UUID, VARCHAR, UUID) TO authenticated;

-- ============================================================
-- SECTION 8: SECDEF FUNCTION — get_escrow_with_details()
-- ============================================================
-- Helper view for API clients to query escrow with related contract/payment info.

DROP FUNCTION IF EXISTS public.get_escrow_with_details(UUID);

CREATE OR REPLACE FUNCTION public.get_escrow_with_details(
    p_escrow_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    result jsonb;
BEGIN
    WITH escrow_data AS (
        SELECT
            e.id AS escrow_id,
            e.contract_id,
            e.amount,
            e.currency,
            e.state,
            e.payment_method,
            e.external_transaction_ref,
            e.bank_confirmation_status,
            e.created_by,
            e.updated_by,
            e.correlation_id,
            e.version,
            e.created_at,
            e.updated_at
        FROM financial_schema.escrow_records e
        WHERE e.id = p_escrow_id AND e.is_deleted = FALSE
    ),
    contract_data AS (
        SELECT
            c.id AS contract_id,
            c.booking_id,
            c.acceptance_status,
            c.base_amount,
            c.currency AS contract_currency
        FROM logistics_schema.contracts c
        JOIN escrow_data ed ON c.id = ed.contract_id
        WHERE c.is_deleted = FALSE
    ),
    booking_data AS (
        SELECT
            b.id AS booking_id,
            b.shipper_id,
            b.transporter_id,
            b.status AS booking_status
        FROM logistics_schema.bookings b
        JOIN contract_data cd ON b.id = cd.booking_id
        WHERE b.is_deleted = FALSE
    ),
    payment_intents AS (
        SELECT json_agg(
            jsonb_build_object(
                'paymentIntentId', pi.id::text,
                'amount', pi.amount,
                'currency', pi.currency,
                'status', pi.status,
                'paymentMethod', pi.payment_method,
                'providerReferenceId', pi.provider_reference_id,
                'createdAt', pi.created_at
            )
        )
        FROM financial_schema.payment_intents pi
        JOIN escrow_data ed ON pi.escrow_id = ed.escrow_id
        WHERE pi.is_deleted = FALSE
    ),
    settlement_reqs AS (
        SELECT json_agg(
            jsonb_build_object(
                'settlementId', sr.id::text,
                'settlementType', sr.settlement_type,
                'approvalStatus', sr.approval_status,
                'settlementAmount', sr.settlement_amount,
                'triggerEvent', sr.trigger_event,
                'createdAt', sr.created_at
            )
        )
        FROM financial_schema.settlement_requests sr
        JOIN escrow_data ed ON sr.escrow_id = ed.escrow_id
        WHERE sr.is_deleted = FALSE
    )
    SELECT jsonb_build_object(
        'escrow', row_to_json(escrow_data)::jsonb,
        'contract', coalesce((SELECT jsonb_build_object(
            'contractId', cd.contract_id,
            'bookingId', cd.booking_id,
            'acceptanceStatus', cd.acceptance_status,
            'baseAmount', cd.base_amount,
            'currency', cd.contract_currency
        ) FROM contract_data cd), '{}'::jsonb),
        'booking', coalesce((SELECT jsonb_build_object(
            'bookingId', bd.booking_id,
            'shipperId', bd.shipper_id,
            'transporterId', bd.transporter_id,
            'bookingStatus', bd.booking_status
        ) FROM booking_data bd), '{}'::jsonb),
        'paymentIntents', COALESCE((SELECT payment_intents), '[]'::jsonb),
        'settlementRequests', COALESCE((SELECT settlement_reqs), '[]'::jsonb)
    ) INTO result
    FROM escrow_data;

    IF result IS NULL THEN
        RETURN jsonb_build_object('error', 'ESCROW_NOT_FOUND', 'code', 'ERR_404');
    END IF;

    RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_escrow_with_details(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_escrow_with_details(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_escrow_with_details(UUID) TO authenticated;

-- ============================================================
-- SECTION 9: SECDEF FUNCTION — update_platform_fee_config()
-- ============================================================
-- Super Admin only: updates platform fee percentage.
-- Validates fee range (0-50%). Client cannot override.
-- Authenticated, authorized, auditable.

DROP FUNCTION IF EXISTS public.update_platform_fee_config(DECIMAL(5,2), UUID);

CREATE OR REPLACE FUNCTION public.update_platform_fee_config(
    p_fee_percentage DECIMAL(5,2),
    p_correlation_id UUID DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_caller UUID;
    v_user_role TEXT;
    v_existing financial_schema.platform_fee_config%ROWTYPE;
    v_new_version INTEGER;
BEGIN
    -- Step 1: Authenticate
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user';
    END IF;

    -- Step 2: Verify SUPER_ADMIN role — only Super Admins may modify fee config
    v_user_role := (auth.jwt()->>'role')::text;
    IF v_user_role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ACCESS_DENIED_FEE_CONFIG: only SUPER_ADMIN may modify platform fee configuration';
    END IF;

    -- Step 3: Validate fee percentage
    IF p_fee_percentage < 0 OR p_fee_percentage > 50 THEN
        RAISE EXCEPTION 'INVALID_FEE_PERCENTAGE: fee must be between 0 and 50, got %', p_fee_percentage;
    END IF;

    -- Step 4: Get existing config (for version tracking)
    SELECT * INTO v_existing
    FROM financial_schema.platform_fee_config
    WHERE key = 'default_platform_fee' AND is_deleted = FALSE
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_existing.id IS NULL THEN
        RAISE EXCEPTION 'FEE_CONFIG_NOT_FOUND: no active platform fee configuration found';
    END IF;

    -- Idempotency: same value?
    IF v_existing.fee_percentage = p_fee_percentage THEN
        RETURN jsonb_build_object(
            'success', true,
            'action', 'fee_config_already_set',
            'feePercentage', p_fee_percentage,
            'message', 'Fee percentage already set to this value. Returned idempotently.'
        );
    END IF;

    -- Step 5: Update fee config with new effective_from timestamp
    -- This preserves history: old row stays, new row gets current timestamp
    v_new_version := COALESCE(v_existing.version, 1) + 1;

    INSERT INTO financial_schema.platform_fee_config (
        key, fee_percentage, currency, effective_from,
        created_by, correlation_id, version
    ) VALUES (
        'default_platform_fee',
        p_fee_percentage,
        'MZN',
        now(),
        v_caller,
        p_correlation_id,
        v_new_version
    );

    RETURN jsonb_build_object(
        'success', true,
        'action', 'fee_config_updated',
        'feePercentage', p_fee_percentage,
        'updatedBy', v_caller::text,
        'effectiveFrom', now()::text,
        'newVersion', v_new_version,
        'message', 'Platform fee updated. New rate effective immediately.'
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_platform_fee_config(DECIMAL(5,2), UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_platform_fee_config(DECIMAL(5,2), UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_platform_fee_config(DECIMAL(5,2), UUID) TO authenticated;

-- ============================================================
-- SECTION 10: IMMUTABILITY PROTECTION — NO UPDATE ON LEDGER FINANCIAL FIELDS
-- ============================================================
-- Revoke all updates on financial columns of ledger entries.
-- Only reconciliation_status and metadata may change.

REVOKE UPDATE (amount, currency, source, destination, debit_credit_type, entry_sequence)
  ON financial_schema.financial_ledger_entries FROM PUBLIC;

-- ============================================================
-- SECTION 11: RLS POLICY — PLATFORM FEE CONFIG SUPER ADMIN ONLY
-- ============================================================
-- Platform fee configuration is Super Admin System Configuration.
-- Ordinary users, Admins, and Moderators cannot modify it.
-- Only Super Admin may mutate platform fee configuration.

ALTER TABLE financial_schema.platform_fee_config ENABLE ROW LEVEL SECURITY;

-- Super Admin only: full access to platform fee config (mutation + read)
CREATE POLICY platform_fee_config_super_admin
  ON financial_schema.platform_fee_config
  FOR ALL
  USING (auth.jwt()->>'role' = 'SUPER_ADMIN')
  WITH CHECK (auth.jwt()->>'role' = 'SUPER_ADMIN');

-- Ordinary authenticated users can read but not modify
CREATE POLICY platform_fee_config_read
  ON financial_schema.platform_fee_config
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- SECTION 12: UPDATED_AT TRIGGER FOR PLATFORM FEE CONFIG
-- ============================================================

CREATE OR REPLACE FUNCTION financial_schema._set_updated_at_platform_fee()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_fee_config_updated_at ON financial_schema.platform_fee_config;

CREATE TRIGGER trg_platform_fee_config_updated_at
  BEFORE UPDATE ON financial_schema.platform_fee_config
  FOR EACH ROW
  EXECUTE FUNCTION financial_schema._set_updated_at();
