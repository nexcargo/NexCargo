-- ============================================================================
-- I-2 PART C ITEM 6 - repair the wrong-column predicate in the Transporter
-- fleet-asset policies. Registered as NXC-I2-DB-008.
--
-- THE FINDING (F-I2-08b, directive Part C item 6 "schema findings")
--   012_fleets_and_assets_c7_003.sql gives a Transporter CRUD on the assets of the
--   fleets they own. Two of those policies compare the ASSET row's own primary key
--   to a FLEET id, which can never be true:
--     012:201-212  "Transporter manages own fleet vehicles"  USING/WITH CHECK
--                  id IN (SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid())
--     012:280-291  "Transporter manages own fleet drivers"   USING/WITH CHECK   (same shape)
--   vehicles.id / drivers.id are gen_random_uuid() primary keys of the asset row
--   (012:171, and the drivers table at 012:245-270); the owning fleet is reached
--   through fleet_id (012:173 vehicles.fleet_id, drivers.fleet_id - indexed at
--   012:193 and 012:272). So the predicate tests the wrong column and is empty for
--   every real row.
--   The same file writes this predicate CORRECTLY twice over, which is what makes
--   this a transcription defect rather than a design choice:
--     012:569-575  "Transporter manages own fleet backhaul"   fleet_id IN (...)
--     012:368-380  "Transporter manages own fleet assignments" joins vehicles/drivers to fleets
--   Census: `grep -n "SELECT f.id FROM logistics_schema.fleets" src/infrastructure/migrations/*.sql`
--   returns only 012:204-205, 012:209-210, 012:283-284, 012:288-289 (broken), 012:570-574
--   (correct) and this file. No other migration recreates either policy name, so
--   nothing later re-paired them.
--
-- IMPACT
--   A TRANSPORTER cannot SELECT, INSERT, UPDATE or DELETE their own vehicles or
--   drivers through any RLS-respecting path; the only reachable rows on those tables
--   are the governance legs (012:226, 012:310) and the 045 delegation legs. The
--   application paths that need this are exactly the MOD-014 routes remediated in
--   item 6: GET /api/fleet?entity=vehicles|drivers (fleet/route.ts) reads through the
--   session client, and POST /api/fleet/vehicles writes through it. Without this
--   repair those routes are correct-but-empty, and the item 6 test "a fleet-scoped
--   read answers 404 for a foreign fleet" would also answer 404 for the caller's own.
--
-- PRE-CHANGE STATE
--   Repository: 012:201-212 and 012:280-291 as quoted above, FOR ALL, no TO clause
--   (so they apply to PUBLIC like every other 012 policy), no other migration has
--   touched either name.
--   Live: 012 is an applied migration (supabase list_migrations), and 045 - which
--   drops only the "Platform team reads all ...", "Dispatcher ..." legs beside these
--   two - left them in place (045:270, 045:280). Section A re-measures the live
--   pg_policies text inside this transaction and ABORTS, printing the live qual, if
--   either policy is neither the recorded defective text nor the already-repaired one.
--   So a successful apply is itself the evidence that the before-state was what is
--   recorded here; a divergence cannot slip through silently.
--
-- WHAT THIS FILE DOES
--   Two policies, one change each: the subquery's compared column moves from the
--   asset's own id to its fleet_id. Nothing else in the predicate, the command, the
--   roles or the tables changes.
--
-- WHAT THIS FILE DOES NOT DO
--   It adds no role check, no delegation leg and no governance leg; 045 Section B
--   ("I2 delegated reads vehicles/drivers", 045:272, 045:282) is left untouched.
--   It does not touch fleets, asset_assignments, backhaul_opportunities or any other
--   table. No function, trigger, grant or policy on any other schema is changed.
--
-- BEHAVIOUR CHANGE DISCLOSED
--   Restored, not new: a Transporter can once again read and write the vehicles and
--   drivers belonging to their own fleets. No row that was reachable becomes
--   unreachable (the defective predicate matched nothing, except in the pathological
--   case where an asset row's id equalled a fleet id owned by the caller, which the
--   FK and gen_random_uuid() make unreachable in practice).
--
-- ROLLBACK
--   DROP POLICY IF EXISTS "Transporter manages own fleet vehicles" ON logistics_schema.vehicles;
--   DROP POLICY IF EXISTS "Transporter manages own fleet drivers"  ON logistics_schema.drivers;
--   then re-issue 012:201-212 and 012:280-291 verbatim (the defective text is quoted
--   in full above, so the reverse statements are exactly reproducible).
-- ============================================================================

