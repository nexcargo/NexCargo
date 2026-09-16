-- NexCargo Migration 005 — Contract Formation + Escrow Initialization (C3)
-- Creates: contracts table, indexes, RLS policies, column grants, stored procedures
-- Design-time foundations per HAO-WAVE2-AUTH-001 (MOD-002, MOD-005)

-- ============================================================
-- PART 1: CONTRACTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id VARCHAR(50) NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES logistics_schema.bookings(id),
  listing_id UUID NOT NULL REFERENCES marketplace_schema.listings(id),
  offer_id UUID NOT NULL REFERENCES marketplace_schema.offers(id),
  match_id UUID REFERENCES marketplace_schema.matches(id),
  base_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'MZN',
  pickup_window_start TIMESTAMPTZ NOT NULL,
  pickup_window_end TIMESTAMPTZ NOT NULL,
  delivery_window_start TIMESTAMPTZ NOT NULL,
  delivery_window_end TIMESTAMPTZ NOT NULL,
  terms_snapshot TEXT NOT NULL,
  acceptance_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  shipper_accepted_at TIMESTAMPTZ,
  shipper_accepted_version INTEGER DEFAULT 1,
  shipper_terms_hash CHAR(64),
  transporter_accepted_at TIMESTAMPTZ,
  transporter_accepted_version INTEGER DEFAULT 1,
  transporter_terms_hash CHAR(64),
  num_signatories INTEGER NOT NULL DEFAULT 0,
  signed_at TIMESTAMPTZ,
  digital_signature_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  correlation_id UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_contracts_booking ON logistics_schema.contracts(booking_id);
CREATE INDEX idx_contracts_acceptance ON logistics_schema.contracts(acceptance_status);
CREATE UNIQUE INDEX uq_contracts_one_per_active_booking
  ON logistics_schema.contracts (booking_id) WHERE is_deleted = FALSE;

-- ============================================================
-- Part 2: CONTRACT RLS POLICIES (3 total)
-- ============================================================

ALTER TABLE logistics_schema.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contracts_shipper_read
  ON logistics_schema.contracts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM logistics_schema.bookings b
      WHERE b.id = contracts.booking_id
        AND b.shipper_id = auth.uid()
        AND b.is_deleted = FALSE
    )
  );

CREATE POLICY contracts_transporter_read
  ON logistics_schema.contracts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM logistics_schema.bookings b
      WHERE b.id = contracts.booking_id
        AND b.transporter_id = auth.uid()
        AND b.is_deleted = FALSE
    )
  );

CREATE POLICY contracts_admin
  ON logistics_schema.contracts
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- Part 3: IMMUTABLE FIELD COLUMN GRANTS
-- ============================================================

REVOKE UPDATE (base_amount, currency, terms_snapshot,
              listing_id, offer_id, match_id,
              pickup_window_start, pickup_window_end,
              delivery_window_start, delivery_window_end,
              contract_id, booking_id)
  ON logistics_schema.contracts FROM PUBLIC;

GRANT UPDATE (acceptance_status, shipper_accepted_at, transporter_accepted_at,
              num_signatories, signed_at, digital_signature_status,
              shipper_accepted_version, transporter_accepted_version,
              shipper_terms_hash, transporter_terms_hash,
              updated_at, version)
  ON logistics_schema.contracts TO PUBLIC;

-- ============================================================
-- PART 4: ESCROW RECORDS RLS POLICIES (2 total)
-- ============================================================

ALTER TABLE financial_schema.escrow_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY escrow_counterparty_read
  ON financial_schema.escrow_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM logistics_schema.bookings b
      WHERE b.contract_id = escrow_records.contract_id
        AND (b.shipper_id = auth.uid() OR b.transporter_id = auth.uid())
        AND b.is_deleted = FALSE
    )
  );

CREATE POLICY escrow_admin
  ON financial_schema.escrow_records
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- Escrow indexes (table pre-exists; indexes added here)
CREATE INDEX IF NOT EXISTS idx_escrow_contract
  ON financial_schema.escrow_records(contract_id);
CREATE INDEX IF NOT EXISTS idx_escrow_state
  ON financial_schema.escrow_records(state);

-- ============================================================
-- Part 5: CONFIRM BOOKING WITH CONTRACT FUNCTION (C3)
-- ============================================================
-- Creates the confirm_booking_with_contract() RPC for C2→C3 transition.
-- Transitions booking from ALIGNMENT_CHECKED → CONFIRMED, creates contract,
-- links contract_id back to booking. Idempotent: returns early if contract exists.

