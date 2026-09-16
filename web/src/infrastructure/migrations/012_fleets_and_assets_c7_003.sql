-- NexCargo Migration — Fleet & Asset Registry (C7-Increment 003 / MOD-014)
-- Creates 6 tables in logistics_schema for MOD-014 fleet and asset persistence layer.
-- Also creates shipment_tracking_records (dependency for asset_assignments FK) if missing.
--
-- Owner: MOD-014 Fleet & Asset Registry Module
-- Scope: Database persistence + RLS policies only
-- Does NOT modify module.config.ts (Track B frozen state preserved per HAO authorization).
-- Does NOT replace or compete with MOD-002 driver_assignments operational assignment table.
-- Does NOT modify tracking states (MOD-003 authority).
-- Does NOT dispatch vehicles, assign loads, or execute operational decisions.
--
-- Tables:
--   0. shipment_tracking_records     — Tracking record foundation (IF MISSING — FK dependency)
--   1. fleets                        — Transporter-owned fleet registry per MOD-014 §4.1
--   2. vehicles                      — Vehicle asset registry per MOD-014 §4.2
--   3. drivers                       — Driver entity representation per MOD-014 §4.3
--   4. asset_assignments             — Transporter internal assignment registry per MOD-014 §4.4
--   5. cross_border_compliance_records — Compliance declarations per MOD-014 §4.5
--   6. backhaul_opportunities        — Backhaul optimization opportunities per MOD-014 §4.6
--
-- Notes:
--   - All tables use UUID primary keys consistent with BaseEntity convention.
--   - Fleet ownership tied to auth.users(id) via ownerId — the owner must have TRANSPORTER role.
--   - asset_assignments is a separate transporter-owned registry; MOD-002 owns driver_assignments.
--   - corridor_id uses VARCHAR(50) provisionally (MOD-009 design-time only, no concrete corridor table).
--   - platform_user_id on drivers is nullable — external/contract drivers may not have auth accounts.
--   - RLS policies follow established convention from migrations 011 and C7-001 Phase 1.
--   - shipment_tracking_records created only if it does NOT already exist (lazy creation).

-- ============================================================
-- 0. DEPENDENCY: shipment_tracking_records
-- Required FK target for asset_assignments.shipment_tracking_id.
-- Created here only if not already present (lazy creation pattern).
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.shipment_tracking_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_ref VARCHAR(50) NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES logistics_schema.bookings(id),
  contract_id UUID REFERENCES logistics_schema.contracts(id),
  status VARCHAR(20) NOT NULL DEFAULT 'CREATED'::VARCHAR,
  visibility_level VARCHAR(20) NOT NULL DEFAULT 'RESTRICTED'::VARCHAR,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_records_booking ON logistics_schema.shipment_tracking_records(booking_id);
CREATE INDEX idx_tracking_records_status ON logistics_schema.shipment_tracking_records(status);
CREATE INDEX idx_tracking_records_contract ON logistics_schema.shipment_tracking_records(contract_id);

ALTER TABLE logistics_schema.shipment_tracking_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipper reads own tracking records"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  USING (
    id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.shipper_id = auth.uid()
    )
  );

CREATE POLICY "Transporter reads own tracking records"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  USING (
    id IN (
      SELECT tr.id FROM logistics_schema.shipment_tracking_records tr
      JOIN logistics_schema.bookings b ON b.id = tr.booking_id
      WHERE b.transporter_id = auth.uid()
    )
  );

CREATE POLICY "Dispatcher reads all tracking records"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Admin/SuperAdmin reads all tracking records"
  ON logistics_schema.shipment_tracking_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- ============================================================
-- 1. fleets — Transporter-owned fleet registry
-- Per MOD-014 §4.1: unique identifier, linked to transporter account
-- Business rules: Fleets must be linked to verified transporter accounts (MOD-010).
-- Each asset must be uniquely registered and linked to a fleet.
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  region VARCHAR(100),
  ownerId UUID NOT NULL REFERENCES auth.users(id),
  operational_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'::VARCHAR
    CHECK (operational_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fleets_owner ON logistics_schema.fleets(ownerId);
CREATE INDEX idx_fleets_operational_status ON logistics_schema.fleets(operational_status);

ALTER TABLE logistics_schema.fleets ENABLE ROW LEVEL SECURITY;

-- TRANSPORTER: full CRUD on own fleets
CREATE POLICY "Transporter manages own fleets"
  ON logistics_schema.fleets FOR ALL
  USING (ownerId = auth.uid())
  WITH CHECK (ownerId = auth.uid());

-- DISPATCHER/MODERATOR: read all fleets
CREATE POLICY "Platform team reads all fleets"
  ON logistics_schema.fleets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin: full CRUD access
CREATE POLICY "Admin superadmin full fleet access"
  ON logistics_schema.fleets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );


