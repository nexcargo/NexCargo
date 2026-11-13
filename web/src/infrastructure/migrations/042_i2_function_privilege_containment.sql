-- NexCargo Migration 042 — I-2 Function Privilege Containment (Stage B, tranche 1)
-- Authorized by QODER EXECUTION DIRECTIVE — NEXCARGO I-2 ARCHITECTURAL ADJUDICATION AND EXECUTION
--   DIRECTIVE (6 Nov 2026), Part C items 2 and 5, Part D database-change rules.
-- Depends on: 016_role_resolution_correction.sql (defines both dropped functions),
--             022/023/024 (define public.atomic_tracking_status_update)
-- Findings closed: F-I2-03 (metadata-era authorization helpers live), F-I2-11 partial
--   (anon-executable RLS helper; search_path pin lost by a later redefinition).
--
-- PRE-CHANGE STATE (live, measured through admissible non-owner paths at 2026-11-06T11:49:41Z):
--   security advisor "Public Can Execute SECURITY DEFINER Function" = 4 findings:
--     public.atomic_tracking_status_update(...), public.declared_role(),
--     public.has_transporter_ownership(uuid), public.rls_auto_enable()
--   security advisor "Function Search Path Mutable" includes public.atomic_tracking_status_update
--     and public.has_transporter_ownership.
--   Migration history (list_migrations) records 016 as "role_resolution_correction", 022 as
--     "atomic_tracking_status_update", 023 as "security_definer_harden_tracking_status" and
--     024 as "c7_final_corrective_defect003_dispatcher_scope" — all applied.
--
-- WHY EACH CHANGE:
--   (1) public.declared_role() returns auth.users.raw_user_meta_data->>'role'. Client-writable
--       metadata is not a role authority (PROMPT 0 v1.3; I-1 rule 4; role-authority.ts:2-3). It has
--       zero references in the repository outside 016 itself, and the advisor shows no policy
--       dependency, so removing it cannot break a path — and leaving an authority-shaped function
--       callable by anon is the defect.
--   (2) public.has_transporter_ownership(uuid) tests the same metadata for 'TRANSPORTER'. Same
--       zero-reference result. Marketplace ownership is app.marketplace_memberships (040) and
--       logistics ownership columns; this helper is the obsolete shape.
--   (3) 023 pinned search_path = 'pg_catalog','public'; 024 redefined the function with
--       CREATE OR REPLACE and NO SET clause, which drops the pin. Re-asserting the pin restores the
--       state 023 established and 024 was tested against — not a new behavior.
--   (4) rls_auto_enable() turns RLS on or off. No session role should be able to ask for that; the
--       repository contains no caller. EXECUTE is revoked from PUBLIC, anon and authenticated.
--
-- DELIBERATELY NOT CHANGED HERE:
--   public.effective_user_role(), public.effective_marketplace_role(),
--   public.record_marketplace_membership(), logistics_schema.transporterscope() and the other
--   policy-referenced helpers (their privileges are load-bearing; they are reviewed in tranche 2).
--   public.test_ef_test / app.test_ef_secure: their definitions exist in no repository migration,
--   so their signatures and bodies are not observable through an admissible path here. A REVOKE
--   needs an exact signature; this file does not guess one. Disposition is reported, not assumed.
--   No table, column, policy, trigger or data object is touched. No financial object is touched.
--
-- ROLLBACK (reverse statements; keep applied in this order):
--   -- restore the two helpers exactly as 016 defined them:
--   CREATE OR REPLACE FUNCTION public.declared_role() RETURNS TEXT LANGUAGE sql STABLE
--     SECURITY DEFINER SET search_path = pg_temp AS $$
--     SELECT u.raw_user_meta_data->>'role' FROM auth.users u WHERE u.id = auth.uid(); $$;
--   REVOKE EXECUTE ON FUNCTION public.declared_role() FROM PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.declared_role() TO authenticated;
--   CREATE OR REPLACE FUNCTION public.has_transporter_ownership(p_user_id UUID) RETURNS BOOLEAN
--     LANGUAGE sql STABLE SECURITY DEFINER AS $$
--     SELECT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p_user_id
--                    AND au.raw_user_meta_data->>'role' = 'TRANSPORTER'); $$;
--   REVOKE EXECUTE ON FUNCTION public.has_transporter_ownership(UUID) FROM PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.has_transporter_ownership(UUID) TO authenticated;
--   -- restore the pre-042 privileges:
--   GRANT EXECUTE ON FUNCTION public.atomic_tracking_status_update(uuid, varchar, varchar, uuid)
--     TO PUBLIC, anon, authenticated;
--   ALTER FUNCTION public.atomic_tracking_status_update(uuid, varchar, varchar, uuid)
--     RESET search_path;   -- returns it to the mutable state 024 left
--   GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated;

-- ============================================================
-- SECTION 1: remove the metadata-era authorization helpers
-- ============================================================
-- No CASCADE: if any live policy, view or index still depends on either function, Postgres refuses
-- and the whole transaction aborts. That refusal is the dependency check, not an accident.

DROP FUNCTION IF EXISTS public.declared_role();
DROP FUNCTION IF EXISTS public.has_transporter_ownership(UUID);

-- ============================================================
-- SECTION 2: atomic_tracking_status_update — contain and re-pin
-- ============================================================
-- authenticated keeps EXECUTE: it is the caller at
-- web/src/modules/mod-003-tracking/application/services/tracking-orchestrator-service.ts:89.

REVOKE EXECUTE
ON FUNCTION public.atomic_tracking_status_update(uuid, character varying, character varying, uuid)
FROM PUBLIC, anon;

ALTER FUNCTION public.atomic_tracking_status_update(uuid, character varying, character varying, uuid)
  SET search_path = pg_catalog, public;

-- ============================================================
-- SECTION 3: contain the RLS-management helper
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
