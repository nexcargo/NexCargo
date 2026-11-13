-- ============================================================================
-- I-2 PART C ITEM 7 - the Driver association invariant enforced by the database.
-- Registered as NXC-I2-DB-011 (finding F-I2-24).
--
-- REQUIREMENT (verbatim)
--   "PROMPT 0 - NEXCARGO MASTER SYSTEM" v1.3:1148
--     "A Driver must always have an identifiable Transporter association.
--      A Driver without an authorising Transporter is not a valid platform state."
--   Item 7 exit criterion, docs/implementations/i2-security-authorization-
--   scope-statement.md:227
--     "... the Driver invariant enforced in the database rather than in
--      application code."
--   Directive rule: marketplace membership must not be inferred from ownership.
--
-- PRE-CHANGE STATE (live project cvdggspiudmudbbdkjrc, measured 2026-11-09)
--   1. logistics_schema.drivers is EMPTY (0 rows), and logistics_schema.fleets is
--      empty too, so this migration changes no existing row and blocks no
--      established data:
--        CNT fleets=0 drivers=0 orphan_drv=0
--   2. Column nullability measured from pg_attribute:
--        DRV=[ fleet_id=NULL, platform_user_id=NULL, created_by=NN ]
--      but the DDL that declares this table says otherwise:
--        012_fleets_and_assets_c7_003.sql:251  CREATE TABLE IF NOT EXISTS logistics_schema.drivers
--        012_fleets_and_assets_c7_003.sql:254  fleet_id UUID NOT NULL REFERENCES logistics_schema.fleets(id) ON DELETE CASCADE
--      So the live column has drifted away from its own migration, and the drift
--      is exactly the half of :1148 that says a Driver must have a fleet: a row
--      with fleet_id NULL is accepted by the database today.
--   3. Live constraints on the table are only CHECKs on the two status enums plus
--      three FKs (fleet_id -> fleets, created_by -> auth.users, platform_user_id ->
--      auth.users). Nothing anywhere in the live catalog asserts anything about the
--      FLEET'S OWNER:
--        fleets: ownerid UUID NOT NULL REFERENCES auth.users(id)      (012:173 shape)
--        fleets policies: "Transporter manages own fleets" FOR ALL
--                   USING/WITH CHECK (ownerid = auth.uid())           (ownership only)
--      The policy is NAMED for a Transporter but its predicate tests identity, not
--      membership. A SHIPPER session can therefore insert fleets and drivers under
--      its own auth.uid() and the database accepts the whole chain. That is the
--      "authorising Transporter" half of :1148 unenforced, and it is also the
--      inference the directive rule forbids.
--   4. Application-side, the repository does always supply a fleet:
--        fleet-repository.ts:464 createDriver(params: { ... fleetId: string ... })
--        fleet-repository.ts:484   fleet_id: params.fleetId
--      which is precisely the "enforced in application code" state :1148 rejects.
--      There is no POST /api/fleet/drivers route, so today nothing can be created
--      through the API at all; the invariant is unprotected for every non-API
--      writer (service-role, SQL console, future routes).
--
-- THE CHANGE
--   Two statements, one per half of the sentence in :1148.
--     A. fleet_id SET NOT NULL - repairs the live column to the shape 012 already
--        declares, so a Driver always has a fleet. No data risk: the column has no
--        NULLs to violate it because the table has no rows.
--     B. BEFORE INSERT OR UPDATE OF fleet_id trigger asserting that the referenced
--        fleet's ownerid holds role 'TRANSPORTER' in app.marketplace_memberships -
--        so the fleet belongs to a Transporter rather than merely to somebody.
--        Membership is read, never inferred from ownership, which is the directive
--        rule satisfied by construction.
--   UPDATE OF fleet_id (not plain UPDATE) so that editing a Driver's name, licence
--   or compliance note cannot fail because the fleet's owner lost membership after
--   the association was created. The invariant is asserted when the association is
--   made or changed, which is what :1148 describes. :1152 ("reassignment ...
--   requires authorisation and must be auditable") is satisfied because a
--   fleet_id change re-enters this trigger.
--   SECURITY DEFINER + pinned search_path, following 043:373's has_operational_scope
--   precedent. This is REQUIRED, not stylistic: app.marketplace_memberships grants
--   authenticated SELECT on its own row only (marketplace_memberships_self_select,
--   040:38), so an INVOKER trigger reading the fleet owner's membership row would
--   see nothing and reject every legitimate Driver - the F-I2-17 failure class this
--   increment already repaired once on app.platform_roles.
--   EXECUTE is revoked from PUBLIC and anon and is never granted to a client role:
--   trigger firing does not check EXECUTE.
--
-- BOUNDS - what this deliberately does not do
--   * It does not assert anything about fleets themselves. The mirror hole (a
--     SHIPPER can still create a fleet it will never be allowed to attach a Driver
--     to) is F-I2-25, reported with the recommended fix, because narrowing the
--     "Transporter manages own fleets" policy is a MOD-014 write-path change and
--     the directive forbids expanding item 7 into that module's surface.
--   * It does not add DRIVER provisioning. Part A of the directive places Driver
--     provisioning outside I-2; nothing here creates, seeds or migrates a Driver.
--   * It does not re-check existing rows: there are none (measured above), so a
--     backfill validation pass would be code for a case that cannot happen.
--   * It does not touch the drivers status enums. Note the pre-existing divergence
--     reported as F-I2-26: MOD-014:219 lists availabilityState
--     AVAILABLE / ASSIGNED / INACTIVE / SUSPENDED while the live CHECK is
--     AVAILABLE / ASSIGNED / OFF_DUTY / UNAVAILABLE.
--
-- ROLLBACK (exact inverse)
--   DROP TRIGGER IF EXISTS trg_drivers_transporter_association ON logistics_schema.drivers;
--   DROP FUNCTION IF EXISTS logistics_schema.assert_driver_transporter_association();
--   ALTER TABLE logistics_schema.drivers ALTER COLUMN fleet_id DROP NOT NULL;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A - before-state guard. Aborts rather than guessing if the measured
-- picture no longer holds: an existing Driver row that violates the invariant
-- would make SET NOT NULL fail mid-migration with a database error instead of a
-- stated reason, and a trigger already installed means this file ran by another
-- route.
-- ----------------------------------------------------------------------------
DO $i2drv_pre$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(d.driver_id, ', ') INTO v_bad
    FROM logistics_schema.drivers d
    LEFT JOIN logistics_schema.fleets f ON f.id = d.fleet_id
   WHERE d.fleet_id IS NULL
      OR f.id IS NULL
      OR NOT EXISTS (SELECT 1 FROM app.marketplace_memberships m
                      WHERE m.user_id = f.ownerid AND m.role = 'TRANSPORTER');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'I2 DRIVER INVARIANT PRE: existing Driver row(s) [%] already violate :1148; data remediation is not authorised in I-2, so this migration refuses to run', v_bad;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger tg
              WHERE tg.tgrelid = 'logistics_schema.drivers'::regclass
                AND NOT tg.tgisinternal AND tg.tgname = 'trg_drivers_transporter_association') THEN
    RAISE EXCEPTION 'I2 DRIVER INVARIANT PRE: trg_drivers_transporter_association is already installed';
  END IF;

  IF NOT has_column_privilege('logistics_schema.drivers', 'fleet_id', 'UPDATE') THEN
    RAISE EXCEPTION 'I2 DRIVER INVARIANT PRE: this role cannot alter fleet_id nullability';
  END IF;
