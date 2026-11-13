-- ============================================================================
-- F-I2-27 REMEDIATION (3 of 3) - completes the service-role privilege baseline
-- for the two observability objects whose real update paths filter by id.
-- Registered against finding F-I2-27, opened by 054 (NXC-I2-DB-012).
-- Supplements 055 (NXC-I2-DB-013) and 056 (NXC-I2-DB-014); it changes no object
-- those two files already handled.
--
-- REQUIREMENT (verbatim, LA DIRECTIVE - F-I2-27 SERVICE-ROLE PRIVILEGE
-- REMEDIATION, 2026-11-09, step 4)
--   "Do not treat a successful migration or grant census as proof. Test actual
--   operations, including ... notifications/event processing, tracking/
--   documents, and administrative operations."
--   "Where an operation cannot be tested, identify it explicitly rather than
--   marking it PASS."
--
-- THE DEFICIENCY THIS FILE FIXES (found by the step-4 functional test, not by a
-- grant census)
--   055 granted monitoring_schema.alerts and monitoring_schema.incidents
--   INSERT+UPDATE because the MOD-017 call-site map shows exactly those two
--   verbs (alert-persistence.ts:47 insert, :82 update; incident-persistence.ts
--   :32 insert, :68 update). The functional test refused anyway:
--     UPDATE alerts SET resolved_at = now() WHERE id = '<uuid>'
--       -> 42501 permission denied for table alerts
--   Measured on the live server in one rolled-back transaction (probe
--   f_i2_27_probe_where_select_rule, which ends in RAISE EXCEPTION so it
--   persisted nothing, including the temporary grant it issued):
--     WHERE=42501/permission denied for table alerts
--     NOFILTER=NO-ERROR            <- the same UPDATE without a WHERE clause runs
--     INCIDENTS=42501/permission denied for table incidents
--     AFTER-GRANT-OK               <- the same filtered UPDATE runs once SELECT exists
--   The rule it demonstrates: a filtered UPDATE reads the filter columns, so
--   PostgreSQL also requires SELECT on the table. INSERT+UPDATE alone is not
--   enough for a statement of the shape the application actually issues.
--   Of the eight objects 055 grants UPDATE on, seven already hold SELECT
--   (documents, document_approvals, document_expiry_records, ocr_results,
--   settlement_requests, escrow_records) or are read-allowed by construction;
--   alerts and incidents are the only two that were left unreachable. This file
--   adds those two rows and nothing else.
--
-- WHY SELECT AND NOT A REWRITE OF THE CALL SITES
--   The alternative would be to make MOD-017 resolve alerts without a filter,
--   which is not safe, or to route them through a new SECURITY DEFINER RPC,
--   which would be new privileged surface for a two-row privilege gap. Reading
--   an alert row that the same role just wrote is consistent with the
--   least-privilege boundary 055 set for every other UPDATE-bearing object.
--
-- WHAT THIS FILE DOES NOT DO
--   It grants no DELETE anywhere. It grants nothing to PUBLIC, anon or
--   authenticated. It does not widen any schema's USAGE (055 already granted
--   monitoring_schema USAGE to service_role). It touches no policy, function,
--   trigger, sequence, role setting or PostgREST configuration. It does not
--   touch app, marketplace_schema or any other schema. It does not revoke the
--   pre-existing column-level UPDATE privileges that NXC-I2-DB-007
--   (049_i2_public_column_grant_minimum.sql) re-issued to authenticated and
--   service_role on contracts, payment_intents, settlement_requests and
--   financial_ledger_entries; those are outside F-I2-27's deficiency and are
--   reported as an observation, not silently edited.
--
-- ROLLBACK
--   REVOKE SELECT ON monitoring_schema.alerts FROM service_role;
--   REVOKE SELECT ON monitoring_schema.incidents FROM service_role;
--   which restores the 055 after-state (alerts=INSERT,UPDATE and
--   incidents=INSERT,UPDATE) exactly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECTION A - BEFORE-STATE GUARD. The two objects must exist, must be ordinary
-- tables with RLS enabled, must hold exactly INSERT+UPDATE for service_role and
-- must be missing SELECT. Anything else means the premise of this file is wrong
-- and nothing is applied.
-- ---------------------------------------------------------------------------
DO
$sr27a_guard$
DECLARE
  v_leg   TEXT;
  v_n     INT;
BEGIN
  FOREACH v_leg IN ARRAY ARRAY['monitoring_schema.alerts', 'monitoring_schema.incidents']
  LOOP
    IF to_regclass(v_leg) IS NULL THEN
      RAISE EXCEPTION 'F-I2-27 PRE: % does not exist, so this migration has no subject', v_leg;
    END IF;
    SELECT count(*) INTO v_n
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.oid = to_regclass(v_leg) AND n.nspname || '.' || c.relname = v_leg
       AND c.relkind = 'r' AND c.relrowsecurity;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'F-I2-27 PRE: % is not an RLS-enabled ordinary table', v_leg;
    END IF;
  END LOOP;

  -- service_role must hold INSERT and UPDATE and must NOT hold SELECT here,
  -- which is the exact gap this file closes.
  SELECT count(*) INTO v_n FROM unnest(ARRAY['monitoring_schema.alerts','monitoring_schema.incidents']) t(o)
   WHERE has_table_privilege('service_role', o, 'INSERT')
     AND has_table_privilege('service_role', o, 'UPDATE')
     AND NOT has_table_privilege('service_role', o, 'SELECT');
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'F-I2-27 PRE: the INSERT+UPDATE-without-SELECT shape is not present on both objects (matched % of 2), so the measured deficiency does not hold', v_n;
  END IF;

  -- the roles this file must leave alone
  IF has_schema_privilege('anon', 'monitoring_schema', 'USAGE')
     OR has_table_privilege('anon', 'monitoring_schema.alerts', 'SELECT')
     OR has_table_privilege('anon', 'monitoring_schema.incidents', 'SELECT') THEN
    RAISE EXCEPTION 'F-I2-27 PRE: anon already reaches monitoring_schema, which contradicts the 055/056 recorded boundary';
  END IF;
