-- ============================================================================
-- I-2 PART C ITEM 5 + ITEM 6, tranche 3: contain the two functions that 047 had
-- to leave alone, now that their behaviour is knowable through an admissible
-- (non-owner) path. Registered as NXC-I2-DB-006.
--
-- WHY THIS FILE EXISTS AT ALL
--   047 pinned the six functions whose bodies are in repository DDL and
--   deliberately left three unpinned because "their bodies are not knowable
--   admissibly". Two of those three have since been characterised through the
--   client path, which is the route Part D prefers, so they no longer have an
--   excuse to stay mutable. Advisor 2026-11-06T14:29:13.778Z after 047 left
--   function_search_path_mutable = 3: public.marketplace_book_handoff,
--   public.test_ef_test, app.test_ef_secure.
--
-- MEASURED PRE-CHANGE STATE (2026-11-06T14:3xZ, no owner-class access used)
--   1. public.marketplace_book_handoff is DEFINED IN THE REPOSITORY, at
--      004_marketplace_handoff_rpc.sql:12 - under an UNQUALIFIED name
--      (CREATE OR REPLACE FUNCTION marketplace_book_handoff(...)), which is why a
--      schema-qualified census regex missed it and why 047 called it unknowable.
--      Its body (004:22-124) references marketplace_schema.listings / .offers /
--      .matches and logistics_schema.bookings - EVERY relation is schema-qualified;
--      the only unqualified calls are now() and jsonb_build_object(), which resolve
--      in pg_catalog, implicitly first in every search_path. A pin therefore cannot
--      redirect anything (this is the R3 check the risk register demands).
--   2. Live behaviour, anon key, correct 5-argument arity:
--        POST /rest/v1/rpc/marketplace_book_handoff -> 401 {"code":"42501",
--        "message":"permission denied for schema marketplace_schema"}
--      Two facts in that one response. First, PostgREST RESOLVED the function and
--      EXECUTED it far enough to hit a relation - so EXECUTE is granted to anon
--      today (004 never revoked it; PUBLIC grants it). Its only protection is
--      incidental schema USAGE, which is exactly the "broad privilege" posture
--      rule 9 forbids and which 027:97 grants marketplace_schema USAGE to for the
--      handoff path. Second, the app's real caller is
--      mod-002-booking/domain/services/booking-orchestration.ts:132, which supplies
--      these five parameters, so the signature is confirmed from both ends.
--      The all-zero uuids make it raise HANDOFF_ERROR at 004:41-42, before the
--      INSERT at 004:84, so this probe cannot persist anything.
--   3. public.test_ef_test: anon POST and anon GET both return 200 "test". It is an
--      anonymous-reachable RPC in the exposed schema with zero arguments, it takes
--      no input and returns a constant, and the repository-wide reference census
--      finds NO call site in any .ts or .sql file - only documentation mentions and
--      this increment's own files (042:38 already records that its definition
--      exists in no repository migration). F-I2-11 is this artifact.
--   4. app.test_ef_secure: PGRST202 for every arity tried, because app is not an
--      exposed schema. Its body is still not knowable by any path available here,
--      so this file does NOT touch it. It stays in the advisor's list and is
--      reported rather than guessed at.
--
-- WHAT THIS FILE DOES
--   Section A - pins public.marketplace_book_handoff to (pg_catalog, public) and
--               removes its anonymous EXECUTE, granting it to authenticated and
--               service_role only. The grant list is explicit rather than inherited
--               from PUBLIC because PUBLIC is what put anon in the caller set.
--   Section B - pins public.test_ef_test and revokes EXECUTE from PUBLIC, anon and
--               authenticated, granting it to nobody. Decision D-1 (whether to DROP
--               the test artifacts) stays OPEN and is unaffected: this is the
--               REVOKE-only containment my recorded default for D-1, not a drop.
--
-- WHAT THIS FILE DOES NOT DO
--   No body, signature, volatility, definer status or RETURN type is changed for
--   either function. No trigger is touched. marketplace_book_handoff stays
--   SECURITY INVOKER (004:9 documents that as intentional, so RLS continues to
--   apply per session). app.test_ef_secure is left alone. No table, policy or grant
--   other than EXECUTE on these two functions is modified.
--
-- BEHAVIOUR CHANGE DISCLOSED
--   One intended change: an ANONYMOUS caller can no longer execute
--   marketplace_book_handoff (42501 at the function instead of at the schema) or
--   test_ef_test (was 200 "test"). No authenticated or service-role path loses
--   anything: the booking flow keeps EXECUTE, and nothing references test_ef_test.
--   If any caller did depend on anonymous reachability it will now fail loudly
--   rather than quietly, which is the point.
--
-- VERIFICATION AFTER APPLY
--   advisor function_search_path_mutable expected 3 -> 2 (residue: app.test_ef_secure only);
--   anon POST marketplace_book_handoff expected 401 (42501, message now names the
--     function rather than marketplace_schema);
--   anon POST test_ef_test expected 401, previously 200 "test".
--
-- ROLLBACK (reverse of every mutation in this file)
--   ALTER FUNCTION public.marketplace_book_handoff(uuid,uuid,uuid,uuid,uuid,uuid) RESET (search_path);
--   GRANT EXECUTE ON FUNCTION public.marketplace_book_handoff(uuid,uuid,uuid,uuid,uuid,uuid) TO PUBLIC;
--   ALTER FUNCTION public.test_ef_test() RESET (search_path);
--   GRANT EXECUTE ON FUNCTION public.test_ef_test() TO PUBLIC, anon, authenticated;
--   (To restore the exact pre-state PUBLIC grant set, re-issue the original 004 and
--    boot-era grants; the RESET and GRANT ... TO PUBLIC statements above are sufficient
--    for the containment this file adds.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECTION A - marketplace_book_handoff: pin, then restrict EXECUTE.
-- Identity arguments are taken from the catalog so an overload or a changed
-- default cannot abort the file (the 046 lesson applied to functions).
-- ---------------------------------------------------------------------------
DO $i5a$
DECLARE v_rec RECORD; v_n INT := 0;
BEGIN
  FOR v_rec IN
    SELECT n.nspname AS sch, p.proname AS fn,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff'
     ORDER BY args
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public', v_rec.sch, v_rec.fn, v_rec.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon', v_rec.sch, v_rec.fn, v_rec.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role', v_rec.sch, v_rec.fn, v_rec.args);
    RAISE NOTICE 'I-2 ITEM5/6 pinned and contained %.%(%s)', v_rec.sch, v_rec.fn, v_rec.args;
    v_n := v_n + 1;
  END LOOP;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'I-2 ITEM5 SECTION A found no public.marketplace_book_handoff; pre-state assumption wrong, aborting without change';
  END IF;
END
$i5a$;

COMMENT ON FUNCTION public.marketplace_book_handoff(uuid, uuid, uuid, uuid, uuid, uuid) IS
  'I-2 item 5/6: search_path pinned to (pg_catalog, public) - every relation reference in the 004 body is schema-qualified, so resolution is unchanged. EXECUTE revoked from PUBLIC and anon, granted to authenticated and service_role; the function stays SECURITY INVOKER so RLS continues to apply per session.';

-- ---------------------------------------------------------------------------
-- SECTION B - test_ef_test: pin, and revoke from every caller. No re-grant: the
-- repository-wide census finds no reference to it in any .ts or .sql file.
-- D-1 (drop or keep) is unaffected - this is REVOKE-only containment.
-- ---------------------------------------------------------------------------
DO $i5b$
DECLARE v_rec RECORD; v_n INT := 0;
BEGIN
  FOR v_rec IN
    SELECT n.nspname AS sch, p.proname AS fn,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'test_ef_test'
     ORDER BY args
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public', v_rec.sch, v_rec.fn, v_rec.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', v_rec.sch, v_rec.fn, v_rec.args);
    RAISE NOTICE 'I-2 ITEM6 pinned and fully revoked %.%(%s)', v_rec.sch, v_rec.fn, v_rec.args;
    v_n := v_n + 1;
  END LOOP;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'I-2 ITEM5 SECTION B found no public.test_ef_test; pre-state assumption wrong, aborting without change';
  END IF;
END
$i5b$;

COMMENT ON FUNCTION public.test_ef_test() IS
  'I-2 item 5/6 (F-I2-11): anon-executable test artifact, returned 200 "test" to an unauthenticated caller. Pinned and revoked from PUBLIC, anon and authenticated with no re-grant; zero references in the repository. Decision D-1 (whether to DROP it) remains open - this is REVOKE-only.';
