-- ============================================================================
-- F-I2-27 REMEDIATION (2 of 3) - PostgREST schema exposure required by the
-- service-role paths 055 just granted. Kept separate from 055 because it is a
-- configuration change, not a privilege change, and it has its own revert path.
--
-- REQUIREMENT
--   LA DIRECTIVE - F-I2-27, Step 2: "Distinguish actual privilege deficiencies
--   from application errors, incorrect RPC signatures, RLS failures and
--   unrelated defects." Step 3: "the smallest coherent migration or set of
--   migrations that restores legitimate service-role functionality."
--
-- THE SECOND HALF OF THE ROOT CAUSE
--   054's census and the 055 before-state matrix proved the privilege half.
--   This file addresses the transport half, measured live on 2026-11-09:
--     1. pg_db_role_setting held exactly one pgrst row -
--        authenticator: pgrst.db_schemas=public, graphql_public (platform
--        default; the value seen at the time this file was written,
--        'public, graphql_public, logistics_schema', is the partial
--        experiment disclosed in the F-I2-27 report and is reset here).
--     2. supabase-js sends the schema chosen by .schema(X) as the
--        Content-Profile / Accept-Profile header, and PostgREST rejects a
--        profile that is not in db_schemas. Measured with the service-role key
--        against this project: an unexposed domain schema returns
--        PGRST205/PGRST203-style schema errors, and after exposing
--        logistics_schema the same request returns
--        42501 "permission denied for schema logistics_schema" - which is the
--        proof that exposure alone grants nothing and privileges alone reach
--        nothing. Both halves are required.
--     3. Dotted resources are not a substitute. `GET /rest/v1/logistics_schema
--        .documents` is answered as a name error on `public.logistics_schema
--        .documents`, i.e. the six call sites that use
--        from(`${LOGISTICS_SCHEMA}.dispute_cases`) style names cannot be made
--        to work by any exposure setting; they are code defects (fixed in the
--        application layer, not here).
--     4. Per-role exposure does not work: `ALTER ROLE service_role SET
--        pgrst.db_schemas=...` leaves the surface unchanged, because the
--        setting is read from the authenticator role at config load. Exposure
--        must therefore be made on authenticator.
--
-- WHY EXPOSING THESE FOUR SCHEMAS CREATES NO NEW CLIENT ACCESS PATH
--   Measured in the same session (f_i2_27_exposure_surface_readonly and
--   f_i2_27_monitoring_policies_readonly, both rolled back by RAISE):
--     * anon holds USAGE on none of the five domain schemas and SELECT on no
--       table in them (anonR=0 in every schema). A request carrying the
--       public anon key still cannot name a domain object after this change.
--     * All 48 tables in logistics/financial/communication/marketplace/
--       monitoring have RLS enabled (rls_on=48 of 48); zero tables combine
--       RLS-off with a client-role read. A schema with no matching policy is
--       default-denied, so exposure cannot widen a policy that does not exist.
--     * monitoring_schema has ZERO policies (measured MONITORING-POLICIES NONE)
--       while authenticated holds INSERT/UPDATE on its six tables. Before this
--       change that grant set was unreachable through the transport; after it,
--       RLS still denies every client write because no policy exists to allow
--       it. Telemetry remains writable only by the service-role persistence
--       layer, which is what I-2 Part C Item 6 intends.
--     * Nothing is granted to PUBLIC, anon or authenticated here, and no
--       existing grant or policy is altered.
--   The consequence that does change, and is therefore disclosed rather than
--   hidden: session-authenticated (JWT) requests can now reach the domain
--   tables their RLS policies already allow, where before they failed at the
--   transport. That is the intended boundary being enforced for the first time,
--   not a new one. The OpenAPI document served to client roles also lists
--   those schemas.
--
-- DELIBERATELY NOT EXPOSED
--   marketplace_schema (no service-role statement targets it; the
--   base-repository listings/offers paths that do target it are an
--   anon-profile defect class reported in the F-I2-27 register rows, not a
--   privilege deficiency), app (054 keeps membership authority definer-RPC
--   only), ai_schema / compliance_schema / analytics_schema /
--   localization_schema / platform_infrastructure_schema (no service-role
--   call site).
--
-- ROLLBACK (exact inverse)
--   ALTER ROLE authenticator RESET pgrst.db_schemas;
--   SELECT pg_notify('pgrst', 'reload config');
--   SELECT pg_notify('pgrst', 'reload schema');
--   which restores the platform default (public, graphql_public).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A - before-state guard.
-- ----------------------------------------------------------------------------
DO $ex27_pre$
DECLARE
  v_cfg TEXT;
