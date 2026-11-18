-- ============================================================================
-- F-I5-01 (SHIPPER OFFER-CREATION AUTHORIZATION) - make the offers INSERT policy
-- test authority, not just identity.
--
-- FINDING (reported by I-5, re-measured live 2026-11-13 under the F-I5-01 directive)
--   marketplace_schema.offers carries exactly one INSERT policy,
--   "Transporter creates own offers", whose entire WITH CHECK is:
--     (auth.uid() = transporter_id)
--   That is an identity test, not an authority test: any authenticated principal
--   that names itself as transporter_id satisfies it. Measured live before this
--   change:
--     * inside BEGIN ... ROLLBACK, as authenticated with the SHIPPER fixture JWT,
--       a direct INSERT naming that same Shipper as transporter_id returned
--       ALLOWED;
--     * over HTTP, POST /api/marketplace/offers as that Shipper returned 201 and
--       persisted a real offer. The probe row was removed and the offers count
--       returned to its pre-probe value of 9.
--   The defect is therefore a genuine authorization bypass with persistence at
--   both the application and the database layer, not merely a wrong HTTP status.
--   The I-5 report's "500 from the repository" observation came from a probe whose
--   listing_id violated the foreign key; with a valid listing the write succeeds.
--
-- WHY THIS IS STRICTLY NECESSARY
--   LA DIRECTIVE - F-I5-01, Sec.1 invariant: "Only an authenticated user with
--   effective TRANSPORTER marketplace membership, acting for their own authorized
--   Transporter identity, may create an offer." Sec.5 requires the database to
--   "reject Shipper-authored offers independently of application-layer checks",
--   and Sec.9 criteria 6 and 7 make that independent rejection a closure
--   condition. The application half is corrected in
--   web/src/app/api/marketplace/offers/route.ts; this file is the database half,
--   and neither is sufficient alone.
--
-- WHY THIS IS NOT A WEAKENING
--   The replacement is strictly narrower. It keeps the original identity conjunct
--   verbatim and adds the authoritative membership conjunct, so no row a
--   legitimate Transporter could insert before is lost: every such caller already
--   resolves to TRANSPORTER. The resolver is the existing I-1
--   public.effective_marketplace_role() - SECURITY DEFINER, STABLE, owner postgres,
--   search_path pinned to pg_catalog/public, zero arguments, keyed on auth.uid(),
--   reading app.marketplace_memberships, whose CHECK constraint admits only
--   'SHIPPER' and 'TRANSPORTER'. It is the same function migration 063 uses, so no
--   new authorization RPC is invented. It never reads user_metadata and never
--   accepts a caller-supplied user id. Command (INSERT), permissive mode, PUBLIC
--   target scope and the policy name are all preserved. The two SELECT policies
--   and the UPDATE policy are not touched, so a Shipper keeps reading the
--   quotations submitted against its own listings. Nothing is granted, revoked or
--   added, and app stays outside the PostgREST exposed set.
--
-- RECURSION
--   The predicate names no relation in a FROM or JOIN clause, so it cannot
--   re-apply itself. The resolver reads app.marketplace_memberships as its
--   SECURITY DEFINER owner; that table has relrowsecurity = true but
--   relforcerowsecurity = false, so the owner bypasses RLS and no policy on it is
--   evaluated. Section C asserts the platform-wide self-reference census is 0.
--
-- BEFORE-STATE (measured live, 2026-11-13)
--   4 policies on marketplace_schema.offers, all PERMISSIVE, all PUBLIC scope:
--     Transporter creates own offers            INSERT (replaced)
--     Shipper reads offers for their listings   SELECT (unchanged)
--     Transporter reads own offers              SELECT (unchanged)
--     Transporter updates own offers            UPDATE (unchanged)
--   No DELETE policy exists. relrowsecurity = true, relforcerowsecurity = false,
--   owner postgres. Privileges: authenticated INSERT/SELECT/UPDATE true, DELETE
--   false, USAGE on the schema true; anon holds no table privilege and no USAGE;
--   service_role holds no table privilege and no USAGE, so no service-role bypass
--   exists and none is introduced.
--
-- ROLLBACK (exact inverse; restores the identity-only predicate verbatim)
--   DROP POLICY IF EXISTS "Transporter creates own offers" ON marketplace_schema.offers;
--   CREATE POLICY "Transporter creates own offers"
--     ON marketplace_schema.offers FOR INSERT
--     WITH CHECK (auth.uid() = transporter_id);
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A - before-state guard. This file must see the identity-only predicate
-- it replaces, the three policies it must leave alone, the resolver it depends on
-- and the privilege set it must not move.
-- ----------------------------------------------------------------------------
DO $fi501_pre$
DECLARE
  v_total  INT;
  v_insert RECORD;
