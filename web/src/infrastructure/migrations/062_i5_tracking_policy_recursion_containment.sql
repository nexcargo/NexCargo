-- ============================================================================
-- I-5 (TRANSPORTER DASHBOARD AND EXPERIENCE) - remove the policy self-reference
-- that makes logistics_schema.shipment_tracking_records unreadable.
--
-- FINDING (pre-existing; found by I-5, authored before I-5)
--   Three policies on shipment_tracking_records name that same table inside
--   their own predicate:
--     * "Shipper reads own tracking records"      (SELECT, migration 012 / C7-001)
--     * "Transporter reads own tracking records"  (SELECT, migration 012 / C7-001)
--     * "Transporter updates own booking tracking" (UPDATE, migration 020)
--   RLS is applied to a relation referenced inside a policy, so the subquery on
--   shipment_tracking_records re-invokes the policy that contains it, and Postgres
--   aborts the statement:
--     ERROR: 42P17: infinite recursion detected in policy for relation
--            "shipment_tracking_records"
--   Measured live on 2026-11-12 as role authenticated with a transporter JWT
--   (set local role authenticated + set local request.jwt.claims): SELECT against
--   shipment_tracking_records and tracking_events, and against dispute_cases,
--   operational_exceptions, shipment_incidents, proof_of_delivery,
--   gps_location_updates and driver_identity_verifications - those seven tables
--   reach the recursion through their own "via parent record / own shipment"
--   policies, which subquery shipment_tracking_records. SELECT against bookings
--   and contracts succeeds, so the fault is confined to this one relation.
--   A census over all 132 live policies (pg_policy, pg_get_expr) returns exactly
--   these three as self-referencing; no other policy names its own table in a
--   subquery, and the correction below therefore fixes the whole family.
--
-- WHY THIS IS STRICTLY NECESSARY FOR I-5
--   LA DIRECTIVE - I-5, Sec.3A lists tracking among the dashboard's required
--   sections and Sec.3H requires active-operations tracking; Sec.4 states "Do not
--   weaken RLS or security controls to make the UI work. Correct genuine I-5
--   blockers using the least disruptive governed solution." and Sec.7 grants
--   "Necessary database inspection and I-5 database work within the boundaries
--   above". src/modules/mod-003-tracking/infrastructure/repositories/
--   tracking-record-repository.ts:162 surfaces this error to the Transporter
--   dashboard, so the blocker is in the database half of a governed boundary and
--   the application cannot work around it without bypassing RLS - which Sec.4
--   forbids. No migration 030, no financial object and no privilege is touched.
--
-- WHY THIS IS NOT A WEAKENING
--   Each replacement is the same predicate written so the rows it admits are
--   unchanged. The original admits a row when its id appears in the set built by
--   joining the table to the bookings that name the current user; because id is
--   the primary key and booking_id is NOT NULL, that is exactly "a booking row
--   exists with this row's booking_id and this user as its party", which is the
--   EXISTS form used here. The non-recursive form is already the house convention:
--   migration 045 wrote "I2 delegated reads tracking" and "I2 delegated updates
--   tracking" over bookings, and contracts' policies use the same EXISTS shape and
--   do not recurse. Command, permissive/restrictive mode, target roles and policy
--   names are preserved; the UPDATE policy keeps its second conjunct requiring an
--   app.platform_roles row of role TRANSPORTER, so a client-supplied role still
--   buys nothing. Nothing is granted, revoked or added.
--
-- BEFORE-STATE (measured live, 2026-11-12)
--   7 policies on shipment_tracking_records, all PERMISSIVE:
--     Admin/SuperAdmin reads all tracking records   SELECT  (unchanged)
--     I2 delegated reads tracking                   SELECT  (unchanged)
--     I2 delegated updates tracking                 UPDATE  (unchanged)
--     Moderator updates tracking records            UPDATE  (unchanged)
--     Shipper reads own tracking records            SELECT  (replaced)
--     Transporter reads own tracking records        SELECT  (replaced)
--     Transporter updates own booking tracking      UPDATE  (replaced)
--   The table held 0 rows at the time of writing, so no existing read result
--   changes; the correction is what lets the first real tracking row be read.
--
-- ROLLBACK (exact inverse; restores the three recursive definitions verbatim)
--   DROP POLICY IF EXISTS "Shipper reads own tracking records"      ON logistics_schema.shipment_tracking_records;
--   DROP POLICY IF EXISTS "Transporter reads own tracking records"  ON logistics_schema.shipment_tracking_records;
--   DROP POLICY IF EXISTS "Transporter updates own booking tracking" ON logistics_schema.shipment_tracking_records;
--   -- then re-run the CREATE POLICY statements of Sections 1 and 2 of
--   -- 012_fleets_and_assets_c7_003.sql / 020_c7_tracking_mutation_security_closure.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A - before-state guard. This file must see the three recursive
-- predicates it replaces and nothing else that would contradict the finding.
-- ----------------------------------------------------------------------------
-- A policy recurses when its own relation appears in a FROM or JOIN clause inside
-- that policy's predicate - which is the only shape that re-applies the policy to
-- itself. Naming the relation as a qualified outer column reference (b.id =
-- <table>.booking_id) is not recursion and is what the replacement uses, so the
-- census below tests the clause position rather than the presence of the name.
-- It is the same census measured against the live catalog before this change:
-- 3 self-referencing policies, all three on shipment_tracking_records.
DO $i5_pre$
DECLARE
  v_recursive INT;
  v_total     INT;
