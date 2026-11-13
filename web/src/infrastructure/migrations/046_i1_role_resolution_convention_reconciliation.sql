-- NexCargo Migration 046 — I-2 Part C Item 1: Role-Resolution Convention Reconciliation
-- Authorized by QODER EXECUTION DIRECTIVE "NEXCARGO — I-2 ARCHITECTURAL ADJUDICATION AND EXECUTION
-- DIRECTIVE" (Lead Architect, 6 Nov 2026), PART C item 1 ("RLS policy remediation and role-resolution
-- consistency") and PART A ("preserve app.marketplace_memberships, app.platform_roles (governance only),
-- effective_marketplace_role(), effective_user_role()").
-- Depends on: 002 and 030 (the five policies removed here), 010/016/040 (the resolvers this file standardises
--             on, and 010's already-completed drops of the other fifteen auth.jwt() policies),
--             042 (declared_role() dropped, atomic_tracking_status_update pinned),
--             043/044 (delegation), 045 (the RPC body this file re-issues, and the "I2 ..." policy set whose
--             governance legs are deliberately left in the 017 convention — see DELIBERATELY NOT CHANGED).
--
-- FINDINGS THIS CLOSES
--   F-I2-02 (role-resolution conventions) — two of its three conventions are already correct live; this file
--     removes the third (auth.jwt()->>'role') from the authoritative policy set and makes the RPC resolve
--     through the same resolvers the policies use.
--   F-I2-07 (7 RLS-enabled tables with no policies) — per-table adjudication recorded below; one policy added
--     because one clause demands it, six closures written down as the answer.
--   F-I2-16 (NEW, measured in this tranche) — the governance "full access" legs on marketplace listings,
--     offers, matches and quotes have NEVER fired for any user, and the platform_fee_config leg sits on a
--     table that is not live at all. See PRE-CHANGE STATE.
--
-- PRE-CHANGE STATE (all of it measured in this tranche, none of it assumed):
--   * MEASURED, decisive: for both confirmed fixture sessions the access token payload carries
--     role = "authenticated" (the Postgres role claim), and nested app_metadata = {provider, providers},
--     user_metadata = {email, email_verified, phone_verified, sub}. Neither metadata bag contains a role.
--     auth.jwt()->>'role' therefore evaluates to 'authenticated' for every real caller, and a policy that
--     tests it against 'admin' / 'moderator' / 'super_admin' / 'SUPER_ADMIN' is a constant FALSE: it admits
--     nobody, including the roles it was written to admit. That makes the twenty auth.jwt() policies an
--     availability defect and a convention violation, NOT a privilege-escalation path — which is exactly why
--     removing them cannot reduce anyone's access.
--   * REPOSITORY CENSUS over all 38 migration files (whole-file parse, comments stripped, balanced-paren
--     statement ends): 223 CREATE POLICY blocks, 99 DROP POLICY statements. By role-resolution convention:
--     20 blocks test auth.jwt() (F-I2-16 candidates), 0 blocks read raw_user_meta_data or user_metadata,
--     119 blocks test app.platform_roles directly. The metadata convention is therefore ALREADY satisfied
--     live: 042 dropped public.declared_role() outright, and 016 superseded 010's metadata COALESCE fallback
--     in effective_user_role().
--   * LIVE SUBSET of the 20: 010 drops fifteen of them by name (Admin full access to bookings, contracts_admin,
--     escrow_admin, payment_intent_admin, settlement_request_admin, financial_ledger_admin, notification_admin,
--     template_admin, delivery_event_admin, alerts_admin, incidents_admin, log_entries_admin, metrics_admin,
--     traces_admin, health_checks_admin), and F-I2-13 established 010 is an applied tracked row. Four names are
--     dropped by no file: the 002 marketplace FOR ALL legs on listings, offers, matches and quotes.
--   * MEASURED BY FAILURE, first attempt at this file: the server refused the literal
--     DROP POLICY ... ON financial_schema.platform_fee_config with 42P01 "relation ... does not exist". So that
--     table is NOT live, and 030_c4_financial_execution.sql (its only creator, at :72) is NOT an applied file —
--     030's platform_fee_config_super_admin policy therefore cannot be a live residue and 030's fee-config
--     seeding at :88/:98 and its fee RPC at :411 are not live either. That is a live fact this increment did
--     not previously hold, and it changes the F-I2-16 residue from five policies to four. Nothing about the
--     rest of 030's contents is established beyond this table.
--     Live policy names are still INACCESSIBLE as an audit read (PART D forbids owner-class inspection), so
--     Section A is written as a catalog-driven loop rather than twenty guesses: it drops exactly the live
--     policies whose names appear in the repository census, on whatever table the live database actually has
--     them on, and therefore also catches any name@table pairing this census could not predict. A name no
--     repository file records cannot be dropped by anyone.
--   * Advisor 2026-11-06T13:41:17.350Z (this tranche's before-state): rls_enabled_no_policy 7
--     (ai_schema.recommendations, analytics_schema.event_store, compliance_schema.audit_logs,
--     localization_schema.user_preferences, logistics_schema.gps_telemetry, logistics_schema.shipments,
--     platform_infrastructure_schema.api_keys); function_search_path_mutable 9 with atomic_tracking_status_update
--     still absent from it (042's pin survives 045's reissue — this file must restate it);
--     authenticated_security_definer_function_executable 8; anon list 0.
--   * Resolver live definitions used as the standard here: public.effective_user_role() (016:14, SECURITY
--     DEFINER, SET search_path = pg_temp, SELECT pr.role FROM app.platform_roles WHERE pr.user_id = auth.uid())
--     and public.effective_marketplace_role() (040:62, SECURITY DEFINER, SET search_path = pg_catalog, public,
--     SELECT mm.role FROM app.marketplace_memberships WHERE mm.user_id = auth.uid()). Both take zero arguments,
--     both were probed live in this tranche through /rest/v1/rpc with the two sessions and returned
--     effective_user_role = null / effective_marketplace_role = SHIPPER and TRANSPORTER respectively, i.e.
--     neither reads metadata and neither is anon-reachable.
--
-- DENY-ALL ADJUDICATION (PART C item 1: "per-table adjudication of the deny-all set against its owning
--   module's specification, with 'stays closed' written down where that is the answer"). All seven tables are
--   created in 001_initial.sql and no file in the directory ever wrote a policy, an ENABLE RLS or a GRANT for
--   any of them; RLS came from the platform helper public.rls_auto_enable(), which is referenced only as
--   pre-existing (035:23, 042:31) and never defined in the repository. ESS-006:195 ("No table is accessible
--   unless explicitly allowed by RLS policy") makes zero-policy the COMPLIANT default, so six closures are the
--   answer, not a defect:
--     ai_schema.recommendations              STAYS CLOSED — ESS-009:509 assigns MOD-006 ownership, not access.
--                                            ESS-006:243 and MOD-007:569,629 describe AI output as advisory
--                                            only; no clause grants a role read or write on this table.
--     analytics_schema.event_store           STAYS CLOSED — PROMPT 2:278 mandates an append-only event store
--                                            and ESS-009:152 makes it the truth of state changes; both are
--                                            write-side through the service layer, and no clause grants an
--                                            authenticated read.
--     localization_schema.user_preferences   STAYS CLOSED, AMBIGUITY RECORDED — ESS-006:351/359 treat the
--                                            language preference as PII that must not reach the frontend
--                                            without an explicit policy, and :367 says it is "stored in user
--                                            profile with RLS protection", i.e. the spec routes it to the
--                                            profile, not to this table. Ownership is itself contested
--                                            (ESS-009:510 MOD-007 versus :519 MOD-016) and 001:288 carries no
--                                            module tag. Adding a policy here would choose a schema the
--                                            corpus has not chosen — the resolution belongs to the owning
--                                            module's spec, not to a security increment.
--     logistics_schema.gps_telemetry         STAYS CLOSED — explicitly deprecated by
--                                            XXX_c7_001_tracking_phase1.sql:7-8 ("legacy migration-001 skeleton
--                                            tables ... these are deprecated scaffolding") and superseded by
--                                            logistics_schema.gps_location_updates, which 021/045 do scope.
--                                            No spec names this table.
--     logistics_schema.shipments             STAYS CLOSED, same deprecation. ESS-006 §4.3:209-217 sketches
--                                            "shipper_can_view_own_shipments", but §4.3 is captioned as an
--                                            EXAMPLE pattern, its shipper_id column does not exist on the
--                                            real table (001:136-156), and PROMPT 2:142 places shipments in
--                                            marketplace_schema. It is illustrative syntax, not a mandate on
--                                            this object.
--     platform_infrastructure_schema.api_keys STAYS CLOSED — no governing clause names it; the only hits are
--                                            non-normative wave-0 readiness reports, and MOD-011:103 "API keys
--                                            (enterprise only)" is product scope, not an RLS grant.
--     compliance_schema.audit_logs           POLICY REQUIRED — ESS-006 §8:441 ("Audit logs MUST be:") closes
--                                            at :453 "RLS-protected (admin-only access)", corroborated by the
--                                            §4.5 RLS module mapping at :247 ("MOD-010 - Security policies,
--                                            audit logs (admin-only)"). A table with zero policies is
--                                            nobody-accessible, which cannot satisfy "admin-only": the clause
--                                            presupposes an admin read. Owner is MOD-010 (ESS-009:513).
--                                            ESS-006:407 (financial tables + audit triggers) is NOT the
--                                            citation for this — wrong scope, and it mandates triggers, not
--                                            reads. MOD-010:529,533,537 require immutability and completeness,
--                                            which is why the policy added below is SELECT-only.
--
-- WHAT THIS FILE DOES NOT DO, AND WHY THAT IS THE RIGHT ANSWER:
--   - It removes the live auth.jwt() policies without replacing them — in practice the four 002 marketplace
--     FOR ALL legs, since the fee-config table is not live. Re-issuing them as
--     effective_user_role()-based FOR ALL legs would hand governance roles table-wide write access to
--     marketplace listings/offers/matches/quotes — a privilege widening
--     that no clause in the corpus asks for, which PART D's "do not invent business rules" and the directive's
--     "Do not grant broad privileges merely to make existing operations work" both forbid. The live effect of
--     the removal is provably nil (the predicates were constant false); the ACCESS GAP they were meant to fill
--     is disclosed as F-I2-16 and remains for the LA to adjudicate: today those four objects are reachable
--     only through a service-role route, and that is a design question about governance tooling, not a
--     security defect this increment may answer by inventing an admin surface.
--   - It does not convert the 119 policies that test app.platform_roles directly. Those predicates read the
--     same table the resolver reads, by the same subject (auth.uid()), with no metadata in the path; routing
--     them through effective_user_role() is uniformity, not security, and re-issuing 119 live policies to get
--     it introduces a new failure mode (a resolver change silently moves 119 policies) in exchange for none.
--     045 re-issued its own governance legs in the same 017 convention for exactly that reason, byte-for-byte.
--     F-I2-02 is therefore reported PARTIAL: zero auth.jwt() and zero metadata references (the exit criterion
--     this file can actually meet), one convention documented as acceptable-by-equivalence for the LA to accept
--     or overrule.
--   - It adds no SHIPPER or DRIVER branch to the RPC. MOD-003 does not grant a Shipper operational status
--     authority, and DRIVER provisioning is outside I-2 by PART A; both classifications continue to fall to
--     the same refusal they hit before this file.
--
-- BEHAVIOUR CHANGE DISCLOSED (the one real change in this file, and the one an LA may want to veto):
--   atomic_tracking_status_update resolved v_role from app.platform_roles only, and 010:38's CHECK has never
--   allowed 'TRANSPORTER' in that table, so the TRANSPORTER branch that 024:62-70 designed — with correct
--   booking-ownership attribution — was UNREACHABLE for every caller. Any signed-in Transporter calling the
--   MOD-003 orchestrator (tracking-orchestrator-service.ts:87-93, a user-context createClient(), not
--   createAdminClient) fell through to the ELSE and got
--   "FORBIDDEN: role 'unassigned' is not authorized for tracking status updates".
--   After this file, v_role resolves through the two governance-backed resolvers, so a Transporter reaches the
--   designed branch, which admits them only when bookings.transporter_id = the caller and refuses otherwise.
--   Governance behaviour is unchanged (effective_user_role() is the same platform_roles lookup the old inline
--   SELECT performed). Marketplace classifications resolve to SHIPPER/TRANSPORTER; SHIPPER still refuses.
--   Repository evidence only for the live half: exercising it needs a real booking plus a tracking record for
--   a fixture Transporter, which would be a business write this increment is not authorized to make.
--
-- ROLLBACK (reverse order, each statement complete):
--   Section C: re-issue 045's Section F body verbatim (that file's lines are byte-identical to this one's apart
--     from the v_role resolution, the COMMENT and this header, so reverting Section C alone restores 045).
--   Section B: DROP POLICY IF EXISTS "I1 governance reads audit logs" ON compliance_schema.audit_logs;
--   Section A: re-issue the dropped policies verbatim from their create sites — 002_rls_policies.sql:11-15
--     (listings), :37-41 (offers), :55-59 (matches), :72-76 (quotes), each
--     USING/WITH CHECK (auth.jwt()->>'role' = 'admin' OR ... 'super_admin' OR ... 'moderator') and FOR ALL,
--     and only for those the applied NOTICE list above actually reports as dropped. The 030 fee-config leg is
--     not restorable here and never needed to be: its table does not exist live, so there is nothing to
--     restore until 030 itself is applied.
--     Because every one of them evaluated to constant false, rollback restores the defect exactly and changes
--     no access for anybody; it is a revert, not an alternative state.

-- ============================================================
-- SECTION A: remove the auth.jwt() role-resolution convention from the policy set
-- ============================================================
-- The set is the twenty names the repository census recorded, resolved against pg_policies so that only what
-- is actually live gets dropped, on whichever table the live database attaches it to. Dropping a predicate
-- that cannot be true for any caller is access-neutral by construction; the measured token payloads above are
-- the evidence for that claim. Each drop is announced so the applied output itself records which of the
-- twenty were still present.

DO $i1conv$
DECLARE
  v_rec RECORD;
  v_n   INT := 0;
BEGIN
  FOR v_rec IN
    SELECT p.schemaname, p.tablename, p.policyname
      FROM pg_policies p
     WHERE p.policyname IN (
        'Admin super-admin moderator full access to listings',
        'Admin super-admin moderator full access to offers',
        'Admin super-admin moderator full access to matches',
        'Admin super-admin moderator full access to quotes',
        'platform_fee_config_super_admin',
        'Admin full access to bookings',
        'contracts_admin',
        'escrow_admin',
        'payment_intent_admin',
        'settlement_request_admin',
        'financial_ledger_admin',
        'notification_admin',
        'template_admin',
        'delivery_event_admin',
        'alerts_admin',
        'incidents_admin',
        'log_entries_admin',
        'metrics_admin',
        'traces_admin',
        'health_checks_admin')
     ORDER BY p.schemaname, p.tablename, p.policyname
  LOOP
    RAISE NOTICE 'I-2 ITEM 1 dropping auth.jwt() policy % on %.%',
      v_rec.policyname, v_rec.schemaname, v_rec.tablename;
    EXECUTE format('DROP POLICY %I ON %I.%I', v_rec.policyname, v_rec.schemaname, v_rec.tablename);
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE 'I-2 ITEM 1 auth.jwt() convention: % live policies dropped', v_n;
END
$i1conv$;

-- ============================================================
-- SECTION B: compliance_schema.audit_logs — the one deny-all table a clause governs
-- ============================================================
-- ESS-006:453 requires audit logs to be "RLS-protected (admin-only access)". Read-only, governance-tier only:
-- the resolver keeps ADMIN and SUPER_ADMIN, and MODERATOR is excluded because the clause says admin-only and
-- the §4.5 mapping names MOD-010's admin tiers, not the moderation tier. No INSERT, UPDATE or DELETE policy is
-- added: MOD-010:529,533,537 require the trail to be immutable and complete, and the writers are the service
-- layer and the audit triggers, which hold a role that bypasses RLS rather than authenticated.

CREATE POLICY "I1 governance reads audit logs"
  ON compliance_schema.audit_logs FOR SELECT
  TO authenticated
  USING (public.effective_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

COMMENT ON POLICY "I1 governance reads audit logs" ON compliance_schema.audit_logs IS
  'I-2 PART C item 1 / ESS-006:453 "RLS-protected (admin-only access)" and :247. Governance read only; writes '
  'stay on the service layer so MOD-010 immutability is not weakened by an authenticated INSERT policy.';

-- ============================================================
-- SECTION C: atomic_tracking_status_update — one resolver convention inside the RPC
-- ============================================================
-- The 045 body is re-issued verbatim except for the v_role resolution, the COMMENT and this header. The pin is
-- restated because CREATE OR REPLACE silently drops a SET clause that is not repeated (the 023->024 precedent;
-- 042 pinned this function and 045 restated it). The dispatcher branch, the state machine and the write block
-- are untouched, and the ADMIN/SUPER_ADMIN, MODERATOR and TRANSPORTER branches keep their exact tests — only
-- the classification the branches are keyed on is now resolved the way the policies resolve it.

CREATE OR REPLACE FUNCTION public.atomic_tracking_status_update(
    p_tracking_id UUID,
    p_target_status VARCHAR(20),
    p_source_module VARCHAR(20) DEFAULT 'MOD-003',
    p_caller_user_id UUID DEFAULT NULL::uuid
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_caller            UUID;
    v_record            logistics_schema.shipment_tracking_records%ROWTYPE;
    v_current_state     VARCHAR(20);
    v_role              TEXT;
    v_key               TEXT;
BEGIN
    -- Derive identity from auth context
    v_caller := auth.uid();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: no authenticated user session';
    END IF;

    -- Validate caller-supplied ID matches auth context
    IF p_caller_user_id IS NOT NULL AND p_caller_user_id <> v_caller THEN
        RAISE EXCEPTION 'FORBIDDEN: caller identity mismatch';
    END IF;

    -- Pre-enforcement guard: target must be known status string
    IF p_target_status NOT IN ('CREATED','BOOKED','AWAITING_PICKUP','PICKUP_ACKNOWLEDGED',
                                'IN_TRANSIT','AT_BORDER','DELIVERED','COMPLETED','CANCELLED','DELAYED') THEN
        RAISE EXCEPTION 'INVALID_STATUS: % is not a valid tracking status', p_target_status;
    END IF;

    -- Read current tracking record
    SELECT * INTO v_record
    FROM logistics_schema.shipment_tracking_records
    WHERE id = p_tracking_id AND is_deleted = FALSE;
    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'TRACKING_RECORD_NOT_FOUND: tracking % not found or deleted', p_tracking_id;
    END IF;
    v_current_state := v_record.status;

    -- I-2 ITEM 1: one role-resolution convention, the same one the policies use. Governance comes from
    -- app.platform_roles through effective_user_role(); marketplace classifications come from
    -- app.marketplace_memberships through effective_marketplace_role(). Both are zero-argument, pinned
    -- SECURITY DEFINER resolvers keyed on auth.uid(), so the subject is this session's JWT sub rather than a
    -- caller-supplied or metadata-supplied claim, and 024's booking-attribution TRANSPORTER branch is reachable.
    SELECT COALESCE(public.effective_user_role(), public.effective_marketplace_role()) INTO v_role;

    -- Validate role + scope based on role hierarchy
    IF v_role = 'ADMIN' OR v_role = 'SUPER_ADMIN' THEN
        NULL;
    ELSIF v_role = 'MODERATOR' THEN
        NULL;
    ELSIF v_role = 'DISPATCHER' OR logistics_schema.delegated_principal() IS NOT NULL THEN
        -- I-2 PART A: authority is the ACTIVE DELEGATION, not a platform_roles row. A legacy DISPATCHER row
        -- with no delegation reaches the inner test and is refused; a delegate with no platform_roles row at
        -- all is admitted on scope and row attribution alone.
        IF NOT (public.has_operational_scope('tracking_update')
                AND logistics_schema.delegated_shipment(p_tracking_id)) THEN
            RAISE EXCEPTION 'FORBIDDEN: tracking % is outside the caller''s delegated Transporter scope, or tracking_update was not delegated', p_tracking_id;
        END IF;
    ELSIF v_role = 'TRANSPORTER' THEN
        IF NOT EXISTS (
            SELECT 1 FROM logistics_schema.bookings b
            JOIN logistics_schema.shipment_tracking_records tr ON tr.booking_id = b.id
            WHERE tr.id = p_tracking_id AND b.transporter_id = v_caller AND b.is_deleted = FALSE
        ) THEN
            RAISE EXCEPTION 'FORBIDDEN: transporter cannot update another entity''s tracking';
        END IF;
    ELSE
        RAISE EXCEPTION 'FORBIDDEN: role ''%'' is not authorized for tracking status updates', COALESCE(v_role, 'unassigned');
    END IF;

    -- STATE MACHINE ENFORCEMENT (DEFECT-003 fix)
    -- Reproduces authoritative VALID_TRANSITIONS from tracking-state-machine.ts
    -- Defense-in-depth: prevents direct RPC abuse bypassing API applyTrackingTransition()
    v_key := v_current_state || '|' || p_target_status;
    IF NOT (
        (v_current_state = 'CREATED' AND p_target_status IN ('BOOKED','DELAYED'))
        OR (v_current_state = 'BOOKED' AND p_target_status IN ('AWAITING_PICKUP','CANCELLED','DELAYED'))
        OR (v_current_state = 'AWAITING_PICKUP' AND p_target_status IN ('PICKUP_ACKNOWLEDGED','CANCELLED','DELAYED'))
        OR (v_current_state = 'PICKUP_ACKNOWLEDGED' AND p_target_status IN ('IN_TRANSIT','CANCELLED','DELAYED'))
        OR (v_current_state = 'IN_TRANSIT' AND p_target_status IN ('AT_BORDER','DELIVERED','CANCELLED','DELAYED'))
        OR (v_current_state = 'AT_BORDER' AND p_target_status IN ('IN_TRANSIT','CANCELLED','DELAYED'))
        OR (v_current_state = 'DELAYED' AND p_target_status IN ('AWAITING_PICKUP','IN_TRANSIT','AT_BORDER','DELIVERED','CANCELLED'))
        OR (v_current_state = 'DELIVERED' AND p_target_status IN ('COMPLETED','CANCELLED'))
        OR (v_current_state IN ('COMPLETED','CANCELLED') AND p_target_status = v_current_state)
    ) THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: % -> % is not permitted per MOD-003', v_current_state, p_target_status;
    END IF;

    -- Terminal state guard (redundant safety)
    IF v_current_state IN ('COMPLETED', 'CANCELLED') AND v_current_state <> p_target_status THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: % is terminal, no outgoing transitions', v_current_state;
    END IF;

    -- Atomic UPDATE + INSERT within single DB transaction
    BEGIN
        UPDATE logistics_schema.shipment_tracking_records
        SET status = p_target_status, last_updated = NOW(), updated_at = NOW(), version = COALESCE(version, 1) + 1
        WHERE id = p_tracking_id AND is_deleted = FALSE;

        INSERT INTO logistics_schema.tracking_events (tracking_id, event_type, event_timestamp, source, state_from, state_to, metadata)
        VALUES (p_tracking_id, 'SHIPMENT_' || UPPER(p_target_status), NOW(), p_source_module, v_current_state, p_target_status, jsonb_build_object('caller_user_id', v_caller, 'previous_status', v_current_state));

    EXCEPTION WHEN OTHERS THEN RAISE;
    END;
END;
$$;

COMMENT ON FUNCTION public.atomic_tracking_status_update(UUID, VARCHAR, VARCHAR, UUID) IS
  'I-2 item 1: role resolved through effective_user_role() then effective_marketplace_role(), never through '
  'auth.jwt() or user_metadata, so the booking-attributed TRANSPORTER branch is reachable. Dispatcher branch '
  'authorized by app.operational_delegations (scope tracking_update) plus booking ownership (045). '
  'search_path pinned (042) and restated here.';

-- 042/045's privilege posture is restated explicitly rather than assumed to survive the reissue.
REVOKE EXECUTE ON FUNCTION public.atomic_tracking_status_update(UUID, VARCHAR, VARCHAR, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atomic_tracking_status_update(UUID, VARCHAR, VARCHAR, UUID) TO authenticated;
