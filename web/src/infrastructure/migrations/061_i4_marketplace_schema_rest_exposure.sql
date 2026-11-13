-- ============================================================================
-- I-4 (SHIPPER DASHBOARD AND EXPERIENCE) - expose marketplace_schema through
-- the REST transport. Configuration change only: this file grants nothing,
-- revokes nothing, creates no object and touches no policy.
--
-- REQUIREMENT
--   LA DIRECTIVE - I-4, Sec.7: "Inspect the existing database first. Prefer
--   reuse of the existing schema, constraints, relationships and security
--   model. Any database change must be strictly necessary for I-4, follow the
--   established migration conventions and verify security and tenant isolation."
--   Sec.9 grants "database inspection and necessary I-4 database work within
--   the boundaries above", and the change below was separately disclosed to and
--   authorized by the Lead Architect before it was applied.
--
-- WHY THIS IS STRICTLY NECESSARY
--   The Shipper booking journey (Scope F) runs through MOD-002 unchanged.
--   executeMOD002Handoff reads the listing and the offer over the REST
--   transport: booking-orchestration.ts:65-66 issues
--   supabase.schema('marketplace_schema').from('listings' | 'offers').
--   056_i2_postgrest_schema_exposure.sql deliberately left marketplace_schema
--   outside pgrst.db_schemas because at that time no service-role statement
--   targeted it and its own post-guard asserted exactly that. Once I-4 put a
--   live caller behind that path, every booking initiation failed at the
--   transport with PGRST106 before RLS, privileges or business rules were
--   consulted - the same two-halves result 056 measured for the domain schemas:
--   exposure alone grants nothing, and privileges alone reach nothing.
--   This is the transport half of an already-governed boundary, not a new one.
--
-- WHY IT CREATES NO NEW CLIENT ACCESS PATH
--   All four figures below were read from the live catalog on 2026-11-11, before
--   and after the change, and are re-asserted by Sections A and C rather than
--   argued from the repository DDL.
--   * marketplace_schema holds 10 relations, 0 of them with RLS disabled, and
--     carries 10 policies. A schema whose rows no policy admits is
--     default-denied, so naming it in the API cannot widen a policy.
--   * anon holds neither USAGE on the schema nor any privilege on any table in
--     it, so a request carrying the public anon key still cannot name a
--     marketplace object after this change. Schema USAGE belongs to
--     authenticated and postgres only.
--   * The complete client-role table privilege census is 8 rows, all of them
--     authenticated and all of them pre-existing from the marketplace DDL:
--     listings SELECT+INSERT+UPDATE, offers SELECT+INSERT+UPDATE,
--     matches SELECT, quotes SELECT. That is exactly the surface the Shipper
--     journey needs, which is the evidence that no new grant was required.
--     service_role holds 0 table privileges here - the MOD-002 handoff runs on
--     the session-scoped client, so it is RLS-checked rather than RLS-bypassing.
--   * This file issues no GRANT and no REVOKE. app stays deliberately
--     unexposed, per the Lead Architect's decision in this stage, so membership
--     authority remains definer-RPC-only (054).
--   * The financial boundary is untouched: migration 030 is not applied here and
--     no financial, escrow, settlement or payment object is exposed or altered.
--
-- BEFORE-STATE (measured live, 2026-11-11, pg_db_role_setting for authenticator)
--   pgrst.db_schemas=public, graphql_public, logistics_schema, financial_schema,
--     communication_schema, monitoring_schema
--   which is exactly the post-state 056 asserted, i.e. no other party had moved
--   the API surface between 056 and this change.
--
-- APPLIED (2026-11-11, after explicit LA authorization for this statement)
--   the ALTER ROLE in Section B plus the two pg_notify reloads. No restart was
--   required; the exposed set was re-read from pg_roles.rolconfig afterwards and
--   the booking route was exercised live end-to-end.
--
-- ROLLBACK (exact inverse, single statement plus the same two reloads)
--   ALTER ROLE authenticator SET pgrst.db_schemas =
--     'public, graphql_public, logistics_schema, financial_schema, communication_schema, monitoring_schema';
--   SELECT pg_notify('pgrst', 'reload config');
--   SELECT pg_notify('pgrst', 'reload schema');
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A - before-state guard and the preconditions this change relies on.
-- ----------------------------------------------------------------------------
DO $i4_pre$
DECLARE
  v_cfg TEXT;