BEGIN
  WITH e AS (
    SELECT n.nspname || '.' || c.relname AS q,
           coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
           coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
  )
  SELECT count(*), count(*) FILTER (WHERE q = 'logistics_schema.shipment_tracking_records')
    INTO v_total, v_recursive
    FROM e
   WHERE strpos(expr, 'FROM ' || q) > 0
      OR strpos(expr, 'JOIN ' || q) > 0
      OR strpos(expr, 'FROM (' || q) > 0
      OR strpos(expr, 'JOIN (' || q) > 0;

  -- 3 and 3: the three named policies are still recursive, and no other party has
  -- introduced - or already removed - a self-reference elsewhere in the platform.
  IF v_recursive <> 3 THEN
    RAISE EXCEPTION 'I-5 PRE: shipment_tracking_records has [%] self-referencing policies, expected the 3 measured live before this change', v_recursive;
  END IF;
  IF v_total <> 3 THEN
    RAISE EXCEPTION 'I-5 PRE: the platform-wide census finds [%] self-referencing policies, not the 3 this change replaces, so another policy needs the same treatment first', v_total;
  END IF;

  IF (SELECT count(*) FROM pg_policy p WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass) <> 7 THEN
    RAISE EXCEPTION 'I-5 PRE: shipment_tracking_records has a different policy inventory than the 7 measured live, so the unchanged half of this change cannot be asserted';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.shipment_tracking_records'::regclass) THEN
    RAISE EXCEPTION 'I-5 PRE: shipment_tracking_records no longer has RLS enabled; rewriting policies would not be the correction';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policy p
              WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
                AND NOT p.polpermissive) THEN
    RAISE EXCEPTION 'I-5 PRE: a RESTRICTIVE policy now exists on shipment_tracking_records; combining it with replacements written against a permissive set would change the admitted rows';
  END IF;

  -- The target roles are part of what is preserved: the three originals name no
  -- role (polroles is {0}, i.e. ALL ROLES in PG17), so the replacements must be
  -- created without TO. A policy scoped to one role here would mean the CREATE
  -- statements below no longer reproduce the live boundary.
  IF EXISTS (SELECT 1 FROM pg_policy p
              WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
                AND p.polname IN ('Shipper reads own tracking records',
                                  'Transporter reads own tracking records',
                                  'Transporter updates own booking tracking')
                AND EXISTS (SELECT 1 FROM unnest(p.polroles) u
                             JOIN pg_roles g ON g.oid = u)) THEN
    RAISE EXCEPTION 'I-5 PRE: one of the three policies is now scoped to a named role, which the verbatim-replica CREATE statements below do not reproduce';
  END IF;
END
$i5_pre$;

-- ----------------------------------------------------------------------------
-- SECTION B - the three replacements. Names, commands and the TRANSPORTER role
-- conjunct are preserved; only the recursive shape goes away.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Shipper reads own tracking records" ON logistics_schema.shipment_tracking_records;
CREATE POLICY "Shipper reads own tracking records"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM logistics_schema.bookings b
      WHERE b.id = shipment_tracking_records.booking_id
        AND b.shipper_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Transporter reads own tracking records" ON logistics_schema.shipment_tracking_records;
CREATE POLICY "Transporter reads own tracking records"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM logistics_schema.bookings b
      WHERE b.id = shipment_tracking_records.booking_id
        AND b.transporter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Transporter updates own booking tracking" ON logistics_schema.shipment_tracking_records;
CREATE POLICY "Transporter updates own booking tracking"
  ON logistics_schema.shipment_tracking_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM logistics_schema.bookings b
      WHERE b.id = shipment_tracking_records.booking_id
        AND b.transporter_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'TRANSPORTER'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM logistics_schema.bookings b
      WHERE b.id = shipment_tracking_records.booking_id
        AND b.transporter_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'TRANSPORTER'
    )
  );

-- ----------------------------------------------------------------------------
-- SECTION C - post-change assertion: no self-reference remains anywhere, the
-- inventory is still the same 7 policies, the replacement predicates still name
-- bookings and still carry the TRANSPORTER role requirement, and on live data the
-- old and new shapes admit exactly the same rows.
-- ----------------------------------------------------------------------------
DO $i5_post$
DECLARE
  v_recursive INT;
  v_total     INT;
  v_names     INT;
