-- ============================================================================
-- I-2 PART C ITEM 7 - audit triggers on the financial table set required by
-- ESS-006:407. Registered as NXC-I2-DB-010 (finding F-I2-20).
--
-- REQUIREMENT (verbatim)
--   docs/ess/ess-006-security-and-compliance.md:407
--     "all financial tables MUST have RLS + audit triggers"
--   Item 7 exit criterion, docs/implementations/i2-security-authorization-
--   scope-statement.md:227
--     "... the :407 table set demonstrably covered ..."
--   ESS-006 section 8 additionally requires the audit log to be "immutable,
--   append-only, RLS-protected (admin-only access)".
--
-- PRE-CHANGE STATE (live project cvdggspiudmudbbdkjrc, measured 2026-11-09 with
-- read-only catalog probes; each probe ended in RAISE EXCEPTION so nothing it
-- touched persisted)
--   1. Complete user-trigger inventory of the project: 14 triggers, of which the
--      financial_schema share is ONE:
--        FIN=[ escrow_records{rls=Y pol=1 trg=0}
--              financial_ledger_entries{rls=Y pol=0 trg=0}
--              payment_intents{rls=Y pol=1 trg=1}
--              settlement_requests{rls=Y pol=1 trg=0} ]
--      (trg counts exclude tgisinternal; the trg=1 on payment_intents is
--      trg_payment_intents_updated_at, a BEFORE UPDATE timestamp trigger, not an
--      audit trigger.)
--   2. Every function in the project whose name matches %audit%:
--        AUDITFN=[ app.audit_operational_delegation() ]
--      i.e. one audit trigger exists platform-wide, added by 043 for the I-2
--      delegation table itself. No financial table has ever had one.
--   3. RLS half of :407 is already satisfied: 4 of 4 financial tables carry
--      relrowsecurity = true, owned by postgres.
--   4. The audit target exists and is shaped for this: compliance_schema.audit_logs
--      (owner postgres, RLS on, 0 rows) with columns
--        id uuid NOT NULL DEFAULT uuid_generate_v4(), user_id uuid NULL,
--        action varchar(255) NOT NULL, resource_type varchar(100) NULL,
--        resource_id uuid NULL, ip_address inet NULL, user_agent text NULL,
--        result varchar(50) NULL, correlation_id uuid NULL,
--        created_at timestamptz NOT NULL DEFAULT now()
--      and exactly one policy, "I1 governance reads audit logs" FOR SELECT to
--      authenticated USING public.effective_user_role() IN ('ADMIN','SUPER_ADMIN')
--      (added by 046 Section B).
--   5. Nothing in the application writes that table:
--      grep -rn "audit_logs" web/src --include=*.ts  ->  zero matches.
--      So :407 was unimplemented in both halves (no trigger produces rows, and no
--      code path writes rows), which is why the table is empty.
--
-- THE CHANGE
--   One SECURITY DEFINER, search_path-pinned trigger function in financial_schema
--   and one AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW trigger on each of the
--   four financial tables, writing one audit_logs row per business-row change.
--   Field choices, and why each is the honest value rather than an invented one:
--     action        = '<INSERT|UPDATE|DELETE> ON <table>'  (TG_OP/TG_TABLE_NAME;
--                     column is varchar(255), the longest string produced here is
--                     under 50 characters)
--     resource_type = 'financial_schema.<table>'           (the affected entity's
--                     kind, per ESS-006 section 8 "affected entity")
--     resource_id   = NEW.id, or OLD.id for a DELETE (verified uuid on all four
--                     tables, matching the uuid column on audit_logs)
--     user_id       = auth.uid()                           (null for a service-role
--                     write, which is what it means: no end user is attributable)
--     result        = 'SUCCESS'                            (a trigger that fired
--                     cannot observe a failed statement; failures roll the whole
--                     transaction back, so no FAILED row is ever written)
--   created_at / id come from the column defaults. ip_address, user_agent and
--   correlation_id are deliberately left NULL: a database trigger has no request
--   context, and ESS-006 section 8's role/correlationId fields have no column to
--   go in (see "DOES NOT DO").
--   FOR EACH ROW AFTER: the row is certainly committed to the transaction before
--   its audit row is written, and DELETE can be audited (a BEFORE trigger would see
--   a row that may never be deleted).
--
-- WHY SECURITY DEFINER
--   compliance_schema.audit_logs carries owner-only privileges (relacl is NULL, so
--   only postgres has any right on it) and neither anon, authenticated nor
--   service_role can INSERT. An INVOKER trigger would therefore abort every
--   financial write with 42501 - which is the F-I2-17 failure class this increment
--   has already had to repair once. DEFINER owned by postgres lets the audit write
--   succeed from any caller while the audit table itself stays unwritable from
--   outside the trigger. This is the same containment 043 uses for
--   app.audit_operational_delegation() (043:142-146), including the identical
--   SET search_path = pg_catalog, public pin.
--   EXECUTE is then revoked from PUBLIC, anon and authenticated. PostgreSQL does
--   not check EXECUTE when a trigger fires, so containment costs the trigger
--   nothing; it only removes the RPC-reachable form of the function.
--
-- DOES NOT DO (each of these is reported as a finding, not silently widened)
--   * It does not add role/correlation_id columns to compliance_schema.audit_logs.
--     That table belongs to MOD-010, ESS-006 section 8's "role" field has no column
--     to live in, and inventing one on another module's table is the kind of scope
--     expansion the directive forbids. F-I2-22 records the coverage gap.
--   * It does not make audit rows readable. The 046 SELECT policy is currently
--     unreachable twice over: authenticated holds no SELECT on the table, and
--     compliance_schema is not an exposed PostgREST schema (live exposed set:
--     public, graphql_public). Granting SELECT would satisfy neither a policy
--     evaluation (no policy reads this table) nor a client path, so no privilege is
--     issued for it here - "do not grant broad privileges merely to make existing
--     operations work". F-I2-23 records the read path as MOD-010 work.
--   * It does not audit TRUNCATE (a statement-level trigger would be needed and no
--     migration in this project truncates a financial table).
--   * It does not restore the two BEFORE UPDATE timestamp triggers of 007 PART 6
--     that are not live on settlement_requests and financial_ledger_entries. That
--     repair is already authored as 034_restore_financial_updated_at_triggers.sql,
--     which declares itself "DRAFT - AWAITING LEAD ARCHITECT APPROVAL (SB-3 Stage
--     A)"; applying another workstream's gated draft is not I-2's to do. F-I2-21
--     records it. escrow_records has no timestamp trigger in any migration at all,
--     and communication_schema.notifications has none live either (031 is not
--     applied); both are reported, not changed.
--   * It does not touch financial_schema.contracts or platform_fee_config, which
--     are absent from the live project (005_contracts_and_escrow_rls and 030 are not
--     applied), nor any table outside the four measured members of financial_schema.
--
-- ROLLBACK (exact inverse, in reverse order)
--   DROP TRIGGER IF EXISTS trg_escrow_records_financial_audit       ON financial_schema.escrow_records;
--   DROP TRIGGER IF EXISTS trg_settlement_requests_financial_audit  ON financial_schema.settlement_requests;
--   DROP TRIGGER IF EXISTS trg_payment_intents_financial_audit      ON financial_schema.payment_intents;
--   DROP TRIGGER IF EXISTS trg_financial_ledger_entries_financial_audit ON financial_schema.financial_ledger_entries;
--   DROP FUNCTION IF EXISTS financial_schema.audit_financial_change();
--   DELETE FROM compliance_schema.audit_logs WHERE resource_type LIKE 'financial_schema.%';
--   (the final statement removes rows this migration's triggers produced; it is
--   owner-class, and is only needed if audit rows were created after the apply)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A - before-state guard. Nothing is created unless the measured
-- pre-change picture still holds: the four tables exist with uuid primary keys,
-- the audit target exists with the columns this trigger writes, and none of the
-- four audit triggers is already installed. An UNEXPECTED value aborts the
-- migration instead of guessing.
-- ----------------------------------------------------------------------------
DO $i2audit_pre$
DECLARE
  v_missing TEXT := '';
  v_bad     TEXT := '';
  v_exists  INT  := 0;