END
$i2drv_pre$;

-- ----------------------------------------------------------------------------
-- SECTION B - :1148 first half. A Driver always references a fleet.
-- This restates the constraint 012:254 declares and the live column dropped.
-- ----------------------------------------------------------------------------
ALTER TABLE logistics_schema.drivers ALTER COLUMN fleet_id SET NOT NULL;

-- ----------------------------------------------------------------------------
-- SECTION C - :1148 second half. The fleet's owner is a Transporter, read from the
-- I-1 baseline membership table rather than inferred from the ownership link.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION logistics_schema.assert_driver_transporter_association()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_owner UUID;
BEGIN
  SELECT f.ownerid INTO v_owner
    FROM logistics_schema.fleets f
   WHERE f.id = NEW.fleet_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'NXC_ERR_DRIVER_NO_TRANSPORTER: fleet % does not exist', NEW.fleet_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM app.marketplace_memberships m
                  WHERE m.user_id = v_owner AND m.role = 'TRANSPORTER') THEN
    RAISE EXCEPTION 'NXC_ERR_DRIVER_NO_TRANSPORTER: driver % would belong to fleet % owned by %, which holds no TRANSPORTER marketplace membership (PROMPT 0 v1.3:1148)',
      NEW.driver_id, NEW.fleet_id, v_owner;
  END IF;

  RETURN NEW;