BEGIN
  SELECT coalesce(string_agg(cfg, ' ~ '), '(unset)') INTO v_cfg
    FROM pg_db_role_setting d
    JOIN pg_roles r ON r.oid = d.setrole
    CROSS JOIN LATERAL unnest(d.setconfig) AS cfg
   WHERE r.rolname = 'authenticator' AND cfg LIKE 'pgrst.db_schemas=%';

  -- The only accepted starting points are the platform default and the
  -- disclosed partial experiment that this file finalises. Anything else means
  -- someone else has changed the API surface and this file must not overwrite
  -- their decision.
  IF v_cfg NOT IN ('(unset)',
                   'pgrst.db_schemas=public, graphql_public',
                   'pgrst.db_schemas=public, graphql_public, logistics_schema') THEN
    RAISE EXCEPTION 'F-I2-27 PRE: authenticator pgrst.db_schemas is [%], which is neither the platform default nor the disclosed experiment this migration completes', v_cfg;
  END IF;

  -- Exposure must not be applied before the privileges exist, or the window
  -- between the two files is a window in which the domain schemas are named by
  -- the API and denied by the catalog for every role including service_role.
  IF NOT has_schema_privilege('service_role'::regrole, 'logistics_schema', 'USAGE')
     OR NOT has_schema_privilege('service_role'::regrole, 'financial_schema', 'USAGE')
     OR NOT has_schema_privilege('service_role'::regrole, 'communication_schema', 'USAGE')
     OR NOT has_schema_privilege('service_role'::regrole, 'monitoring_schema', 'USAGE') THEN
    RAISE EXCEPTION 'F-I2-27 PRE: 055 has not been applied - service_role still lacks USAGE on a domain schema, so exposing it would change nothing except the OpenAPI surface';
  END IF;

  -- Safety precondition re-measured at apply time, not trusted from the header.
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname IN ('logistics_schema','financial_schema','communication_schema','monitoring_schema')
         AND c.relkind IN ('r','p') AND NOT c.relrowsecurity) <> 0 THEN
    RAISE EXCEPTION 'F-I2-27 PRE: at least one table in an exposed schema no longer has RLS enabled, so this exposure would publish an unenforced table';
  END IF;

  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) pr
       JOIN pg_roles g ON g.oid = pr.grantee
       WHERE n.nspname IN ('logistics_schema','financial_schema','communication_schema','monitoring_schema')
         AND g.rolname = 'anon'
         AND (pr.privilege_type LIKE 'INSERT' OR pr.privilege_type LIKE 'UPDATE'
              OR pr.privilege_type LIKE 'DELETE' OR pr.privilege_type = 'SELECT')) <> 0 THEN
    RAISE EXCEPTION 'F-I2-27 PRE: anon holds a table privilege in an exposed schema, which contradicts the measured anonR=0 baseline';
  END IF;
END
$ex27_pre$;

-- ----------------------------------------------------------------------------
-- SECTION B - the exposure. One setting plus the two reload notices that make
-- PostgREST pick it up without a restart.
-- ----------------------------------------------------------------------------
ALTER ROLE authenticator SET pgrst.db_schemas =
  'public, graphql_public, logistics_schema, financial_schema, communication_schema, monitoring_schema';

SELECT pg_notify('pgrst', 'reload config');
SELECT pg_notify('pgrst', 'reload schema');

-- ----------------------------------------------------------------------------
-- SECTION C - post-change assertion: the setting landed, the schemas that must
-- stay closed did not move, and the service-role path that motivated the whole
-- change now resolves against the catalog.
-- ----------------------------------------------------------------------------
DO $ex27_post$
DECLARE
  v_cfg TEXT;
  v_leg TEXT := '';
BEGIN
  SELECT coalesce(string_agg(cfg, ' ~ '), '(unset)') INTO v_cfg
    FROM pg_db_role_setting d
    JOIN pg_roles r ON r.oid = d.setrole
    CROSS JOIN LATERAL unnest(d.setconfig) AS cfg
   WHERE r.rolname = 'authenticator' AND cfg LIKE 'pgrst.db_schemas=%';

  IF v_cfg IS DISTINCT FROM 'pgrst.db_schemas=public, graphql_public, logistics_schema, financial_schema, communication_schema, monitoring_schema' THEN
    RAISE EXCEPTION 'F-I2-27 POST: authenticator pgrst.db_schemas reads [%]', v_cfg;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_db_role_setting d
              JOIN pg_roles r ON r.oid = d.setrole
             WHERE r.rolname <> 'authenticator'
               AND EXISTS (SELECT 1 FROM unnest(d.setconfig) c WHERE c LIKE 'pgrst.db_schemas=%')) THEN
    RAISE EXCEPTION 'F-I2-27 POST: a non-authenticator role carries pgrst.db_schemas, which is the per-role form measured not to work';
  END IF;

  -- app and marketplace_schema must remain outside the exposed set.
  IF v_cfg LIKE '%app%' OR v_cfg LIKE '%marketplace_schema%' THEN
    RAISE EXCEPTION 'F-I2-27 POST: the exposed set includes app or marketplace_schema';
  END IF;

  -- The schemas named by the service-role call sites must resolve and be
  -- readable by a service_role session; the notification only affects the API
  -- layer, so this is the catalog-side half of the proof. monitoring_schema is
  -- write-only in the map, so its expected outcome is a table-level denial -
  -- which itself proves the name resolves inside the now-exposed schema.
  SET LOCAL ROLE service_role;
  BEGIN
    v_leg := 'logistics_schema.support_tickets';
    EXECUTE 'SELECT count(*) FROM logistics_schema.support_tickets WHERE false';
    v_leg := 'financial_schema.settlement_requests';
    EXECUTE 'SELECT count(*) FROM financial_schema.settlement_requests WHERE false';
    v_leg := 'communication_schema.notifications';
    EXECUTE 'SELECT count(*) FROM communication_schema.notifications WHERE false';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'F-I2-27 POST: service_role cannot resolve % after exposure (%)', v_leg, SQLERRM;
  END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM monitoring_schema.health_checks WHERE false';
    v_leg := 'read it';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM LIKE '%permission denied for schema%' THEN
      RESET ROLE;
      RAISE EXCEPTION 'F-I2-27 POST: monitoring_schema is still schema-unreachable for service_role (%)', SQLERRM;
    END IF;
    v_leg := 'was denied at table level';
  END;
  RESET ROLE;
  IF v_leg IS DISTINCT FROM 'was denied at table level' THEN
    RAISE EXCEPTION 'F-I2-27 POST: service_role [%] monitoring_schema.health_checks, which 055 grants INSERT only', v_leg;
  END IF;
END
$ex27_post$;
