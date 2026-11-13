-- NexCargo Migration 041 — I-1 Marketplace Membership Write Path
-- Authorized by QODER EXECUTION DIRECTIVE — NEXCARGO I-1 (Full Implementation Authorisation), §3.5, §8, §9.
-- Depends on: 040_i1_marketplace_membership.sql (app.marketplace_memberships)
--
-- Purpose: give the trusted server path (service_role) one narrow, idempotent way to record a
--          member's marketplace classification.
--
-- Why an RPC and not a direct insert: the Data API exposes the public schema by default; whether
-- the custom app schema is in PostgREST's db_schemas is not observable from SQL. A public function
-- is the one write path whose reachability is known, and its privileges are the point.
--
-- Deliberately NOT changed here:
--   - app.marketplace_memberships structure, RLS, policies, table grants
--   - public.effective_marketplace_role() / public.effective_user_role()
--   - Any existing object

-- ============================================================
-- SECTION 1: service-role-only membership writer
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_marketplace_membership(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'record_marketplace_membership requires a user id';
  END IF;

  -- Same domain constraint as the table CHECK, restated so a bad call is refused here
  -- rather than surfacing as an opaque constraint violation.
  IF p_role IS NULL OR p_role NOT IN ('SHIPPER', 'TRANSPORTER') THEN
    RAISE EXCEPTION 'marketplace membership role must be SHIPPER or TRANSPORTER';
  END IF;

  INSERT INTO app.marketplace_memberships (user_id, role, created_at, updated_at)
  VALUES (p_user_id, p_role, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.record_marketplace_membership(UUID, TEXT) IS
  'Trusted-server-only write path for app.marketplace_memberships. Idempotent. service_role only: a session role can never write its own marketplace classification.';

-- The caller identity is a service credential, not a session — no EXECUTE for anon or authenticated.
REVOKE ALL ON FUNCTION public.record_marketplace_membership(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_marketplace_membership(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.record_marketplace_membership(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_marketplace_membership(UUID, TEXT) TO service_role;
