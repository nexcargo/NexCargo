-- ============================================================================
-- I-2 PART C ITEM 4 - service-role minimum privileges. Registered as
-- NXC-I2-DB-012 (closes the Item 4 half of F-I2-04's neighbours; opens F-I2-27).
--
-- REQUIREMENT (verbatim)
--   docs/implementations/i2-security-authorization-scope-statement.md:202-207
--     "Match each retained grant to a named call site; revoke the rest."
--     Exit criterion: "Every retained grant justified in writing; every
--     dependency documented; no flow regresses."
--   directive rule 9: "Grant only the minimum required privileges ... document
--   any genuine dependency", and the binding constraint "do not grant broad
--   privileges merely to make existing operations work".
--   ESS-006:49 least privilege; PROMPT 0:238.
--
-- PRE-CHANGE STATE (live project cvdggspiudmudbbdkjrc, measured 2026-11-09 by
-- census probes that each ended in RAISE EXCEPTION, so nothing they touched
-- persisted and no schema_migrations row was written)
--   1. service_role table privileges across the whole project, per schema
--      (t=tables in schema, sel/ins = tables service_role can SELECT / INSERT):
--        ai_schema{t=1 sel=0 ins=0} analytics_schema{t=1 sel=0 ins=0}
--        app{t=4 sel=3 ins=2} communication_schema{t=3 sel=0 ins=0}
--        compliance_schema{t=1 sel=0 ins=0} financial_schema{t=4 sel=0 ins=0}
--        localization_schema{t=1 sel=0 ins=0} logistics_schema{t=31 sel=0 ins=0}
--        marketplace_schema{t=4 sel=0 ins=0} monitoring_schema{t=6 sel=0 ins=0}
--        platform_infrastructure_schema{t=1 sel=0 ins=0}
--      public contains NO tables at all ("public-has-no-tables"), so the
--      service-role surface is 3 tables, all of them in app.
--   2. The exact ACLs of those objects:
--        app.marketplace_memberships        {postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwd/postgres}
--        app.operational_delegations        {postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=ar/postgres}
--        app.operational_delegation_audit   {postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=r/postgres}
--        app.operational_delegation_audit_seq {postgres=rwU/postgres,service_role=rU/postgres}
--      app.platform_roles has no service_role entry.
--   3. USAGE on schema app is FALSE for service_role, authenticated and anon
--      alike (has_schema_privilege, all three). A role without schema USAGE
--      cannot name any object inside it, so all four privileges in (2) are
--      unreachable by a service_role session. Confirmed functionally before this
--      file existed: with SET LOCAL ROLE service_role, reads of
--      app.marketplace_memberships, app.operational_delegations and
--      app.operational_delegation_audit each returned
--      ERR(permission denied for schema app).
--   4. The service-role write/read path for those tables does NOT use table
--      privileges. It is four SECURITY DEFINER functions in public, each with
--      EXECUTE granted to service_role and each pinned
--      (SET search_path = pg_catalog, public):
--        public.record_marketplace_membership(uuid,text)      041:53, 040:81 lineage
--        public.grant_operational_delegation(uuid,uuid,text,uuid) 043:312
--        public.revoke_operational_delegation(uuid,uuid,text)     043:314 (definer 043:282)
--        public.effective_marketplace_role()                  040:81
--      measured EXECUTE for service_role: rec=true grant=true rev=true mrole=true.
--      043:182-185 states the design in words: "writes reach these tables
--      exclusively through the SECURITY DEFINER RPCs in Section 4, whose owner
--      bypasses RLS."
--   5. Call-site map (scope statement 3.2, re-checked for the four app objects):
--      `grep -rn "operational_delegations|marketplace_memberships|operational_delegation_audit"
--      web/src --include=*.ts` returns only comments in
--      app/api/auth/register/route.ts:5, lib/supabase/get-user.ts:12,
--      lib/supabase/api-auth.ts:20/24, lib/auth/role-authority.ts:6/7 - no table
--      reference. The one real call site, register/route.ts:96-99, is
--      `admin.rpc('record_marketplace_membership', ...)`, i.e. the definer path.
--      grant_operational_delegation / revoke_operational_delegation have no call
--      site in code at all yet.
--
-- THE CHANGE
--   REVOKE ALL on the three app tables and the one app sequence FROM service_role.
--   That is the whole of Item 4's reachable target: nothing is added, nothing is
--   widened, and no policy, function, trigger or data is touched.
--
--   WHY REVOKING HAS ZERO FUNCTIONAL EFFECT, AND WHY THAT IS THE POINT
--     - Unreachable before (measured 3): no service_role session can name these
--       objects, so no statement that succeeds today can depend on them.
--     - Redundant in design (measured 4): the writer RPCs are definer-owned by
--       postgres, which is the privilege the write actually runs under. 043's own
--       comment says the client never writes these tables directly.
--     - Unjustified by the map (measured 5): rule 9 requires a retained grant to
--       match a named call site. These four match none.
--     - Latent rather than harmless: the moment any later migration grants app
--       USAGE to service_role - or exposes app through PostgREST - arwd on
--       marketplace_memberships becomes a direct, RLS-bypassing write to the
--       membership authority table, and INSERT on operational_delegations becomes
--       a way to mint a delegation without the audited RPC. The stated intent of
--       043:211 ("even the trusted server path may not write the audit trail
--       directly") is only true once the sequence and table grants are gone.
--   Removing an unreachable privilege is therefore the minimum-privilege action
--   Item 4 exists to perform, and its regression risk is empty by measurement
--   rather than by hope.
--
-- DOES NOT DO (reported, not silently widened)
--   * It does NOT grant service_role anything to repair the ~40 scope-statement
--     3.2 call sites. Measured 1 says those sites target financial_schema,
--     logistics_schema, communication_schema, compliance_schema and
--     monitoring_schema tables that service_role cannot reach at all: they fail
--     with "permission denied for schema ...", which is why Item 4 sequenced last
--     produced a finding instead of a grant list. Granting USAGE plus per-table
--     privileges across nine schemas to make createAdminClient() "work" would be
--     exactly the broad privilege rule 9 forbids, and would move every one of
--     those flows outside the RLS enforcement Part A requires. F-I2-27 records
--     each site class with its per-site resolution (session client + RLS, or a
--     public pinned definer RPC on the record_marketplace_membership precedent).
--   * It does NOT touch the authenticated grants on the same tables
--     (authenticated=r on all three, which 043:190-203's read policies need) nor
--     app.platform_roles, which already holds no service_role entry.
--   * It does NOT touch the Supabase-managed schemas (storage, realtime, vault,
--     auth, graphql*, supabase_migrations) whose service_role privileges are
--     platform-owned, nor the pg_default_acl rows: postgres' default privileges
--     grant anon/authenticated/service_role ALL on tables created in public and
--     storage. That is a live latent exposure - a table created in public by
--     postgres would be anon-writable - but public contains no tables today, so
--     it is reported, not reconfigured, because altering platform default
--     privileges is outside I-2 and would be an unrelated database change.
--   * It does NOT revoke EXECUTE from the four definer RPCs: they are the
--     documented path and register/route.ts depends on one of them.
--
-- ROLLBACK (exact inverse, in reverse order; the four GRANTs restore the
--   measured before-ACLs byte-for-byte)
--   GRANT USAGE, SELECT ON SEQUENCE app.operational_delegation_audit_seq TO service_role;
--   GRANT SELECT ON app.operational_delegation_audit TO service_role;
--   GRANT SELECT, INSERT ON app.operational_delegations TO service_role;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON app.marketplace_memberships TO service_role;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A - before-state guard. Every assertion below is a measurement taken
-- from the live catalog minutes before this file was written. A drift aborts the
-- migration rather than letting a privilege be revoked against a state that has
-- changed underneath it.
-- ----------------------------------------------------------------------------
DO $i2sr_pre$
DECLARE
  v_acl   TEXT;
  v_letters TEXT;
BEGIN
  -- (0) All four objects must exist, or every lookup below would abort on a
  -- catalog error instead of on the state this file describes.
  IF to_regclass('app.marketplace_memberships') IS NULL
     OR to_regclass('app.operational_delegations') IS NULL
     OR to_regclass('app.operational_delegation_audit') IS NULL
     OR to_regclass('app.operational_delegation_audit_seq') IS NULL THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE PRE: one of the four app objects this migration names is absent, so the measured pre-state no longer holds';
  END IF;

  -- (1) The premise that makes this change zero-delta. If service_role could
  -- actually enter app, these revocations would be a behaviour change and the
  -- file has to be re-scoped, not applied.
  IF has_schema_privilege('service_role'::regrole, 'app', 'USAGE') THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE PRE: service_role holds USAGE on app, so the grants below are reachable and this migration is no longer a zero-delta cleanup';
  END IF;

  -- (2) The four ACLs, compared to the exact strings measured live.
  SELECT relacl::text INTO v_acl FROM pg_class
   WHERE oid = 'app.marketplace_memberships'::regclass;
  IF v_acl IS DISTINCT FROM '{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwd/postgres}' THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE PRE: marketplace_memberships ACL is %, expected the measured arwd grant to service_role', COALESCE(v_acl, 'NULL');
  END IF;

  SELECT relacl::text INTO v_acl FROM pg_class
   WHERE oid = 'app.operational_delegations'::regclass;
  IF v_acl IS DISTINCT FROM '{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=ar/postgres}' THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE PRE: operational_delegations ACL is %, expected the measured ar grant to service_role', COALESCE(v_acl, 'NULL');
  END IF;

  SELECT relacl::text INTO v_acl FROM pg_class
   WHERE oid = 'app.operational_delegation_audit'::regclass;
  IF v_acl IS DISTINCT FROM '{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=r/postgres}' THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE PRE: operational_delegation_audit ACL is %, expected the measured r grant to service_role', COALESCE(v_acl, 'NULL');
  END IF;

  SELECT relacl::text INTO v_acl FROM pg_class
   WHERE oid = 'app.operational_delegation_audit_seq'::regclass;
  IF v_acl IS DISTINCT FROM '{postgres=rwU/postgres,service_role=rU/postgres}' THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE PRE: audit sequence ACL is %, expected the measured rU grant to service_role', COALESCE(v_acl, 'NULL');
  END IF;

  -- (3) Breadth guard: outside app, no project table may hold a service_role
  -- table privilege. If one appeared, the Item 4 census is stale and this file
  -- does not describe the live minimum.
  SELECT string_agg(n.nspname || '.' || c.relname, ', ') INTO v_letters
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind = 'r'
     AND n.nspname NOT IN ('app','pg_catalog','information_schema','pg_temp','pg_toast',
                           'auth','realtime','storage','vault','supabase_migrations',
                           'graphql','graphql_public','extensions','net','pgbouncer',
                           'supabase_functions','pgsodium','pgsodium_masks','edge_functions',
                           'pgmq','cron','_faas_sql_meta','_faas_sql_functions')
     AND has_table_privilege('service_role'::regrole, c.oid, 'SELECT');
  IF v_letters IS NOT NULL THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE PRE: service_role also holds SELECT on [%], which the measured census did not include', v_letters;
  END IF;

  -- (4) The path that replaces these grants must be intact BEFORE the grants go:
  -- four pinned SECURITY DEFINER RPCs, EXECUTE-able by service_role.
  SELECT string_agg(t.fn, ', ') INTO v_letters
    FROM (VALUES ('public.record_marketplace_membership(uuid,text)'),
                 ('public.grant_operational_delegation(uuid,uuid,text,uuid)'),
                 ('public.revoke_operational_delegation(uuid,uuid,text)'),
                 ('public.effective_marketplace_role()')) t(fn)
   WHERE to_regprocedure(t.fn) IS NULL
      OR NOT EXISTS (SELECT 1 FROM pg_proc p
                      WHERE p.oid = to_regprocedure(t.fn)
                        AND p.prosecdef
                        AND COALESCE(array_to_string(p.proconfig, ','), '') LIKE '%search_path=pg_catalog, public%')
      OR NOT has_function_privilege('service_role'::regrole, to_regprocedure(t.fn), 'EXECUTE');
  IF v_letters IS NOT NULL THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE PRE: definer RPC(s) [%] are missing, unpinned or not EXECUTE-able by service_role, so the grants being revoked may be load-bearing after all', v_letters;
  END IF;
END
$i2sr_pre$;

-- ----------------------------------------------------------------------------
-- SECTION B - the revocations. Four statements, nothing else.
-- ----------------------------------------------------------------------------
REVOKE ALL ON SEQUENCE app.operational_delegation_audit_seq FROM service_role;
REVOKE ALL ON TABLE app.operational_delegation_audit FROM service_role;
REVOKE ALL ON TABLE app.operational_delegations FROM service_role;
REVOKE ALL ON TABLE app.marketplace_memberships FROM service_role;

-- ----------------------------------------------------------------------------
-- SECTION C - post-change assertion. Three halves, all required: the privileges
-- are gone, the client-role access that Item 4 does NOT own is unchanged, and a
-- service_role session can still perform the documented membership read through
-- the definer resolver, which is the flow that had to survive.
-- ----------------------------------------------------------------------------
DO $i2sr_post$
DECLARE
  v_role   TEXT;
  v_leg    TEXT;
  v_bad    TEXT := '';
BEGIN
  -- (1) revoked.
  IF has_table_privilege('service_role'::regrole, 'app.marketplace_memberships'::regclass, 'SELECT')
     OR has_table_privilege('service_role'::regrole, 'app.marketplace_memberships'::regclass, 'INSERT')
     OR has_table_privilege('service_role'::regrole, 'app.marketplace_memberships'::regclass, 'UPDATE')
     OR has_table_privilege('service_role'::regrole, 'app.marketplace_memberships'::regclass, 'DELETE') THEN
    v_bad := v_bad || 'marketplace_memberships ';
  END IF;
  IF has_table_privilege('service_role'::regrole, 'app.operational_delegations'::regclass, 'SELECT')
     OR has_table_privilege('service_role'::regrole, 'app.operational_delegations'::regclass, 'INSERT') THEN
    v_bad := v_bad || 'operational_delegations ';
  END IF;
  IF has_table_privilege('service_role'::regrole, 'app.operational_delegation_audit'::regclass, 'SELECT') THEN
    v_bad := v_bad || 'operational_delegation_audit ';
  END IF;
  IF has_sequence_privilege('service_role'::regrole, 'app.operational_delegation_audit_seq'::regclass, 'USAGE')
     OR has_sequence_privilege('service_role'::regrole, 'app.operational_delegation_audit_seq'::regclass, 'SELECT') THEN
    v_bad := v_bad || 'operational_delegation_audit_seq ';
  END IF;
  IF v_bad <> '' THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE POST: service_role still holds a privilege on [%]', v_bad;
  END IF;

  -- (2) unchanged: the authenticated read grants that 043:190-203 depends on, and
  -- the policy set, are exactly as before.
  IF NOT has_table_privilege('authenticated'::regrole, 'app.marketplace_memberships'::regclass, 'SELECT')
     OR NOT has_table_privilege('authenticated'::regrole, 'app.operational_delegations'::regclass, 'SELECT')
     OR NOT has_table_privilege('authenticated'::regrole, 'app.operational_delegation_audit'::regclass, 'SELECT') THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE POST: the authenticated SELECT grants this migration does not own have moved';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'app'
        AND tablename IN ('marketplace_memberships','operational_delegations','operational_delegation_audit')) <> 4 THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE POST: the app policy count moved off the measured 4 (memberships=1 delegations=2 audit=1)';
  END IF;

  -- (3) functional: a service_role session still resolves a marketplace role
  -- through the definer, which is the register/route.ts:96 path. The call is made
  -- with no JWT in context, so it returns NULL; what is being proved is the
  -- absence of a permission error, not the value.
  SET LOCAL ROLE service_role;
  BEGIN
    SELECT public.effective_marketplace_role() INTO v_role;
    v_leg := 'ok value=' || COALESCE(v_role, 'NULL');
  EXCEPTION WHEN OTHERS THEN
    v_leg := 'ERR ' || SQLERRM;
  END;
  RESET ROLE;

  IF v_leg NOT LIKE 'ok %' THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE POST: the definer membership resolver is no longer callable by service_role (%)', v_leg;
  END IF;

  -- And it must remain true that service_role cannot name an app table directly;
  -- the denial is the security property, before and after alike.
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM 1 FROM app.operational_delegations;
    v_leg := 'REACHABLE';
  EXCEPTION WHEN insufficient_privilege THEN
    v_leg := 'denied';
  END;
  RESET ROLE;

  IF v_leg IS DISTINCT FROM 'denied' THEN
    RAISE EXCEPTION 'I2 SERVICE-ROLE POST: a service_role session can reach app.operational_delegations directly (%)', v_leg;
  END IF;
END
$i2sr_post$;
