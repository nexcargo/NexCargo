-- ============================================================================
-- I-2 PART C ITEM 5 — SECURITY DEFINER / FUNCTION PRIVILEGE CONTAINMENT,
--                     tranche 2: pin search_path on the repository-verified
--                     functions the advisor still lists as role-mutable.
--
-- AUTHORIZATION
--   Lead Architect directive of 6 November 2026, Part C item 5
--   ("Review SECURITY DEFINER functions ... privilege containment") and Part D
--   ("Prepare narrowly scoped migrations ... Apply ... Verify"). Same authority
--   basis that carried 042, 043, 044, 045 and 046. Registered as NXC-I2-DB-005.
--
-- PRE-CHANGE STATE (measured, not inferred)
--   Security advisor 2026-11-06T14:25:35.003Z lists function_search_path_mutable
--   = 9, exactly: public.marketplace_book_handoff, financial_schema._set_updated_at,
--   communication_schema._set_updated_at, monitoring_schema._set_updated_at,
--   logistics_schema._set_updated_at, public.test_ef_test, app.test_ef_secure,
--   logistics_schema.validate_same_transporter,
--   logistics_schema.enforce_assignment_transporter_boundary.
--   This list is an instrument of the platform itself, so no owner-class catalog
--   read is needed to know WHICH objects are affected — that is why item 5 is not
--   blocked by the owner-class access limit recorded in the I-2 scope statement §8.
--   Same snapshot also confirms 046 landed: rls_enabled_no_policy went 7 -> 15 with
--   compliance_schema.audit_logs GONE (046 Section B) and exactly the nine tables
--   that held only an inert auth.jwt() policy ADDED (046 Section A).
--
-- WHY A PIN IS SAFE HERE AND NOWHERE ELSE IN THIS FILE
--   A search_path pin can silently change how an UNQUALIFIED relation name inside
--   a body resolves. Each body of the six functions this file touches was read from
--   the repository DDL and checked for exactly that:
--     _set_updated_at (all four schemas)  - 006:111, 008, 009, 013 - body is
--         BEGIN NEW.updated_at = now(); RETURN NEW; END
--         now() resolves in pg_catalog, which is implicitly first in every path.
--         Zero relation references at all.
--     logistics_schema.validate_same_transporter - 015 - LANGUAGE sql, every
--         reference qualified (logistics_schema.vehicles / .fleets / .drivers).
--     logistics_schema.enforce_assignment_transporter_boundary - 015 - plpgsql,
--         every reference qualified (same three tables). Its two INTO targets
--         v_owner and d_owner are PL/pgSQL variables, not relations.
--   No unqualified relation reference exists in any of the six, so
--   SET search_path = pg_catalog, public cannot redirect a name that resolves
--   today. This is the check R3 in the I-2 risk register asks for.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO
--   It does NOT pin public.marketplace_book_handoff, public.test_ef_test or
--   app.test_ef_secure. Those three are LIVE but have no CREATE FUNCTION in any
--   file under src/infrastructure/migrations, so their bodies - and therefore
--   whether they contain unqualified references - are not knowable through any
--   path available to me. Pinning a body I cannot read is precisely the
--   "before-state is wrong" hazard F-I2-13 records, and R3 makes it a named risk.
--   They are reported instead, in the census Section A prints, and carried forward.
--   It does NOT revoke EXECUTE from any of the six: none appears in the advisor's
--   anon-executable list (that count is 0 since 042) and the two logistics_schema
--   functions are called from triggers and from application paths.
--   It does NOT change any signature, volatility, definer status or body.
--   It does NOT drop test_ef_* (decision D-1 remains open and untouched).
--
-- BEHAVIOUR CHANGE DISCLOSED
--   None expected. For the six pinned functions every object name inside the body
--   is schema-qualified or pg_catalog-resident, so resolution is identical before
--   and after; the only change is that resolution no longer depends on whatever
--   search_path the calling session happens to carry - which is the defect the
--   advisor flags. Verified after apply by re-running the UPDATE paths that fire
--   these triggers (see the register row).
--
-- ROLLBACK (reverse of every statement in this file)
--   ALTER FUNCTION financial_schema._set_updated_at() RESET (search_path);
--   ALTER FUNCTION communication_schema._set_updated_at() RESET (search_path);
--   ALTER FUNCTION monitoring_schema._set_updated_at() RESET (search_path);
--   ALTER FUNCTION logistics_schema._set_updated_at() RESET (search_path);
--   ALTER FUNCTION logistics_schema.validate_same_transporter(uuid, uuid) RESET (search_path);
--   ALTER FUNCTION logistics_schema.enforce_assignment_transporter_boundary() RESET (search_path);
--   (Nothing else in this file mutates state; Section A is read-only.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECTION A - live census, read-only. Prints what the server actually holds for
-- every advisor-flagged function so the three file-less ones are reported with
-- evidence rather than guessed at, and so this file's own effect is auditable
-- from the apply output.
-- ---------------------------------------------------------------------------
DO $i5census$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT n.nspname AS sch,
           p.proname AS fn,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
           p.prosecdef AS definer,
           coalesce(array_to_string(p.proconfig, ','), '<unset>') AS cfg,
           coalesce(pg_catalog.pg_get_function_result(p.oid), '?') AS ret
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE (n.nspname = 'public'  AND p.proname IN ('marketplace_book_handoff', 'test_ef_test'))
        OR (n.nspname = 'app'      AND p.proname = 'test_ef_secure')
        OR (n.nspname = 'logistics_schema' AND p.proname IN
              ('validate_same_transporter', 'enforce_assignment_transporter_boundary', '_set_updated_at'))
        OR (n.nspname IN ('financial_schema', 'communication_schema', 'monitoring_schema')
              AND p.proname = '_set_updated_at')
     ORDER BY n.nspname, p.proname
  LOOP
    RAISE NOTICE 'I-2 ITEM5 PRE %.%(%s) | definer=% | config=% | returns=%',
      v_rec.sch, v_rec.fn, v_rec.args, v_rec.definer, v_rec.cfg, v_rec.ret;
  END LOOP;
END
$i5census$;

-- ---------------------------------------------------------------------------
-- SECTION B - pin the six whose bodies are repository-verified. Catalog-driven so
-- an overload or a missing object cannot abort the file (the 046 lesson), and each
-- identity is taken from the server rather than assumed from the file text.
-- ---------------------------------------------------------------------------
DO $i5pin$
DECLARE
  v_rec RECORD;
  v_n   INT := 0;
BEGIN
  FOR v_rec IN
    SELECT n.nspname AS sch,
           p.proname AS fn,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = '_set_updated_at'
        OR (n.nspname = 'logistics_schema' AND p.proname IN
              ('validate_same_transporter', 'enforce_assignment_transporter_boundary'))
     ORDER BY n.nspname, p.proname
  LOOP
    RAISE NOTICE 'I-2 ITEM5 PINNING %.%(%s)', v_rec.sch, v_rec.fn, v_rec.args;
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public',
      v_rec.sch, v_rec.fn, v_rec.args);
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE 'I-2 ITEM5 pinned % functions; marketplace_book_handoff, test_ef_test and test_ef_secure deliberately excluded (bodies not knowable admissibly)', v_n;
END
$i5pin$;