END
$fn$;

COMMENT ON FUNCTION logistics_schema.assert_driver_transporter_association() IS
  'I-2 item 7 (PROMPT 0 v1.3:1148): a Driver may only be associated with a fleet whose owner holds TRANSPORTER membership. SECURITY DEFINER because marketplace_memberships is readable by its own row only.';

REVOKE ALL ON FUNCTION logistics_schema.assert_driver_transporter_association() FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics_schema.assert_driver_transporter_association() FROM anon;

DROP TRIGGER IF EXISTS trg_drivers_transporter_association ON logistics_schema.drivers;
CREATE TRIGGER trg_drivers_transporter_association
  BEFORE INSERT OR UPDATE OF fleet_id ON logistics_schema.drivers
  FOR EACH ROW EXECUTE FUNCTION logistics_schema.assert_driver_transporter_association();

-- ----------------------------------------------------------------------------
-- SECTION D - post-change assertion. Both halves must be observable in the catalog
-- or the migration aborts, so a partial apply can never be reported as done.
-- ----------------------------------------------------------------------------
DO $i2drv_post$
DECLARE
  v_nn      BOOLEAN;
  v_fn      TEXT;
  v_cols    TEXT;
BEGIN
  SELECT attnotnull INTO v_nn
    FROM pg_attribute
   WHERE attrelid = 'logistics_schema.drivers'::regclass AND attname = 'fleet_id';
  IF v_nn IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'I2 DRIVER INVARIANT POST: fleet_id is still nullable';
  END IF;

  SELECT p.proname || '|def=' || p.prosecdef || '|cfg=' ||
         COALESCE(array_to_string(p.proconfig, ','), 'NULL') INTO v_fn
    FROM pg_trigger tg JOIN pg_proc p ON p.oid = tg.tgfoid
   WHERE tg.tgrelid = 'logistics_schema.drivers'::regclass
     AND tg.tgname = 'trg_drivers_transporter_association';
  IF v_fn IS DISTINCT FROM 'assert_driver_transporter_association|def=true|cfg=search_path=pg_catalog, public' THEN
    RAISE EXCEPTION 'I2 DRIVER INVARIANT POST: trigger binding is %', COALESCE(v_fn, 'MISSING');
  END IF;

  -- The trigger must be row-level, fire on INSERT and on UPDATE OF fleet_id. The
  -- column restriction is asserted from pg_get_triggerdef() rather than from
  -- pg_trigger.tgargs, because tgargs arrives as an empty hex literal through this
  -- driver and cannot be compared as a text array. A name or compliance-note edit
  -- must not fail on a membership the owner held when the association was made, so
  -- "UPDATE OF fleet_id" and not plain "UPDATE" is the required shape.
  SELECT pg_get_triggerdef(tg.oid) INTO v_cols
    FROM pg_trigger tg WHERE tg.tgrelid = 'logistics_schema.drivers'::regclass
     AND tg.tgname = 'trg_drivers_transporter_association';
  IF v_cols IS NULL OR v_cols NOT LIKE 'CREATE TRIGGER%'
     OR v_cols NOT LIKE '%BEFORE INSERT OR UPDATE OF fleet_id%'
     OR v_cols NOT LIKE '%FOR EACH ROW%' THEN
    RAISE EXCEPTION 'I2 DRIVER INVARIANT POST: trigger definition is not the required BEFORE INSERT OR UPDATE OF fleet_id FOR EACH ROW: %', COALESCE(v_cols, 'MISSING');
  END IF;
END
$i2drv_post$;
