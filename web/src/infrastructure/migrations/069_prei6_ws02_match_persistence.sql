-- ============================================================================
-- NexCargo Migration 069 -- PRE-I-6 WS-02 MATCH PERSISTENCE / D-M1 + D-M3
-- Authorized by: LA IMPLEMENTATION DIRECTIVE -- PRE-I-6 WS-02 MATCH PERSISTENCE
-- (D-M1 APPROVED, D-M2 APPROVED, D-M3 APPROVED, D-M4 DEFERRED).
-- Implements Option A of "PRE-I-6 WS-02 -- MATCH PERSISTENCE AND BOOKING-HANDOFF
-- REMEDIATION PROPOSAL" (2026-11-18). Touches ONLY marketplace_schema.matches.
--
-- FINDING (measured live 2026-11-18, owner-class catalog)
--   marketplace_schema.matches: RLS on, force off; exactly ONE policy
--   ("Match participants read matches", SELECT, PERMISSIVE, PUBLIC scope) whose
--   qual carries the over-broad disjunct OR l.is_deleted = false, exposing every
--   non-deleted listing's matches to ANY authenticated reader. Grants:
--   authenticated SELECT only (027:97-98); INSERT/UPDATE absent; anon and
--   service_role hold nothing. public.marketplace_book_handoff is SECURITY
--   INVOKER (6 uuid args, search_path pinned pg_catalog/public, 067 booking_id
--   generation live in the body); its UPDATE matches step therefore fails with
--   42501 for every real session, and even with a grant would hit 0 rows because
--   no UPDATE policy exists. No writer of matches exists anywhere in web/src.
--
-- EXACT CHANGE (matches only)
--   D-M1:
--   1. GRANT INSERT ON marketplace_schema.matches TO authenticated.
--   2. GRANT UPDATE (status, updated_at, version) -- column-scoped, exactly the
--      three columns the INVOKER handoff writes. No table-wide UPDATE.
--   3. INSERT policy "Shipper records match on own published listing"
--      (TO authenticated): status PROPOSED, created_by = auth.uid(),
--      is_deleted false, listing owned by auth.uid() AND PUBLISHED AND not
--      deleted, offer SUBMITTED AND not deleted AND linked to the same listing.
--      Body identifiers never establish authority; every relationship is
--      re-derived from stored rows.
--   4. UPDATE policy "Shipper transitions own proposed match" (TO authenticated):
--      USING restricts the old row to PROPOSED + not deleted + listing owned by
--      auth.uid(); WITH CHECK permits REJECTED for the owning Shipper, and
--      ACCEPTED only when the matching booking (logistics_schema.bookings,
--      same listing_id + selected_offer_id, shipper = auth.uid(), not deleted)
--      already exists. The handoff INSERTs the booking BEFORE updating the
--      match, so the conjunct holds inside the RPC transaction and denies a
--      direct PostgREST ACCEPTED without a booking. Terminal states are
--      unreachable (USING requires PROPOSED). No platform-role branch:
--      platform admins acquire no marketplace-party authority (D-WS01-1).
--   D-M3:
--   5. Replace the SELECT policy predicate in place (name, command, permissive
--      mode and PUBLIC scope preserved): participants only -- the listing's
--      shipper OR the offer's transporter. The OR l.is_deleted = false disjunct
--      is removed; unrelated authenticated users can no longer read match ids,
--      scores, ranks, reasoning traces or relationship metadata.
--   D-M4 (DEFERRED): no partial unique index, no new constraint of any kind.
--
-- NOT CHANGED (guarded byte-identical / census-identical before and after)
--   public.marketplace_book_handoff: signature, SECURITY INVOKER posture, pinned
--   search_path, body (067 correction included), EXECUTE set. No function is
--   created, replaced or dropped; no SECURITY DEFINER is introduced.
--   matches columns, constraints (PK + 4 FKs, no status CHECK), indexes (5),
--   non-internal triggers (0), RLS flags. listings/offers/bookings policy counts
--   (4/4/5). No grant to anon or service_role; no other table touched.
--
-- WHY THIS IS NOT A WEAKENING
--   The two new write paths are narrower than every sibling marketplace write
--   policy: ownership + lifecycle state + stored-row relationship checks, and
--   the ACCEPTED branch additionally requires the coupled booking row. The
--   SELECT change strictly removes visibility; both legitimate party branches
--   are preserved verbatim. The column-scoped UPDATE grant cannot rewrite
--   listing_id, offer_id, match_score, ranking_position or created_by.
--
-- ROLLBACK (exact inverse; restores the measured over-broad SELECT predicate)
--   DROP POLICY IF EXISTS "Shipper records match on own published listing" ON marketplace_schema.matches;
--   DROP POLICY IF EXISTS "Shipper transitions own proposed match" ON marketplace_schema.matches;
--   DROP POLICY IF EXISTS "Match participants read matches" ON marketplace_schema.matches;
--   CREATE POLICY "Match participants read matches" ON marketplace_schema.matches
--     FOR SELECT USING (
--       ((EXISTS ( SELECT 1 FROM marketplace_schema.listings l
--         WHERE ((l.id = matches.listing_id) AND ((l.shipper_id = auth.uid()) OR (l.is_deleted = false)))))
--        OR (EXISTS ( SELECT 1 FROM marketplace_schema.offers o
--         WHERE ((o.id = matches.offer_id) AND (o.transporter_id = auth.uid()))))));
--   REVOKE UPDATE (status, updated_at, version) ON marketplace_schema.matches FROM authenticated;
--   REVOKE INSERT ON marketplace_schema.matches FROM authenticated;
--   Persisted match rows remain ordinary SELECT-readable records; no data
--   migration is needed and no orphaned booking can exist (booking INSERT and
--   ACCEPTED transition share one RPC transaction).
--
-- APPLICATION PROCEDURE
--   Apply via Supabase apply_migration with name 069_prei6_ws02_match_persistence,
--   then re-measure from the catalog (pg_policy / pg_get_expr /
--   has_table_privilege / has_column_privilege) and via real-session HTTP plus
--   direct-RPC probes. File existence is not proof of application; the journal
--   row and catalog measurements are. One DO block: atomic.
-- ============================================================================

