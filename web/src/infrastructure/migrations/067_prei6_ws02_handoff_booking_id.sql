-- ============================================================================
-- 067_prei6_ws02_handoff_booking_id.sql
-- PRE-I-6 WS-02 (LIM-001 inherited findings) - D-WS02-2, marketplace_book_handoff.
--
-- AUTHORITY
--   QODER DIRECTIVE - PRE-I-6 LA DECISIONS AND REMEDIATION, 16 November 2026.
--   D-WS02-2: APPROVED. Correct the marketplace_book_handoff defect with the
--     smallest safe change. Inspect signature/implementation; establish intended
--     semantics from specs/callers; identify the precise defect and its effect on
--     booking/offer/listing/match; preserve the booking lifecycle; validate
--     relationships and caller authorization; correct match-id handling without
--     inventing or changing business semantics; preserve idempotency/repeat-call;
--     prevent cross-tenant/cross-party handoff; maintain the public contract
--     unless essential and documented; include direct-RPC and application-path
--     tests. Do not redesign booking/matching.
--
-- FINDING (measured live 2026-11-17, project cvdggspiudmudbbdkjrc)
--   public.marketplace_book_handoff(p_match_id uuid, p_listing_id uuid,
--   p_offer_id uuid, p_shipper_id uuid, p_transporter_id uuid,
--   p_correlation_id uuid DEFAULT NULL) RETURNS jsonb is SECURITY INVOKER,
--   search_path pinned to (pg_catalog, public) by 048, EXECUTE held by
--   authenticated + service_role (anon/PUBLIC revoked by 048), owner postgres.
--   Its INSERT INTO logistics_schema.bookings (004:84-95, unchanged through 048)
--   lists listing_id, selected_offer_id, shipper_id, transporter_id, status,
--   origin_address, destination_address, cargo_description, cargo_type,
--   weight_kg, offer_price, vehicle_type, correlation_id, is_deleted, version -
--   and OMITS booking_id.
--   logistics_schema.bookings.booking_id is VARCHAR(50) NOT NULL UNIQUE with NO
--   column default (003:14); it is an external reference distinct from the uuid
--   primary key id (whose default is uuid_generate_v4()). Because the INSERT
--   supplies no booking_id and the column has no default, EVERY handoff aborts at
--   the INSERT with "null value in column booking_id of relation bookings
--   violates not-null constraint". The function is atomic (SECURITY INVOKER, one
--   transaction): the abort rolls back the whole call, so no booking is created
--   and the match stays PROPOSED, the listing stays PUBLISHED and the offer stays
--   SUBMITTED. This was confirmed live in NXC-PREI6-WS02-001 probe P-B and the
--   real-session HTTP accept (500 Handoff failed booking_id not-null). The
--   application-side match-id threading defect (WS-02 item 1) is already corrected
--   in booking-orchestration.ts; this migration corrects the residual DATABASE
--   defect only.
--
-- INTENDED SEMANTICS (from callers + live convention, not invented)
--   booking_id is a generated UUID string. The shipper booking workflow
--   (app/[locale]/(shipper)/shipment-workflow.tsx:148) supplies
--   crypto.randomUUID(); the direct booking route persists body.bookingId; every
--   existing application-created booking row stores a lowercase hyphenated UUID
--   string in booking_id, independent of its uuid id (e.g. protected booking
--   827194cf has id 827194cf... and booking_id 8d6b1d84...). The handoff must
--   follow the same convention.
--
-- EXACT CHANGE (one column + one value added to the INSERT; nothing else altered)
--   The INSERT column list gains booking_id and the VALUES list gains
--   gen_random_uuid()::text. gen_random_uuid() is core pg_catalog (verified live),
--   reachable under the pinned search_path; uuid_generate_v4() lives ONLY in the
--   extensions schema and is NOT reachable here, so it cannot be used in the body.
--   gen_random_uuid()::text yields the same UUID-string format as the existing
--   convention. The row id keeps its own uuid_generate_v4() default; booking_id is
--   an independent reference, exactly as in existing rows.
--   Everything else is byte-identical to the live pre-change body: the listing
--   PUBLISHED guard, the offer SUBMITTED guard, the TD-C2-001/002 triad coherence
--   guards (match.listing_id = p_listing_id, match.offer_id = p_offer_id,
--   offer.listing_id = p_listing_id), the transporter identity guard
--   (offer.transporter_id = p_transporter_id), status ALIGNMENT_CHECKED, the
--   match PROPOSED->ACCEPTED and listing PUBLISHED->BOOKED transitions with their
--   NOT FOUND guards, RETURNING id INTO v_booking_id, and the jsonb return
--   contract (booking_id = the row uuid id, status, match_id, listing_id, success).
--
-- WHY THIS IS NOT A WEAKENING / NOT A SEMANTIC CHANGE
--   Strictly enabling: a handoff that previously always aborted now succeeds for
--   an already-authorized, triad-coherent call. No guard is removed or relaxed.
--   Caller authorization is unchanged: SECURITY INVOKER means RLS still applies
--   per authenticated session, and the triad + transporter identity guards still
--   refuse cross-party/cross-tenant handoff. Repeat-call/idempotency is unchanged:
--   a second call finds the match no longer PROPOSED and aborts at the triad guard
--   BEFORE the INSERT, so no duplicate booking is created. The public signature,
--   RETURNS jsonb, LANGUAGE plpgsql, SECURITY INVOKER posture, pinned search_path,
--   owner and all ACLs are preserved (CREATE OR REPLACE changes none of them). No
--   policy, grant, schema, table, trigger or other function is touched. No
--   financial, escrow, payment or settlement object is referenced.
--
-- PRECONDITIONS (asserted below before the replace)
--   P1 the function exists with the exact authorized 6-argument signature;
--   P2 SECURITY INVOKER (prosecdef = false) with search_path pinned pg_catalog/public;
--   P3 the body does not yet generate booking_id (no gen_random_uuid() call) -
--      the original vulnerable state;
--   P4 grant layout: EXECUTE authenticated + service_role, not anon, not PUBLIC.
--
-- POSTCONDITIONS / INVARIANTS (asserted below after the replace)
--   Q1 signature, SECURITY INVOKER and pinned search_path unchanged;
--   Q2 grant layout unchanged;
--   Q3 the INSERT column list contains booking_id and VALUES contains
--      gen_random_uuid()::text;
--   Q4 the triad/transporter guards, ALIGNMENT_CHECKED status, both lifecycle
--      transitions, RETURNING id and the jsonb return contract are byte-present.
--
-- ROLLBACK INSTRUCTIONS
--   Execute the commented original definition in the ROLLBACK section at the
--   bottom of this file (uncomment and run as the migration owner). It is the
--   verbatim pre-change body captured live via pg_get_functiondef on 2026-11-17.
--   CREATE OR REPLACE again preserves oid, SECURITY INVOKER, search_path and
--   grants. Rollback re-opens the booking_id not-null abort; no data is migrated
--   and no destructive step is involved.
--
-- APPLICATION PROCEDURE
--   Established NexCargo procedure: apply via Supabase apply_migration with name
--   067_prei6_ws02_handoff_booking_id, then verify from the catalog
--   (pg_get_functiondef / pg_proc / has_function_privilege), via a rolled-back
--   owner-class probe on a task-owned triad, and via a real authenticated-session
--   HTTP accept plus direct-RPC call. File existence is not proof of application;
--   the journal row and catalog measurements are.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PRECONDITIONS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_oid  OID;
    v_def  TEXT;