COMMENT ON FUNCTION logistics_schema.validate_same_transporter(uuid, uuid) IS
  'I-2 item 5: search_path pinned (pg_catalog, public). All relation references are schema-qualified, so resolution is unchanged; the pin removes dependence on the calling session''s path.';

COMMENT ON FUNCTION logistics_schema.enforce_assignment_transporter_boundary() IS
  'I-2 item 5: search_path pinned (pg_catalog, public). All relation references are schema-qualified, so resolution is unchanged; the pin removes dependence on the calling session''s path.';

-- ---------------------------------------------------------------------------
-- SECTION C - post-state census, read-only, so the apply output itself proves the
-- pin took and shows which three functions the advisor will still list.
-- ---------------------------------------------------------------------------
DO $i5post$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT n.nspname AS sch,
           p.proname AS fn,
           coalesce(array_to_string(p.proconfig, ','), '<unset>') AS cfg
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE (n.nspname = 'public'  AND p.proname IN ('marketplace_book_handoff', 'test_ef_test'))
        OR (n.nspname = 'app'      AND p.proname = 'test_ef_secure')
        OR (n.nspname = 'logistics_schema' AND p.proname IN
              ('validate_same_transporter', 'enforce_assignment_transporter_boundary', '_set_updated_at'))
        OR (n.nspname IN ('financial_schema', 'communication_schema', 'monitoring_schema')
              AND p.proname = '_set_updated_at')
     ORDER BY n.nspname, p.proname
  LOOP
    RAISE NOTICE 'I-2 ITEM5 POST %.% | config=%', v_rec.sch, v_rec.fn, v_rec.cfg;
  END LOOP;
END
$i5post$;