DO $ws02m$
DECLARE
  v_rec          RECORD;
  v_fn_src       TEXT;
  v_fn_cfg       TEXT[];
  v_con_before   TEXT;
  v_idx_before   TEXT;
  v_select_qual  TEXT;
BEGIN
  -- ------------------------------------------------------------------
  -- PRE-GUARDS: measured before-state (2026-11-18)
  -- ------------------------------------------------------------------
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'marketplace_schema.matches'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'marketplace_schema.matches'::regclass) THEN
    RAISE EXCEPTION 'WS02M PRE: matches RLS flags differ from the measured before-state';
  END IF;

  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'marketplace_schema.matches'::regclass) <> 1 THEN
    RAISE EXCEPTION 'WS02M PRE: matches does not have exactly one policy';
  END IF;
  SELECT p.polcmd, p.polpermissive, p.polroles, pg_get_expr(p.polqual, p.polrelid) AS qual
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'marketplace_schema.matches'::regclass
     AND p.polname = 'Match participants read matches';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02M PRE: matches SELECT target policy absent'; END IF;
  IF v_rec.polcmd <> 'r' OR NOT v_rec.polpermissive THEN
    RAISE EXCEPTION 'WS02M PRE: matches target is not a permissive SELECT policy';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_rec.polroles) u JOIN pg_roles g ON g.oid = u) THEN
    RAISE EXCEPTION 'WS02M PRE: matches SELECT target is not PUBLIC scope';
  END IF;
  IF strpos(v_rec.qual, 'l.is_deleted = false') = 0
     OR strpos(v_rec.qual, 'l.shipper_id = auth.uid()') = 0
     OR strpos(v_rec.qual, 'o.transporter_id = auth.uid()') = 0 THEN
    RAISE EXCEPTION 'WS02M PRE: matches SELECT target lacks the measured over-broad disjunct or a party branch';
  END IF;
  v_select_qual := v_rec.qual;

  IF NOT has_table_privilege('authenticated', 'marketplace_schema.matches', 'SELECT')
     OR has_table_privilege('authenticated', 'marketplace_schema.matches', 'INSERT')
     OR has_column_privilege('authenticated', 'marketplace_schema.matches', 'status', 'UPDATE')
     OR has_table_privilege('anon', 'marketplace_schema.matches', 'INSERT')
     OR has_column_privilege('anon', 'marketplace_schema.matches', 'status', 'UPDATE')
     OR has_table_privilege('service_role', 'marketplace_schema.matches', 'INSERT')
     OR has_column_privilege('service_role', 'marketplace_schema.matches', 'status', 'UPDATE') THEN
    RAISE EXCEPTION 'WS02M PRE: matches grant set differs from the measured SELECT-only before-state';
  END IF;

  SELECT p.prosrc, p.proconfig INTO v_fn_src, v_fn_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff' AND p.pronargs = 6;
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02M PRE: marketplace_book_handoff(uuid x6) absent'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff' AND p.prosecdef) THEN
    RAISE EXCEPTION 'WS02M PRE: handoff is not SECURITY INVOKER';
  END IF;
  IF NOT (v_fn_cfg @> ARRAY['search_path=pg_catalog, public']) THEN
    RAISE EXCEPTION 'WS02M PRE: handoff search_path is not pinned';
  END IF;
  IF strpos(v_fn_src, 'gen_random_uuid()') = 0 THEN
    RAISE EXCEPTION 'WS02M PRE: 067 booking_id correction is not live in the handoff body';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.marketplace_book_handoff(uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.marketplace_book_handoff(uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'WS02M PRE: handoff EXECUTE set differs from the measured before-state';
  END IF;

  SELECT string_agg(pg_get_constraintdef(c.oid), '|' ORDER BY c.conname) INTO v_con_before
    FROM pg_constraint c WHERE c.conrelid = 'marketplace_schema.matches'::regclass;
  IF (SELECT count(*) FROM pg_constraint c
       WHERE c.conrelid = 'marketplace_schema.matches'::regclass AND c.contype = 'c') <> 0 THEN
    RAISE EXCEPTION 'WS02M PRE: matches already carries a CHECK constraint';
  END IF;
  SELECT string_agg(indexdef, '|' ORDER BY indexname) INTO v_idx_before
    FROM pg_indexes WHERE schemaname = 'marketplace_schema' AND tablename = 'matches';
  IF (SELECT count(*) FROM pg_indexes WHERE schemaname = 'marketplace_schema' AND tablename = 'matches') <> 5 THEN
    RAISE EXCEPTION 'WS02M PRE: matches index count differs from the measured five';
  END IF;
  IF (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid = 'marketplace_schema.matches'::regclass AND NOT t.tgisinternal) <> 0 THEN
    RAISE EXCEPTION 'WS02M PRE: matches already carries a non-internal trigger';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'logistics_schema' AND table_name = 'bookings'
                    AND column_name = 'selected_offer_id') THEN
    RAISE EXCEPTION 'WS02M PRE: logistics_schema.bookings.selected_offer_id absent';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'marketplace_schema.listings'::regclass) <> 4
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'marketplace_schema.offers'::regclass) <> 4
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.bookings'::regclass) <> 5 THEN
    RAISE EXCEPTION 'WS02M PRE: sibling policy counts differ from the measured before-state';
  END IF;

  IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'FROM ' || n.nspname || '.' || c.relname) > 0
          OR strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'JOIN ' || n.nspname || '.' || c.relname) > 0) <> 0 THEN
    RAISE EXCEPTION 'WS02M PRE: a self-referencing policy already exists in the catalog';
  END IF;

  -- ------------------------------------------------------------------
  -- D-M1: minimal grants (column-scoped UPDATE) + two write policies
  -- ------------------------------------------------------------------
  EXECUTE $sql$GRANT INSERT ON TABLE marketplace_schema.matches TO authenticated$sql$;
  EXECUTE $sql$GRANT UPDATE (status, updated_at, version) ON TABLE marketplace_schema.matches TO authenticated$sql$;

  EXECUTE $sql$CREATE POLICY "Shipper records match on own published listing"
    ON marketplace_schema.matches FOR INSERT TO authenticated
    WITH CHECK (
      status = 'PROPOSED'
      AND created_by = auth.uid()
      AND is_deleted = false
      AND EXISTS (SELECT 1 FROM marketplace_schema.listings l
                  WHERE l.id = listing_id
                    AND l.shipper_id = auth.uid()
                    AND l.status = 'PUBLISHED'
                    AND l.is_deleted = false)
      AND EXISTS (SELECT 1 FROM marketplace_schema.offers o
                  WHERE o.id = offer_id
                    AND o.listing_id = matches.listing_id
                    AND o.status = 'SUBMITTED'
                    AND o.is_deleted = false)
    )$sql$;

  EXECUTE $sql$CREATE POLICY "Shipper transitions own proposed match"
    ON marketplace_schema.matches FOR UPDATE TO authenticated
    USING (
      status = 'PROPOSED'
      AND is_deleted = false
      AND EXISTS (SELECT 1 FROM marketplace_schema.listings l
                  WHERE l.id = matches.listing_id AND l.shipper_id = auth.uid())
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM marketplace_schema.listings l
              WHERE l.id = matches.listing_id AND l.shipper_id = auth.uid())
      AND (
        status = 'REJECTED'
        OR (status = 'ACCEPTED'
            AND EXISTS (SELECT 1 FROM logistics_schema.bookings b
                        WHERE b.listing_id = matches.listing_id
                          AND b.selected_offer_id = matches.offer_id
                          AND b.shipper_id = auth.uid()
                          AND b.is_deleted = false))
      )
    )$sql$;

  -- ------------------------------------------------------------------
  -- D-M3: SELECT predicate correction (name/command/permissive/PUBLIC kept)
  -- ------------------------------------------------------------------
  EXECUTE $sql$DROP POLICY "Match participants read matches" ON marketplace_schema.matches$sql$;
  EXECUTE $sql$CREATE POLICY "Match participants read matches"
    ON marketplace_schema.matches FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM marketplace_schema.listings l
              WHERE l.id = matches.listing_id AND l.shipper_id = auth.uid())
      OR EXISTS (SELECT 1 FROM marketplace_schema.offers o
                 WHERE o.id = matches.offer_id AND o.transporter_id = auth.uid())
    )$sql$;

  -- ------------------------------------------------------------------
  -- POST-GUARDS
  -- ------------------------------------------------------------------
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'marketplace_schema.matches'::regclass) <> 3 THEN
    RAISE EXCEPTION 'WS02M POST: matches policy count is not exactly three';
  END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles, pg_get_expr(p.polwithcheck, p.polrelid) AS wc
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'marketplace_schema.matches'::regclass
     AND p.polname = 'Shipper records match on own published listing';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02M POST: INSERT policy absent'; END IF;
  IF v_rec.polcmd <> 'a' OR NOT v_rec.polpermissive
     OR NOT (v_rec.polroles = ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'authenticated')]) THEN
    RAISE EXCEPTION 'WS02M POST: INSERT policy command/permissive/authenticated scope wrong';
  END IF;
  IF strpos(v_rec.wc, 'PROPOSED') = 0
     OR strpos(v_rec.wc, 'created_by = auth.uid()') = 0
     OR strpos(v_rec.wc, 'l.shipper_id = auth.uid()') = 0
     OR strpos(v_rec.wc, 'PUBLISHED') = 0
     OR strpos(v_rec.wc, 'SUBMITTED') = 0
     OR strpos(v_rec.wc, 'o.listing_id = matches.listing_id') = 0
     OR strpos(v_rec.wc, 'is_deleted = false') = 0 THEN
    RAISE EXCEPTION 'WS02M POST: INSERT policy lost an identity/ownership/lifecycle/linkage conjunct';
  END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles,
         pg_get_expr(p.polqual, p.polrelid) AS qual,
         pg_get_expr(p.polwithcheck, p.polrelid) AS wc
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'marketplace_schema.matches'::regclass
     AND p.polname = 'Shipper transitions own proposed match';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02M POST: UPDATE policy absent'; END IF;
  IF v_rec.polcmd <> 'w' OR NOT v_rec.polpermissive
     OR NOT (v_rec.polroles = ARRAY[(SELECT oid FROM pg_roles WHERE rolname = 'authenticated')]) THEN
    RAISE EXCEPTION 'WS02M POST: UPDATE policy command/permissive/authenticated scope wrong';
  END IF;
  IF strpos(v_rec.qual, 'PROPOSED') = 0 OR strpos(v_rec.qual, 'l.shipper_id = auth.uid()') = 0
     OR strpos(v_rec.qual, 'is_deleted = false') = 0 THEN
    RAISE EXCEPTION 'WS02M POST: UPDATE USING lost the PROPOSED/ownership conjunct';
  END IF;
  IF strpos(v_rec.wc, 'REJECTED') = 0 OR strpos(v_rec.wc, 'ACCEPTED') = 0
     OR strpos(v_rec.wc, 'logistics_schema.bookings') = 0
     OR strpos(v_rec.wc, 'b.selected_offer_id = matches.offer_id') = 0
     OR strpos(v_rec.wc, 'b.listing_id = matches.listing_id') = 0
     OR strpos(v_rec.wc, 'b.shipper_id = auth.uid()') = 0
     OR strpos(v_rec.wc, 'l.shipper_id = auth.uid()') = 0 THEN
    RAISE EXCEPTION 'WS02M POST: UPDATE WITH CHECK lost a transition/ownership/booking-coupling conjunct';
  END IF;
  IF strpos(v_rec.qual, 'platform_roles') > 0 OR strpos(v_rec.wc, 'platform_roles') > 0
     OR strpos(v_rec.qual, 'user_metadata') > 0 OR strpos(v_rec.wc, 'user_metadata') > 0 THEN
    RAISE EXCEPTION 'WS02M POST: UPDATE policy depends on a non-authoritative or platform-bypass source';
  END IF;

  SELECT p.polcmd, p.polpermissive, p.polroles, pg_get_expr(p.polqual, p.polrelid) AS qual
    INTO v_rec FROM pg_policy p
   WHERE p.polrelid = 'marketplace_schema.matches'::regclass
     AND p.polname = 'Match participants read matches';
  IF NOT FOUND THEN RAISE EXCEPTION 'WS02M POST: corrected SELECT policy absent'; END IF;
  IF v_rec.polcmd <> 'r' OR NOT v_rec.polpermissive THEN
    RAISE EXCEPTION 'WS02M POST: SELECT replacement changed command/permissive mode';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_rec.polroles) u JOIN pg_roles g ON g.oid = u) THEN
    RAISE EXCEPTION 'WS02M POST: SELECT replacement changed PUBLIC scope';
  END IF;
  IF strpos(v_rec.qual, 'l.shipper_id = auth.uid()') = 0
     OR strpos(v_rec.qual, 'o.transporter_id = auth.uid()') = 0 THEN
    RAISE EXCEPTION 'WS02M POST: SELECT replacement lost a legitimate party branch';
  END IF;
  IF strpos(v_rec.qual, 'is_deleted') > 0 THEN
    RAISE EXCEPTION 'WS02M POST: SELECT replacement still carries the over-broad is_deleted disjunct';
  END IF;
  IF v_rec.qual = v_select_qual THEN
    RAISE EXCEPTION 'WS02M POST: SELECT predicate was not actually replaced';
  END IF;

  IF NOT has_table_privilege('authenticated', 'marketplace_schema.matches', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'marketplace_schema.matches', 'INSERT') THEN
    RAISE EXCEPTION 'WS02M POST: authenticated SELECT/INSERT grant missing';
  END IF;
  IF NOT has_column_privilege('authenticated', 'marketplace_schema.matches', 'status', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'marketplace_schema.matches', 'updated_at', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'marketplace_schema.matches', 'version', 'UPDATE') THEN
    RAISE EXCEPTION 'WS02M POST: column-scoped UPDATE grant missing on a permitted column';
  END IF;
  IF has_column_privilege('authenticated', 'marketplace_schema.matches', 'listing_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'marketplace_schema.matches', 'offer_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'marketplace_schema.matches', 'match_score', 'UPDATE')
     OR has_column_privilege('authenticated', 'marketplace_schema.matches', 'ranking_position', 'UPDATE')
     OR has_column_privilege('authenticated', 'marketplace_schema.matches', 'reasoning_trace', 'UPDATE')
     OR has_column_privilege('authenticated', 'marketplace_schema.matches', 'created_by', 'UPDATE')
     OR has_column_privilege('authenticated', 'marketplace_schema.matches', 'is_deleted', 'UPDATE') THEN
    RAISE EXCEPTION 'WS02M POST: UPDATE grant leaked beyond status/updated_at/version';
  END IF;
  IF has_table_privilege('anon', 'marketplace_schema.matches', 'INSERT')
     OR has_column_privilege('anon', 'marketplace_schema.matches', 'status', 'UPDATE')
     OR has_table_privilege('service_role', 'marketplace_schema.matches', 'INSERT')
     OR has_column_privilege('service_role', 'marketplace_schema.matches', 'status', 'UPDATE') THEN
    RAISE EXCEPTION 'WS02M POST: anon/service_role acquired a write privilege';
  END IF;

  IF (SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff' AND p.pronargs = 6)
     IS DISTINCT FROM v_fn_src THEN
    RAISE EXCEPTION 'WS02M POST: handoff body changed';
  END IF;
  IF (SELECT p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff' AND p.pronargs = 6)
     IS DISTINCT FROM v_fn_cfg THEN
    RAISE EXCEPTION 'WS02M POST: handoff search_path config changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'marketplace_book_handoff' AND p.prosecdef) THEN
    RAISE EXCEPTION 'WS02M POST: handoff SECURITY INVOKER posture changed';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.marketplace_book_handoff(uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.marketplace_book_handoff(uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'WS02M POST: handoff EXECUTE set changed';
  END IF;

  IF (SELECT string_agg(pg_get_constraintdef(c.oid), '|' ORDER BY c.conname)
        FROM pg_constraint c WHERE c.conrelid = 'marketplace_schema.matches'::regclass)
     IS DISTINCT FROM v_con_before THEN
    RAISE EXCEPTION 'WS02M POST: matches constraint set changed (D-M4 forbids new constraints)';
  END IF;
  IF (SELECT string_agg(indexdef, '|' ORDER BY indexname)
        FROM pg_indexes WHERE schemaname = 'marketplace_schema' AND tablename = 'matches')
     IS DISTINCT FROM v_idx_before THEN
    RAISE EXCEPTION 'WS02M POST: matches index set changed (D-M4 forbids a new index)';
  END IF;
  IF (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid = 'marketplace_schema.matches'::regclass AND NOT t.tgisinternal) <> 0 THEN
    RAISE EXCEPTION 'WS02M POST: a non-internal trigger appeared on matches';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'marketplace_schema.matches'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'marketplace_schema.matches'::regclass) THEN
    RAISE EXCEPTION 'WS02M POST: matches RLS flags moved';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'marketplace_schema.listings'::regclass) <> 4
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'marketplace_schema.offers'::regclass) <> 4
     OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'logistics_schema.bookings'::regclass) <> 5 THEN
    RAISE EXCEPTION 'WS02M POST: a sibling policy count moved; only matches may change';
  END IF;

  IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'FROM ' || n.nspname || '.' || c.relname) > 0
          OR strpos(coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
                    coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
                    'JOIN ' || n.nspname || '.' || c.relname) > 0) <> 0 THEN
    RAISE EXCEPTION 'WS02M POST: a self-referencing policy exists in the catalog';
  END IF;
END
$ws02m$;