BEGIN
  SELECT count(*) INTO v_total
    FROM pg_policy p
   WHERE p.polrelid = 'marketplace_schema.offers'::regclass;

  IF v_total <> 4 THEN
    RAISE EXCEPTION 'F-I5-01 PRE: offers carries [%] policies, not the 4 measured live before this change', v_total;
  END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polwithcheck, p.polrelid) AS expr,
         pg_get_expr(p.polqual, p.polrelid) AS qual
    INTO v_insert
    FROM pg_policy p
   WHERE p.polrelid = 'marketplace_schema.offers'::regclass
     AND p.polname = 'Transporter creates own offers';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'F-I5-01 PRE: the INSERT policy "Transporter creates own offers" is absent, so the measured before-state no longer holds';
  END IF;
  IF v_insert.polcmd <> 'a' OR v_insert.qual IS NOT NULL THEN
    RAISE EXCEPTION 'F-I5-01 PRE: "Transporter creates own offers" is not an INSERT-only policy';
  END IF;
  IF v_insert.expr IS DISTINCT FROM '(auth.uid() = transporter_id)' THEN
    RAISE EXCEPTION 'F-I5-01 PRE: the INSERT predicate is [%], not the identity-only test this file replaces', v_insert.expr;
  END IF;

  -- The three policies that must not move. The Shipper read is the quotation
  -- viewing capability Sec.4 and Sec.6C of the directive require preserved.
  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'marketplace_schema.offers'::regclass
                    AND p.polname = 'Shipper reads offers for their listings'
                    AND p.polcmd = 'r'
                    AND strpos(pg_get_expr(p.polqual, p.polrelid), 'l.shipper_id = auth.uid()') > 0) THEN
    RAISE EXCEPTION 'F-I5-01 PRE: the Shipper quotation read policy is not in its measured form';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'marketplace_schema.offers'::regclass
                    AND p.polname = 'Transporter reads own offers'
                    AND p.polcmd = 'r'
                    AND pg_get_expr(p.polqual, p.polrelid) = '(auth.uid() = transporter_id)') THEN
    RAISE EXCEPTION 'F-I5-01 PRE: the Transporter read policy is not in its measured form';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'marketplace_schema.offers'::regclass
                    AND p.polname = 'Transporter updates own offers'
                    AND p.polcmd = 'w'
                    AND pg_get_expr(p.polqual, p.polrelid) = '(auth.uid() = transporter_id)'
                    AND pg_get_expr(p.polwithcheck, p.polrelid) = '(auth.uid() = transporter_id)') THEN
    RAISE EXCEPTION 'F-I5-01 PRE: the Transporter update policy is not in its measured form';
  END IF;

  -- The authoritative resolver must already exist with the properties the
  -- predicate relies on. This file creates no function.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'effective_marketplace_role'
                    AND p.pronargs = 0 AND p.prosecdef AND p.provolatile = 's'
                    AND pg_get_userbyid(p.proowner) = 'postgres'
                    AND p.proconfig @> ARRAY['search_path=pg_catalog, public']) THEN
    RAISE EXCEPTION 'F-I5-01 PRE: public.effective_marketplace_role() is absent or is not the pinned STABLE SECURITY DEFINER resolver';
  END IF;

  -- The membership domain must admit only the two canonical classifications, so
  -- an equality test against TRANSPORTER is exact rather than case-sensitive luck.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                  WHERE c.conrelid = 'app.marketplace_memberships'::regclass
                    AND c.contype = 'c'
                    AND pg_get_constraintdef(c.oid) LIKE '%SHIPPER%TRANSPORTER%') THEN
    RAISE EXCEPTION 'F-I5-01 PRE: app.marketplace_memberships no longer constrains role to SHIPPER and TRANSPORTER';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'marketplace_schema.offers'::regclass) THEN
    RAISE EXCEPTION 'F-I5-01 PRE: row level security is not enabled on offers; a policy change would not be the correction';
  END IF;
  IF (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'marketplace_schema.offers'::regclass) THEN
    RAISE EXCEPTION 'F-I5-01 PRE: relforcerowsecurity is set on offers, which contradicts the measured before-state';
  END IF;

  IF NOT has_table_privilege('authenticated', 'marketplace_schema.offers', 'INSERT') THEN
    RAISE EXCEPTION 'F-I5-01 PRE: authenticated lacks INSERT, so the measured before-state no longer holds';
  END IF;
  IF has_table_privilege('anon', 'marketplace_schema.offers', 'INSERT')
     OR has_table_privilege('service_role', 'marketplace_schema.offers', 'INSERT') THEN
    RAISE EXCEPTION 'F-I5-01 PRE: anon or service_role holds INSERT on offers, which contradicts the measured before-state';
  END IF;