CREATE OR REPLACE FUNCTION public.confirm_booking_with_contract(
    p_booking_id uuid,
    p_correlation_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_status                  varchar;
    v_listing_id              uuid;
    v_offer_id                uuid;
    v_shipper_id              uuid;
    v_transporter_id          uuid;
    v_offer_price             numeric;
    v_currency                varchar(3);
    v_origin_address          text;
    v_destination_address     text;
    v_cargo_description       text;
    v_cargo_type              varchar(50);
    v_weight_kg               numeric;
    v_vehicle_type            varchar(30);
    v_avail_start             text;
    v_avail_end               text;
    v_new_contract_id         uuid;
    v_terms_snapshot          text;
    v_has_contract            boolean;
BEGIN
    -- Authorize caller immediately
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;

    -- Lock and inspect booking
    SELECT status, listing_id, selected_offer_id, shipper_id, transporter_id, offer_price, currency,
           origin_address, destination_address, cargo_description, cargo_type, weight_kg, vehicle_type,
           availability_window_start, availability_window_end
    INTO v_status, v_listing_id, v_offer_id, v_shipper_id, v_transporter_id, v_offer_price, v_currency,
         v_origin_address, v_destination_address, v_cargo_description, v_cargo_type, v_weight_kg, v_vehicle_type,
         v_avail_start, v_avail_end
    FROM logistics_schema.bookings
    WHERE id = p_booking_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND';
    END IF;

    IF v_status <> 'ALIGNMENT_CHECKED' THEN
        RAISE EXCEPTION 'INVALID_PREDECESSOR: must be ALIGNMENT_CHECKED, got %', v_status;
    END IF;

    -- Party verification before any idempotent paths
    IF v_shipper_id <> auth.uid() THEN
        RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;

    -- Idempotency: contract already exists?
    SELECT EXISTS (
        SELECT 1 FROM logistics_schema.contracts
        WHERE booking_id = p_booking_id AND is_deleted = FALSE
    ) INTO v_has_contract;

    IF v_has_contract THEN
        RETURN jsonb_build_object(
            'success', true, 'action', 'contract_already_exists',
            'booking_id', p_booking_id::text, 'booking_status', v_status,
            'terms', jsonb_build_object('message', 'Booking already confirmed.')
        );
    END IF;

    -- Confirm booking status
    UPDATE logistics_schema.bookings
    SET status = 'CONFIRMED', confirmation_timestamp = now(), updated_at = now()
    WHERE id = p_booking_id;

    -- Build terms snapshot JSON
    v_terms_snapshot := json_build_object(
        'listingId', v_listing_id, 'offerId', v_offer_id,
        'shipperId', v_shipper_id, 'transporterId', v_transporter_id,
        'origin', v_origin_address, 'destination', v_destination_address,
        'cargoDescription', v_cargo_description, 'cargoType', v_cargo_type,
        'weightKg', v_weight_kg, 'vehicleType', v_vehicle_type,
        'price', v_offer_price, 'currency', v_currency,
        'pickupWindowStart', v_avail_start, 'pickupWindowEnd', v_avail_end,
        'deliveryWindowStart', v_avail_start, 'deliveryWindowEnd', v_avail_end
    )::text;

    -- Create contract row
    INSERT INTO logistics_schema.contracts (
        contract_id, booking_id, listing_id, offer_id,
        base_amount, currency,
        pickup_window_start, pickup_window_end,
        delivery_window_start, delivery_window_end,
        terms_snapshot,
        acceptance_status, num_signatories, digital_signature_status,
        version, correlation_id, created_by, created_at, updated_at
    ) VALUES (
        'CNT-' || replace(p_booking_id::text, '-', '')::text,
        p_booking_id, v_listing_id, v_offer_id,
        v_offer_price, v_currency,
        CASE WHEN v_avail_start IS NOT NULL THEN v_avail_start::timestamptz ELSE now() END,
        CASE WHEN v_avail_end IS NOT NULL THEN v_avail_end::timestamptz ELSE now() END,
        CASE WHEN v_avail_start IS NOT NULL THEN v_avail_start::timestamptz ELSE now() END,
        CASE WHEN v_avail_end IS NOT NULL THEN v_avail_end::timestamptz ELSE now() END,
        v_terms_snapshot,
        'DRAFT', 0, 'PENDING',
        1, p_correlation_id, v_shipper_id, now(), now()
    ) RETURNING id INTO v_new_contract_id;

    -- Link contract to booking
    UPDATE logistics_schema.bookings
    SET contract_id = v_new_contract_id, updated_at = now()
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
        'success', true, 'action', 'confirmed_with_contract',
        'booking_id', p_booking_id::text, 'booking_status', 'CONFIRMED',
        'contract_id', v_new_contract_id::text,
        'acceptance_status', 'DRAFT',
        'confirmation_timestamp', now()::text
    );
END;
$function$;
