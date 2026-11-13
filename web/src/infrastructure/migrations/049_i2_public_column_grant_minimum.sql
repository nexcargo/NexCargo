-- ============================================================================
-- I-2 PART C ITEM 3 - privilege minimum on the F-I2-04 column grants.
-- Registered as NXC-I2-DB-007.
--
-- THE FINDING (F-I2-04, directive Part C item 3, rule 9)
--   Four migrations implement "financial immutability" by granting UPDATE on a
--   HANDFUL OF COLUMNS TO PUBLIC. PUBLIC is not a role you can trust to mean
--   "the app": it contains anon. So an unauthenticated connection holds a written,
--   standing column-write privilege on contract-acceptance and payment/settlement
--   state columns. RLS is what has been saving it - anon matches no policy, so no
--   rows are reachable - but that is a row filter doing the job of a privilege
--   boundary, and rule 9 forbids keeping the broad grant anyway.
--     005_contracts_and_escrow_rls.sql:94   UPDATE (acceptance_status, shipper_accepted_at,
--                                           transporter_accepted_at, ...) ON ..._contracts TO PUBLIC
--     006_payment_intents.sql:103-105       UPDATE (status, provider_reference_id,
--                                           external_transaction_ref, fee_amount, failure_reason,
--                                           updated_at, version, updated_by)
--                                           ON financial_schema.payment_intents TO PUBLIC
--     007_settlement_ledger_c4iii.sql:171   same shape ON financial_schema.settlement_requests
--     007_settlement_ledger_c4iii.sql:178   same shape ON financial_schema.financial_ledger_entries
--   The paired REVOKE statements (006:100, 007:168, 007:175) that make the columns
--   "immutable" are NOT touched by this file and their intent survives it.
--
-- PRE-CHANGE STATE (measured as far as an admissible path allows)
--   Owner-class privilege catalog reads stay blocked in this session (scope
--   statement §8), so the live grant set is not enumerated here in advance. That
--   is precisely why Section A is CONDITIONAL on the catalog: it acts on whatever
--   PUBLIC column privileges the server itself reports for these four tables, and
--   on nothing else. Two consequences of doing it that way, both desirable:
--     - 005_contracts_and_escrow_rls has no tracked migration row (F-I2-13), so its
--       live state is unknown. If its grant never landed, Section A finds nothing
--       for that table and changes nothing. If it did land, it is narrowed the same
--       way as the others.
--     - financial_schema.financial_ledger_entries has had NO RLS policy since 046
--       (advisor 2026-11-06T14:34:35.143Z lists it in rls_enabled_no_policy = 15),
--       because its only policy was an inert auth.jwt() leg. So it is already
--       deny-all at row level; removing the standing PUBLIC column privilege is
--       therefore belt-and-braces rather than a behaviour change.
--
-- WHY THIS CANNOT GRANT ANYTHING NEW
--   authenticated and service_role are members of PUBLIC. A grant to PUBLIC is
--   therefore a SUPERSET of a grant to those two roles. The loop revokes the
--   PUBLIC grant and re-issues the identical (table, column) privilege to
--   authenticated and service_role only, so the resulting capability set is a
--   strict subset of the one it replaced. Nothing is widened, which is the
--   constraint rule 9 and the standing instruction "do not grant broad privileges
--   merely to make existing operations work" are about. anon loses only a privilege
--   it could never exercise past RLS.
--
-- WHAT THIS FILE DOES NOT DO
--   It does not touch any other table's column grants, even if PUBLIC holds them -
--   "make no unrelated database changes" bounds this to the four tables F-I2-04
--   names, and any others found are reported as findings rather than silently
--   edited. It does not change any REVOKE of the immutable core columns. It adds no
--   policy, changes no policy, touches no function, no trigger and no role.
--
-- BEHAVIOUR CHANGE DISCLOSED
--   Intended: an anon-privileged column UPDATE on these four tables is refused at
--   the privilege layer (42501) instead of only being filtered away by RLS. No
--   application path changes: the routes that write these columns go through the
--   service-role client (api/settlements/route.ts:15, settlement-execution-service.ts:296)
--   or an authenticated session, and both keep the privilege explicitly.
--
-- ROLLBACK (restore the pre-change grant shape exactly as the files authored it)
--   Re-issue the original statements verbatim:
--     006_payment_intents.sql:103-105, 007_settlement_ledger_c4iii.sql:171-172 and :178-179,
--     and, if it is live, 005_contracts_and_escrow_rls.sql:94-99.
--   Each is GRANT UPDATE (<same column list>) ON <same table> TO PUBLIC; the column
--   lists are recorded above and in the source files, and Section A prints the pairs
--   it acted on so the reverse set is enumerable from the apply output.
-- ============================================================================

DO $i3cols$
DECLARE
  v_rec RECORD;
  v_pairs TEXT := '';
BEGIN
  FOR v_rec IN
    SELECT cp.table_schema AS sch, cp.table_name AS tbl, cp.column_name AS col
      FROM information_schema.column_privileges cp
     WHERE cp.grantee = 'PUBLIC'
       AND cp.privilege_type = 'UPDATE'
       AND cp.table_schema = 'financial_schema'
       AND cp.table_name IN ('contracts', 'payment_intents', 'settlement_requests', 'financial_ledger_entries')
     ORDER BY cp.table_name, cp.column_name
  LOOP
    v_pairs := v_pairs || format('%s.%s.%s ', v_rec.sch, v_rec.tbl, v_rec.col);
    EXECUTE format('REVOKE UPDATE (%I) ON %I.%I FROM PUBLIC', v_rec.col, v_rec.sch, v_rec.tbl);
    EXECUTE format('GRANT  UPDATE (%I) ON %I.%I TO authenticated, service_role', v_rec.col, v_rec.sch, v_rec.tbl);
  END LOOP;

  IF v_pairs = '' THEN
    RAISE NOTICE 'I-2 ITEM3 found no PUBLIC column UPDATE privileges on the four F-I2-04 tables; no change made';
  ELSE
    RAISE NOTICE 'I-2 ITEM3 converted PUBLIC column privileges to authenticated+service_role for: %', v_pairs;
  END IF;
END
$i3cols$;

-- 005:94-99 grants against logistics_schema.contracts, which is a different schema
-- from the financial three, so it is handled by its own conditional pass with the
-- table named exactly - a wildcard over "%contract%" would risk touching tables
-- F-I2-04 does not name, and "make no unrelated database changes" forbids that.
DO $i3contracts$
DECLARE
  v_rec RECORD;
  v_n   INT := 0;
BEGIN
  FOR v_rec IN
    SELECT cp.table_schema AS sch, cp.table_name AS tbl, cp.column_name AS col
      FROM information_schema.column_privileges cp
     WHERE cp.grantee = 'PUBLIC'
       AND cp.privilege_type = 'UPDATE'
       AND cp.table_schema = 'logistics_schema'
       AND cp.table_name = 'contracts'
     ORDER BY cp.column_name
  LOOP
    EXECUTE format('REVOKE UPDATE (%I) ON %I.%I FROM PUBLIC', v_rec.col, v_rec.sch, v_rec.tbl);
    EXECUTE format('GRANT  UPDATE (%I) ON %I.%I TO authenticated, service_role', v_rec.col, v_rec.sch, v_rec.tbl);
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE 'I-2 ITEM3 logistics_schema.contracts PUBLIC column privileges converted: % (0 pairs means 005 is not live and nothing was changed)', v_n;
END
$i3contracts$;