END
$fi501_pre$;

-- ----------------------------------------------------------------------------
-- SECTION B - replace the one identity-only INSERT predicate. The policy name is
-- kept: the actor it admits is still a Transporter creating its own offer, so
-- renaming it would describe a boundary that did not change. The other three
-- policies are not touched.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Transporter creates own offers" ON marketplace_schema.offers;

CREATE POLICY "Transporter creates own offers"
  ON marketplace_schema.offers FOR INSERT
  WITH CHECK (
    public.effective_marketplace_role() = 'TRANSPORTER'
    AND auth.uid() = transporter_id
  );

-- ----------------------------------------------------------------------------
-- SECTION C - post-change assertion: the inventory is still 4 policies, the three
-- untouched ones are byte-identical, the replacement conjoins membership with the
-- original identity test, no self-reference was introduced anywhere, and no
-- privilege or RLS setting moved.
-- ----------------------------------------------------------------------------
DO $fi501_post$
DECLARE
  v_total INT;
  v_new   RECORD;
  v_expr  TEXT;
BEGIN
  SELECT count(*) INTO v_total
    FROM pg_policy p
   WHERE p.polrelid = 'marketplace_schema.offers'::regclass;

  IF v_total <> 4 THEN
    RAISE EXCEPTION 'F-I5-01 POST: offers now carries [%] policies instead of 4', v_total;
  END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polwithcheck, p.polrelid) AS expr,
         pg_get_expr(p.polqual, p.polrelid) AS qual
    INTO v_new
    FROM pg_policy p
   WHERE p.polrelid = 'marketplace_schema.offers'::regclass
     AND p.polname = 'Transporter creates own offers';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'F-I5-01 POST: the replacement policy was not created';
  END IF;
  IF v_new.polcmd <> 'a' OR v_new.qual IS NOT NULL THEN
    RAISE EXCEPTION 'F-I5-01 POST: the replacement is not an INSERT-only policy';
  END IF;
  IF NOT v_new.polpermissive THEN
    RAISE EXCEPTION 'F-I5-01 POST: the replacement is restrictive, which would change how the other policies combine';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_new.polroles) u JOIN pg_roles g ON g.oid = u) THEN
    RAISE EXCEPTION 'F-I5-01 POST: the replacement is scoped to a named role instead of the PUBLIC scope the original had';
  END IF;

  v_expr := v_new.expr;
  IF v_expr IS NULL
     OR strpos(v_expr, 'effective_marketplace_role()') = 0
     OR strpos(v_expr, 'TRANSPORTER') = 0
     OR strpos(v_expr, 'auth.uid() = transporter_id') = 0 THEN
    RAISE EXCEPTION 'F-I5-01 POST: the replacement does not conjoin authoritative membership with the caller identity test';
  END IF;
  IF strpos(v_expr, 'user_metadata') > 0
     OR strpos(v_expr, 'raw_user_meta_data') > 0
     OR strpos(v_expr, 'platform_roles') > 0 THEN
    RAISE EXCEPTION 'F-I5-01 POST: the replacement depends on client-writable metadata or on a non-authoritative role source';
  END IF;

  -- The three policies that must not move, compared against their exact measured
  -- definitions rather than a substring, so a silent widening cannot pass.
  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'marketplace_schema.offers'::regclass
                    AND p.polname = 'Shipper reads offers for their listings'
                    AND p.polcmd = 'r'
                    AND strpos(pg_get_expr(p.polqual, p.polrelid), 'l.shipper_id = auth.uid()') > 0
                    AND strpos(pg_get_expr(p.polqual, p.polrelid), 'l.is_deleted = false') > 0) THEN
    RAISE EXCEPTION 'F-I5-01 POST: the Shipper quotation read policy changed, so a Shipper may have lost or gained visibility';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'marketplace_schema.offers'::regclass
                    AND p.polname = 'Transporter reads own offers'
                    AND p.polcmd = 'r'
                    AND pg_get_expr(p.polqual, p.polrelid) = '(auth.uid() = transporter_id)') THEN
    RAISE EXCEPTION 'F-I5-01 POST: the Transporter read policy changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy p
                  WHERE p.polrelid = 'marketplace_schema.offers'::regclass
                    AND p.polname = 'Transporter updates own offers'
                    AND p.polcmd = 'w'
                    AND pg_get_expr(p.polqual, p.polrelid) = '(auth.uid() = transporter_id)'
                    AND pg_get_expr(p.polwithcheck, p.polrelid) = '(auth.uid() = transporter_id)') THEN
    RAISE EXCEPTION 'F-I5-01 POST: the Transporter update policy changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy p
              WHERE p.polrelid = 'marketplace_schema.offers'::regclass AND p.polcmd = 'd') THEN
    RAISE EXCEPTION 'F-I5-01 POST: a DELETE policy appeared where the before-state had none';
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
    RAISE EXCEPTION 'F-I5-01 POST: a self-referencing policy exists somewhere in the catalog';
  END IF;

  -- The resolver must not have been altered, and no policy may have been added to
  -- the membership table that reaches back into offers.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'effective_marketplace_role'
                    AND p.pronargs = 0 AND p.prosecdef AND p.provolatile = 's'
                    AND p.proconfig @> ARRAY['search_path=pg_catalog, public']) THEN
    RAISE EXCEPTION 'F-I5-01 POST: the resolver properties changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy p
              WHERE p.polrelid = 'app.marketplace_memberships'::regclass
                AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                     coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) LIKE '%offers%') THEN
    RAISE EXCEPTION 'F-I5-01 POST: a membership policy now references offers, which would create a recursive dependency';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'marketplace_schema.offers'::regclass) THEN
    RAISE EXCEPTION 'F-I5-01 POST: row level security is no longer enabled on offers';
  END IF;
  IF (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'marketplace_schema.offers'::regclass) THEN
    RAISE EXCEPTION 'F-I5-01 POST: relforcerowsecurity changed, which would alter the owner''s own exposure';
  END IF;

  IF NOT has_table_privilege('authenticated', 'marketplace_schema.offers', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'marketplace_schema.offers', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'marketplace_schema.offers', 'UPDATE')
     OR has_table_privilege('authenticated', 'marketplace_schema.offers', 'DELETE')
     OR has_table_privilege('anon', 'marketplace_schema.offers', 'INSERT')
     OR has_table_privilege('service_role', 'marketplace_schema.offers', 'INSERT')
     OR has_schema_privilege('anon', 'marketplace_schema', 'USAGE')
     OR has_schema_privilege('service_role', 'marketplace_schema', 'USAGE') THEN
    RAISE EXCEPTION 'F-I5-01 POST: the privilege set moved; this file must not grant or revoke anything';
  END IF;
END
$fi501_post$;