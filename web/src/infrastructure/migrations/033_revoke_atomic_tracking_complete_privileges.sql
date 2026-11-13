-- NexCargo Migration 033 — F-01 Critical Security Containment (privilege-only)
-- Authorised by LA directive "NexCargo — I-1 Execution: F-01 Critical Security Containment and Controlled Progression", package SB-1A.
-- Revokes EXECUTE on public.atomic_tracking_complete(UUID, UUID) from PUBLIC, anon and authenticated.
-- Privilege change only: function body, signature, owner and search_path are untouched and remain as authored in migration 022.
-- Provenance: the function is created solely by 022_atomic_tracking_status_update.sql; migrations 023 and 024 redefine only atomic_tracking_status_update().
-- Zero invocation sites exist in web/src, so no application path depends on this RPC and none is broken by the revocation.
-- Revoking FROM PUBLIC alone would NOT contain the exposure: the anon role holds a direct EXECUTE grant, and a direct grant survives a PUBLIC revoke.
-- Evidence: of migration 016's three sibling functions, only effective_user_role() also revokes FROM anon (016:28), and only it is absent from the live anon-executable set.
-- LIVE STATE: applied by the LA in the Supabase SQL Editor on 2026-11-04; verified via the platform security-advisor snapshot at 13:48:15Z, where
-- atomic_tracking_complete disappeared from both the anon (5 -> 4) and authenticated (9 -> 8) executable sets with every other lint entry unchanged.

REVOKE EXECUTE
ON FUNCTION public.atomic_tracking_complete(uuid, uuid)
FROM PUBLIC, anon, authenticated;
