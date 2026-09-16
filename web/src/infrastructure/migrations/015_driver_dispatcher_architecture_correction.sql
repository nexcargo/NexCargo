-- NexCargo Migration 015 -- Driver/Dispatcher Architecture Correction (Phase 3.2)
-- Authorized by HAO — Phase 3.2 Implementation Authorization
-- Purpose: Correct Driver authorization model and Dispatcher scoping infrastructure
--
-- Changes:
--   A. Add assigned_transporter_id to app.platform_roles (Dispatcher Transporter-scoped delegation)
--      - Nullable UUID FK → auth.users(id) ON DELETE SET NULL
--      - Existing unmapped Dispatcher remains unmapped (zero operational scope)
--      - Verification trigger ensures assigned_transporter has role='TRANSPORTER'
--   B. Make logistics_schema.drivers.fleet_id nullable (enable pending-association workflow)
--      - Drop NOT NULL constraint to allow Driver self-registration before Transporter association
--
-- Preserved:
--   - All existing platform_roles columns (user_id, role, assigned_by, assigned_at, etc.)
--   - assigned_by remains as audit/history column (NOT used for authorization scope)
--   - No new tables created
--   - No Tracking Phase 1 tables deployed (deferred to separate work)
--   - No Fleet Owner role introduced
--   - All existing RLS policies preserved until subsequent migration corrects scoping
--   - Compatibility identifiers preserved (UserRole.DRIVER, DashboardType.DRIVER, MobileRoleType.DRIVER)
--
-- Deferred:
--   - Role resolution correction (effective_user_role) — Migration 016
--   - RLS correction (Driver assignment + Dispatcher scoping) — Migration 017
--   - Assignment integrity enforcement — included here as validation function
--   - API authorization correction — handled in application code (separate)
--   - Frontend corrections — handled in application code (separate)

-- ============================================================
-- SECTION A: app.platform_roles — Add assigned_transporter_id
-- ============================================================

ALTER TABLE app.platform_roles ADD COLUMN IF NOT EXISTS assigned_transporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for quick Transporter-scope lookups by dispatcher user
CREATE INDEX IF NOT EXISTS idx_platform_roles_transporter_scope
  ON app.platform_roles(assigned_transporter_id) WHERE assigned_transporter_id IS NOT NULL;

-- Composite index for "find all dispatchers for a transporter" queries
CREATE INDEX IF NOT EXISTS idx_platform_roles_transporter_dispatchers
  ON app.platform_roles(user_id, assigned_transporter_id);

-- Validation function: ensure assigned_transporter actually has TRANSPORTER identity
-- This prevents accidentally assigning a SHIPPER or DRIVER as the delegation target
CREATE OR REPLACE FUNCTION app.validate_dispatcher_transporter_delegation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.assigned_transporter_id IS NOT NULL THEN
    -- Verify the assigned_transporter exists and has TRANSPORTER metadata role
    IF NOT EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = NEW.assigned_transporter_id
        AND au.raw_user_meta_data->>'role' = 'TRANSPORTER'
    ) THEN
      RAISE EXCEPTION 'assigned_transporter_id % must reference a user with TRANSPORTER identity', NEW.assigned_transporter_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_dispatcher_transporter_delegation ON app.platform_roles;
CREATE TRIGGER trg_validate_dispatcher_transporter_delegation
  BEFORE INSERT OR UPDATE OF assigned_transporter_id ON app.platform_roles
  FOR EACH ROW
  EXECUTE FUNCTION app.validate_dispatcher_transporter_delegation();

-- Deny public execution of validation function
REVOKE EXECUTE ON FUNCTION app.validate_dispatcher_transporter_delegation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.validate_dispatcher_transporter_delegation() TO authenticated;

-- ============================================================
-- SECTION B: logistics_schema.drivers — Make fleet_id nullable
-- ============================================================

-- Drop NOT NULL constraint on fleet_id to enable pending-association workflow
-- This allows Drivers to self-register without an immediate fleet assignment
ALTER TABLE logistics_schema.drivers ALTER COLUMN fleet_id DROP NOT NULL;

-- NOTE: FK constraint remains intact. fleet_id can be NULL (unassigned) but when present
-- must reference a valid logistics_schema.fleets(id).

-- ============================================================
-- SECTION C: Assignment integrity validation function
-- ============================================================

-- Validates that a vehicle and driver belong to the same Transporter's fleet
-- Returns true if same Transporter, false otherwise
-- Used by API layer and RLS policies to enforce cross-Transporter boundary
CREATE OR REPLACE FUNCTION logistics_schema.validate_same_transporter(
  p_vehicle_id UUID,
  p_driver_id UUID
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM logistics_schema.vehicles v
    JOIN logistics_schema.fleets fv ON fv.id = v.fleet_id
    JOIN logistics_schema.drivers d ON d.id = p_driver_id
    JOIN logistics_schema.fleets fd ON fd.id = d.fleet_id
    WHERE v.id = p_vehicle_id
      AND fv.ownerid = fd.ownerid
  );
$$;

-- Deny public execution
REVOKE EXECUTE ON FUNCTION logistics_schema.validate_same_transporter(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION logistics_schema.validate_same_transporter(UUID, UUID) TO authenticated;

-- ============================================================
-- SECTION D: Asset assignments — Add validation trigger
-- ============================================================

-- Trigger to prevent cross-Transporter assignments at database level
CREATE OR REPLACE FUNCTION logistics_schema.enforce_assignment_transporter_boundary()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner UUID;
  d_owner UUID;
BEGIN
  -- Only validate when both vehicle_id and driver_id are set
  IF NEW.vehicle_id IS NOT NULL AND NEW.driver_id IS NOT NULL THEN
    -- Get vehicle's fleet owner
    SELECT f.ownerid INTO v_owner
    FROM logistics_schema.vehicles v
    JOIN logistics_schema.fleets f ON f.id = v.fleet_id
    WHERE v.id = NEW.vehicle_id;

    -- Get driver's fleet owner
    SELECT f.ownerid INTO d_owner
    FROM logistics_schema.drivers d
    JOIN logistics_schema.fleets f ON f.id = d.fleet_id
    WHERE d.id = NEW.driver_id;

    IF v_owner IS NOT NULL AND d_owner IS NOT NULL AND v_owner != d_owner THEN
      RAISE EXCEPTION 'Cross-Transporter assignment not allowed: vehicle owned by %, driver owned by %', v_owner, d_owner;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_assignment_transporter_boundary ON logistics_schema.asset_assignments;
CREATE TRIGGER trg_enforce_assignment_transporter_boundary
  BEFORE INSERT OR UPDATE OF vehicle_id, driver_id ON logistics_schema.asset_assignments
  FOR EACH ROW
  EXECUTE FUNCTION logistics_schema.enforce_assignment_transporter_boundary();

-- Deny public execution
REVOKE EXECUTE ON FUNCTION logistics_schema.enforce_assignment_transporter_boundary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION logistics_schema.enforce_assignment_transporter_boundary() TO authenticated;