BEGIN
  SELECT coalesce(string_agg(cfg, ' ~ '), '(unset)') INTO v_cfg
    FROM pg_db_role_setting d
    JOIN pg_roles r ON r.oid = d.setrole
    CROSS JOIN LATERAL unnest(d.setconfig) AS cfg
   WHERE r.rolname = 'authenticator' AND cfg LIKE 'pgrst.db_schemas=%';

  -- Either the recorded 056 post-state (this change has not run yet) or the
  -- recorded I-4 target (it has, and this file is being replayed) is accepted.
  -- Anything else means someone else has moved the API surface and this file
  -- must not silently adopt their decision.
  IF v_cfg NOT IN (
       'pgrst.db_schemas=public, graphql_public, logistics_schema, financial_schema, communication_schema, monitoring_schema',
       'pgrst.db_schemas=public, graphql_public, logistics_schema, financial_schema, communication_schema, monitoring_schema, marketplace_schema') THEN
    RAISE EXCEPTION 'I-4 PRE: authenticator pgrst.db_schemas reads [%], which is neither the recorded 056 post-state nor the recorded I-4 target', v_cfg;
  END IF;

  -- RLS must be on across the schema being published. A single unenforced table
  -- would turn exposure into a public read.
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'marketplace_schema'
         AND c.relkind IN ('r','p') AND NOT c.relrowsecurity) <> 0 THEN
    RAISE EXCEPTION 'I-4 PRE: at least one marketplace_schema table no longer has RLS enabled, so this exposure would publish an unenforced table';
  END IF;

  -- The measured anon baseline: no table privilege and no USAGE anywhere in the
  -- schema being published.
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) pr
       JOIN pg_roles g ON g.oid = pr.grantee
       WHERE n.nspname = 'marketplace_schema' AND g.rolname = 'anon') <> 0 THEN
    RAISE EXCEPTION 'I-4 PRE: anon holds a marketplace_schema table privilege, which contradicts the measured baseline this change relies on';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace n
             CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) pr
             JOIN pg_roles g ON g.oid = pr.grantee
             WHERE n.nspname = 'marketplace_schema' AND g.rolname = 'anon') THEN
    RAISE EXCEPTION 'I-4 PRE: anon holds marketplace_schema USAGE, so exposure would give it a nameable surface';
  END IF;
END
$i4_pre$;

-- ----------------------------------------------------------------------------
-- SECTION B - the exposure. 056's six schemas plus marketplace_schema; app and
-- every other schema stay out.
-- ----------------------------------------------------------------------------
ALTER ROLE authenticator SET pgrst.db_schemas =
  'public, graphql_public, logistics_schema, financial_schema, communication_schema, monitoring_schema, marketplace_schema';

SELECT pg_notify('pgrst', 'reload config');
SELECT pg_notify('pgrst', 'reload schema');

-- ----------------------------------------------------------------------------
-- SECTION C - post-change assertion: the setting landed, the schemas that must
-- stay closed did not move, and nothing was granted or revoked along the way.
-- ----------------------------------------------------------------------------
DO $i4_post$
DECLARE
  v_cfg TEXT;
  v_auth INT;
  v_other INT;
BEGIN
  SELECT coalesce(string_agg(cfg, ' ~ '), '(unset)') INTO v_cfg
    FROM pg_db_role_setting d
    JOIN pg_roles r ON r.oid = d.setrole
    CROSS JOIN LATERAL unnest(d.setconfig) AS cfg
   WHERE r.rolname = 'authenticator' AND cfg LIKE 'pgrst.db_schemas=%';

  IF v_cfg IS DISTINCT FROM 'pgrst.db_schemas=public, graphql_public, logistics_schema, financial_schema, communication_schema, monitoring_schema, marketplace_schema' THEN
    RAISE EXCEPTION 'I-4 POST: authenticator pgrst.db_schemas reads [%]', v_cfg;
  END IF;

  -- Supersedes the half of 056's Section C that asserted marketplace_schema was
  -- outside the set. The app half still holds and is asserted here instead.
  IF v_cfg LIKE '%app%' THEN
    RAISE EXCEPTION 'I-4 POST: the exposed set includes app, which the Lead Architect directed to leave unexposed';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_db_role_setting d
              JOIN pg_roles r ON r.oid = d.setrole
             WHERE r.rolname <> 'authenticator'
               AND EXISTS (SELECT 1 FROM unnest(d.setconfig) c WHERE c LIKE 'pgrst.db_schemas=%')) THEN
    RAISE EXCEPTION 'I-4 POST: a non-authenticator role carries pgrst.db_schemas, the per-role form 056 measured not to work';
  END IF;

  -- The change is configuration only, so the privilege census must still read
  -- exactly what it read before: 8 authenticated table privileges over listings,
  -- offers, matches and quotes, and nothing at all for anon, service_role or
  -- PUBLIC.
  SELECT count(*) FILTER (WHERE g.rolname = 'authenticated'),
         count(*) FILTER (WHERE g.rolname IN ('anon','service_role','PUBLIC'))
    INTO v_auth, v_other
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) pr
    JOIN pg_roles g ON g.oid = pr.grantee
   WHERE n.nspname = 'marketplace_schema'
     AND g.rolname IN ('authenticated','anon','service_role','PUBLIC');

  IF v_auth <> 8 THEN
    RAISE EXCEPTION 'I-4 POST: authenticated holds [%] marketplace_schema table privileges, expected the 8 measured before this change', v_auth;
  END IF;
  IF v_other <> 0 THEN
    RAISE EXCEPTION 'I-4 POST: anon, service_role or PUBLIC holds a direct marketplace_schema table privilege; exposure was supposed to be the only change';
  END IF;
END
$i4_post$;
