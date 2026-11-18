-- ============================================================================
-- NexCargo Migration 070 -- PRE-I-6 FINAL COMPLETION DIRECTIVE, Item 3
-- Minimal Driver operations: assignment-scoped operational identity for
-- Transporter-managed Drivers. Authorized by: LA PRE-I-6 FINAL COMPLETION
-- DIRECTIVE Sec.1 Item 3 (optional platform-account association,
-- assignment-scoped authorization, tracking/location submission, Proof of
-- Pickup/Delivery submission; reuse existing entities/APIs/authorization;
-- no Driver marketplace role, no independent Driver subsystem).
-- This is the DRIVER operational-identity decision deferred by migration 068
-- (D-WS02-1 deferral note) and by the WS-05 disposition of Proof of Pickup.
--
-- MEASURED BEFORE-STATE (live catalog, 2026-11-18)
--   logistics_schema.drivers.platform_user_id uuid NULL, FOREIGN KEY to
--     auth.users(id) already exists; SELECT policies "Driver views own
--     profile" (platform_user_id = auth.uid()) and, on asset_assignments,
--     "Driver views own assignments" already exist. No schema change needed.
--   gps_location_updates INSERT "Driver inserts GPS updates": WITH CHECK
--     requires app.platform_roles role DRIVER -- a dead token (zero rows,
--     DRIVER is not canonical). Path inert for every session.
--   driver_identity_verifications INSERT "Driver inserts verifications":
--     same dead DRIVER token. Path inert.
--   proof_of_delivery INSERT "Transporter submits POD for own booking"
--     (migration 063): effective_marketplace_role()='TRANSPORTER' +
--     dual-parent + booking-transporter ownership. No Driver branch.
--   shipment_tracking_records: 7 policies; no Driver SELECT branch, so an
--     assigned Driver cannot read the tracking record it operates on.
--   public.atomic_tracking_status_update (035/042/045/046 lineage, 066
--     VERIFIED-POD completion gate): role hierarchy admits ADMIN/SUPER_ADMIN/
--     MODERATOR, DISPATCHER/delegation, TRANSPORTER booking owner; a
--     role-less account (the only shape a linked Driver account can have)
--     falls into the ELSE refusal.
--   app.platform_roles holds SUPER_ADMIN x1 + DISPATCHER x1;
--     app.marketplace_memberships holds SHIPPER x3 + TRANSPORTER x3.
--   service_role holds NO SELECT on app.platform_roles /
--     app.marketplace_memberships (I-2 least-privilege containment), so the
--     application cannot read a target account's roles; the boundary below
--     is therefore enforced in the database predicates themselves using the
--     existing pinned SECURITY DEFINER resolvers, not by a new function.
--
-- EXACT CHANGE (five objects; nothing else)
--   1. gps_location_updates INSERT policy replaced: the dead DRIVER token is
--      swapped for an assignment-scoped Driver predicate: the caller's
--      linked driver row (drivers.platform_user_id = auth.uid()) must hold a
--      PLANNED/ACTIVE asset_assignments row for the submitted tracking_id,
--      and the caller must hold NO marketplace membership and NO platform
--      role (effective_marketplace_role()/effective_user_role() both NULL).
--   2. driver_identity_verifications INSERT policy replaced: same
--      assignment-scoped predicate, additionally pinning the inserted
--      driver_id to the caller's own linked driver row and booking_id to the
--      booking of the assigned tracking record (dual-parent integrity,
--      mirroring the 063 POD pattern).
--   3. proof_of_delivery INSERT policy replaced (same name): the 063
--      Transporter branch is preserved VERBATIM and one Driver branch is
--      added with the same assignment scope + role-less conjuncts +
--      dual-parent + non-deleted booking/tracking guards.
--   4. ONE new SELECT policy on shipment_tracking_records: "Driver reads
--      assigned tracking" -- the same assignment scope + role-less
--      conjuncts + is_deleted = false. Policy count 7 -> 8. No write branch.
--   5. public.atomic_tracking_status_update: ONE added ELSIF branch between
--      the TRANSPORTER branch and the ELSE refusal, admitting a role-less
--      caller with a PLANNED/ACTIVE assignment for the target tracking
--      record, and refusing COMPLETED/CANCELLED targets for that branch
--      (Drivers submit operational progress; lifecycle termination and
--      completion remain with the Transporter/platform). Every other byte
--      of the function -- identity checks, vocabulary, the role hierarchy,
--      the DEFECT-003 transition matrix, the 066 VERIFIED-POD completion
--      gate, the atomic UPDATE + tracking_events INSERT -- is preserved.
--
-- WHY THE ROLE-LESS CONJUNCTS
--   A Driver is a MOD-014 asset record subordinate to a Transporter, not an
--   account class (I-5 Sec.3D, PROMPT 0 v1.3). Linking a platform account to
--   a driver row must not hand that account a second authority surface: an
--   account that already holds a marketplace membership or a platform role
--   keeps exactly its existing authorities and gains nothing from the link
--   (in particular a Shipper can never submit POD evidence on its own
--   booking through a driver link). The registration route cannot add a
--   membership to an existing account, so a lawfully linked role-less
--   account cannot later acquire a marketplace role; platform-role
--   assignment is an explicit administrator act, after which the role
--   branches of the RPC and the existing platform policies govern.
--
-- WHY THIS IS NOT A WEAKENING
--   Every replaced predicate was FALSE for every real session (dead DRIVER
--   token) or is preserved verbatim (063 Transporter POD branch). The new
--   branches admit only a caller whose linked driver row is assigned to the
--   specific shipment by the owning Transporter, only while the assignment
--   is PLANNED/ACTIVE, and only while the caller holds no other role. No
--   grant, schema object, index, constraint, trigger, RLS flag, ownership or
--   function signature is added or changed except the five objects above.
--   marketplace_book_handoff, confirm_booking_with_contract,
--   accept_and_finalize_contract and atomic_tracking_complete are asserted
--   byte-identical by the DO block. Migrations 067/068/069 objects are
--   untouched (matches policy census asserted unchanged).
--
-- RECURSION
--   No new/replaced predicate names its own relation in FROM/JOIN: gps and
--   div reference drivers/asset_assignments/shipment_tracking_records/
--   bookings; the POD policy references tracking/bookings/drivers/
--   assignments; the tracking SELECT policy references drivers/
--   asset_assignments only. Self-reference census asserted 0 after.
--
-- ROLLBACK (exact inverse)
--   DROP POLICY IF EXISTS "Driver reads assigned tracking" ON logistics_schema.shipment_tracking_records;
--   DROP POLICY IF EXISTS "Driver inserts GPS updates" ON logistics_schema.gps_location_updates;
--   CREATE POLICY "Driver inserts GPS updates" ON logistics_schema.gps_location_updates
--     FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM app.platform_roles pr
--       WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER'::text));
--   DROP POLICY IF EXISTS "Driver inserts verifications" ON logistics_schema.driver_identity_verifications;
--   CREATE POLICY "Driver inserts verifications" ON logistics_schema.driver_identity_verifications
--     FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM app.platform_roles pr
--       WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER'::text));
--   DROP POLICY IF EXISTS "Transporter submits POD for own booking" ON logistics_schema.proof_of_delivery;
--   CREATE POLICY "Transporter submits POD for own booking" ON logistics_schema.proof_of_delivery
--     FOR INSERT WITH CHECK (
--       (effective_marketplace_role() = 'TRANSPORTER'::text) AND (EXISTS (SELECT 1
--         FROM logistics_schema.shipment_tracking_records tr
--         JOIN logistics_schema.bookings b ON b.id = tr.booking_id
--         WHERE tr.id = proof_of_delivery.tracking_id
--           AND b.id = proof_of_delivery.booking_id
--           AND b.transporter_id = auth.uid() AND b.is_deleted = false AND tr.is_deleted = false)));
--   Then restore public.atomic_tracking_status_update to its pre-070 body
--   (the 066 version, captured verbatim in the migration journal evidence;
--   the only difference is the removed Driver ELSIF branch).
--
-- APPLICATION PROCEDURE
--   Apply via Supabase apply_migration with name
--   070_prei6_final_driver_operations, then re-measure from the catalog and
--   via real-session HTTP. File existence is not proof of application.
-- ============================================================================

