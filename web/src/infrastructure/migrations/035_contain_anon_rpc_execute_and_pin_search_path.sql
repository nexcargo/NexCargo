-- NexCargo Migration 035 — F-01 containment continuation: remove anon/PUBLIC EXECUTE from two
-- SECURITY DEFINER RPCs and pin their search_path
-- Status: DRAFT — AWAITING LEAD ARCHITECT APPROVAL (SB-3 Stage A). NOT APPLIED to the live project.
-- Authorised to be authored by the Lead Architect directive "NexCargo — SB-3 Stage A: Design & Implementation Preparation", instruction 6.
-- Containment direction established by SB-1A (migration 033) under F-01; this file extends that same direction to
-- the two remaining anon-executable SECURITY DEFINER functions in schema public. No privilege or data change was
-- executed against the live project while authoring this file.
--
-- BEFORE-STATE (live catalog, measured 2026-11-05, read-only):
--   public.atomic_tracking_status_update(uuid, varchar, varchar, uuid)
--     prosecdef = true, owner = postgres (rolbypassrls = true), proconfig = NULL (NO search_path pin)
--     proacl = {=X/postgres, postgres=X, anon=X, authenticated=X, service_role=X}
--   public.has_transporter_ownership(uuid)
--     prosecdef = true, owner = postgres, proconfig = NULL (NO search_path pin)
--     proacl includes an explicit anon EXECUTE grant
--
-- WHY THESE TWO AND NOT OTHERS:
--   Of the ten SECURITY DEFINER functions in public, these are the only ones that are anon-executable AND have no
--   search_path pin. Every sibling already pins its path, which is the pattern this file completes:
--     accept_and_finalize_contract / activate_contract_with_escrow / atomic_tracking_complete /
--     confirm_booking_with_contract  -> SET search_path = pg_catalog, public
--     effective_user_role / declared_role -> SET search_path = pg_temp
--     rls_auto_enable -> SET search_path = pg_catalog
--   A SECURITY DEFINER function owned by a role with rolbypassrls executes its body with the caller's search_path
--   when none is pinned, so unqualified resolution inside the body is caller-influenced.
--
-- DEPENDENCY CHECKS PERFORMED (live, read-only):
--   pg_policy references to atomic_tracking_status_update: 0
--   pg_policy references to has_transporter_ownership:     0
--   -> neither function is invoked from inside any RLS policy expression, so revoking EXECUTE cannot break a policy.
--      (For contrast, public.effective_user_role() is referenced by 20 policies and logistics_schema.transporterscope()
--      by 20; this file deliberately does NOT change their privileges.)
--   Callers retained: public.atomic_tracking_status_update is called by an authenticated user session at
--     web/src/modules/mod-003-tracking/application/services/tracking-orchestrator-service.ts:89
--     -> EXECUTE is retained for authenticated. Only PUBLIC and anon are revoked.
--   Callers absent: has_transporter_ownership and declared_role have zero references in web/src outside migration
--     016, so no application path breaks. (033:6 uses the same "zero invocation sites" argument.)
--   Anon cannot currently reach either function's write path anyway: the body of atomic_tracking_status_update
--     raises 'UNAUTHORIZED: no authenticated user session' when auth.uid() IS NULL, and has_transporter_ownership
--     reads auth.users metadata for auth.uid(). The revocation moves the barrier from function body to ACL, which is
--     the least-privilege requirement in ESS-006 §2.2 and removes reliance on an in-body check.
--
-- NOT IN SCOPE (deliberately, pending Lead Architect decisions recorded in the SB-3 Stage A package):
--   public.declared_role() is also anon-executable and reads user_metadata role, which HAO-RRL-002 rejects as an
--   authorization source; its disposition (revoke, or drop) is decision D-6 and is NOT taken in this file.
--   public.rls_auto_enable() is anon-executable but inert; disposition is decision D-5.

REVOKE EXECUTE
ON FUNCTION public.atomic_tracking_status_update(uuid, character varying, character varying, uuid)
FROM PUBLIC, anon;

ALTER FUNCTION public.atomic_tracking_status_update(uuid, character varying, character varying, uuid)
  SET search_path = pg_catalog, public;

REVOKE EXECUTE
ON FUNCTION public.has_transporter_ownership(uuid)
FROM PUBLIC, anon;

ALTER FUNCTION public.has_transporter_ownership(uuid)
  SET search_path = pg_catalog, public;