BEGIN
  WITH e AS (
    SELECT n.nspname || '.' || c.relname AS q,
           coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
           coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') AS expr
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
  )
  SELECT count(*), count(*) FILTER (WHERE q = 'logistics_schema.shipment_tracking_records')
    INTO v_total, v_recursive
    FROM e
   WHERE strpos(expr, 'FROM ' || q) > 0
      OR strpos(expr, 'JOIN ' || q) > 0
      OR strpos(expr, 'FROM (' || q) > 0
      OR strpos(expr, 'JOIN (' || q) > 0;

  IF v_recursive <> 0 THEN
    RAISE EXCEPTION 'I-5 POST: [%] policies on shipment_tracking_records still name that table in a subquery', v_recursive;
  END IF;
  IF v_total <> 0 THEN
    RAISE EXCEPTION 'I-5 POST: the platform-wide census still finds [%] self-referencing policies', v_total;
  END IF;

  IF (SELECT count(*) FROM pg_policy p WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass) <> 7 THEN
    RAISE EXCEPTION 'I-5 POST: shipment_tracking_records now carries a different number of policies than the 7 it had before';
  END IF;

  SELECT count(*) INTO v_names
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
     AND p.polname IN ('Admin/SuperAdmin reads all tracking records',
                       'I2 delegated reads tracking',
                       'I2 delegated updates tracking',
                       'Moderator updates tracking records',
                       'Shipper reads own tracking records',
                       'Transporter reads own tracking records',
                       'Transporter updates own booking tracking');

  IF v_names <> 7 THEN
    RAISE EXCEPTION 'I-5 POST: the seven policy names measured before this change are no longer all present, so an unrelated policy was lost';
  END IF;

  -- ...and the three replacements still apply to every role, as the originals did.
  IF EXISTS (SELECT 1 FROM pg_policy p
              WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
                AND p.polname IN ('Shipper reads own tracking records',
                                  'Transporter reads own tracking records',
                                  'Transporter updates own booking tracking')
                AND EXISTS (SELECT 1 FROM unnest(p.polroles) u
                             JOIN pg_roles g ON g.oid = u)) THEN
    RAISE EXCEPTION 'I-5 POST: a replacement policy is scoped to a named role, which narrows the boundary the original applied to every role';
  END IF;

  -- Each replacement must be written over bookings, must still be reached by the
  -- auth.uid() party test, and the UPDATE leg must still demand the governed
  -- TRANSPORTER platform role in both its USING and its WITH CHECK half.
  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
                    AND p.polname = 'Shipper reads own tracking records'
                    AND p.polcmd = 'r'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%bookings b%'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%shipper_id = auth.uid()%'
                    AND pg_get_expr(p.polwithcheck, p.polrelid) IS NULL) THEN
    RAISE EXCEPTION 'I-5 POST: the shipper SELECT policy is not the bookings-based replica it should be';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
                    AND p.polname = 'Transporter reads own tracking records'
                    AND p.polcmd = 'r'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%bookings b%'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%transporter_id = auth.uid()%'
                    AND pg_get_expr(p.polwithcheck, p.polrelid) IS NULL) THEN
    RAISE EXCEPTION 'I-5 POST: the transporter SELECT policy is not the bookings-based replica it should be';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'logistics_schema.shipment_tracking_records'::regclass
                    AND p.polname = 'Transporter updates own booking tracking'
                    AND p.polcmd = 'w'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%bookings b%'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%transporter_id = auth.uid()%'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%platform_roles pr%'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%TRANSPORTER%'
                    AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%bookings b%'
                    AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%platform_roles pr%'
                    AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%TRANSPORTER%') THEN
    RAISE EXCEPTION 'I-5 POST: the transporter UPDATE policy lost its bookings boundary or its app.platform_roles TRANSPORTER conjunct';
  END IF;

  -- Row-boundary equivalence over live data: for every tracking row and every
  -- party recorded on a booking, the removed predicate and its replacement must
  -- admit the same answer. Vacuously true while the table is empty, which is the
  -- measured before-state; the behavioural probe that follows this migration
  -- inserts rows to test it with data.
  IF EXISTS (
    WITH parties AS (
      SELECT DISTINCT transporter_id AS u FROM logistics_schema.bookings WHERE transporter_id IS NOT NULL
      UNION
      SELECT DISTINCT shipper_id FROM logistics_schema.bookings WHERE shipper_id IS NOT NULL
    )
    SELECT 1
      FROM logistics_schema.shipment_tracking_records tr, parties p
     WHERE (tr.id IN (SELECT t2.id FROM logistics_schema.shipment_tracking_records t2
                        JOIN logistics_schema.bookings b2 ON b2.id = t2.booking_id
                       WHERE b2.transporter_id = p.u))
        IS DISTINCT FROM
           (EXISTS (SELECT 1 FROM logistics_schema.bookings b3
                     WHERE b3.id = tr.booking_id AND b3.transporter_id = p.u))
        OR (tr.id IN (SELECT t3.id FROM logistics_schema.shipment_tracking_records t3
                        JOIN logistics_schema.bookings b4 ON b4.id = t3.booking_id
                       WHERE b4.shipper_id = p.u))
        IS DISTINCT FROM
           (EXISTS (SELECT 1 FROM logistics_schema.bookings b5
                     WHERE b5.id = tr.booking_id AND b5.shipper_id = p.u))
  ) THEN
    RAISE EXCEPTION 'I-5 POST: the replacement predicate admits a different row than the predicate it replaced';
  END IF;
END
$i5_post$;