DO $fc070$
DECLARE
  v_expr           TEXT;
  v_fn_before      TEXT;
  v_handoff_before TEXT;
  v_confirm_before TEXT;
  v_accept_before  TEXT;
  v_complete_before TEXT;
  v_matches_before TEXT;
  v_new_fn         TEXT;
BEGIN
  -- ------------------------------------------------------------------
  -- Capture protected function bodies and the matches policy census.
  -- ------------------------------------------------------------------
  SELECT pg_get_functiondef(p.oid) INTO v_handoff_before
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff';
  SELECT pg_get_functiondef(p.oid) INTO v_confirm_before
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'confirm_booking_with_contract';
  SELECT pg_get_functiondef(p.oid) INTO v_accept_before
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'accept_and_finalize_contract';
  SELECT pg_get_functiondef(p.oid) INTO v_complete_before
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_complete';
  IF v_handoff_before IS NULL OR v_confirm_before IS NULL OR v_accept_before IS NULL OR v_complete_before IS NULL THEN
    RAISE EXCEPTION 'FC070 PRE: a protected function is absent';
  END IF;

  SELECT string_agg(p.polname || ':' || p.polcmd::text, ',' ORDER BY p.polname) INTO v_matches_before
    FROM pg_policy p WHERE p.polrelid = 'marketplace_schema.matches'::regclass;

  SELECT pg_get_functiondef(p.oid) INTO v_fn_before
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_status_update';
  IF v_fn_before IS NULL THEN
    RAISE EXCEPTION 'FC070 PRE: atomic_tracking_status_update absent';
  END IF;
  IF strpos(v_fn_before, 'POD_REQUIRED') = 0 THEN
    RAISE EXCEPTION 'FC070 PRE: the 066 VERIFIED-POD completion gate is missing from atomic_tracking_status_update';
  END IF;
  IF strpos(v_fn_before, 'platform_user_id') > 0 THEN
    RAISE EXCEPTION 'FC070 PRE: atomic_tracking_status_update already carries a driver branch';
  END IF;

  -- ------------------------------------------------------------------
  -- PRE-GUARDS: measured before-state
  -- ------------------------------------------------------------------
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.gps_location_updates'::regclass) <> 2
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.driver_identity_verifications'::regclass) <> 3
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.proof_of_delivery'::regclass) <> 3
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.shipment_tracking_records'::regclass) <> 7 THEN
    RAISE EXCEPTION 'FC070 PRE: a target table policy count differs from the measured before-state';
  END IF;

  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.gps_location_updates'::regclass
     AND p.polname = 'Driver inserts GPS updates';
  IF v_expr IS NULL OR strpos(v_expr, 'DRIVER') = 0 THEN
    RAISE EXCEPTION 'FC070 PRE: gps INSERT policy is absent or no longer the dead DRIVER token';
  END IF;
  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.driver_identity_verifications'::regclass
     AND p.polname = 'Driver inserts verifications';
  IF v_expr IS NULL OR strpos(v_expr, 'DRIVER') = 0 THEN
    RAISE EXCEPTION 'FC070 PRE: div INSERT policy is absent or no longer the dead DRIVER token';
  END IF;
  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
     AND p.polname = 'Transporter submits POD for own booking';
  IF v_expr IS NULL OR strpos(v_expr, 'effective_marketplace_role()') = 0 OR strpos(v_expr, 'b.transporter_id = auth.uid()') = 0 THEN
    RAISE EXCEPTION 'FC070 PRE: POD INSERT policy is absent or lost the 063 transporter branch';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'logistics_schema.drivers'::regclass AND contype = 'f'
                    AND pg_get_constraintdef(oid) LIKE '%platform_user_id%auth.users%') THEN
    RAISE EXCEPTION 'FC070 PRE: drivers.platform_user_id FK to auth.users is absent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                  WHERE polrelid = 'logistics_schema.drivers'::regclass
                    AND polname = 'Driver views own profile')
     OR NOT EXISTS (SELECT 1 FROM pg_policy
                     WHERE polrelid = 'logistics_schema.asset_assignments'::regclass
                       AND polname = 'Driver views own assignments') THEN
    RAISE EXCEPTION 'FC070 PRE: the existing driver self-read policies are absent';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.gps_location_updates'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.driver_identity_verifications'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.proof_of_delivery'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.shipment_tracking_records'::regclass) THEN
    RAISE EXCEPTION 'FC070 PRE: RLS is not enabled on a target table';
  END IF;
  IF (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.gps_location_updates'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.driver_identity_verifications'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.proof_of_delivery'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.shipment_tracking_records'::regclass) THEN
    RAISE EXCEPTION 'FC070 PRE: relforcerowsecurity is set on a target table';
  END IF;
  IF NOT has_table_privilege('authenticated', 'logistics_schema.gps_location_updates', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'logistics_schema.driver_identity_verifications', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'logistics_schema.proof_of_delivery', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'logistics_schema.shipment_tracking_records', 'SELECT') THEN
    RAISE EXCEPTION 'FC070 PRE: authenticated lacks the measured privilege on a target table';
  END IF;
  IF has_table_privilege('anon', 'logistics_schema.gps_location_updates', 'INSERT')
     OR has_table_privilege('anon', 'logistics_schema.driver_identity_verifications', 'INSERT')
     OR has_table_privilege('anon', 'logistics_schema.proof_of_delivery', 'INSERT') THEN
    RAISE EXCEPTION 'FC070 PRE: anon holds INSERT on a target table';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'effective_marketplace_role'
                    AND p.pronargs = 0 AND p.prosecdef AND p.provolatile = 's'
                    AND pg_get_userbyid(p.proowner) = 'postgres'
                    AND p.proconfig @> ARRAY['search_path=pg_catalog, public'])
     OR NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public' AND p.proname = 'effective_user_role'
                       AND p.pronargs = 0 AND p.prosecdef
                       AND pg_get_userbyid(p.proowner) = 'postgres') THEN
    RAISE EXCEPTION 'FC070 PRE: a role resolver is absent or changed';
  END IF;

  -- ------------------------------------------------------------------
  -- 1. GPS INSERT: assignment-scoped driver predicate
  -- ------------------------------------------------------------------
  EXECUTE $sql$DROP POLICY IF EXISTS "Driver inserts GPS updates" ON logistics_schema.gps_location_updates$sql$;
  EXECUTE $sql$CREATE POLICY "Driver inserts GPS updates"
    ON logistics_schema.gps_location_updates FOR INSERT
    WITH CHECK (
      public.effective_marketplace_role() IS NULL
      AND public.effective_user_role() IS NULL
      AND EXISTS (
        SELECT 1
        FROM logistics_schema.asset_assignments aa
        JOIN logistics_schema.drivers d ON d.id = aa.driver_id
        WHERE d.platform_user_id = auth.uid()
          AND aa.shipment_tracking_id = gps_location_updates.tracking_id
          AND aa.status IN ('PLANNED', 'ACTIVE')
      )
    )$sql$;

  -- ------------------------------------------------------------------
  -- 2. Driver identity verification INSERT (Proof of Pickup evidence,
  --    MOD-003 Sec.4.7): assignment scope + own-driver + dual-parent pins
  -- ------------------------------------------------------------------
  EXECUTE $sql$DROP POLICY IF EXISTS "Driver inserts verifications" ON logistics_schema.driver_identity_verifications$sql$;
  EXECUTE $sql$CREATE POLICY "Driver inserts verifications"
    ON logistics_schema.driver_identity_verifications FOR INSERT
    WITH CHECK (
      public.effective_marketplace_role() IS NULL
      AND public.effective_user_role() IS NULL
      AND EXISTS (
        SELECT 1
        FROM logistics_schema.asset_assignments aa
        JOIN logistics_schema.drivers d ON d.id = aa.driver_id
        JOIN logistics_schema.shipment_tracking_records tr ON tr.id = aa.shipment_tracking_id
        WHERE d.platform_user_id = auth.uid()
          AND d.id = driver_identity_verifications.driver_id
          AND aa.shipment_tracking_id = driver_identity_verifications.tracking_id
          AND tr.booking_id = driver_identity_verifications.booking_id
          AND aa.status IN ('PLANNED', 'ACTIVE')
          AND tr.is_deleted = false
      )
    )$sql$;

  -- ------------------------------------------------------------------
  -- 3. POD INSERT: 063 Transporter branch verbatim + assignment-scoped
  --    Driver branch (same name, command, permissive mode, PUBLIC scope)
  -- ------------------------------------------------------------------
  EXECUTE $sql$DROP POLICY IF EXISTS "Transporter submits POD for own booking" ON logistics_schema.proof_of_delivery$sql$;
  EXECUTE $sql$CREATE POLICY "Transporter submits POD for own booking"
    ON logistics_schema.proof_of_delivery FOR INSERT
    WITH CHECK (
      (
        public.effective_marketplace_role() = 'TRANSPORTER'
        AND EXISTS (
          SELECT 1
          FROM logistics_schema.shipment_tracking_records tr
          JOIN logistics_schema.bookings b ON b.id = tr.booking_id
          WHERE tr.id = proof_of_delivery.tracking_id
            AND b.id = proof_of_delivery.booking_id
            AND b.transporter_id = auth.uid()
            AND b.is_deleted = false
            AND tr.is_deleted = false
        )
      )
      OR (
        public.effective_marketplace_role() IS NULL
        AND public.effective_user_role() IS NULL
        AND EXISTS (
          SELECT 1
          FROM logistics_schema.asset_assignments aa
          JOIN logistics_schema.drivers d ON d.id = aa.driver_id
          JOIN logistics_schema.shipment_tracking_records tr ON tr.id = aa.shipment_tracking_id
          JOIN logistics_schema.bookings b ON b.id = tr.booking_id
          WHERE d.platform_user_id = auth.uid()
            AND aa.shipment_tracking_id = proof_of_delivery.tracking_id
            AND tr.booking_id = proof_of_delivery.booking_id
            AND aa.status IN ('PLANNED', 'ACTIVE')
            AND b.is_deleted = false
            AND tr.is_deleted = false
        )
      )
    )$sql$;

  -- ------------------------------------------------------------------
  -- 4. Tracking SELECT: assigned driver may read the record it operates on
  -- ------------------------------------------------------------------
  EXECUTE $sql$CREATE POLICY "Driver reads assigned tracking"
    ON logistics_schema.shipment_tracking_records FOR SELECT
    USING (
      public.effective_marketplace_role() IS NULL
      AND public.effective_user_role() IS NULL
      AND is_deleted = false
      AND EXISTS (
        SELECT 1
        FROM logistics_schema.asset_assignments aa
        JOIN logistics_schema.drivers d ON d.id = aa.driver_id
        WHERE d.platform_user_id = auth.uid()
          AND aa.shipment_tracking_id = shipment_tracking_records.id
          AND aa.status IN ('PLANNED', 'ACTIVE')
      )
    )$sql$;

  -- ------------------------------------------------------------------
  -- 5. atomic_tracking_status_update: add exactly one Driver ELSIF branch.
  --    The pre-070 body is preserved byte-for-byte except the insertion.
  -- ------------------------------------------------------------------
  v_new_fn := replace(v_fn_before,
    $marker$    ELSE
        RAISE EXCEPTION 'FORBIDDEN: role ''%'' is not authorized for tracking status updates', COALESCE(v_role, 'unassigned');$marker$,
    $marker$    ELSIF v_role IS NULL AND EXISTS (
        SELECT 1
        FROM logistics_schema.asset_assignments aa
        JOIN logistics_schema.drivers d ON d.id = aa.driver_id
        WHERE d.platform_user_id = v_caller
          AND aa.shipment_tracking_id = p_tracking_id
          AND aa.status IN ('PLANNED', 'ACTIVE')
    ) THEN
        IF p_target_status IN ('COMPLETED', 'CANCELLED') THEN
            RAISE EXCEPTION 'FORBIDDEN: an assigned driver may not complete or cancel a shipment';
        END IF;
    ELSE
        RAISE EXCEPTION 'FORBIDDEN: role ''%'' is not authorized for tracking status updates', COALESCE(v_role, 'unassigned');$marker$);
  IF v_new_fn = v_fn_before THEN
    RAISE EXCEPTION 'FC070: the ELSE anchor of atomic_tracking_status_update did not match; function unchanged';
  END IF;
  EXECUTE v_new_fn;

  -- ------------------------------------------------------------------
  -- POST-GUARDS
  -- ------------------------------------------------------------------
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.gps_location_updates'::regclass) <> 2
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.driver_identity_verifications'::regclass) <> 3
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.proof_of_delivery'::regclass) <> 3
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.shipment_tracking_records'::regclass) <> 8 THEN
    RAISE EXCEPTION 'FC070 POST: a policy count moved unexpectedly';
  END IF;

  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.gps_location_updates'::regclass
     AND p.polname = 'Driver inserts GPS updates';
  IF v_expr IS NULL OR strpos(v_expr, 'platform_user_id = auth.uid()') = 0
     OR strpos(v_expr, '(aa.status)::text = ANY ((ARRAY[''PLANNED''::character varying, ''ACTIVE''::character varying])::text[])') = 0
     OR strpos(v_expr, 'effective_marketplace_role() IS NULL') = 0
     OR strpos(v_expr, 'effective_user_role() IS NULL') = 0
     OR strpos(v_expr, 'DRIVER') > 0 OR strpos(v_expr, 'platform_roles') > 0 THEN
    RAISE EXCEPTION 'FC070 POST: gps INSERT replacement lost the assignment scope or kept the dead token';
  END IF;

  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.driver_identity_verifications'::regclass
     AND p.polname = 'Driver inserts verifications';
  IF v_expr IS NULL OR strpos(v_expr, 'd.id = driver_identity_verifications.driver_id') = 0
     OR strpos(v_expr, 'tr.booking_id = driver_identity_verifications.booking_id') = 0
     OR strpos(v_expr, 'platform_user_id = auth.uid()') = 0
     OR strpos(v_expr, 'DRIVER') > 0 THEN
    RAISE EXCEPTION 'FC070 POST: div INSERT replacement lost a pin or kept the dead token';
  END IF;

  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
     AND p.polname = 'Transporter submits POD for own booking';
  IF v_expr IS NULL OR strpos(v_expr, 'effective_marketplace_role() = ''TRANSPORTER''') = 0
     OR strpos(v_expr, 'b.transporter_id = auth.uid()') = 0
     OR strpos(v_expr, 'platform_user_id = auth.uid()') = 0
     OR strpos(v_expr, '(aa.status)::text = ANY ((ARRAY[''PLANNED''::character varying, ''ACTIVE''::character varying])::text[])') = 0 THEN
    RAISE EXCEPTION 'FC070 POST: POD INSERT replacement lost the 063 branch or the driver scope';
  END IF;

  SELECT pg_get_expr(p.polqual, p.polrelid) INTO v_expr
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
     AND p.polname = 'Driver reads assigned tracking';
  IF v_expr IS NULL OR strpos(v_expr, 'platform_user_id = auth.uid()') = 0
     OR strpos(v_expr, 'is_deleted = false') = 0 THEN
    RAISE EXCEPTION 'FC070 POST: tracking SELECT driver policy absent or wrong';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_new_fn
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_status_update';
  IF strpos(v_new_fn, 'platform_user_id = v_caller') = 0
     OR strpos(v_new_fn, 'an assigned driver may not complete or cancel') = 0
     OR strpos(v_new_fn, 'POD_REQUIRED') = 0 THEN
    RAISE EXCEPTION 'FC070 POST: the function lost the driver branch or the 066 completion gate';
  END IF;
  IF (SELECT p.prosecdef AND p.provolatile = 'v'
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_status_update') IS NOT TRUE THEN
    RAISE EXCEPTION 'FC070 POST: function security/volatility properties moved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_status_update'
                    AND p.proconfig @> ARRAY['search_path=pg_catalog, public']) THEN
    RAISE EXCEPTION 'FC070 POST: function search_path pin moved';
  END IF;

  -- Protected functions byte-identical
  IF (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff') IS DISTINCT FROM v_handoff_before
     OR (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'confirm_booking_with_contract') IS DISTINCT FROM v_confirm_before
     OR (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'accept_and_finalize_contract') IS DISTINCT FROM v_accept_before
     OR (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'atomic_tracking_complete') IS DISTINCT FROM v_complete_before THEN
    RAISE EXCEPTION 'FC070 POST: a protected function body changed';
  END IF;

  -- matches policies (069) untouched
  IF (SELECT string_agg(p.polname || ':' || p.polcmd::text, ',' ORDER BY p.polname)
        FROM pg_policy p WHERE p.polrelid = 'marketplace_schema.matches'::regclass) IS DISTINCT FROM v_matches_before THEN
    RAISE EXCEPTION 'FC070 POST: the matches policy census moved';
  END IF;

  -- Privilege set unchanged
  IF NOT has_table_privilege('authenticated', 'logistics_schema.gps_location_updates', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'logistics_schema.driver_identity_verifications', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'logistics_schema.proof_of_delivery', 'INSERT')
     OR has_table_privilege('anon', 'logistics_schema.gps_location_updates', 'INSERT')
     OR has_table_privilege('anon', 'logistics_schema.driver_identity_verifications', 'INSERT')
     OR has_table_privilege('anon', 'logistics_schema.proof_of_delivery', 'INSERT') THEN
    RAISE EXCEPTION 'FC070 POST: the privilege set moved; this file must not grant or revoke anything';
  END IF;

  -- No self-referencing policy anywhere
  IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'FROM ' || n.nspname || '.' || c.relname) > 0
          OR strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'JOIN ' || n.nspname || '.' || c.relname) > 0) <> 0 THEN
    RAISE EXCEPTION 'FC070 POST: a self-referencing policy exists in the catalog';
  END IF;
END
$fc070$;