BEGIN
  IF to_regclass('compliance_schema.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'I2 AUDIT PRE: compliance_schema.audit_logs is absent; refusing to create triggers against an unknown audit target';
  END IF;

  SELECT count(*) INTO v_exists
    FROM pg_attribute a
   WHERE a.attrelid = 'compliance_schema.audit_logs'::regclass
     AND a.attname IN ('action','resource_type','resource_id','user_id','result')
     AND NOT a.attisdropped;
  IF v_exists <> 5 THEN
    RAISE EXCEPTION 'I2 AUDIT PRE: audit_logs is missing columns this trigger writes (found % of 5)', v_exists;
  END IF;

  IF (SELECT atttypid::regtype FROM pg_attribute
       WHERE attrelid = 'compliance_schema.audit_logs'::regclass AND attname = 'resource_id')::text <> 'uuid' THEN
    RAISE EXCEPTION 'I2 AUDIT PRE: audit_logs.resource_id is not uuid, so a business-row id would not type-check into it';
  END IF;

  SELECT string_agg(t.tbl, ', ') INTO v_missing
    FROM (VALUES ('financial_schema.escrow_records'), ('financial_schema.financial_ledger_entries'),
                 ('financial_schema.payment_intents'), ('financial_schema.settlement_requests')) t(tbl)
   WHERE to_regclass(t.tbl) IS NULL
      OR NOT EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = t.tbl::regclass AND a.attname = 'id'
                        AND a.atttypid = 'uuid'::regtype);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'I2 AUDIT PRE: financial table(s) [%] missing or lacking a uuid id column', v_missing;
  END IF;

  SELECT string_agg(c.relname, ', ') INTO v_bad
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE NOT tg.tgisinternal AND tg.tgname LIKE '%_financial_audit';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'I2 AUDIT PRE: audit triggers already installed on [%]; this migration has already run by another route', v_bad;
  END IF;
