-- NexCargo Migration 040 — I-1 Marketplace Membership Authority
-- Authorized by QODER EXECUTION DIRECTIVE — NEXCARGO I-1 (Full Implementation Authorisation), 5 Nov 2026, §3.3–§3.4, §8, §9.
--
-- Purpose: Give the marketplace domain (SHIPPER / TRANSPORTER) a database-backed authority,
--          replacing auth.users.raw_user_meta_data as the source a server may trust.
--
-- Changes:
--   1. app.marketplace_memberships — one row per user, constrained to SHIPPER|TRANSPORTER
--   2. public.effective_marketplace_role() — narrowly scoped SECURITY DEFINER resolver that
--      reads auth.uid() only; it accepts no caller-supplied user id
--   3. RLS enabled and narrow table grants applied together (§9)
--
-- Deliberately NOT changed here:
--   - public.effective_user_role() and app.platform_roles (platform domain; its search_path pin
--     is applied as a separate controlled statement, not bundled with this migration)
--   - public.declared_role() / public.has_transporter_ownership() (deferred, not part of I-1)
--   - Any existing RLS policy on any existing table
--   - No metadata-derived authority is created or preserved

-- ============================================================
-- SECTION 1: app.marketplace_memberships
-- ============================================================

CREATE TABLE IF NOT EXISTS app.marketplace_memberships (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('SHIPPER', 'TRANSPORTER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 2: Row level security (applied together with Section 3 grants)
-- ============================================================

ALTER TABLE app.marketplace_memberships ENABLE ROW LEVEL SECURITY;

-- A member may read their own marketplace membership and nothing else.
DROP POLICY IF EXISTS marketplace_memberships_self_select ON app.marketplace_memberships;
CREATE POLICY marketplace_memberships_self_select
  ON app.marketplace_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policy exists on purpose: a session role can never write its own
-- authoritative marketplace role, even where a table grant would otherwise allow it.
-- Membership rows are written only through the trusted server path holding service_role.

-- ============================================================
-- SECTION 3: Table privileges (explicit; default PUBLIC=ALL is removed)
-- ============================================================

REVOKE ALL ON app.marketplace_memberships FROM PUBLIC;
REVOKE ALL ON app.marketplace_memberships FROM anon;
REVOKE ALL ON app.marketplace_memberships FROM authenticated;
GRANT SELECT ON app.marketplace_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.marketplace_memberships TO service_role;

-- ============================================================
-- SECTION 4: Marketplace resolver
-- ============================================================

CREATE OR REPLACE FUNCTION public.effective_marketplace_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT mm.role
  FROM app.marketplace_memberships mm
  WHERE mm.user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.effective_marketplace_role() IS
  'I-1 marketplace role authority. Resolves only the calling JWT subject; returns SHIPPER, TRANSPORTER, or NULL. Never accepts a caller-supplied user id and never reads user_metadata.';

REVOKE ALL ON FUNCTION public.effective_marketplace_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.effective_marketplace_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.effective_marketplace_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_marketplace_role() TO service_role;