-- SECTION A: before-state capture. Fails loudly, with the live text, on divergence.
DO $i2fleetpred_pre$
DECLARE
  v_rec  RECORD;
  v_kind TEXT;
BEGIN
  FOR v_rec IN
    SELECT pol.polname, ns.nspname AS sch, cls.relname AS tbl,
           pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
      FROM pg_policy pol
      JOIN pg_class cls ON cls.oid = pol.polrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     WHERE ns.nspname = 'logistics_schema'
       AND pol.polname IN ('Transporter manages own fleet vehicles', 'Transporter manages own fleet drivers')
  LOOP
    v_kind := CASE
      WHEN v_rec.using_expr ~ 'fleet_id\s+IN' AND coalesce(v_rec.check_expr, '') ~ 'fleet_id\s+IN' THEN 'repaired'
      WHEN v_rec.using_expr ~ '(^|[^_a-z])id\s+IN' AND coalesce(v_rec.check_expr, '') ~ '(^|[^_a-z])id\s+IN' THEN 'defective'
      ELSE 'UNEXPECTED'
    END;
    IF v_kind = 'UNEXPECTED' THEN
      RAISE EXCEPTION 'I2 FLEET-PRED: % on % is neither the recorded defective nor the repaired predicate. USING=% WITH CHECK=%',
        v_rec.polname, v_rec.sch || '.' || v_rec.tbl, v_rec.using_expr, v_rec.check_expr;
    END IF;
  END LOOP;
END
$i2fleetpred_pre$;

-- SECTION B: the repair.
DROP POLICY IF EXISTS "Transporter manages own fleet vehicles" ON logistics_schema.vehicles;
CREATE POLICY "Transporter manages own fleet vehicles"
  ON logistics_schema.vehicles FOR ALL
  USING (
    fleet_id IN (
      SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Transporter manages own fleet drivers" ON logistics_schema.drivers;
CREATE POLICY "Transporter manages own fleet drivers"
  ON logistics_schema.drivers FOR ALL
  USING (
    fleet_id IN (
      SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
    )
  )
  WITH CHECK (
    fleet_id IN (
      SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
    )
  );

-- SECTION C: after-state assertion. If either policy is not the repaired predicate
-- after this transaction's own DDL, the apply aborts instead of half-landing.
DO $i2fleetpred_post$
DECLARE
  v_rec RECORD;
  v_seen INT := 0;
BEGIN
  FOR v_rec IN
    SELECT cls.relname AS tbl, pol.polname,
           pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
           pg_get_expr(pol.polwithcheck, pol.polrelid)  AS check_expr
      FROM pg_policy pol
      JOIN pg_class cls ON cls.oid = pol.polrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     WHERE ns.nspname = 'logistics_schema'
       AND pol.polname IN ('Transporter manages own fleet vehicles', 'Transporter manages own fleet drivers')
  LOOP
    v_seen := v_seen + 1;
    IF v_rec.using_expr !~ 'fleet_id\s+IN' OR v_rec.check_expr !~ 'fleet_id\s+IN' THEN
      RAISE EXCEPTION 'I2 FLEET-PRED POST: %.% still reads USING=% WITH CHECK=%',
        v_rec.tbl, v_rec.polname, v_rec.using_expr, v_rec.check_expr;
    END IF;
  END LOOP;
  IF v_seen <> 2 THEN
    RAISE EXCEPTION 'I2 FLEET-PRED POST: expected 2 repaired policies, found %', v_seen;
  END IF;
END
$i2fleetpred_post$;
