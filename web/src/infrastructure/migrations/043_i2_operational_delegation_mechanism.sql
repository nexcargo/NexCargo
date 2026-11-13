-- NexCargo Migration 043 — I-2 Operational Delegation Mechanism for DISPATCHER
-- Authorized by QODER EXECUTION DIRECTIVE "NEXCARGO — I-2 ARCHITECTURAL ADJUDICATION AND EXECUTION
-- DIRECTIVE" (Lead Architect, 6 Nov 2026), PART A (D-6 adjudication) and PART C items 1, 2, 5, 8.
-- Depends on: 010 (app.platform_roles), 015 (assigned_transporter_id + validator trigger),
--             016 (public.effective_user_role), 017 (logistics_schema.transporterscope),
--             040/041 (membership table, writer pattern), 042 (this increment's privilege containment).
--
-- Findings it closes: F-I2-05 (operational classification stored as a governance role) — the mechanism half.
-- Findings it deliberately does NOT close: F-I2-14 (dispatcher policies are not row-scoped) — that is 044,
--   kept separate so each migration has its own rollback. F-I2-06 (Driver invariant) is outside I-2 by PART A.
--
-- WHAT THE ADJUDICATION REQUIRES (PART A, verbatim obligations):
--   "associate each Dispatcher with an identifiable Transporter; represent explicit, bounded delegation;
--    support revocation; preserve an auditable record of delegation grants, changes and revocations;
--    enforce delegated scope through backend authorization and RLS; prevent delegation from granting
--    financial, administrative, driver-onboarding or unrelated organizational privileges."
--   and "Do not automatically migrate existing Dispatcher records without verifying their provenance,
--    associated Transporter and intended scope. Preserve existing data and report any ambiguous records."
--
-- PRE-CHANGE STATE (measured, not assumed) — 2026-11-06T12:04:37.990Z security advisor + list_migrations:
--   * function_search_path_mutable = 11, including logistics_schema.transporterscope and
--     app.validate_dispatcher_transporter_delegation (both touched here).
--   * anon_security_definer_function_executable = 0 (after 042).
--   * tracked history 28 rows; 23 map to repository files once the stripped numeric prefix is accounted
--     for; 010/017 have no tracked row but ARE live (app.platform_roles is depended on by applied 015/016/024,
--     and 035:31 records transporterscope() as referenced by 20 live policies). Live policy text and live
--     function bodies are INACCESSIBLE without owner-class access, which PART D forbids.
--   * app.platform_roles CHECK is the inline constraint auto-named platform_roles_role_check
--     (010:36-38) allowing DISPATCHER, MODERATOR, ADMIN, SUPER_ADMIN.
--   * Repository-wide write-site census for app.platform_roles: ZERO insert/update/upsert sites in any .sql
--     or .ts file. The only plausible origin of a live DISPATCHER row is the tracked, file-less migration
--     boot_hao_super_admin_and_dispatcher_test (20260914134704). Its contents and intended scope are
--     INACCESSIBLE, so NO record is migrated, rewritten or deleted by this file.
--
-- DELIBERATELY NOT CHANGED HERE:
--   - public.effective_user_role() and public.effective_marketplace_role() (PART A names them preserved).
--   - app.platform_roles rows: nothing is deleted, moved or rewritten, including any DISPATCHER row.
--   - assigned_transporter_id: the column and its index stay (dropping them would destroy data of
--     unverified provenance). They simply stop being an authority for anything.
--   - Any RLS policy. 044 owns the policy scope tightening.
--   - atomic_tracking_status_update body (042's pin and revocations remain in force).
--   - The 017/024 dispatcher policy text, which cannot be read live and is therefore not rewritten blind.
--
-- ROLLBACK (run in reverse order; reverses every object this file creates or alters):
--   ALTER TABLE app.platform_roles DROP CONSTRAINT IF EXISTS platform_roles_role_check;
--   ALTER TABLE app.platform_roles ADD CONSTRAINT platform_roles_role_check
--     CHECK (role IN ('DISPATCHER','MODERATOR','ADMIN','SUPER_ADMIN'));
--   DROP TRIGGER IF EXISTS trg_operational_delegation_audit ON app.operational_delegations;
--   DROP FUNCTION IF EXISTS app.audit_operational_delegation();
--   DROP FUNCTION IF EXISTS public.has_operational_scope(TEXT);
--   DROP FUNCTION IF EXISTS public.revoke_operational_delegation(UUID, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public.grant_operational_delegation(UUID, UUID, TEXT, UUID);
--   DROP FUNCTION IF EXISTS logistics_schema.transporterscope(UUID);
--   CREATE FUNCTION logistics_schema.transporterscope(p_user_id UUID) RETURNS UUID
--     LANGUAGE sql STABLE SECURITY DEFINER AS $$
--       SELECT au.id FROM auth.users au
--       JOIN app.platform_roles pr ON pr.user_id = au.id
--       WHERE pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND pr.user_id = p_user_id
--       LIMIT 1; $$;
--   (the above restores the 017 definition verbatim, including its unpinned search_path, which is what
--    was live before this file; REVOKE/GRANT from 017:40-41 would also need re-applying)
--   ALTER FUNCTION app.validate_dispatcher_transporter_delegation() RESET search_path;
--   DROP TABLE IF EXISTS app.operational_delegation_audit;
--   DROP TABLE IF EXISTS app.operational_delegations;
--   DROP SEQUENCE IF EXISTS app.operational_delegation_audit_seq;

-- ============================================================
-- SECTION 1: the delegation record
-- ============================================================
-- One row per (delegate, scope) grant. Revocation closes the row rather than deleting it, so the grant,
-- the change and the revocation all remain readable — PART A's "auditable record of delegation grants,
-- changes and revocations".

CREATE TABLE IF NOT EXISTS app.operational_delegations (
  delegation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  principal_transporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  scope TEXT NOT NULL,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  -- Bounded delegation: the allowlist is derived from what the live implementation already grants a
  -- dispatcher (017 SECTION C reads, 017 assignment manage policy, 024 tracking-update branch), and
  -- deliberately omits everything PART A forbids: no financial scope, no administrative scope, no
  -- driver-onboarding scope, no personnel-management scope. A new value requires a spec citation.
  CONSTRAINT operational_delegations_scope_allowed
    CHECK (scope IN ('operational_read', 'assignment_manage', 'tracking_update')),
  -- Explicit delegation: a dispatcher is never its own principal.
  CONSTRAINT operational_delegations_not_self
    CHECK (delegate_user_id <> principal_transporter_user_id),
  -- Revocation is a fact with an actor and a time, or it has not happened.
  CONSTRAINT operational_delegations_revocation_coherent
    CHECK ((revoked_at IS NULL AND revoked_by IS NULL)
        OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)),
  -- No self-revocation either, so the record reads as an action taken on the delegate, not by them.
  CONSTRAINT operational_delegations_revoker_is_not_delegate
    CHECK (revoked_by IS NULL OR revoked_by <> delegate_user_id)
);

-- Exactly one active grant per (delegate, scope); history rows stay visible after revocation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_operational_delegations_active
  ON app.operational_delegations(delegate_user_id, scope)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_operational_delegations_principal
  ON app.operational_delegations(principal_transporter_user_id);

COMMENT ON TABLE app.operational_delegations IS
  'I-2 PART A: the authoritative record that a Dispatcher operates for one identifiable Transporter, '
  'within a bounded scope, revocably. Not a platform role and not a marketplace membership. Existing '
  'app.platform_roles DISPATCHER rows were NOT migrated here (provenance unverified by design).';

-- ============================================================
-- SECTION 2: append-only audit of grants, changes and revocations
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS app.operational_delegation_audit_seq;

CREATE TABLE IF NOT EXISTS app.operational_delegation_audit (
  audit_seq BIGINT PRIMARY KEY DEFAULT nextval('app.operational_delegation_audit_seq'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL CHECK (action IN ('GRANT', 'CHANGE', 'REVOKE')),
  delegation_id UUID NOT NULL,
  delegate_user_id UUID NOT NULL,
  principal_transporter_user_id UUID NOT NULL,
  scope TEXT,
  old_scope TEXT,
  performed_by UUID NOT NULL,
  detail TEXT
);

ALTER SEQUENCE app.operational_delegation_audit_seq
  OWNED BY app.operational_delegation_audit.audit_seq;

COMMENT ON TABLE app.operational_delegation_audit IS
  'Append-only delegation audit trail required by PROMPT 0:1160 and I-2 PART A. No UPDATE, no DELETE '
  'privilege is granted to any role; the only writer is the trigger installed below.';

-- The trigger is the writer. Nothing else inserts here, which is what makes the trail trustworthy:
-- an application path cannot record a delegation without also recording its audit row.
CREATE OR REPLACE FUNCTION app.audit_operational_delegation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO app.operational_delegation_audit
      (action, delegation_id, delegate_user_id, principal_transporter_user_id, scope, performed_by, detail)
    VALUES ('GRANT', NEW.delegation_id, NEW.delegate_user_id, NEW.principal_transporter_user_id,
            NEW.scope, NEW.granted_by, 'granted ' || NEW.scope);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
      INSERT INTO app.operational_delegation_audit
        (action, delegation_id, delegate_user_id, principal_transporter_user_id, scope, performed_by, detail)
      VALUES ('REVOKE', NEW.delegation_id, NEW.delegate_user_id, NEW.principal_transporter_user_id,
              NEW.scope, NEW.revoked_by, COALESCE(NEW.revoke_reason, 'revoked'));
    ELSE
      INSERT INTO app.operational_delegation_audit
        (action, delegation_id, delegate_user_id, principal_transporter_user_id, scope, old_scope, performed_by, detail)
      VALUES ('CHANGE', NEW.delegation_id, NEW.delegate_user_id, NEW.principal_transporter_user_id,
              NEW.scope, OLD.scope, COALESCE(NEW.revoked_by, NEW.granted_by),
              'scope changed from ' || COALESCE(OLD.scope, 'none') || ' to ' || NEW.scope);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_operational_delegation_audit ON app.operational_delegations;
CREATE TRIGGER trg_operational_delegation_audit
  AFTER INSERT OR UPDATE ON app.operational_delegations
  FOR EACH ROW EXECUTE FUNCTION app.audit_operational_delegation();

-- ============================================================
-- SECTION 3: RLS on both new tables
-- ============================================================
-- Reads only: the delegate may see their own delegations, governance tiers may see all. No INSERT,
-- UPDATE or DELETE policy exists for any role — writes reach these tables exclusively through the
-- SECURITY DEFINER RPCs in Section 4, whose owner bypasses RLS. That is the PART A requirement that
-- delegation be enforced through RLS without leaving a client-writable surface.

ALTER TABLE app.operational_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.operational_delegation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY operational_delegations_delegate_reads_own
  ON app.operational_delegations FOR SELECT
  TO authenticated
  USING (delegate_user_id = auth.uid());

CREATE POLICY operational_delegations_governance_reads_all
  ON app.operational_delegations FOR SELECT
  TO authenticated
  USING (public.effective_user_role() IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'));

CREATE POLICY operational_delegation_audit_governance_reads_all
  ON app.operational_delegation_audit FOR SELECT
  TO authenticated
  USING (public.effective_user_role() IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'));

REVOKE ALL ON app.operational_delegations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON app.operational_delegations TO authenticated;
GRANT SELECT, INSERT ON app.operational_delegations TO service_role;

REVOKE ALL ON app.operational_delegation_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON app.operational_delegation_audit TO authenticated;
-- service_role gets SELECT only: even the trusted server path may not write the audit trail directly.
GRANT SELECT ON app.operational_delegation_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE app.operational_delegation_audit_seq TO service_role;

-- ============================================================
-- SECTION 4: the write path — one narrow RPC per act
-- ============================================================
-- Pattern copied from 041_i1_marketplace_membership_writer.sql: a public function is the one write path
-- whose reachability is known, service_role is the caller, and the session identity of the acting human
-- is an explicit argument that the backend has already authenticated. A session role can never write its
-- own delegation, exactly as a session role can never write its own marketplace membership.

CREATE OR REPLACE FUNCTION public.grant_operational_delegation(
  p_delegate_user_id UUID,
  p_principal_transporter_user_id UUID,
  p_scope TEXT,
  p_granted_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_delegate_user_id IS NULL OR p_principal_transporter_user_id IS NULL
     OR p_scope IS NULL OR p_granted_by IS NULL THEN
    RAISE EXCEPTION 'grant_operational_delegation requires delegate, principal, scope and granter';
  END IF;

  -- Restated so a bad call is refused here rather than surfacing as an opaque constraint violation.
  IF p_scope NOT IN ('operational_read', 'assignment_manage', 'tracking_update') THEN
    RAISE EXCEPTION 'operational delegation scope % is not an allowed scope', p_scope;
  END IF;

  -- The principal must hold TRANSPORTER membership in the authoritative table. This replaces the
  -- pre-I-1 habit of testing auth.users.raw_user_meta_data (015:48-57), which directive rule 4 and
  -- F-I2-03 remove as an authority source.
  IF NOT EXISTS (
    SELECT 1 FROM app.marketplace_memberships mm
    WHERE mm.user_id = p_principal_transporter_user_id AND mm.role = 'TRANSPORTER'
  ) THEN
    RAISE EXCEPTION 'delegation principal % is not a TRANSPORTER membership holder', p_principal_transporter_user_id;
  END IF;

  -- A governance tier must not receive operational delegation: it already has platform-wide reach, and
  -- mixing the two is the classification error F-I2-05 exists to remove.
  IF EXISTS (
    SELECT 1 FROM app.platform_roles pr
    WHERE pr.user_id = p_delegate_user_id AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  ) THEN
    RAISE EXCEPTION 'governance-tier user % cannot receive an operational delegation', p_delegate_user_id;
  END IF;

  INSERT INTO app.operational_delegations
    (delegate_user_id, principal_transporter_user_id, scope, granted_by)
  VALUES (p_delegate_user_id, p_principal_transporter_user_id, p_scope, p_granted_by)
  RETURNING delegation_id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_operational_delegation(
  p_delegation_id UUID,
  p_revoked_by UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_delegation_id IS NULL OR p_revoked_by IS NULL THEN
    RAISE EXCEPTION 'revoke_operational_delegation requires a delegation id and a revoker';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'revocation requires a recorded reason';
  END IF;

  -- Idempotent: an already-revoked delegation is left untouched rather than re-timestamped, so the
  -- audit trail keeps one REVOKE per real act.
  UPDATE app.operational_delegations
     SET revoked_at = now(), revoked_by = p_revoked_by, revoke_reason = p_reason
   WHERE delegation_id = p_delegation_id AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'delegation % not found or already revoked', p_delegation_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.grant_operational_delegation(UUID, UUID, TEXT, UUID) IS
  'I-2 PART A bounded, revocable Dispatcher delegation writer. service_role only; the acting human is '
  'passed as p_granted_by after the backend has authorized them.';
COMMENT ON FUNCTION public.revoke_operational_delegation(UUID, UUID, TEXT) IS
  'I-2 PART A revocation. service_role only; requires a reason; audited by trigger.';

REVOKE ALL ON FUNCTION public.grant_operational_delegation(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_operational_delegation(UUID, UUID, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.revoke_operational_delegation(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_operational_delegation(UUID, UUID, TEXT) TO service_role;

-- ============================================================
-- SECTION 5: re-point the existing scope authority at the new mechanism
-- ============================================================
-- logistics_schema.transporterscope() is live and referenced by about twenty policies (035:31 records the
-- count). Redefining it moves every one of those policies onto the delegation table WITHOUT rewriting a
-- policy file — the smallest change that satisfies "enforced through RLS", and the reason 044 can stay
-- focused on F-I2-14 alone.
--
-- The signature is preserved because the live callers pass an argument (policies call
-- transporterscope(auth.uid()); 024:61 calls transporterscope(v_caller), where v_caller was itself set
-- from auth.uid()). The function must keep its name and arity or twenty policies break.
--
-- Identity steering is closed: a caller who passes someone else's uuid now gets NULL instead of that
-- person's principal. It returns NULL rather than raising because this runs inside policy expressions,
-- where an exception would turn a deny into a 500.

CREATE OR REPLACE FUNCTION logistics_schema.transporterscope(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT od.principal_transporter_user_id
    FROM app.operational_delegations od
   WHERE od.delegate_user_id = p_user_id
     AND p_user_id = auth.uid()
     AND od.revoked_at IS NULL
   ORDER BY od.granted_at DESC
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION logistics_schema.transporterscope(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION logistics_schema.transporterscope(UUID) TO authenticated;

COMMENT ON FUNCTION logistics_schema.transporterscope(UUID) IS
  'I-2: resolves the delegating Transporter for the CALLING dispatcher from app.operational_delegations. '
  'Returns NULL for anyone who is not the caller and for revoked or absent delegations. No longer reads '
  'app.platform_roles, which PART A restricts to governance tiers.';

-- Per-scope test for the action-specific policies and the backend. Zero identity argument: it can only
-- ever answer about the caller, which is what makes it safe to expose to sessions.
CREATE OR REPLACE FUNCTION public.has_operational_scope(p_scope TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.operational_delegations od
     WHERE od.delegate_user_id = auth.uid()
       AND od.revoked_at IS NULL
       AND od.scope = p_scope
  );
$$;

REVOKE ALL ON FUNCTION public.has_operational_scope(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_operational_scope(TEXT) TO authenticated;

COMMENT ON FUNCTION public.has_operational_scope(TEXT) IS
  'Does the calling session hold this active operational scope? Keyed on auth.uid(); takes no identity argument.';

-- ============================================================
-- SECTION 6: platform_roles becomes governance-only going forward
-- ============================================================
-- NOT VALID is the whole point: it stops new DISPATCHER rows immediately while leaving any existing row
-- exactly as found, because PART A forbids migrating records whose provenance, principal and intended
-- scope cannot be verified. Those rows are inert now that transporterscope() no longer reads this table
-- and the API resolver (role-authority.ts) filters to governance tiers; restoring one requires an
-- explicit delegation grant through Section 4, which is the verification step PART A asks for.

ALTER TABLE app.platform_roles DROP CONSTRAINT IF EXISTS platform_roles_role_check;
ALTER TABLE app.platform_roles ADD CONSTRAINT platform_roles_role_check
  CHECK (role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')) NOT VALID;

COMMENT ON CONSTRAINT platform_roles_role_check ON app.platform_roles IS
  'I-2 PART A: app.platform_roles holds governance tiers only. DISPATCHER removed with NOT VALID so no '
  'existing row is altered or destroyed; new DISPATCHER rows are refused. See F-I2-15 for provenance.';

-- Pin the validator that is still attached to platform_roles (it was one of the 11 remaining mutable
-- search_path functions). Behaviour is unchanged; only its resolution is fixed. Its metadata test is
-- left intact on purpose — removing it would weaken the guard on a column this file does not own.
ALTER FUNCTION app.validate_dispatcher_transporter_delegation()
  SET search_path = pg_catalog, public;