-- ============================================================
-- 2. vehicles — Vehicle asset registry
-- Per MOD-014 §4.2: physical logistics vehicle attributes
-- Business rules: Assets uniquely registered, statuses declared by transporter.
-- Mozambique nationwide licensing rule (§7.6): licencesValidNationwide flag.
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id VARCHAR(100) NOT NULL UNIQUE,
  fleet_id UUID NOT NULL REFERENCES logistics_schema.fleets(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('HEAVY_TRUCK', 'LIGHT_DELIVERY', 'TRAILER', 'REFRIGERATED', 'SPECIALISED')),
  registration_number VARCHAR(50) NOT NULL,
  capacity_weight_kg NUMERIC(10,2) NOT NULL CHECK (capacity_weight_kg > 0),
  capacity_volume_m3 NUMERIC(8,2),
  availability_state VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'::VARCHAR
    CHECK (availability_state IN ('AVAILABLE', 'ASSIGNED', 'INACTIVE', 'MAINTENANCE', 'SUSPENDED')),
  insurance_provider VARCHAR(200),
  insurance_policy_number VARCHAR(100),
  insurance_valid_until TIMESTAMPTZ,
  licence_jurisdiction VARCHAR(100),
  licences_valid_nationwide BOOLEAN NOT NULL DEFAULT FALSE,
  cross_border_permit_status VARCHAR(30) NOT NULL DEFAULT 'NONE'::VARCHAR
    CHECK (cross_border_permit_status IN ('NONE', 'TEMPORARY_OBTAINABLE', 'PRE_EXISTING')),
  compliance_notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicles_fleet ON logistics_schema.vehicles(fleet_id);
CREATE INDEX idx_vehicles_type ON logistics_schema.vehicles(type);
CREATE INDEX idx_vehicles_availability ON logistics_schema.vehicles(availability_state);
CREATE INDEX idx_vehicles_registration ON logistics_schema.vehicles(registration_number);

ALTER TABLE logistics_schema.vehicles ENABLE ROW LEVEL SECURITY;

-- TRANSPORTER: CRUD on vehicles belonging to their fleets
CREATE POLICY "Transporter manages own fleet vehicles"
  ON logistics_schema.vehicles FOR ALL
  USING (
    id IN (
      SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
    )
  );

-- DISPATCHER/MODERATOR: read all vehicles
CREATE POLICY "Platform team reads all vehicles"
  ON logistics_schema.vehicles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin: full CRUD override
CREATE POLICY "Admin superadmin full vehicle access"
  ON logistics_schema.vehicles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );


-- ============================================================
-- 3. drivers — Driver entity representation
-- Per MOD-014 §4.3: logistics operator identity and eligibility
-- Business rules: Drivers linked to verified fleet.
-- External/contract drivers may not have auth.users account (platform_user_id nullable).
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id VARCHAR(100) NOT NULL UNIQUE,
  fleet_id UUID NOT NULL REFERENCES logistics_schema.fleets(id) ON DELETE CASCADE,
  platform_user_id UUID REFERENCES auth.users(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  license_type VARCHAR(50),
  license_number VARCHAR(100),
  license_expiry_date DATE,
  certification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'::VARCHAR
    CHECK (certification_status IN ('VERIFIED', 'PENDING', 'EXPIRED', 'SUSPENDED')),
  availability_state VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'::VARCHAR
    CHECK (availability_state IN ('AVAILABLE', 'ASSIGNED', 'OFF_DUTY', 'UNAVAILABLE')),
  contact_number VARCHAR(30),
  compliance_notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_drivers_fleet ON logistics_schema.drivers(fleet_id);
CREATE INDEX idx_drivers_platform_user ON logistics_schema.drivers(platform_user_id);
CREATE INDEX idx_drivers_certification ON logistics_schema.drivers(certification_status);
CREATE INDEX idx_drivers_availability ON logistics_schema.drivers(availability_state);

ALTER TABLE logistics_schema.drivers ENABLE ROW LEVEL SECURITY;

-- TRANSPORTER: CRUD on drivers belonging to their fleets
CREATE POLICY "Transporter manages own fleet drivers"
  ON logistics_schema.drivers FOR ALL
  USING (
    id IN (
      SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
    )
  );

-- DRIVER role: view own profile (when linked via platform_user_id)
CREATE POLICY "Driver views own profile"
  ON logistics_schema.drivers FOR SELECT
  USING (platform_user_id = auth.uid());

-- DISPATCHER/MODERATOR: read all drivers
CREATE POLICY "Platform team reads all drivers"
  ON logistics_schema.drivers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin: full CRUD override
CREATE POLICY "Admin superadmin full driver access"
  ON logistics_schema.drivers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );


