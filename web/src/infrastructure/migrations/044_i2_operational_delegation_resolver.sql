-- NexCargo Migration 044 — I-2 Operational Delegation Read Resolver
-- Authorized by QODER EXECUTION DIRECTIVE "NEXCARGO — I-2 ARCHITECTURAL ADJUDICATION AND EXECUTION
-- DIRECTIVE" (Lead Architect, 6 Nov 2026), PART A ("enforce delegated scope through backend authorization
-- AND RLS") and PART C items 1, 5, 8.
-- Depends on: 043_i2_operational_delegation_mechanism.sql (app.operational_delegations).
--
-- Why this exists: 043 gave the database its delegation authority, and logistics_schema.transporterscope()
-- now feeds the RLS side. The backend side needs one callable, non-steerable read of the same record —
-- otherwise the only enforcement of PART A lives in policies and nothing in the API layer can honor it.
-- No existing route is a Dispatcher route yet (the Dispatcher surface is I-9 by the roadmap), so this file
-- adds a reader and no behaviour change: nothing that works today changes, and I-2's code side gains a
-- resolver instead of inventing one later.
--
-- PRE-CHANGE STATE: app.operational_delegations created by 043 (tracked row i2_operational_delegation_mechanism,
--   applied 2026-11-06; advisor at 12:17:12.300Z showed function_search_path_mutable 11 -> 9 and
--   anon_security_definer_function_executable 0). Live legs of 043: 8 PASS / 0 FAIL — anon and session
--   callers refused on both writer RPCs, has_operational_scope reachable by session and false for both
--   fixture accounts, app.* and logistics_schema.* not exposed by PostgREST.
--
-- DELIBERATELY NOT CHANGED: 043's tables, triggers, writer RPCs, transporterscope(), either I-1 resolver,
--   any policy. F-I2-14 (dispatcher policies are not row-scoped) is the next file, not this one.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.effective_operational_delegation();

CREATE OR REPLACE FUNCTION public.effective_operational_delegation()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE jsonb_build_object(
      'principal_transporter_user_id',
      (SELECT od.principal_transporter_user_id
         FROM app.operational_delegations od
        WHERE od.delegate_user_id = auth.uid()
          AND od.revoked_at IS NULL
        ORDER BY od.granted_at DESC
        LIMIT 1),
      'scopes',
      COALESCE((SELECT jsonb_agg(DISTINCT od.scope)
                  FROM app.operational_delegations od
                 WHERE od.delegate_user_id = auth.uid()
                   AND od.revoked_at IS NULL), '[]'::jsonb),
      'delegations',
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
                  'delegation_id', od.delegation_id,
                  'scope', od.scope,
                  'principal_transporter_user_id', od.principal_transporter_user_id,
                  'granted_by', od.granted_by,
                  'granted_at', od.granted_at))
                  FROM app.operational_delegations od
                 WHERE od.delegate_user_id = auth.uid()
                   AND od.revoked_at IS NULL), '[]'::jsonb)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.effective_operational_delegation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_operational_delegation() TO authenticated;

COMMENT ON FUNCTION public.effective_operational_delegation() IS
  'I-2 PART A backend resolver for Dispatcher delegation. Zero identity arguments, keyed on auth.uid(), so '
  'a caller can only ever read their own delegation. Returns NULL without a session and an empty scopes '
  'array with none. Reads app.operational_delegations only — never app.platform_roles and never user metadata.';
