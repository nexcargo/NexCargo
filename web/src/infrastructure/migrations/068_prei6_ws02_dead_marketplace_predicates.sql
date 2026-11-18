-- ============================================================================
-- NexCargo Migration 068 -- PRE-I-6 WS-02 / D-WS02-1
-- Correct the dead marketplace-role predicates in three logistics_schema RLS
-- policies. Authorized by: LA DIRECTIVE -- PRE-I-6 LA DECISIONS AND REMEDIATION,
-- Sec.3 D-WS02-1 (APPROVED). Smallest safe change; no broad policy rewrite.
--
-- FINDING (measured live 2026-11-17, owner-class catalog + real-session HTTP)
--   app.platform_roles is the LIVE PLATFORM-STAFF role table: it holds only
--   DISPATCHER (1) and SUPER_ADMIN (1). It holds ZERO SHIPPER, TRANSPORTER or
--   DRIVER rows. Marketplace roles live in app.marketplace_memberships (SHIPPER
--   3, TRANSPORTER 3), whose CHECK admits only 'SHIPPER' and 'TRANSPORTER', and
--   are resolved by public.effective_marketplace_role() (SECURITY DEFINER,
--   STABLE, owner postgres, search_path pinned pg_catalog/public, keyed on
--   auth.uid()). public.effective_user_role() reads app.platform_roles and is
--   the PLATFORM resolver. The two sources are distinct and must stay distinct.
--   Three policies test MARKETPLACE tokens against the PLATFORM table, so they
--   are dead for every real marketplace user:
--     1. documents INSERT "Shipper transporter upload documents"
--        WITH CHECK requires app.platform_roles.role IN ('SHIPPER','TRANSPORTER').
--        LIVE BEFORE proof: a real Shipper session POST of a valid user-linked
--        document returned HTTP 403 / 42501 "new row violates row-level security
--        policy for table documents" (zero persistence).
--     2. shipment_tracking_records UPDATE "Transporter updates own booking
--        tracking" USING/WITH CHECK require app.platform_roles.role='TRANSPORTER'
--        conjoined with booking ownership. The role conjunct is dead.
--     3. tracking_events INSERT "I2 tracking mutations insert events" WITH CHECK
--        admits app.platform_roles.role IN ('DRIVER','MODERATOR','ADMIN',
--        'SUPER_ADMIN') OR a delegated-scope branch. The DRIVER token is dead;
--        MODERATOR/ADMIN/SUPER_ADMIN are genuine platform tokens and are kept.
--
-- EXACT CHANGE (three policies only; name, command, permissive mode and role
-- scope preserved; nothing granted, revoked, added or dropped except the three
-- predicate replacements)
--   1. documents INSERT: replace the dead app.platform_roles SHIPPER/TRANSPORTER
--      EXISTS with public.effective_marketplace_role() = ANY(ARRAY['SHIPPER',
--      'TRANSPORTER']). The booking-ownership and user-identity branches are
--      preserved VERBATIM, so resource isolation is unchanged.
--   2. shipment_tracking_records UPDATE: replace the dead app.platform_roles
--      TRANSPORTER EXISTS with public.effective_marketplace_role()='TRANSPORTER'.
--      The booking-ownership conjunct (b.transporter_id = auth.uid()) is
--      preserved VERBATIM in both USING and WITH CHECK.
--   3. tracking_events INSERT: remove the dead 'DRIVER' token from the
--      app.platform_roles array (keeping MODERATOR/ADMIN/SUPER_ADMIN), and add
--      the approved Transporter-party branch: effective_marketplace_role()=
--      'TRANSPORTER' AND tracking_id belongs to a booking whose transporter_id
--      = auth.uid(). The delegated-scope branch is preserved VERBATIM. This is
--      the replacement recommended in NXC-PREI6-WS02-001 Item 5 and approved by
--      D-WS02-1; it invents no new role and reads no client-writable metadata.
--
-- DEFERRED (related evidence, NOT modified -- D-WS02-1 defers the two DRIVER-only
-- INSERT policies because DRIVER is not a canonical marketplace classification
-- and no DRIVER membership exists; correcting them needs a separate LA decision
-- on the DRIVER operational identity):
--   driver_identity_verifications INSERT "Driver inserts verifications"
--   gps_location_updates INSERT "Driver inserts GPS updates"
--   The DO block captures their exact before-expressions into plpgsql variables
--   and asserts byte-equality afterwards, so they are provably untouched.
--
-- WHY THIS IS NOT A WEAKENING
--   Each replacement swaps a predicate that is FALSE for every real marketplace
--   user (zero matching platform_roles rows) for the authoritative membership
--   resolver, while keeping every ownership / identity / delegation conjunct
--   verbatim. No caller who was lawfully admitted before loses access; the only
--   behaviour change is that legitimate SHIPPER/TRANSPORTER members are no longer
--   refused by a dead token. The platform-staff branch of tracking_events keeps
--   its genuine MODERATOR/ADMIN/SUPER_ADMIN tokens against app.platform_roles.
--   No privilege, grant, RLS flag, ownership, function or signature is touched.
--   app stays outside the PostgREST exposed set. The resolver never reads
--   user_metadata and never accepts a caller-supplied user id.
--
-- RECURSION
--   No replacement names its own relation in a FROM/JOIN. documents and the
--   tracking UPDATE reference logistics_schema.bookings; tracking_events
--   references shipment_tracking_records JOIN bookings -- the same parent-record
--   pattern the existing "I2 read tracking events via parent record" SELECT
--   policy already uses. The global self-reference census is 0 before and after.
--
-- BEFORE-STATE (measured live 2026-11-17)
--   documents: 8 policies, RLS on, force off, authenticated SELECT/INSERT/UPDATE
--     true, anon INSERT false, service_role INSERT true.
--   shipment_tracking_records: 7 policies, RLS on, force off, authenticated
--     SELECT/INSERT/UPDATE true, anon INSERT false, service_role INSERT false.
--   tracking_events: 2 policies, RLS on, force off, authenticated SELECT/INSERT
--     true, UPDATE false, anon INSERT false, service_role INSERT false.
--   driver_identity_verifications: 3 policies. gps_location_updates: 2 policies.
--   All three target policies PERMISSIVE; documents and the tracking UPDATE are
--   PUBLIC scope; tracking_events INSERT is scoped to {authenticated}.
--
-- ROLLBACK (exact inverse; restores the three dead-token predicates verbatim)
--   DROP POLICY IF EXISTS "Shipper transporter upload documents" ON logistics_schema.documents;
--   CREATE POLICY "Shipper transporter upload documents" ON logistics_schema.documents
--     FOR INSERT WITH CHECK (
--       (EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid()
--                AND pr.role = ANY (ARRAY['SHIPPER'::text,'TRANSPORTER'::text])))
--       AND ((((linked_entity_type)::text = 'booking'::text) AND linked_entity_id IN
--             (SELECT b.id FROM logistics_schema.bookings b
--              WHERE b.shipper_id = auth.uid() AND b.is_deleted = false))
--            OR (((linked_entity_type)::text = 'user'::text) AND linked_entity_id = auth.uid())));
--   DROP POLICY IF EXISTS "Transporter updates own booking tracking" ON logistics_schema.shipment_tracking_records;
--   CREATE POLICY "Transporter updates own booking tracking" ON logistics_schema.shipment_tracking_records
--     FOR UPDATE USING (
--       (EXISTS (SELECT 1 FROM logistics_schema.bookings b
--                WHERE b.id = shipment_tracking_records.booking_id AND b.transporter_id = auth.uid()))
--       AND (EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'TRANSPORTER'::text)))
--     WITH CHECK (
--       (EXISTS (SELECT 1 FROM logistics_schema.bookings b
--                WHERE b.id = shipment_tracking_records.booking_id AND b.transporter_id = auth.uid()))
--       AND (EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'TRANSPORTER'::text)));
--   DROP POLICY IF EXISTS "I2 tracking mutations insert events" ON logistics_schema.tracking_events;
--   CREATE POLICY "I2 tracking mutations insert events" ON logistics_schema.tracking_events
--     FOR INSERT TO authenticated WITH CHECK (
--       (EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid()
--                AND pr.role = ANY (ARRAY['DRIVER'::text,'MODERATOR'::text,'ADMIN'::text,'SUPER_ADMIN'::text])))
--       OR (has_operational_scope('tracking_update'::text) AND logistics_schema.delegated_shipment(tracking_id)));
--
-- APPLICATION PROCEDURE
--   Apply via Supabase apply_migration with name 068_prei6_ws02_dead_marketplace_predicates,
--   then re-measure from the catalog (pg_policy / pg_get_expr / has_table_privilege)
--   and via real-session HTTP plus rolled-back role-simulated RLS probes. File
--   existence is not proof of application; the journal row and catalog
--   measurements are. The whole change is one DO block, so it is atomic and the
--   deferred-policy comparison does not depend on cross-statement temp state.
-- ============================================================================