-- ============================================================
-- 4. asset_assignments — Transporter internal assignment registry
-- Per MOD-014 §4.4: linkage between assets and shipment assignments
-- This is a SEPARATE table from MOD-002's driver_assignments.
-- MOD-002 owns operational assignment writes (HAO D-7 decision).
-- MOD-014 records transporter's internal assignment decisions.
-- No double-booking of vehicles or drivers (§7.3 State Integrity Rule).
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id VARCHAR(100) NOT NULL UNIQUE,
  vehicle_id UUID REFERENCES logistics_schema.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES logistics_schema.drivers(id) ON DELETE SET NULL,
  shipment_tracking_id UUID NOT NULL REFERENCES logistics_schema.shipment_tracking_records(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED'::VARCHAR
    CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Constraint: at least one of vehicle_id OR driver_id must be present
ALTER TABLE logistics_schema.asset_assignments ADD CONSTRAINT chk_assignment_has_asset
  CHECK (vehicle_id IS NOT NULL OR driver_id IS NOT NULL);

CREATE INDEX idx_asset_assignments_vehicle ON logistics_schema.asset_assignments(vehicle_id);
CREATE INDEX idx_asset_assignments_driver ON logistics_schema.asset_assignments(driver_id);
CREATE INDEX idx_asset_assignments_shipment ON logistics_schema.asset_assignments(shipment_tracking_id);
CREATE INDEX idx_asset_assignments_status ON logistics_schema.asset_assignments(status);

ALTER TABLE logistics_schema.asset_assignments ENABLE ROW LEVEL SECURITY;

-- TRANSPORTER: CRUD on assignments for their fleet's vehicles/drivers
CREATE POLICY "Transporter manages own fleet assignments"
  ON logistics_schema.asset_assignments FOR ALL
  USING (
    (vehicle_id IS NOT NULL AND vehicle_id IN (
      SELECT v.id FROM logistics_schema.vehicles v
      JOIN logistics_schema.fleets f ON f.id = v.fleet_id WHERE f.ownerId = auth.uid()
    ))
    OR
    (driver_id IS NOT NULL AND driver_id IN (
      SELECT d.id FROM logistics_schema.drivers d
      JOIN logistics_schema.fleets f ON f.id = d.fleet_id WHERE f.ownerId = auth.uid()
    ))
  )
  WITH CHECK (
    (vehicle_id IS NOT NULL AND vehicle_id IN (
      SELECT v.id FROM logistics_schema.vehicles v
      JOIN logistics_schema.fleets f ON f.id = v.fleet_id WHERE f.ownerId = auth.uid()
    ))
    OR
    (driver_id IS NOT NULL AND driver_id IN (
      SELECT d.id FROM logistics_schema.drivers d
      JOIN logistics_schema.fleets f ON f.id = d.fleet_id WHERE f.ownerId = auth.uid()
    ))
  );

-- DRIVER role: view assignments where they are assigned
CREATE POLICY "Driver views own assignments"
  ON logistics_schema.asset_assignments FOR SELECT
  USING (
    driver_id = auth.uid()
  );

-- DISPATCHER/MODERATOR: read all assignments
CREATE POLICY "Platform team reads all assignments"
  ON logistics_schema.asset_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- DISPATCHER/Admin/SuperAdmin: manage all assignments
CREATE POLICY "Dispatcher admin manage assignments"
  ON logistics_schema.asset_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin: full override
CREATE POLICY "Admin superadmin full assignment access"
  ON logistics_schema.asset_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );


-- ============================================================
-- 5. cross_border_compliance_records — Cross-border compliance
-- Per MOD-014 §4.5: declared compliance for cross-border corridors
-- Note: corridor_id is VARCHAR(50) provisional type per D-S2B-002 condition.
-- MOD-009 has no concrete corridor table yet (design-time only Wave 4).
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.cross_border_compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id VARCHAR(100) NOT NULL UNIQUE,
  vehicle_id UUID NOT NULL REFERENCES logistics_schema.vehicles(id) ON DELETE CASCADE,
  corridor_id VARCHAR(50),
  country_code VARCHAR(10) NOT NULL,
  permit_type VARCHAR(30) NOT NULL CHECK (permit_type IN ('INSURANCE', 'TRANSPORT_PERMIT', 'CUSTOMS_BOND', 'OPERATING_LICENSE')),
  permit_number VARCHAR(100),
  issue_date DATE,
  expiry_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'VALID'::VARCHAR
    CHECK (status IN ('VALID', 'EXPIRING', 'EXPIRED', 'PENDING_RENEWAL')),
  temporary_permit BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_compliance_vehicle ON logistics_schema.cross_border_compliance_records(vehicle_id);