END
$sr27a_guard$;

-- ---------------------------------------------------------------------------
-- SECTION B - THE TWO ROWS
-- ---------------------------------------------------------------------------
GRANT SELECT ON TABLE monitoring_schema.alerts   TO service_role;
GRANT SELECT ON TABLE monitoring_schema.incidents TO service_role;

-- ---------------------------------------------------------------------------
-- SECTION C - AFTER-STATE ASSERTIONS. Object shape, the refused verbs, the
-- unchanged client boundary, and the functional leg the 42501 was standing in
-- the way of. Every statement here is the operation the application issues.
-- ---------------------------------------------------------------------------
DO
$sr27c_post$
DECLARE
  v_n   INT;
  v_leg TEXT;
BEGIN
  -- (1) exactly the two rows were added: service_role now holds SELECT+INSERT+
  -- UPDATE and still no DELETE on both objects.
  SELECT count(*) INTO v_n FROM unnest(ARRAY['monitoring_schema.alerts','monitoring_schema.incidents']) t(o)
   WHERE has_table_privilege('service_role', o, 'SELECT')
     AND has_table_privilege('service_role', o, 'INSERT')
     AND has_table_privilege('service_role', o, 'UPDATE')
     AND NOT has_table_privilege('service_role', o, 'DELETE');
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'F-I2-27 POST: SELECT+INSERT+UPDATE without DELETE is not the shape on both objects (matched % of 2)', v_n;
  END IF;

  -- (2) the service-role table-level privilege census in the four domain
  -- schemas is now 45 rows, i.e. 055's 43 plus exactly these two, with zero
  -- DELETE rows anywhere in those schemas.
  SELECT count(*) INTO v_n
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) a
   WHERE a.grantee = 'service_role'::regrole
     AND n.nspname IN ('logistics_schema','financial_schema','communication_schema','monitoring_schema');
  IF v_n <> 45 THEN
    RAISE EXCEPTION 'F-I2-27 POST: service_role holds % privilege rows in the four domain schemas, expected 45 (055 set 43, this file adds 2)', v_n;
  END IF;
  SELECT count(*) INTO v_n
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) a
   WHERE a.grantee = 'service_role'::regrole AND a.privilege_type = 'DELETE'
     AND n.nspname IN ('logistics_schema','financial_schema','communication_schema','monitoring_schema');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'F-I2-27 POST: % service_role DELETE rows exist in the domain schemas, expected 0', v_n;
  END IF;

  -- (3) nothing moved on the client side of the boundary.
  SELECT count(*) INTO v_n
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) a
   WHERE n.nspname IN ('logistics_schema','financial_schema','communication_schema','monitoring_schema')
     AND a.grantee IN ('anon'::regrole::oid, 0::oid);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'F-I2-27 POST: % anon/PUBLIC privilege rows exist in the domain schemas, expected 0', v_n;
  END IF;
  IF has_schema_privilege('authenticated', 'app', 'USAGE')
     OR has_schema_privilege('service_role', 'app', 'USAGE')
     OR has_schema_privilege('anon', 'marketplace_schema', 'USAGE') THEN
    RAISE EXCEPTION 'F-I2-27 POST: the app / marketplace_schema boundary moved';
  END IF;

  -- (4) the operation that was refused now runs. Zero rows are touched: the
  -- filters name ids that cannot exist, so this asserts the privilege gate and
  -- nothing else. alert-persistence.ts:82 and incident-persistence.ts:68 issue
  -- exactly this shape.
  SET LOCAL ROLE service_role;
  BEGIN
    EXECUTE 'UPDATE monitoring_schema.alerts SET resolved_at = now() WHERE id = ''00000000-0000-4000-8000-0000000000e1''';
    EXECUTE 'UPDATE monitoring_schema.incidents SET status = ''MITIGATING'' WHERE id = ''00000000-0000-4000-8000-0000000000e2''';
    EXECUTE 'SELECT count(*) FROM monitoring_schema.alerts WHERE false';
    EXECUTE 'SELECT count(*) FROM monitoring_schema.incidents WHERE false';
    v_leg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'F-I2-27 POST: the observability update/read leg still fails (%)', SQLERRM;
  END;
  RESET ROLE;
  IF v_leg IS DISTINCT FROM 'ok' THEN
    RAISE EXCEPTION 'F-I2-27 POST: functional leg did not complete';
  END IF;

  -- (5) and DELETE is still refused for a service_role session, at table level.
  SET LOCAL ROLE service_role;
  BEGIN
    EXECUTE 'DELETE FROM monitoring_schema.alerts WHERE id = ''00000000-0000-4000-8000-0000000000e3''';
    v_leg := 'DELETED';
  EXCEPTION WHEN insufficient_privilege THEN
    v_leg := 'denied';
  END;
  RESET ROLE;
  IF v_leg IS DISTINCT FROM 'denied' THEN
    RAISE EXCEPTION 'F-I2-27 POST: a service_role session deleted from monitoring_schema.alerts (%)', v_leg;
  END IF;
END
$sr27c_post$;