BEGIN
    SELECT p.oid, pg_get_functiondef(p.oid) INTO v_oid, v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff'
       AND pg_get_function_identity_arguments(p.oid) = 'p_match_id uuid, p_listing_id uuid, p_offer_id uuid, p_shipper_id uuid, p_transporter_id uuid, p_correlation_id uuid';

    IF v_oid IS NULL THEN
        RAISE EXCEPTION 'PRECONDITION P1 FAILED: marketplace_book_handoff signature not found';
    END IF;

    IF (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
        RAISE EXCEPTION 'PRECONDITION P2 FAILED: function is not SECURITY INVOKER';
    END IF;

    IF NOT ((SELECT proconfig FROM pg_proc WHERE oid = v_oid) @> ARRAY['search_path=pg_catalog, public']::text[]) THEN
        RAISE EXCEPTION 'PRECONDITION P2 FAILED: search_path not pinned to pg_catalog/public';
    END IF;

    IF position('gen_random_uuid()' in v_def) <> 0 THEN
        RAISE EXCEPTION 'PRECONDITION P3 FAILED: booking_id generation already present (already migrated or unexpected body)';
    END IF;

    IF has_function_privilege('anon', v_oid, 'EXECUTE')
       OR has_function_privilege('public', v_oid, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'PRECONDITION P4 FAILED: grant layout unexpected';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- REPLACEMENT: marketplace_book_handoff (booking_id generation only)
-- SECURITY INVOKER is intentional (004:9, 048:62) - no SECURITY DEFINER keyword.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketplace_book_handoff(p_match_id uuid, p_listing_id uuid, p_offer_id uuid, p_shipper_id uuid, p_transporter_id uuid, p_correlation_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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

    IF (SELECT listing_id FROM marketplace_schema.offers WHERE id = p_offer_id AND status = 'SUBMITTED') <> p_listing_id THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Triad mismatch — offer listing';
    END IF;

    IF (SELECT transporter_id FROM marketplace_schema.offers WHERE id = p_offer_id AND status = 'SUBMITTED') <> p_transporter_id THEN
        RAISE EXCEPTION 'HANDOFF_ERROR: Transporter mismatch — offer owner(%!)<>provided(%)',
            (SELECT transporter_id FROM marketplace_schema.offers WHERE id = p_offer_id AND status = 'SUBMITTED'), p_transporter_id;
    END IF;

    -- Create booking with status ALIGNMENT_CHECKED (pre-alignment validated by caller)
    -- WS-02 / D-WS02-2: booking_id is VARCHAR(50) NOT NULL UNIQUE with no default; the
    -- original INSERT omitted it so every handoff aborted. Supply a generated UUID string
    -- (the established booking_id convention). gen_random_uuid() is core pg_catalog and
    -- reachable under the pinned search_path; uuid_generate_v4() is extensions-only.
    INSERT INTO logistics_schema.bookings (
        booking_id, listing_id, selected_offer_id, shipper_id, transporter_id,
        status, origin_address, destination_address, cargo_description,
        cargo_type, weight_kg, offer_price, vehicle_type,
        correlation_id, is_deleted, version
    ) VALUES (
        gen_random_uuid()::text, p_listing_id, p_offer_id, p_shipper_id, p_transporter_id,
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
$function$;

-- ---------------------------------------------------------------------------
-- POSTCONDITIONS / INVARIANTS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_oid  OID;
    v_def  TEXT;
BEGIN
    SELECT p.oid, pg_get_functiondef(p.oid) INTO v_oid, v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff'
       AND pg_get_function_identity_arguments(p.oid) = 'p_match_id uuid, p_listing_id uuid, p_offer_id uuid, p_shipper_id uuid, p_transporter_id uuid, p_correlation_id uuid';

    IF v_oid IS NULL THEN
        RAISE EXCEPTION 'POSTCONDITION Q1 FAILED: signature changed or function missing';
    END IF;

    IF (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
        RAISE EXCEPTION 'POSTCONDITION Q1 FAILED: function became SECURITY DEFINER';
    END IF;

    IF NOT ((SELECT proconfig FROM pg_proc WHERE oid = v_oid) @> ARRAY['search_path=pg_catalog, public']::text[]) THEN
        RAISE EXCEPTION 'POSTCONDITION Q1 FAILED: search_path pin lost';
    END IF;

    IF has_function_privilege('anon', v_oid, 'EXECUTE')
       OR has_function_privilege('public', v_oid, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'POSTCONDITION Q2 FAILED: grant layout changed';
    END IF;

    IF position('booking_id, listing_id, selected_offer_id' in v_def) = 0
       OR position('gen_random_uuid()::text, p_listing_id' in v_def) = 0 THEN
        RAISE EXCEPTION 'POSTCONDITION Q3 FAILED: booking_id generation not present in the INSERT';
    END IF;

    IF position('HANDOFF_ERROR: Triad mismatch' in v_def) = 0
       OR position('HANDOFF_ERROR: Transporter mismatch' in v_def) = 0
       OR position('''ALIGNMENT_CHECKED''' in v_def) = 0
       OR position('RETURNING id INTO v_booking_id' in v_def) = 0
       OR position('SET status = ''ACCEPTED''' in v_def) = 0
       OR position('SET status = ''BOOKED''' in v_def) = 0
       OR position('''booking_id'', v_booking_id::text' in v_def) = 0 THEN
        RAISE EXCEPTION 'POSTCONDITION Q4 FAILED: a lifecycle/triad/return-contract element was altered';
    END IF;
END $$;

COMMENT ON FUNCTION public.marketplace_book_handoff(uuid, uuid, uuid, uuid, uuid, uuid) IS
  'PRE-I-6 WS-02 D-WS02-2 (067): the bookings INSERT now supplies booking_id = gen_random_uuid()::text (VARCHAR(50) NOT NULL UNIQUE, no default), correcting the not-null abort that made every handoff fail. SECURITY INVOKER, pinned search_path (pg_catalog, public), signature, jsonb return contract, triad/transporter guards and EXECUTE grants (authenticated, service_role) unchanged. 048 containment preserved.';

-- ============================================================================
-- ROLLBACK - verbatim pre-change body (live pg_get_functiondef, 2026-11-17).
-- Uncomment and run as the migration owner to restore the original behavior.
-- CREATE OR REPLACE preserves oid, SECURITY INVOKER, search_path and grants.
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.marketplace_book_handoff(p_match_id uuid, p_listing_id uuid, p_offer_id uuid, p_shipper_id uuid, p_transporter_id uuid, p_correlation_id uuid DEFAULT NULL::uuid)
--  RETURNS jsonb
--  LANGUAGE plpgsql
--  SET search_path TO 'pg_catalog', 'public'
-- AS $function$
-- DECLARE
--     v_listing_origin_address text;
--     v_listing_destination_address text;
--     v_listing_cargo_description text;
--     v_listing_cargo_type varchar(50);
--     v_listing_weight_kg numeric;
--     v_offer_price numeric;
--     v_offer_vehicle_type varchar(30);
--     v_booking_id uuid;
--     v_match_check_listing uuid;
--     v_match_check_offer uuid;
-- BEGIN
--     SELECT origin_address, destination_address, description, cargo_type, weight_kg
--     INTO v_listing_origin_address, v_listing_destination_address, v_listing_cargo_description, v_listing_cargo_type, v_listing_weight_kg
--     FROM marketplace_schema.listings
--     WHERE id = p_listing_id AND status = 'PUBLISHED';
--     IF v_listing_origin_address IS NULL THEN
--         RAISE EXCEPTION 'HANDOFF_ERROR: Listing % not found or not in PUBLISHED state', p_listing_id;
--     END IF;
--     SELECT price_proposal, vehicle_type
--     INTO v_offer_price, v_offer_vehicle_type
--     FROM marketplace_schema.offers
--     WHERE id = p_offer_id AND status = 'SUBMITTED';
--     IF v_offer_price IS NULL THEN
--         RAISE EXCEPTION 'HANDOFF_ERROR: Offer % not found or not in SUBMITTED state', p_offer_id;
--     END IF;
--     SELECT listing_id, offer_id INTO v_match_check_listing, v_match_check_offer
--     FROM marketplace_schema.matches
--     WHERE id = p_match_id AND status = 'PROPOSED';
--     IF v_match_check_listing IS NULL OR v_match_check_offer IS NULL THEN
--         RAISE EXCEPTION 'HANDOFF_ERROR: Match not found or not in PROPOSED state';
--     END IF;
--     IF v_match_check_listing <> p_listing_id THEN
--         RAISE EXCEPTION 'HANDOFF_ERROR: Triad mismatch — match listing (%!)<>provided(%)', v_match_check_listing, p_listing_id;
--     END IF;
--     IF v_match_check_offer <> p_offer_id THEN
--         RAISE EXCEPTION 'HANDOFF_ERROR: Triad mismatch — match offer (%!)<>provided(%)', v_match_check_offer, p_offer_id;
--     END IF;
--     IF (SELECT listing_id FROM marketplace_schema.offers WHERE id = p_offer_id AND status = 'SUBMITTED') <> p_listing_id THEN
--         RAISE EXCEPTION 'HANDOFF_ERROR: Triad mismatch — offer listing';
--     END IF;
--     IF (SELECT transporter_id FROM marketplace_schema.offers WHERE id = p_offer_id AND status = 'SUBMITTED') <> p_transporter_id THEN
--         RAISE EXCEPTION 'HANDOFF_ERROR: Transporter mismatch — offer owner(%!)<>provided(%)',
--             (SELECT transporter_id FROM marketplace_schema.offers WHERE id = p_offer_id AND status = 'SUBMITTED'), p_transporter_id;
--     END IF;
--     INSERT INTO logistics_schema.bookings (
--         listing_id, selected_offer_id, shipper_id, transporter_id,
--         status, origin_address, destination_address, cargo_description,
--         cargo_type, weight_kg, offer_price, vehicle_type,
--         correlation_id, is_deleted, version
--     ) VALUES (
--         p_listing_id, p_offer_id, p_shipper_id, p_transporter_id,
--         'ALIGNMENT_CHECKED', v_listing_origin_address, v_listing_destination_address,
--         v_listing_cargo_description, v_listing_cargo_type, v_listing_weight_kg,
--         v_offer_price, v_offer_vehicle_type,
--         p_correlation_id, false, 1
--     ) RETURNING id INTO v_booking_id;
--     UPDATE marketplace_schema.matches
--     SET status = 'ACCEPTED', updated_at = now(), version = version + 1
--     WHERE id = p_match_id AND status = 'PROPOSED';
--     IF NOT FOUND THEN
--         RAISE EXCEPTION 'HANDOFF_ERROR: Match % not found or not in PROPOSED state', p_match_id;
--     END IF;
--     UPDATE marketplace_schema.listings
--     SET status = 'BOOKED', updated_at = now(), version = version + 1
--     WHERE id = p_listing_id AND status = 'PUBLISHED';
--     IF NOT FOUND THEN
--         RAISE EXCEPTION 'HANDOFF_ERROR: Listing % failed to transition to BOOKED', p_listing_id;
--     END IF;
--     RETURN jsonb_build_object(
--         'booking_id', v_booking_id::text,
--         'status', 'ALIGNMENT_CHECKED',
--         'match_id', p_match_id::text,
--         'listing_id', p_listing_id::text,
--         'success', true
--     );
-- END;
-- $function$;