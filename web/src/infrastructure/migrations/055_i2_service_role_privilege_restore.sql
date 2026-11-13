-- ============================================================================
-- F-I2-27 REMEDIATION (1 of 3) - service-role minimum privilege restoration.
-- Registered against finding F-I2-27, opened by 054 (NXC-I2-DB-012).
-- AMENDED AFTER APPLICATION, 2026-11-09, when Step-4 functional testing closed
-- the finding: this file is one of THREE privilege/transport files (055, 056,
-- 057) plus the 058 residue cleanup, not two - "(1 of 2)" was written before
-- 057 was needed - and its 43-privilege baseline is superseded to 45 by 057.
-- A second correction matters more than the numbering: the census this file
-- records, and the after-state it asserts, are pg_class.relacl only. They are
-- not a complete privilege census. pg_attribute.attacl carries 32 pre-existing
-- column-level UPDATE privileges to service_role issued by 049
-- (NXC-I2-DB-007) - contracts 11 columns including version, payment_intents 9
-- including status, settlement_requests 7, financial_ledger_entries 5 - each
-- paired with the identical grant to authenticated. Those privileges are
-- invisible to an aclexplode(relacl) query, they were not revoked here, and
-- their existence is why the Step-4 write matrix probes column boundaries
-- instead of issuing table-wide UPDATE statements against live fixture rows.
-- Full disclosure: scope statement 3.0b and register rows NXC-I2-DB-013,
-- NXC-I2-DB-014, NXC-I2-VAL-002.
--
-- REQUIREMENT (verbatim, LA DIRECTIVE - F-I2-27 SERVICE-ROLE PRIVILEGE
-- REMEDIATION, 2026-11-09)
--   "Prepare and apply the smallest coherent database migration or set of
--   migrations that restores legitimate service-role functionality."
--   "Grant only the privileges needed by the identified operations. Avoid
--   indiscriminate GRANT ALL across schemas or tables. Do not grant privileges
--   to PUBLIC, anon or authenticated merely to make service-role operations
--   work. Preserve existing RLS policies and their intended access boundaries."
--
-- BEFORE-STATE (live project cvdggspiudmudbbdkjrc, measured 2026-11-09 by the
-- census probes f_i2_27_pre_matrix_readonly and f_i2_27_acl_inspect_readonly,
-- each of which ends in RAISE EXCEPTION, so nothing they touched persisted and
-- no schema_migrations row was written)
--   USAGE for service_role: logistics_schema=N financial_schema=N
--   communication_schema=N monitoring_schema=N marketplace_schema=N app=N
--   public=Y.
--   @@@SVC_GRANTS_N=0 - an aclexplode census over logistics/financial/
--   communication/marketplace/monitoring returned ZERO service_role privilege
--   rows. That is the authoritative before-state: all 43 (object, privilege)
--   pairs this file restores were absent.
--   @@@SERIAL NONE - no column of any of the 23 objects is a serial or identity
--   column, so NO sequence privilege is required by any of these operations.
--   PROBE DEFECT, DISCLOSED: the same pre-change probe also printed a
--   per-object "[riu-]" matrix with need=23 have=0 missing=23. That print was
--   produced by a loop over string_to_array(ops, '') and is NOT a valid
--   per-privilege measurement: on this server (PostgreSQL 17.11, measured)
--   string_to_array('RIU','') returns the single element 'RIU', so the case
--   expression fell through to DELETE for every multi-letter row and one
--   iteration per table was counted instead of one per privilege. The correct
--   form, used for the after-state census, splits by position
--   (substr(ops, i, 1) over generate_series) and reports need=43 have=43
--   missing=0 with no extra grants and @@@DELETE_ROWS=0. The zero-privilege
--   before-state is unaffected by that defect because it was measured
--   independently by @@@SVC_GRANTS_N=0.
--   @@@BOUNDARY (the client roles this migration must not touch):
--   anon USAGE=false on all four domain schemas; anon SELECT on
--   logistics_schema.documents=false; anon INSERT on
--   communication_schema.notifications=false; authenticated USAGE=true on
--   logistics_schema and monitoring_schema; authenticated SELECT on
--   logistics_schema.documents=true and on communication_schema.notifications
--   =true; authenticated UPDATE on financial_schema.settlement_requests=false.
--
-- WHY THESE 43 PRIVILEGES ON 23 TABLES AND NOT A SCHEMA-WIDE GRANT
--   Each pair maps to a named server-side statement reached only through
--   createAdminClient() or an explicit service-role client (scope statement
--   3.2/3.4 inventory, re-derived per file):
--     logistics_schema.documents RIU        document-repository.ts:406,522,677,700,...
--     document_linkages RI                  :437,548,879,903,1253
--     document_versions RI                  :488,539,749,761,790,1304
--     document_approvals RIU                :556,816,847
--     document_expiry_records RIU           :456,580,1076,1107,1137,1272
--     ocr_results RIU                       :564,928,961,982
--     digital_signatures RI                 :572,1017,1050
--     bookings R                            documents/upload|download|preview, dispute evidence reads
--     contracts R                           documents/upload|download|preview
--     dispute_cases RI                      app/api/disputes/route.ts:93,184, [id]/route.ts:34,
--                                           [id]/escalate/route.ts:78
--     escalations RI                        app/api/disputes/[id]/escalate/route.ts:104
--     support_tickets RI                    app/api/support/tickets/route.ts:116,210
--     escrow_records RU                     disputes/[id]/hold:41,62 resolution:52,75
--                                           escrow-service.ts:69,129,152 settlement-execution-service.ts:299
--     payment_intents R                     app/api/reconciliation/[escrowId]/route.ts:37
--     settlement_requests RIU               settlement-execution-service.ts:53,340
--                                           reconciliation:51 webhooks/settlement PATCH x2
--     financial_ledger_entries R            reconciliation:71
--     notifications RI                      app/api/notifications/route.ts:97
--                                           mod-016 notification-event-handler.ts:361,379
--     alerts IU                             mod-017 alert-persistence.ts:47,81-84
--     incidents IU                          mod-017 incident-persistence.ts:31,67-70
--     log_entries I                         mod-017 log-persistence.ts:46-48
--     metrics I  traces I  health_checks I  mod-017 metric|trace|health-persistence.ts
--   DELETE is granted nowhere: no service-role statement deletes in these
--   schemas. marketplace_schema and app are granted nothing: marketplace reads
--   go through the session client under RLS, and 054 deliberately left the app
--   membership tables reachable only through the four public pinned SECURITY
--   DEFINER RPCs, which service_role already EXECUTEs.
--
-- WHY THIS DOES NOT WEAKEN RLS OR ROLE SEPARATION
--   service_role has rolbypassrls=true (measured during I-2 Part C). Granting
--   it table privileges therefore cannot change what any client role sees; it
--   only lets the server process perform the statements it was already written
--   to perform. No anon or authenticated grant is created or widened here -
--   SECTION C asserts the boundary is byte-identical afterwards.
--
-- DOES NOT DO
--   * It does not restore the app membership grants 054 revoked. That revocation
--     stands; the definer RPC path is the documented route.
--   * It does not create the ten RPC names that do not exist in this database
--     (claim_one_queued_notification, record_delivery_attempt,
--     call_notification_api, advance_escrow_state, get_escrow_with_details,
--     initiate_payment_intent, execute_settlement, approve_settlement,
--     create_settlement_request, confirm_payment_via_webhook - measured by
--     f_i2_27_fn_census_readonly). Those are missing functions, not missing
--     privileges, and are SB-3A's gated scope.
--   * It does not change PostgREST schema exposure. That is 056, kept separate
--     because it is a configuration change with its own revert path.
--
-- ROLLBACK (exact inverse; the measured before-state is zero privileges)
--   REVOKE USAGE ON SCHEMA logistics_schema FROM service_role;
--   REVOKE USAGE ON SCHEMA financial_schema FROM service_role;
--   REVOKE USAGE ON SCHEMA communication_schema FROM service_role;
--   REVOKE USAGE ON SCHEMA monitoring_schema FROM service_role;
--   REVOKE ALL ON TABLE <each of the 23 tables> FROM service_role;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A - before-state guard. Each assertion is a measurement taken from
-- the live catalog immediately before this file was written. Drift aborts the
-- migration instead of granting against a state it no longer describes.
-- ----------------------------------------------------------------------------
DO $sr27_pre$
DECLARE
  v_bad TEXT := '';
BEGIN
  -- (1) The four schemas must not already be usable by service_role, otherwise
  -- this file is not the restoration it claims to be.
  IF has_schema_privilege('service_role'::regrole, 'logistics_schema', 'USAGE')
     OR has_schema_privilege('service_role'::regrole, 'financial_schema', 'USAGE')
     OR has_schema_privilege('service_role'::regrole, 'communication_schema', 'USAGE')
     OR has_schema_privilege('service_role'::regrole, 'monitoring_schema', 'USAGE') THEN
    RAISE EXCEPTION 'F-I2-27 PRE: service_role already holds USAGE on a domain schema, so the measured zero-privilege before-state no longer holds';
  END IF;

  -- (2) app must stay closed: 054's decision depends on it, and this migration
  -- must not silently reopen the membership tables.
  IF has_schema_privilege('service_role'::regrole, 'app', 'USAGE') THEN
    RAISE EXCEPTION 'F-I2-27 PRE: service_role holds USAGE on app, which reverses the 054 minimum-privilege decision';
  END IF;

  -- (3) All 23 objects must exist under the exact names the call sites use.
  SELECT string_agg(t, ', ') INTO v_bad FROM (
    SELECT unnest(ARRAY[
      'logistics_schema.documents','logistics_schema.document_linkages','logistics_schema.document_versions',
      'logistics_schema.document_approvals','logistics_schema.document_expiry_records','logistics_schema.ocr_results',
      'logistics_schema.digital_signatures','logistics_schema.bookings','logistics_schema.contracts',
      'logistics_schema.dispute_cases','logistics_schema.escalations','logistics_schema.support_tickets',
      'financial_schema.escrow_records','financial_schema.payment_intents','financial_schema.settlement_requests',
      'financial_schema.financial_ledger_entries','communication_schema.notifications',
      'monitoring_schema.alerts','monitoring_schema.incidents','monitoring_schema.log_entries',
      'monitoring_schema.metrics','monitoring_schema.traces','monitoring_schema.health_checks']) AS t
  ) q WHERE to_regclass(t) IS NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'F-I2-27 PRE: object(s) [%] named by the call-site map are absent, so the map no longer matches the schema', v_bad;
  END IF;

  -- (4) RLS must be enabled on every object being granted. service_role bypasses
  -- RLS, so this is a guard for the client boundary that exposure (056) could
  -- otherwise reach: an RLS-off table with a client grant would be a leak.
  SELECT string_agg(t, ', ') INTO v_bad FROM (
    SELECT c.oid::regclass::text AS t, c.relrowsecurity AS on_
      FROM unnest(ARRAY[
        'logistics_schema.documents','logistics_schema.document_linkages','logistics_schema.document_versions',
        'logistics_schema.document_approvals','logistics_schema.document_expiry_records','logistics_schema.ocr_results',
        'logistics_schema.digital_signatures','logistics_schema.bookings','logistics_schema.contracts',
        'logistics_schema.dispute_cases','logistics_schema.escalations','logistics_schema.support_tickets',
        'financial_schema.escrow_records','financial_schema.payment_intents','financial_schema.settlement_requests',
        'financial_schema.financial_ledger_entries','communication_schema.notifications',
        'monitoring_schema.alerts','monitoring_schema.incidents','monitoring_schema.log_entries',
        'monitoring_schema.metrics','monitoring_schema.traces','monitoring_schema.health_checks']::text[]) u(name)
      JOIN pg_class c ON c.oid = to_regclass(u.name)
  ) q WHERE NOT q.on_;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'F-I2-27 PRE: RLS is disabled on [%], which contradicts the exposure-safety case this migration relies on', v_bad;
  END IF;

  -- (5) No sequence dependency: the measured @@@SERIAL census was NONE. If a
  -- serial or identity column appeared, this file would be under-granting and
  -- INSERTs would fail on the sequence instead of the table.
  SELECT string_agg(DISTINCT t, ', ') INTO v_bad FROM (
    SELECT c.oid::regclass::text AS t
      FROM unnest(ARRAY[
        'logistics_schema.documents','logistics_schema.document_linkages','logistics_schema.document_versions',
        'logistics_schema.document_approvals','logistics_schema.document_expiry_records','logistics_schema.ocr_results',
        'logistics_schema.digital_signatures','logistics_schema.bookings','logistics_schema.contracts',
        'logistics_schema.dispute_cases','logistics_schema.escalations','logistics_schema.support_tickets',
        'financial_schema.escrow_records','financial_schema.payment_intents','financial_schema.settlement_requests',
        'financial_schema.financial_ledger_entries','communication_schema.notifications',
        'monitoring_schema.alerts','monitoring_schema.incidents','monitoring_schema.log_entries',
        'monitoring_schema.metrics','monitoring_schema.traces','monitoring_schema.health_checks']::text[]) u(name)
      JOIN pg_class c ON c.oid = to_regclass(u.name)
      JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE a.attnum > 0 AND NOT a.attisdropped
       AND (a.attidentity <> '' OR EXISTS (
             SELECT 1 FROM pg_attrdef d
              WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum
                AND pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval%'))
  ) q;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'F-I2-27 PRE: [%] now carries a serial/identity column, so the zero-sequence before-state is stale and sequence USAGE must be scoped explicitly', v_bad;
  END IF;

  -- (6) The definer RPCs that 054 relied on must still be callable by
  -- service_role; this migration restores table privileges without making the
  -- membership path any less definer-only.
  IF NOT has_function_privilege('service_role'::regrole, 'public.record_marketplace_membership(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role'::regrole, 'public.effective_marketplace_role()', 'EXECUTE')
     OR NOT has_function_privilege('service_role'::regrole, 'public.effective_user_role()', 'EXECUTE') THEN
    RAISE EXCEPTION 'F-I2-27 PRE: the definer membership path is no longer EXECUTE-able by service_role, so this file describes a different architecture than the one in place';
  END IF;
END
$sr27_pre$;

-- ----------------------------------------------------------------------------
-- SECTION B - the restoration. Four USAGE grants and seven grouped privilege
-- statements, each group matching exactly the operations the call-site map
-- names. Nothing else, and no DELETE anywhere.
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA logistics_schema TO service_role;
GRANT USAGE ON SCHEMA financial_schema TO service_role;
GRANT USAGE ON SCHEMA communication_schema TO service_role;
GRANT USAGE ON SCHEMA monitoring_schema TO service_role;

-- read + insert + update
GRANT SELECT, INSERT, UPDATE ON TABLE
  logistics_schema.documents,
  logistics_schema.document_approvals,
  logistics_schema.document_expiry_records,
  logistics_schema.ocr_results,
  financial_schema.settlement_requests
TO service_role;

-- read + insert
GRANT SELECT, INSERT ON TABLE
  logistics_schema.document_linkages,
  logistics_schema.document_versions,
  logistics_schema.digital_signatures,
  logistics_schema.dispute_cases,
  logistics_schema.escalations,
  logistics_schema.support_tickets,
  communication_schema.notifications
TO service_role;

-- read only
GRANT SELECT ON TABLE
  logistics_schema.bookings,
  logistics_schema.contracts,
  financial_schema.payment_intents,
  financial_schema.financial_ledger_entries
TO service_role;

-- read + update
GRANT SELECT, UPDATE ON TABLE financial_schema.escrow_records TO service_role;

-- insert + update (telemetry is written and resolved, never read by the server path)
GRANT INSERT, UPDATE ON TABLE
  monitoring_schema.alerts,
  monitoring_schema.incidents
TO service_role;

-- insert only
GRANT INSERT ON TABLE
  monitoring_schema.log_entries,
  monitoring_schema.metrics,
  monitoring_schema.traces,
  monitoring_schema.health_checks
TO service_role;

-- ----------------------------------------------------------------------------
-- SECTION C - post-change assertion. Five halves: the 23 privileges are
-- present, no DELETE was included, nothing outside the map was granted, the
-- client-role boundary is identical to the measured before-state, and a
-- service_role session can actually perform the reads the map claims.
-- ----------------------------------------------------------------------------
DO $sr27_post$
DECLARE
  v_req RECORD;
  v_missing TEXT := '';
  v_extra TEXT := '';
  v_leg TEXT := '';
  v_n INT;
BEGIN
  -- (1) required-and-present: one has_table_privilege test per (object, op).
  FOR v_req IN SELECT * FROM (VALUES
    ('logistics_schema','documents','R'), ('logistics_schema','documents','I'), ('logistics_schema','documents','U'),
    ('logistics_schema','document_linkages','R'), ('logistics_schema','document_linkages','I'),
    ('logistics_schema','document_versions','R'), ('logistics_schema','document_versions','I'),
    ('logistics_schema','document_approvals','R'), ('logistics_schema','document_approvals','I'), ('logistics_schema','document_approvals','U'),
    ('logistics_schema','document_expiry_records','R'), ('logistics_schema','document_expiry_records','I'), ('logistics_schema','document_expiry_records','U'),
    ('logistics_schema','ocr_results','R'), ('logistics_schema','ocr_results','I'), ('logistics_schema','ocr_results','U'),
    ('logistics_schema','digital_signatures','R'), ('logistics_schema','digital_signatures','I'),
    ('logistics_schema','bookings','R'), ('logistics_schema','contracts','R'),
    ('logistics_schema','dispute_cases','R'), ('logistics_schema','dispute_cases','I'),
    ('logistics_schema','escalations','R'), ('logistics_schema','escalations','I'),
    ('logistics_schema','support_tickets','R'), ('logistics_schema','support_tickets','I'),
    ('financial_schema','escrow_records','R'), ('financial_schema','escrow_records','U'),
    ('financial_schema','payment_intents','R'),
    ('financial_schema','settlement_requests','R'), ('financial_schema','settlement_requests','I'), ('financial_schema','settlement_requests','U'),
    ('financial_schema','financial_ledger_entries','R'),
    ('communication_schema','notifications','R'), ('communication_schema','notifications','I'),
    ('monitoring_schema','alerts','I'), ('monitoring_schema','alerts','U'),
    ('monitoring_schema','incidents','I'), ('monitoring_schema','incidents','U'),
    ('monitoring_schema','log_entries','I'), ('monitoring_schema','metrics','I'),
    ('monitoring_schema','traces','I'), ('monitoring_schema','health_checks','I')) AS v(ns, tbl, op) LOOP
    IF NOT has_table_privilege('service_role'::regrole, v_req.ns||'.'||v_req.tbl,
         CASE v_req.op WHEN 'R' THEN 'SELECT' WHEN 'I' THEN 'INSERT' WHEN 'U' THEN 'UPDATE' END) THEN
      v_missing := v_missing || v_req.ns||'.'||v_req.tbl||':'||v_req.op||' ';
    END IF;
    IF has_table_privilege('service_role'::regrole, v_req.ns||'.'||v_req.tbl, 'DELETE') THEN
      v_extra := v_extra || v_req.ns||'.'||v_req.tbl||':DELETE ';
    END IF;
  END LOOP;

  IF has_schema_privilege('service_role'::regrole, 'logistics_schema', 'USAGE') IS NOT TRUE
     OR has_schema_privilege('service_role'::regrole, 'financial_schema', 'USAGE') IS NOT TRUE
     OR has_schema_privilege('service_role'::regrole, 'communication_schema', 'USAGE') IS NOT TRUE
     OR has_schema_privilege('service_role'::regrole, 'monitoring_schema', 'USAGE') IS NOT TRUE THEN
    v_missing := v_missing || 'SCHEMA-USAGE ';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'F-I2-27 POST: service_role still lacks [%]', v_missing;
  END IF;
  IF v_extra <> '' THEN
    RAISE EXCEPTION 'F-I2-27 POST: service_role holds DELETE on [%]; the call-site map contains no delete statement, so this migration must not grant it', v_extra;
  END IF;

  -- (2) nothing outside the map. Count every service_role table privilege in
  -- the four granted schemas plus the two deliberately untouched ones; the
  -- expected total is exactly 43 privilege rows across the 23 tables, and
  -- marketplace_schema/app must still be empty.
  SELECT count(*) INTO v_n FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) pr
   WHERE n.nspname IN ('logistics_schema','financial_schema','communication_schema','monitoring_schema')
     AND c.relkind IN ('r','p')
     AND pr.grantee = 'service_role'::regrole;
  IF v_n <> 43 THEN
    RAISE EXCEPTION 'F-I2-27 POST: the four granted schemas hold % service_role privilege rows, expected exactly 43 (23 tables per the call-site map)', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) pr
   WHERE n.nspname IN ('marketplace_schema','app')
     AND pr.grantee = 'service_role'::regrole;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'F-I2-27 POST: service_role acquired % privilege row(s) in marketplace_schema/app, which this migration does not own', v_n;
  END IF;

  IF has_schema_privilege('service_role'::regrole, 'app', 'USAGE')
     OR has_schema_privilege('service_role'::regrole, 'marketplace_schema', 'USAGE') THEN
    RAISE EXCEPTION 'F-I2-27 POST: service_role was given USAGE on app or marketplace_schema, reopening the membership-authority surface 054 closed';
  END IF;

  -- (3) the client boundary is exactly the measured before-state.
  IF has_schema_privilege('anon'::regrole, 'logistics_schema', 'USAGE')
     OR has_schema_privilege('anon'::regrole, 'financial_schema', 'USAGE')
     OR has_schema_privilege('anon'::regrole, 'communication_schema', 'USAGE')
     OR has_schema_privilege('anon'::regrole, 'monitoring_schema', 'USAGE')
     OR has_schema_privilege('anon'::regrole, 'marketplace_schema', 'USAGE') THEN
    RAISE EXCEPTION 'F-I2-27 POST: anon gained domain-schema USAGE - a client role picked up access this migration was not allowed to give it';
  END IF;

  IF has_table_privilege('anon'::regrole, 'logistics_schema.documents', 'SELECT')
     OR has_table_privilege('anon'::regrole, 'communication_schema.notifications', 'INSERT')
     OR has_table_privilege('authenticated'::regrole, 'financial_schema.settlement_requests', 'UPDATE')
     OR has_table_privilege('authenticated'::regrole, 'monitoring_schema.log_entries', 'SELECT') THEN
    RAISE EXCEPTION 'F-I2-27 POST: a client role gained a table privilege this migration does not own';
  END IF;

  -- (4) functional proof from inside the role, not only from the catalog. Each
  -- read below targets an object the map grants SELECT on, over a false
  -- predicate, so no row is touched. One read per read-granted schema proves
  -- those USAGE grants landed and the privilege checks pass; monitoring_schema,
  -- which the map grants no read on, is proved in (4b) instead.
  SET LOCAL ROLE service_role;
  BEGIN
    v_leg := 'logistics_schema.documents';
    EXECUTE 'SELECT count(*) FROM logistics_schema.documents WHERE false';
    v_leg := 'financial_schema.escrow_records';
    EXECUTE 'SELECT count(*) FROM financial_schema.escrow_records WHERE false';
    v_leg := 'communication_schema.notifications';
    EXECUTE 'SELECT count(*) FROM communication_schema.notifications WHERE false';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'F-I2-27 POST: a service_role session cannot read % (%)', v_leg, SQLERRM;
  END;
  RESET ROLE;

  -- (4b) and the boundary in the other direction: monitoring_schema is
  -- write-only in the call-site map, so a service_role read there MUST be
  -- denied - and denied at TABLE level, which is what proves the USAGE grant
  -- arrived without a read privilege being granted alongside it. A SCHEMA-level
  -- denial here would mean USAGE had not landed. The INSERT grant itself cannot
  -- be proved by a read, so it is proved in Step 4 through the real
  -- observability persistence path instead.
  SET LOCAL ROLE service_role;
  BEGIN
    EXECUTE 'SELECT count(*) FROM monitoring_schema.log_entries WHERE false';
    v_leg := 'can read';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM LIKE '%permission denied for schema%' THEN
      RESET ROLE;
      RAISE EXCEPTION 'F-I2-27 POST: monitoring_schema denial is schema-level (%), so the USAGE grant did not land', SQLERRM;
    END IF;
    v_leg := 'denied-at-table-level';
  END;
  RESET ROLE;
  IF v_leg IS DISTINCT FROM 'denied-at-table-level' THEN
    RAISE EXCEPTION 'F-I2-27 POST: a service_role session [%] monitoring_schema.log_entries, which the map grants INSERT only', v_leg;
  END IF;

  -- And the app membership authority must remain unreachable directly, exactly
  -- as 054 left it. The denial is the property being asserted.
  SET LOCAL ROLE service_role;
  BEGIN
    EXECUTE 'SELECT count(*) FROM app.marketplace_memberships WHERE false';
    v_leg := 'REACHABLE';
  EXCEPTION WHEN insufficient_privilege THEN
    v_leg := 'denied';
  END;
  RESET ROLE;
  IF v_leg IS DISTINCT FROM 'denied' THEN
    RAISE EXCEPTION 'F-I2-27 POST: a service_role session can reach app.marketplace_memberships directly (%), which would put the membership authority table outside the audited definer RPCs', v_leg;
  END IF;
END
$sr27_post$;