END
$i2audit_pre$;

-- ----------------------------------------------------------------------------
-- SECTION B - the audit trigger function.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION financial_schema.audit_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_entity_id UUID;
BEGIN
  -- PL/pgSQL leaves the opposite record unassigned for the operation: NEW is not
  -- assigned in a DELETE trigger and OLD is not assigned in an INSERT trigger, so
  -- COALESCE(NEW.id, OLD.id) would raise 'record "old" is not assigned yet' rather
  -- than evaluate to NULL. The row reference is selected per TG_OP instead.
  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
  ELSE
    v_entity_id := NEW.id;
  END IF;

  INSERT INTO compliance_schema.audit_logs (action, resource_type, resource_id, user_id, result)
  VALUES (
    TG_OP || ' ON ' || TG_TABLE_NAME,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    v_entity_id,
    auth.uid(),
    'SUCCESS'
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$fn$;

COMMENT ON FUNCTION financial_schema.audit_financial_change() IS
  'I-2 item 7 (ESS-006:407): writes one compliance_schema.audit_logs row per changed row of a financial table. SECURITY DEFINER because audit_logs is owner-only; EXECUTE is not granted to client roles because trigger firing does not require it.';

-- Privilege containment, per the 042/048 item-5 pattern. Not granted to
-- service_role either: no client calls this function.
REVOKE ALL ON FUNCTION financial_schema.audit_financial_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION financial_schema.audit_financial_change() FROM anon;
REVOKE ALL ON FUNCTION financial_schema.audit_financial_change() FROM authenticated;

-- ----------------------------------------------------------------------------
-- SECTION C - the four triggers. Idempotent by DROP IF EXISTS so the file can be
-- re-run after a partial apply.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_escrow_records_financial_audit ON financial_schema.escrow_records;
CREATE TRIGGER trg_escrow_records_financial_audit
  AFTER INSERT OR UPDATE OR DELETE ON financial_schema.escrow_records
  FOR EACH ROW EXECUTE FUNCTION financial_schema.audit_financial_change();

DROP TRIGGER IF EXISTS trg_settlement_requests_financial_audit ON financial_schema.settlement_requests;
CREATE TRIGGER trg_settlement_requests_financial_audit
  AFTER INSERT OR UPDATE OR DELETE ON financial_schema.settlement_requests
  FOR EACH ROW EXECUTE FUNCTION financial_schema.audit_financial_change();

DROP TRIGGER IF EXISTS trg_payment_intents_financial_audit ON financial_schema.payment_intents;
CREATE TRIGGER trg_payment_intents_financial_audit
  AFTER INSERT OR UPDATE OR DELETE ON financial_schema.payment_intents
  FOR EACH ROW EXECUTE FUNCTION financial_schema.audit_financial_change();

DROP TRIGGER IF EXISTS trg_financial_ledger_entries_financial_audit ON financial_schema.financial_ledger_entries;
CREATE TRIGGER trg_financial_ledger_entries_financial_audit
  AFTER INSERT OR UPDATE OR DELETE ON financial_schema.financial_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION financial_schema.audit_financial_change();

-- ----------------------------------------------------------------------------
-- SECTION D - post-change assertion. ESS-006:407 is satisfied only when each of
-- the four tables has RLS enabled AND exactly one row-level audit trigger bound to
-- the pinned definer function. Anything else aborts, so a silent partial apply
-- cannot be reported as complete.
-- ----------------------------------------------------------------------------
DO $i2audit_post$
DECLARE
  v_rec   RECORD;
  v_bad   TEXT := '';
  v_ok    INT  := 0;
BEGIN
  FOR v_rec IN
    SELECT c.relname                                AS tbl,
           c.relrowsecurity                         AS rls,
           (SELECT count(*) FROM pg_trigger tg
              WHERE tg.tgrelid = c.oid AND NOT tg.tgisinternal
                AND tg.tgname = 'trg_' || c.relname || '_financial_audit') AS at,
           (SELECT p.proname || '|def=' || p.prosecdef || '|cfg=' ||
                   COALESCE(array_to_string(p.proconfig, ','), 'NULL')
              FROM pg_trigger tg JOIN pg_proc p ON p.oid = tg.tgfoid
             WHERE tg.tgrelid = c.oid AND tg.tgname = 'trg_' || c.relname || '_financial_audit') AS fn
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'financial_schema' AND c.relkind = 'r'
     ORDER BY c.relname
  LOOP
    IF v_rec.rls IS NOT TRUE OR v_rec.at <> 1
       OR v_rec.fn IS DISTINCT FROM 'audit_financial_change|def=true|cfg=search_path=pg_catalog, public' THEN
      v_bad := v_bad || v_rec.tbl || '{rls=' || v_rec.rls || ' audit_triggers=' || v_rec.at
               || ' fn=' || COALESCE(v_rec.fn, 'NONE') || '} ';
    ELSE
      v_ok := v_ok + 1;
    END IF;
  END LOOP;

  IF v_bad <> '' THEN
    RAISE EXCEPTION 'I2 AUDIT POST: :407 not satisfied for [%]', v_bad;
  END IF;
  IF v_ok <> 4 THEN
    RAISE EXCEPTION 'I2 AUDIT POST: expected 4 compliant financial tables, found %', v_ok;
  END IF;
END
$i2audit_post$;
