-- ============================================================================
-- I-2 PART C ITEM 6 - restore the governance legs of every policy that tests
-- app.platform_roles inline. Registered as NXC-I2-DB-009 (finding F-I2-17).
--
-- HOW THIS WAS FOUND (item 8, admissible live verification)
--   The RLS simulation probe run against the live project on 2026-11-09 set
--   LOCAL ROLE authenticated and counted rows on every table whose live policy
--   expression references an app.* governance table. Result, verbatim:
--     authenticated.SELECT on app: marketplace_memberships=true,
--       operational_delegation_audit=true, operational_delegations=true,
--       platform_roles=false
--     19 tables ERR(42501 permission denied for table platform_roles), among them
--       logistics_schema.fleets / vehicles / drivers / asset_assignments,
--       documents, document_versions, document_approvals, document_linkages,
--       document_expiry_records, digital_signatures, ocr_results,
--       backhaul_opportunities, cross_border_compliance_records
--     plus 42501 for table escalations / investigations / regions /
--       logistics_corridors / refund_coordinations / support_tickets (same class,
--       different table - reported as findings, not changed here)
--     plus 42P17 infinite recursion for the shipment_tracking_records family
--       (a separate defect, F-I2-18, reported not changed)
--   So for every session-role query, the fleet family - the exact surface I-2 item
--   6 remediated and the surface Part A requires RLS to enforce delegation on -
--   does not evaluate the governance leg at all. It aborts with a permission error.
--
-- THE MECHANISM
--   A PostgreSQL RLS policy expression is evaluated with the privileges of the
--   querying role. Policies written as
--     EXISTS (SELECT 1 FROM app.platform_roles pr
--             WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN','SUPER_ADMIN'))
--   therefore need SELECT on app.platform_roles for whoever runs the query. That
--   privilege was never issued by any migration (census: `grep -rn "platform_roles"
--   src/infrastructure/migrations/*.sql | grep -i "grant\|revoke"` returns zero
--   table-privilege rows). Its sibling governance tables WERE: 040:55 grants SELECT
--   on app.marketplace_memberships to authenticated, and 043:373-376 grants SELECT
--   on app.operational_delegations. app.platform_roles is the outlier, which is why
--   the marketplace and delegation legs work and the platform-role legs do not.
--
-- PRE-CHANGE STATE (live, measured above)
--   * app.platform_roles: RLS enabled (010:87) with exactly one policy,
--     platform_roles_admin FOR ALL USING public.effective_user_role() IN ('ADMIN',
--     'SUPER_ADMIN') (010:90-94). Table privileges for authenticated: none.
--   * ~40 policies across the repository DDL read that table inline; 19 of them are
--     on tables a session can otherwise query, and all 19 currently fail with 42501.
--   * No application path today can list fleets, vehicles, drivers or assignments
--     through a session client, which is what MOD-014's routes do (item 6).
--
-- THE CHANGE, AND WHY IT IS THE PROPORTIONATE ONE
--   GRANT SELECT ON app.platform_roles TO authenticated. One statement, and what it
--   makes reachable is bounded three ways:
--     - The table's own RLS still applies to the caller, so a non-governance session
--       selects ZERO rows from it. The leg evaluates FALSE, which is exactly what
--       the policy intends, instead of erroring.
--     - anon is not granted anything here, so the unauthenticated path keeps failing
--       closed (a policy leg for anon still cannot read the table).
--     - app is not an exposed PostgREST schema (live exposed schemas: public,
--       graphql_public), so there is no client-readable surface added: the privilege
--       is only ever exercised from inside policy evaluation.
--   The alternative - rewriting every inline leg as public.effective_user_role() IN
--   (...), which is the SECURITY DEFINER convention 010/043 already use elsewhere -
--   is the right long-term shape and is recorded here as the recommendation for the
--   next increment. Doing it now means regenerating ~40 live policies from
--   expressions this session cannot fully read back in every case, i.e. a broad
--   speculative rewrite of modules I-2 does not own. The grant repairs the same
--   defect with zero change to who can see which rows.
--
-- WHAT THIS FILE DOES NOT DO
--   No policy is created, dropped or altered. No other table is granted. The
--   escalation/investigations/regions/corridors/refund_coordinations/support_tickets
--   42501 cases and the shipment_tracking_records 42P17 recursion are left untouched
--   and reported, because repairing them means touching MOD-015, MOD-009 and MOD-003
--   policy architecture, which the directive bounds out of this increment.
--
-- ROLLBACK
--   REVOKE SELECT ON app.platform_roles FROM authenticated;
--   (restores the pre-change state exactly; the 42501 failures it re-introduces are
--    the measured pre-change behaviour, not a new state)
-- ============================================================================

GRANT SELECT ON app.platform_roles TO authenticated;

-- Post-change assertion: the privilege landed, anon did not receive it, and the
-- governance table's own RLS is still enabled so the grant cannot widen row visibility.
DO $i2prerole_post$
DECLARE
  v_rls  TEXT;
BEGIN
  IF NOT has_table_privilege('authenticated', 'app.platform_roles', 'SELECT') THEN
    RAISE EXCEPTION 'I2 PREREAD POST: authenticated still lacks SELECT on app.platform_roles';
  END IF;
  IF has_table_privilege('anon', 'app.platform_roles', 'SELECT') THEN
    RAISE EXCEPTION 'I2 PREREAD POST: anon unexpectedly holds SELECT on app.platform_roles';
  END IF;
  SELECT CASE WHEN relrowsecurity THEN 'rls-on' ELSE 'rls-OFF' END INTO v_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'app' AND c.relname = 'platform_roles';
  IF v_rls <> 'rls-on' THEN
    RAISE EXCEPTION 'I2 PREREAD POST: app.platform_roles RLS is not enabled (%), so this grant would leak role rows', v_rls;
  END IF;
END
$i2prerole_post$;