CREATE INDEX idx_compliance_country ON logistics_schema.cross_border_compliance_records(country_code);
CREATE INDEX idx_compliance_status ON logistics_schema.cross_border_compliance_records(status);
CREATE INDEX idx_compliance_expiry ON logistics_schema.cross_border_compliance_records(expiry_date) WHERE expiry_date IS NOT NULL;

ALTER TABLE logistics_schema.cross_border_compliance_records ENABLE ROW LEVEL SECURITY;

-- TRANSPORTER: CRUD on compliance records for their fleet vehicles
CREATE POLICY "Transporter manages own fleet compliance"
  ON logistics_schema.cross_border_compliance_records FOR ALL
  USING (
    vehicle_id IN (
      SELECT v.id FROM logistics_schema.vehicles v
      JOIN logistics_schema.fleets f ON f.id = v.fleet_id WHERE f.ownerId = auth.uid()
    )
  )
  WITH CHECK (
    vehicle_id IN (
      SELECT v.id FROM logistics_schema.vehicles v
      JOIN logistics_schema.fleets f ON f.id = v.fleet_id WHERE f.ownerId = auth.uid()
    )
  );

-- DRIVER role: view compliance records for vehicles they operate
CREATE POLICY "Driver views vehicle compliance"
  ON logistics_schema.cross_border_compliance_records FOR SELECT
  USING (
    vehicle_id IN (
      SELECT a.vehicle_id FROM logistics_schema.asset_assignments a
      WHERE a.driver_id = auth.uid() AND a.status != 'CANCELLED'
    )
  );

-- DISPATCHER/MODERATOR: read all compliance records
CREATE POLICY "Platform team reads all compliance records"
  ON logistics_schema.cross_border_compliance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin: full CRUD override
CREATE POLICY "Admin superadmin full compliance access"
  ON logistics_schema.cross_border_compliance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );


-- ============================================================
-- 6. backhaul_opportunities — Backhaul optimization
-- Per MOD-014 §4.6: empty backhaul optimisation structure
-- Advisory-only: AI suggestions from MOD-006 are non-binding.
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.backhaul_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id VARCHAR(100) NOT NULL UNIQUE,
  fleet_id UUID NOT NULL REFERENCES logistics_schema.fleets(id) ON DELETE CASCADE,
  shipment_tracking_id UUID NOT NULL REFERENCES logistics_schema.shipment_tracking_records(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES logistics_schema.vehicles(id) ON DELETE RESTRICT,
  current_location TEXT,
  destination TEXT,
  return_route TEXT,
  suggested_load_id UUID,
  estimated_cost_recovery_pct NUMERIC(5,2) CHECK (estimated_cost_recovery_pct >= 0 AND estimated_cost_recovery_pct <= 100),
  status VARCHAR(20) NOT NULL DEFAULT 'IDENTIFIED'::VARCHAR
    CHECK (status IN ('IDENTIFIED', 'MATCHED', 'DECLINED', 'BOOKED')),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_backhaul_fleet ON logistics_schema.backhaul_opportunities(fleet_id);
CREATE INDEX idx_backhaul_shipment ON logistics_schema.backhaul_opportunities(shipment_tracking_id);
CREATE INDEX idx_backhaul_vehicle ON logistics_schema.backhaul_opportunities(vehicle_id);
CREATE INDEX idx_backhaul_status ON logistics_schema.backhaul_opportunities(status);

ALTER TABLE logistics_schema.backhaul_opportunities ENABLE ROW LEVEL SECURITY;

-- TRANSPORTER: CRUD on backhaul opportunities for their fleets
CREATE POLICY "Transporter manages own fleet backhaul"
  ON logistics_schema.backhaul_opportunities FOR ALL
  USING (fleet_id IN (
    SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
  ))
  WITH CHECK (fleet_id IN (
    SELECT f.id FROM logistics_schema.fleets f WHERE f.ownerId = auth.uid()
  ));

-- DISPATCHER/MODERATOR: read all backhaul opportunities
CREATE POLICY "Platform team reads all backhaul"
  ON logistics_schema.backhaul_opportunities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin: full CRUD override
CREATE POLICY "Admin superadmin full backhaul access"
  ON logistics_schema.backhaul_opportunities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );
