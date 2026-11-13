-- ============================================================================
-- I-5 (TRANSPORTER DASHBOARD AND EXPERIENCE) - let the Transporter that owns the
-- booking submit proof of delivery for its own shipment.
--
-- FINDING (pre-existing; found by I-5)
--   logistics_schema.proof_of_delivery carries exactly one INSERT policy,
--   "Driver submits POD", whose entire WITH CHECK is:
--     EXISTS (SELECT 1 FROM app.platform_roles pr
--              WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER')
--   DRIVER is not a canonical role: I-1 removed it from the platform taxonomy and
--   PROMPT 0 v1.3 keeps the marketplace roles at SHIPPER and TRANSPORTER, with a
--   Driver being a MOD-014 asset record subordinate to a Transporter rather than
--   an account class. Measured live on 2026-11-12: app.platform_roles holds 2 rows
--   (1 DISPATCHER, 1 SUPER_ADMIN) and 0 rows of role DRIVER, so the predicate
--   admits nobody. The table holds 0 rows.
--   The application path is the session client: PodRepository.create() uses
--   createClient() (src/modules/mod-003-tracking/infrastructure/repositories/
--   pod-repository.ts), POST /api/tracking/[trackingId]/pod calls
--   PodSubmissionService.submitPOD() with no service-role client, and no SECURITY
--   DEFINER function exists that inserts into proof_of_delivery. Measured live:
--   the only pod/delivery/tracking functions are record_delivery_attempt,
--   atomic_tracking_complete and atomic_tracking_status_update, and none of them
--   writes proof_of_delivery. service_role does not even hold INSERT on the table.
--   So unlike tracking status - which atomic_tracking_status_update performs as
--   its owner and therefore outside RLS - POD submission has no path at all.
--
-- WHY THIS IS STRICTLY NECESSARY FOR I-5
--   LA DIRECTIVE - I-5, Sec.3H lists "Proof of pickup and proof of delivery" among
--   the operational capabilities to deliver where existing services support them,
--   and Sec.10 criterion 13 requires authorized delivery operations. The service,
--   route, repository and table all exist; only this one predicate is dead. Sec.4
--   states "Do not weaken RLS or security controls to make the UI work. Correct
--   genuine I-5 blockers using the least disruptive governed solution." and Sec.7
--   grants "Necessary database inspection and I-5 database work within the
--   boundaries above". No migration 030, no financial object, no escrow, settlement
--   or payment-authorisation object is touched, and no privilege is granted or
--   revoked: authenticated already holds INSERT and anon already does not.
--
-- WHY THIS IS NOT A WEAKENING
--   The replacement is narrower than a role-only test, not wider. It requires all
--   of: the caller's marketplace membership resolves to TRANSPORTER through
--   public.effective_marketplace_role() (the I-1 database resolver over
--   app.marketplace_memberships - never user_metadata and never a client-supplied
--   header); and a shipment_tracking_records row exists whose id is the submitted
--   tracking_id AND whose booking_id is the submitted booking_id; and that booking
--   names auth.uid() as its transporter. Binding both identifiers through the join
--   is what stops a Transporter from attaching evidence to another Transporter's
--   shipment, or from pairing its own tracking id with somebody else's booking id.
--   Both parent rows must be undeleted. Command (INSERT), permissive mode and
--   target roles (PUBLIC, as before) are preserved; the SELECT and UPDATE policies
--   are left exactly as they are, so verification remains a platform-governance
--   action and a Transporter still cannot verify its own POD. No new role, no
--   tenant_id, no company_id and no new ownership model is introduced.
--
-- BEFORE-STATE (measured live, 2026-11-12)
--   3 policies on proof_of_delivery, all PERMISSIVE:
--     Driver submits POD                        INSERT  (replaced)
--     I2 read POD via parent record             SELECT  roles {authenticated} (unchanged)
--     Moderator/Admin/SuperAdmin verifies POD   UPDATE  (unchanged)
--   relrowsecurity = true, relforcerowsecurity = false, owner postgres.
--   Privileges: authenticated INSERT/SELECT true, anon INSERT false,
--   service_role INSERT false. 0 self-referencing policies platform-wide.
--
-- ROLLBACK (exact inverse; restores the dead DRIVER predicate verbatim)
--   DROP POLICY IF EXISTS "Transporter submits POD for own booking" ON logistics_schema.proof_of_delivery;
--   CREATE POLICY "Driver submits POD"
--     ON logistics_schema.proof_of_delivery FOR INSERT
--     WITH CHECK (
--       EXISTS (SELECT 1 FROM app.platform_roles pr
--                WHERE pr.user_id = auth.uid() AND pr.role = 'DRIVER')
--     );
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A - before-state guard. This file must see the dead DRIVER predicate it
-- replaces, the two policies it must leave alone, and the resolver it depends on.
-- ----------------------------------------------------------------------------
DO $i5_pod_pre$
DECLARE
  v_total   INT;
  v_insert  RECORD;
BEGIN
  SELECT count(*) INTO v_total
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass;

  IF v_total <> 3 THEN
    RAISE EXCEPTION 'I-5 POD PRE: proof_of_delivery carries [%] policies, not the 3 measured before this change', v_total;
  END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polwithcheck, p.polrelid) AS expr
    INTO v_insert
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
     AND p.polname = 'Driver submits POD';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'I-5 POD PRE: the "Driver submits POD" INSERT policy is absent, so the finding this file corrects no longer holds';
  END IF;
  IF v_insert.polcmd <> 'a' THEN
    RAISE EXCEPTION 'I-5 POD PRE: "Driver submits POD" is not an INSERT policy';
  END IF;
  IF v_insert.expr IS NULL OR strpos(v_insert.expr, 'app.platform_roles') = 0 OR strpos(v_insert.expr, 'DRIVER') = 0 THEN
    RAISE EXCEPTION 'I-5 POD PRE: "Driver submits POD" no longer carries the platform_roles DRIVER predicate';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_insert.polroles) u JOIN pg_roles g ON g.oid = u) THEN
    RAISE EXCEPTION 'I-5 POD PRE: "Driver submits POD" is scoped to a named role, not the PUBLIC scope measured before this change';
  END IF;

  -- The predicate is dead only because no DRIVER row exists. If that ever changes,
  -- this file must be re-assessed rather than applied blind.
  IF (SELECT count(*) FROM app.platform_roles WHERE role = 'DRIVER') <> 0 THEN
    RAISE EXCEPTION 'I-5 POD PRE: app.platform_roles now holds DRIVER rows, so the predicate is not dead and this correction is not justified';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
                    AND p.polname = 'I2 read POD via parent record' AND p.polcmd = 'r')
     OR NOT EXISTS (SELECT 1 FROM pg_policy p
                     WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
                       AND p.polname = 'Moderator/Admin/SuperAdmin verifies POD' AND p.polcmd = 'w') THEN
    RAISE EXCEPTION 'I-5 POD PRE: the SELECT or UPDATE policy this file must leave untouched is missing';
  END IF;

  -- The resolver the replacement depends on must exist and must be SECURITY
  -- DEFINER, because app is deliberately not exposed to PostgREST.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'effective_marketplace_role'
                    AND p.pronargs = 0 AND p.prosecdef) THEN
    RAISE EXCEPTION 'I-5 POD PRE: public.effective_marketplace_role() is absent or is not SECURITY DEFINER';
  END IF;

  IF NOT has_table_privilege('authenticated', 'logistics_schema.proof_of_delivery', 'INSERT') THEN
    RAISE EXCEPTION 'I-5 POD PRE: authenticated lacks INSERT, so a policy change alone would not open the path';
  END IF;
  IF has_table_privilege('anon', 'logistics_schema.proof_of_delivery', 'INSERT') THEN
    RAISE EXCEPTION 'I-5 POD PRE: anon holds INSERT on proof_of_delivery, which contradicts the measured before-state';
  END IF;
