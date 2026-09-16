-- NexCargo Migration 016 -- Role Resolution Correction (Phase 3.2)
-- Purpose: Remove DRIVER from platform authorization; create new role resolution tier
--
-- Strategy: Use CREATE OR REPLACE (NOT DROP+CREATE) to avoid breaking RLS policy dependencies.

-- ============================================================
-- SECTION 1: Replace effective_user_role() via CREATE OR REPLACE only
-- ============================================================

-- OLD implementation returned DRIVER from metadata fallback.
-- NEW implementation resolves ONLY from app.platform_roles.
-- All existing RLS policies referencing effective_user_role() continue working
-- but now get NULL for users who don't have a platform-assigned role.
CREATE OR REPLACE FUNCTION public.effective_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
  SELECT pr.role FROM app.platform_roles pr
  WHERE pr.user_id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute (may be needed after replacement)
REVOKE EXECUTE ON FUNCTION public.effective_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.effective_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.effective_user_role() TO authenticated;

-- ============================================================
-- SECTION 2: Create declared_role() — metadata-only (context/UI)
-- ============================================================

CREATE OR REPLACE FUNCTION public.declared_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
  SELECT u.raw_user_meta_data->>'role'
  FROM auth.users u
  WHERE u.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.declared_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.declared_role() TO authenticated;

-- ============================================================
-- SECTION 3: Helper — has_transporter_ownership()
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_transporter_ownership(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = p_user_id
      AND au.raw_user_meta_data->>'role' = 'TRANSPORTER'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_transporter_ownership(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_transporter_ownership(UUID) TO authenticated;