DO $ws02$
DECLARE
  v_rec        RECORD;
  v_div_before TEXT;
  v_gps_before TEXT;
BEGIN
  -- ------------------------------------------------------------------
  -- Capture the two deferred DRIVER-only policies verbatim (untouched).
  -- ------------------------------------------------------------------
  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_div_before
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.driver_identity_verifications'::regclass
     AND p.polname = 'Driver inserts verifications';
  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_gps_before
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.gps_location_updates'::regclass
     AND p.polname = 'Driver inserts GPS updates';
  IF v_div_before IS NULL OR v_gps_before IS NULL THEN
    RAISE EXCEPTION 'WS02 PRE: a deferred DRIVER-only INSERT policy is absent';
  END IF;

  -- ------------------------------------------------------------------
  -- PRE-GUARDS
  -- ------------------------------------------------------------------
  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polwithcheck, p.polrelid) AS wc
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.documents'::regclass
     AND p.polname = 'Shipper transporter upload documents';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02 PRE: documents INSERT target policy absent'; END IF;
  IF v_rec.polcmd <> 'a' OR NOT v_rec.polpermissive THEN
    RAISE EXCEPTION 'WS02 PRE: documents target is not a permissive INSERT policy'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_rec.polroles) u JOIN pg_roles g ON g.oid = u) THEN
    RAISE EXCEPTION 'WS02 PRE: documents target is not PUBLIC scope'; END IF;
  IF strpos(v_rec.wc, 'app.platform_roles') = 0
     OR strpos(v_rec.wc, 'SHIPPER') = 0 OR strpos(v_rec.wc, 'TRANSPORTER') = 0
     OR strpos(v_rec.wc, 'b.shipper_id = auth.uid()') = 0 THEN
    RAISE EXCEPTION 'WS02 PRE: documents target lacks the measured dead token + ownership branch'; END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polqual, p.polrelid) AS qual,
         pg_get_expr(p.polwithcheck, p.polrelid) AS wc
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
     AND p.polname = 'Transporter updates own booking tracking';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02 PRE: tracking UPDATE target policy absent'; END IF;
  IF v_rec.polcmd <> 'w' OR NOT v_rec.polpermissive THEN
    RAISE EXCEPTION 'WS02 PRE: tracking target is not a permissive UPDATE policy'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_rec.polroles) u JOIN pg_roles g ON g.oid = u) THEN
    RAISE EXCEPTION 'WS02 PRE: tracking target is not PUBLIC scope'; END IF;
  IF strpos(v_rec.qual, 'app.platform_roles') = 0 OR strpos(v_rec.wc, 'app.platform_roles') = 0
     OR strpos(v_rec.qual, 'b.transporter_id = auth.uid()') = 0 THEN
    RAISE EXCEPTION 'WS02 PRE: tracking target lacks the measured dead token + ownership conjunct'; END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polwithcheck, p.polrelid) AS wc
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.tracking_events'::regclass
     AND p.polname = 'I2 tracking mutations insert events';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02 PRE: tracking_events INSERT target policy absent'; END IF;
  IF v_rec.polcmd <> 'a' OR NOT v_rec.polpermissive THEN
    RAISE EXCEPTION 'WS02 PRE: tracking_events target is not a permissive INSERT policy'; END IF;
  IF NOT (v_rec.polroles = ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'authenticated')]) THEN
    RAISE EXCEPTION 'WS02 PRE: tracking_events target is not scoped to authenticated'; END IF;
  IF strpos(v_rec.wc, 'DRIVER') = 0
     OR strpos(v_rec.wc, 'has_operational_scope(''tracking_update''::text) AND logistics_schema.delegated_shipment(tracking_id)') = 0 THEN
    RAISE EXCEPTION 'WS02 PRE: tracking_events target lacks the measured DRIVER token + delegated branch'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'effective_marketplace_role'
                    AND p.pronargs = 0 AND p.prosecdef AND p.provolatile = 's'
                    AND pg_get_userbyid(p.proowner) = 'postgres'
                    AND p.proconfig @> ARRAY['search_path=pg_catalog, public']) THEN
    RAISE EXCEPTION 'WS02 PRE: public.effective_marketplace_role() is absent or not the pinned STABLE SECURITY DEFINER resolver'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                  WHERE c.conrelid = 'app.marketplace_memberships'::regclass AND c.contype = 'c'
                    AND pg_get_constraintdef(c.oid) LIKE '%SHIPPER%TRANSPORTER%') THEN
    RAISE EXCEPTION 'WS02 PRE: app.marketplace_memberships no longer constrains role to SHIPPER and TRANSPORTER'; END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.documents'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.shipment_tracking_records'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.tracking_events'::regclass) THEN
    RAISE EXCEPTION 'WS02 PRE: RLS is not enabled on a target table'; END IF;
  IF (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.documents'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.shipment_tracking_records'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.tracking_events'::regclass) THEN
    RAISE EXCEPTION 'WS02 PRE: relforcerowsecurity is set on a target table'; END IF;
  IF NOT has_table_privilege('authenticated', 'logistics_schema.documents', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'logistics_schema.shipment_tracking_records', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'logistics_schema.tracking_events', 'INSERT') THEN
    RAISE EXCEPTION 'WS02 PRE: authenticated lacks the measured privilege on a target table'; END IF;
  IF has_table_privilege('anon', 'logistics_schema.documents', 'INSERT')
     OR has_table_privilege('anon', 'logistics_schema.tracking_events', 'INSERT') THEN
    RAISE EXCEPTION 'WS02 PRE: anon holds INSERT on a target table'; END IF;

  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.documents'::regclass) <> 8
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.shipment_tracking_records'::regclass) <> 7
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.tracking_events'::regclass) <> 2
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.driver_identity_verifications'::regclass) <> 3
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.gps_location_updates'::regclass) <> 2 THEN
    RAISE EXCEPTION 'WS02 PRE: a target/deferred table policy count differs from the before-state'; END IF;

  IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'FROM ' || n.nspname || '.' || c.relname) > 0
          OR strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'JOIN ' || n.nspname || '.' || c.relname) > 0) <> 0 THEN
    RAISE EXCEPTION 'WS02 PRE: a self-referencing policy already exists in the catalog'; END IF;

  -- ------------------------------------------------------------------
  -- REPLACEMENTS (dollar-quoted EXECUTE; names/commands/scopes preserved)
  -- ------------------------------------------------------------------
  EXECUTE $sql$DROP POLICY IF EXISTS "Shipper transporter upload documents" ON logistics_schema.documents$sql$;
  EXECUTE $sql$CREATE POLICY "Shipper transporter upload documents"
    ON logistics_schema.documents FOR INSERT
    WITH CHECK (
      public.effective_marketplace_role() = ANY (ARRAY['SHIPPER'::text, 'TRANSPORTER'::text])
      AND (
        (((linked_entity_type)::text = 'booking'::text) AND linked_entity_id IN (
          SELECT b.id FROM logistics_schema.bookings b
          WHERE b.shipper_id = auth.uid() AND b.is_deleted = false))
        OR (((linked_entity_type)::text = 'user'::text) AND linked_entity_id = auth.uid())
      )
    )$sql$;

  EXECUTE $sql$DROP POLICY IF EXISTS "Transporter updates own booking tracking" ON logistics_schema.shipment_tracking_records$sql$;
  EXECUTE $sql$CREATE POLICY "Transporter updates own booking tracking"
    ON logistics_schema.shipment_tracking_records FOR UPDATE
    USING (
      EXISTS (SELECT 1 FROM logistics_schema.bookings b
              WHERE b.id = shipment_tracking_records.booking_id AND b.transporter_id = auth.uid())
      AND public.effective_marketplace_role() = 'TRANSPORTER'
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM logistics_schema.bookings b
              WHERE b.id = shipment_tracking_records.booking_id AND b.transporter_id = auth.uid())
      AND public.effective_marketplace_role() = 'TRANSPORTER'
    )$sql$;

  EXECUTE $sql$DROP POLICY IF EXISTS "I2 tracking mutations insert events" ON logistics_schema.tracking_events$sql$;
  EXECUTE $sql$CREATE POLICY "I2 tracking mutations insert events"
    ON logistics_schema.tracking_events FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM app.platform_roles pr
              WHERE pr.user_id = auth.uid()
                AND pr.role = ANY (ARRAY['MODERATOR'::text, 'ADMIN'::text, 'SUPER_ADMIN'::text]))
      OR (public.effective_marketplace_role() = 'TRANSPORTER' AND tracking_id IN (
            SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
            JOIN logistics_schema.bookings b ON b.id = tr.booking_id
            WHERE b.transporter_id = auth.uid()))
      OR (has_operational_scope('tracking_update'::text) AND logistics_schema.delegated_shipment(tracking_id))
    )$sql$;

  -- ------------------------------------------------------------------
  -- POST-GUARDS
  -- ------------------------------------------------------------------
  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polwithcheck, p.polrelid) AS wc
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.documents'::regclass
     AND p.polname = 'Shipper transporter upload documents';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02 POST: documents replacement absent'; END IF;
  IF v_rec.polcmd <> 'a' OR NOT v_rec.polpermissive THEN
    RAISE EXCEPTION 'WS02 POST: documents replacement changed command/permissive mode'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_rec.polroles) u JOIN pg_roles g ON g.oid = u) THEN
    RAISE EXCEPTION 'WS02 POST: documents replacement changed PUBLIC scope'; END IF;
  IF strpos(v_rec.wc, 'effective_marketplace_role()') = 0
     OR strpos(v_rec.wc, 'SHIPPER') = 0 OR strpos(v_rec.wc, 'TRANSPORTER') = 0
     OR strpos(v_rec.wc, 'b.shipper_id = auth.uid()') = 0
     OR strpos(v_rec.wc, 'linked_entity_id = auth.uid()') = 0 THEN
    RAISE EXCEPTION 'WS02 POST: documents replacement lost the resolver or an ownership branch'; END IF;
  IF strpos(v_rec.wc, 'platform_roles') > 0 OR strpos(v_rec.wc, 'user_metadata') > 0 THEN
    RAISE EXCEPTION 'WS02 POST: documents replacement still depends on a non-authoritative source'; END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polqual, p.polrelid) AS qual,
         pg_get_expr(p.polwithcheck, p.polrelid) AS wc
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
     AND p.polname = 'Transporter updates own booking tracking';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02 POST: tracking replacement absent'; END IF;
  IF v_rec.polcmd <> 'w' OR NOT v_rec.polpermissive THEN
    RAISE EXCEPTION 'WS02 POST: tracking replacement changed command/permissive mode'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_rec.polroles) u JOIN pg_roles g ON g.oid = u) THEN
    RAISE EXCEPTION 'WS02 POST: tracking replacement changed PUBLIC scope'; END IF;
  IF strpos(v_rec.qual, 'effective_marketplace_role()') = 0
     OR strpos(v_rec.wc, 'effective_marketplace_role()') = 0
     OR strpos(v_rec.qual, 'TRANSPORTER') = 0 OR strpos(v_rec.wc, 'TRANSPORTER') = 0
     OR strpos(v_rec.qual, 'b.transporter_id = auth.uid()') = 0
     OR strpos(v_rec.wc, 'b.transporter_id = auth.uid()') = 0 THEN
    RAISE EXCEPTION 'WS02 POST: tracking replacement lost the resolver or the ownership conjunct'; END IF;
  IF strpos(v_rec.qual, 'platform_roles') > 0 OR strpos(v_rec.wc, 'platform_roles') > 0 THEN
    RAISE EXCEPTION 'WS02 POST: tracking replacement still depends on the platform role table'; END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polwithcheck, p.polrelid) AS wc
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.tracking_events'::regclass
     AND p.polname = 'I2 tracking mutations insert events';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02 POST: tracking_events replacement absent'; END IF;
  IF v_rec.polcmd <> 'a' OR NOT v_rec.polpermissive THEN
    RAISE EXCEPTION 'WS02 POST: tracking_events replacement changed command/permissive mode'; END IF;
  IF NOT (v_rec.polroles = ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'authenticated')]) THEN
    RAISE EXCEPTION 'WS02 POST: tracking_events replacement changed authenticated scope'; END IF;
  IF strpos(v_rec.wc, 'effective_marketplace_role()') = 0
     OR strpos(v_rec.wc, 'b.transporter_id = auth.uid()') = 0
     OR strpos(v_rec.wc, 'MODERATOR') = 0 OR strpos(v_rec.wc, 'SUPER_ADMIN') = 0
     OR strpos(v_rec.wc, 'has_operational_scope(''tracking_update''::text) AND logistics_schema.delegated_shipment(tracking_id)') = 0 THEN
    RAISE EXCEPTION 'WS02 POST: tracking_events replacement lost the Transporter-party branch, a platform token or the delegated branch'; END IF;
  IF strpos(v_rec.wc, 'DRIVER') > 0 THEN
    RAISE EXCEPTION 'WS02 POST: tracking_events replacement still carries the dead DRIVER token'; END IF;
  IF strpos(v_rec.wc, 'user_metadata') > 0 THEN
    RAISE EXCEPTION 'WS02 POST: tracking_events replacement depends on client-writable metadata'; END IF;

  -- deferred policies byte-identical
  IF (SELECT pg_get_expr(p.polwithcheck, p.polrelid) FROM pg_policy p
       WHERE p.polrelid = 'logistics_schema.driver_identity_verifications'::regclass
         AND p.polname = 'Driver inserts verifications') IS DISTINCT FROM v_div_before THEN
    RAISE EXCEPTION 'WS02 POST: deferred driver_identity_verifications INSERT policy changed'; END IF;
  IF (SELECT pg_get_expr(p.polwithcheck, p.polrelid) FROM pg_policy p
       WHERE p.polrelid = 'logistics_schema.gps_location_updates'::regclass
         AND p.polname = 'Driver inserts GPS updates') IS DISTINCT FROM v_gps_before THEN
    RAISE EXCEPTION 'WS02 POST: deferred gps_location_updates INSERT policy changed'; END IF;

  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.documents'::regclass) <> 8
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.shipment_tracking_records'::regclass) <> 7
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.tracking_events'::regclass) <> 2
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.driver_identity_verifications'::regclass) <> 3
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.gps_location_updates'::regclass) <> 2 THEN
    RAISE EXCEPTION 'WS02 POST: a policy count moved; only three predicates may be replaced'; END IF;

  IF NOT has_table_privilege('authenticated', 'logistics_schema.documents', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'logistics_schema.shipment_tracking_records', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'logistics_schema.tracking_events', 'INSERT')
     OR has_table_privilege('anon', 'logistics_schema.documents', 'INSERT')
     OR has_table_privilege('anon', 'logistics_schema.tracking_events', 'INSERT') THEN
    RAISE EXCEPTION 'WS02 POST: the privilege set moved; this file must not grant or revoke anything'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.documents'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.shipment_tracking_records'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.tracking_events'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.documents'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.shipment_tracking_records'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.tracking_events'::regclass) THEN
    RAISE EXCEPTION 'WS02 POST: an RLS flag moved'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'effective_marketplace_role'
                    AND p.pronargs = 0 AND p.prosecdef AND p.provolatile = 's'
                    AND p.proconfig @> ARRAY['search_path=pg_catalog, public']) THEN
    RAISE EXCEPTION 'WS02 POST: the resolver properties changed'; END IF;

  IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'FROM ' || n.nspname || '.' || c.relname) > 0
          OR strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'JOIN ' || n.nspname || '.' || c.relname) > 0) <> 0 THEN
    RAISE EXCEPTION 'WS02 POST: a self-referencing policy exists in the catalog'; END IF;
END
$ws02$;