END
$i5_pod_pre$;

-- ----------------------------------------------------------------------------
-- SECTION B - replace the one dead INSERT predicate. The policy is renamed because
-- the actor it admits is no longer a Driver: keeping the old name would describe a
-- boundary that does not exist. The other two policies are not touched.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Driver submits POD" ON logistics_schema.proof_of_delivery;

CREATE POLICY "Transporter submits POD for own booking"
  ON logistics_schema.proof_of_delivery FOR INSERT
  WITH CHECK (
    public.effective_marketplace_role() = 'TRANSPORTER'
    AND EXISTS (
      SELECT 1
        FROM logistics_schema.shipment_tracking_records tr
        JOIN logistics_schema.bookings b ON b.id = tr.booking_id
       WHERE tr.id = proof_of_delivery.tracking_id
         AND b.id = proof_of_delivery.booking_id
         AND b.transporter_id = auth.uid()
         AND b.is_deleted = FALSE
         AND tr.is_deleted = FALSE
    )
  );

-- ----------------------------------------------------------------------------
-- SECTION C - post-change assertion: the inventory is still 3 policies, the two
-- untouched ones are intact, the replacement binds both parent identifiers to the
-- caller's own booking, no self-reference was introduced anywhere, and no privilege
-- or RLS setting moved.
-- ----------------------------------------------------------------------------
DO $i5_pod_post$
DECLARE
  v_total INT;
  v_new   RECORD;
  v_expr  TEXT;
