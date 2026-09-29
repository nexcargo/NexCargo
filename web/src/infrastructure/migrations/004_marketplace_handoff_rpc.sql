-- NexCargo Migration 004 -- Marketplace Booking Handoff Atomic Transaction (Hardened)
-- Purpose: PostgreSQL stored function enabling genuine ACID atomic handoff
-- for C2-Increment 003: Match PROPOSED→ACCEPTED + Listing PUBLISHED→BOOKED 
-- + Booking REQUESTED→ALIGNMENT_CHECKED as one indivisible unit.
--
-- TD-C2-001/002 Hardened: Triad coherence verification + transporter identity check
--
-- Invoked via: supabase.rpc('marketplace_book_handoff', { params })
-- Security: SECURITY INVOKER preserves RLS policies per authenticated session.
-- Authorised by: HAO C2-003 Authorization (2026-09-07).

CREATE OR REPLACE FUNCTION marketplace_book_handoff(
    p_match_id uuid,
    p_listing_id uuid,
    p_offer_id uuid,
    p_shipper_id uuid,
    p_transporter_id uuid,
    p_correlation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_listing_origin_address text;
    v_listing_destination_address text;
    v_listing_cargo_description text;
    v_listing_cargo_type varchar(50);
    v_listing_weight_kg numeric;
    v_offer_price numeric;
    v_offer_vehicle_type varchar(30);
    v_booking_id uuid;
    v_match_check_listing uuid;
    v_match_check_offer uuid;
BEGIN
    -- Look up listing data (must exist and be PUBLISHED)
    SELECT origin_address, destination_address, description, cargo_type, weight_kg
    INTO v_listing_origin_address, v_listing_destination_address, v_listing_cargo_description, v_listing_cargo_type, v_listing_weight_kg
    FROM marketplace_schema.listings
    WHERE id = p_listing_id AND status = 'PUBLISHED';

    IF v_listing_origin_address IS NULL THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Listing % not found or not in PUBLISHED state', p_listing_id;
    END IF;

    -- Look up offer data (must exist and be SUBMITTED)
    SELECT price_proposal, vehicle_type
    INTO v_offer_price, v_offer_vehicle_type
    FROM marketplace_schema.offers
    WHERE id = p_offer_id AND status = 'SUBMITTED';

    IF v_offer_price IS NULL THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Offer % not found or not in SUBMITTED state', p_offer_id;
    END IF;

    -- TD-C2-001 & TD-C2-002: Triad coherence + transporter identity
    -- Verify match references THIS listing and THIS offer
    SELECT listing_id, offer_id INTO v_match_check_listing, v_match_check_offer
    FROM marketplace_schema.matches
    WHERE id = p_match_id AND status = 'PROPOSED';

    IF v_match_check_listing IS NULL OR v_match_check_offer IS NULL THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Match not found or not in PROPOSED state';
    END IF;

    IF v_match_check_listing <> p_listing_id THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Triad mismatch — match listing (%!)<>provided(%)', v_match_check_listing, p_listing_id;
    END IF;

    IF v_match_check_offer <> p_offer_id THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Triad mismatch — match offer (%!)<>provided(%)', v_match_check_offer, p_offer_id;
    END IF;

    -- Verify offer belongs to listing and transporter matches
    IF (SELECT listing_id FROM marketplace_schema.offers WHERE id = p_offer_id AND status = 'SUBMITTED') <> p_listing_id THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Triad mismatch — offer listing';
    END IF;

    IF (SELECT transporter_id FROM marketplace_schema.offers WHERE id = p_offer_id AND status = 'SUBMITTED') <> p_transporter_id THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Transporter mismatch — offer owner(%!)<>provided(%)',
            (SELECT transporter_id FROM marketplace_schema.offers WHERE id = p_offer_id AND status = 'SUBMITTED'), p_transporter_id;
    END IF;

    -- Create booking with status ALIGNMENT_CHECKED (pre-alignment validated by caller)
    INSERT INTO logistics_schema.bookings (
        listing_id, selected_offer_id, shipper_id, transporter_id,
        status, origin_address, destination_address, cargo_description,
        cargo_type, weight_kg, offer_price, vehicle_type,
        correlation_id, is_deleted, version
    ) VALUES (
        p_listing_id, p_offer_id, p_shipper_id, p_transporter_id,
        'ALIGNMENT_CHECKED', v_listing_origin_address, v_listing_destination_address,
        v_listing_cargo_description, v_listing_cargo_type, v_listing_weight_kg,
        v_offer_price, v_offer_vehicle_type,
        p_correlation_id, false, 1
    ) RETURNING id INTO v_booking_id;

    -- Transition match PROPOSED → ACCEPTED
    UPDATE marketplace_schema.matches
    SET status = 'ACCEPTED', updated_at = now(), version = version + 1
    WHERE id = p_match_id AND status = 'PROPOSED';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Match % not found or not in PROPOSED state', p_match_id;
    END IF;

    -- Transition listing PUBLISHED → BOOKED
    UPDATE marketplace_schema.listings
    SET status = 'BOOKED', updated_at = now(), version = version + 1
    WHERE id = p_listing_id AND status = 'PUBLISHED';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Listing % failed to transition to BOOKED', p_listing_id;
    END IF;

    -- Return result
    RETURN jsonb_build_object(
        'booking_id', v_booking_id::text,
        'status', 'ALIGNMENT_CHECKED',
        'match_id', p_match_id::text,
        'listing_id', p_listing_id::text,
        'success', true
    );
END;
$$;