BEGIN
  SELECT count(*) INTO v_total
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass;

  IF v_total <> 3 THEN
    RAISE EXCEPTION 'I-5 POD POST: proof_of_delivery now carries [%] policies instead of 3', v_total;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policy p
              WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
                AND p.polname = 'Driver submits POD') THEN
    RAISE EXCEPTION 'I-5 POD POST: the replaced DRIVER policy is still present';
  END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polwithcheck, p.polrelid) AS expr,
         pg_get_expr(p.polqual, p.polrelid) AS qual
    INTO v_new
    FROM pg_policy p
   WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
     AND p.polname = 'Transporter submits POD for own booking';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'I-5 POD POST: the replacement policy was not created';
  END IF;
  IF v_new.polcmd <> 'a' OR v_new.qual IS NOT NULL THEN
    RAISE EXCEPTION 'I-5 POD POST: the replacement is not an INSERT-only policy';
  END IF;
  IF NOT v_new.polpermissive THEN
    RAISE EXCEPTION 'I-5 POD POST: the replacement is restrictive, which would change how the other policies combine';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_new.polroles) u JOIN pg_roles g ON g.oid = u) THEN
    RAISE EXCEPTION 'I-5 POD POST: the replacement is scoped to a named role instead of the PUBLIC scope the original had';
  END IF;

  v_expr := v_new.expr;
  IF v_expr IS NULL
     OR strpos(v_expr, 'effective_marketplace_role()') = 0
     OR strpos(v_expr, 'TRANSPORTER') = 0
     OR strpos(v_expr, 'shipment_tracking_records') = 0
     OR strpos(v_expr, 'bookings') = 0
     OR strpos(v_expr, 'transporter_id = auth.uid()') = 0
     OR strpos(v_expr, 'proof_of_delivery.tracking_id') = 0
     OR strpos(v_expr, 'proof_of_delivery.booking_id') = 0 THEN
    RAISE EXCEPTION 'I-5 POD POST: the replacement does not bind the membership, both parent identifiers and the transporter party test';
  END IF;
  IF strpos(v_expr, 'platform_roles') > 0 THEN
    RAISE EXCEPTION 'I-5 POD POST: the replacement still depends on app.platform_roles, which is the dead predicate this file removes';
  END IF;

  -- The two policies that must not move: verification stays a governance action and
  -- the read boundary stays the parent-record test.
  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
                    AND p.polname = 'Moderator/Admin/SuperAdmin verifies POD'
                    AND p.polcmd = 'w'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%platform_roles%') THEN
    RAISE EXCEPTION 'I-5 POD POST: the verification policy changed, so a Transporter may have gained the ability to verify its own POD';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'logistics_schema.proof_of_delivery'::regclass
                    AND p.polname = 'I2 read POD via parent record'
                    AND p.polcmd = 'r'
                    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%transporter_id = auth.uid()%') THEN
    RAISE EXCEPTION 'I-5 POD POST: the POD read policy changed';
  END IF;

  -- No policy anywhere may name its own relation in a subquery: that is the
  -- recursion 062 removed, and this file must not reintroduce it on a new table.
  IF (SELECT count(*)
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'FROM ' || n.nspname || '.' || c.relname) > 0
          OR strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'JOIN ' || n.nspname || '.' || c.relname) > 0) <> 0 THEN
    RAISE EXCEPTION 'I-5 POD POST: a self-referencing policy exists somewhere in the catalog';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'logistics_schema.proof_of_delivery'::regclass) THEN
    RAISE EXCEPTION 'I-5 POD POST: row level security is no longer enabled on proof_of_delivery';
  END IF;
  IF (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'logistics_schema.proof_of_delivery'::regclass) THEN
    RAISE EXCEPTION 'I-5 POD POST: relforcerowsecurity changed, which would alter the owner''s own exposure';
  END IF;

  IF NOT has_table_privilege('authenticated', 'logistics_schema.proof_of_delivery', 'INSERT')
     OR has_table_privilege('anon', 'logistics_schema.proof_of_delivery', 'INSERT')
     OR has_table_privilege('service_role', 'logistics_schema.proof_of_delivery', 'INSERT') THEN
    RAISE EXCEPTION 'I-5 POD POST: the INSERT privilege set moved; this file must not grant or revoke anything';
  END IF;
END
$i5_pod_post$;