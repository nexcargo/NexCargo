-- ============================================================
-- MOD-009 — Regional & Cross-Border Logistics Reference Foundation
-- Minimal Mozambique-First Model
-- HAO Authorization: Minimal MOD-009 reference-data foundation
--
-- Creates:
--   1. logistics_schema.regions (9 columns) — country-level reference
--   2. logistics_schema.logistics_corridors (12 columns) — route reference
--   3. Seeds 7 regions: MZ, ZA, ZW, MW, ZM, SZ, BW
--   4. Seeds 3 corridors: BEIRA, NACALA, MAPUTO
--   5. Reconciles corridor_id in existing tables to UUID canonical identity
--
-- NOT authorized by this migration:
--   - CrossBorderShipmentSegment persistence
--   - BorderTransitionEvent persistence
--   - CountryComplianceProfile
--   - PostGIS, routing engines, AI optimisation
--   - Any UI, mobile, C8 work
--   - North-South Corridor (deferred pending DRC/CD addition)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'logistics_schema' AND tablename = 'regions') THEN
    -- ============================================================
    -- 1. regions — Country-level geographic reference
    -- Region represents a country per MOD-009 adjudication.
    -- No internal geography (provinces/districts) at this stage.
    -- ============================================================

    CREATE TABLE logistics_schema.regions (
      region_id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
      name              VARCHAR(200)     NOT NULL,
      country_code      CHAR(2)          NOT NULL UNIQUE CHECK (country_code ~ '^[A-Z]{2}$'),
      active_status     BOOLEAN          NOT NULL DEFAULT true,
      default_language  CHAR(2)          NOT NULL DEFAULT 'pt' CHECK (default_language IN ('pt', 'en')),
      supported_languages TEXT[]         NOT NULL DEFAULT '{pt,en}',
      currency_code     CHAR(3)          NOT NULL CHECK (currency_code IN ('MZN', 'ZAR', 'USD')),
      created_at        TIMESTAMPTZ      NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ      NOT NULL DEFAULT now()
    );

    RAISE NOTICE 'Created logistics_schema.regions (9 columns)';
  ELSE
    RAISE NOTICE 'Skipping logistics_schema.regions — already exists';
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'logistics_schema' AND tablename = 'logistics_corridors') THEN
    -- ============================================================
    -- 2. logistics_corridors — Predefined logistics route reference
    -- UUID canonical corridor identity with human-readable unique code.
    -- intermediate_region_ids: UUID[] (unsorted set; directionality
    -- via origin→destination encodes traversal order).
    -- FK references ensure referential integrity.
    -- ============================================================

    CREATE TABLE logistics_schema.logistics_corridors (
      corridor_id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
      code                      VARCHAR(50)       NOT NULL UNIQUE CHECK (code ~ '^[A-Z_][A-Z0-9_]*$'),
      name                      VARCHAR(200)      NOT NULL,
      origin_region_id          UUID              NOT NULL REFERENCES logistics_schema.regions(region_id) ON DELETE RESTRICT,
      destination_region_id     UUID              NOT NULL REFERENCES logistics_schema.regions(region_id) ON DELETE RESTRICT,
      intermediate_region_ids   UUID[]            NOT NULL DEFAULT '{}',
      permitted_transport_modes TEXT[]            NOT NULL,
      risk_level                VARCHAR(10)       NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
      operational_rules         JSONB             NOT NULL DEFAULT '{}'::jsonb,
      active_status             BOOLEAN           NOT NULL DEFAULT true,
      average_transit_time_days INTEGER           NOT NULL DEFAULT 0 CHECK (average_transit_time_days >= 0),
      created_at                TIMESTAMPTZ       NOT NULL DEFAULT now(),
      updated_at                TIMESTAMPTZ       NOT NULL DEFAULT now()
    );

    -- Unique constraint prevents duplicate corridor codes between same region pair
    ALTER TABLE logistics_schema.logistics_corridors
      ADD CONSTRAINT uq_corridor_origin_dest_code UNIQUE (origin_region_id, destination_region_id, code);

    RAISE NOTICE 'Created logistics_schema.logistics_corridors (12 columns + constraints)';
  ELSE
    RAISE NOTICE 'Skipping logistics_schema.logistics_corridors — already exists';
  END IF;
END $$;


-- ============================================================
-- 3. Indexes for logistics_corridors
-- ============================================================

-- Composite index for route-matching queries (find corridors by origin+dest)
CREATE INDEX IF NOT EXISTS idx_corridor_origin_dest
  ON logistics_schema.logistics_corridors (origin_region_id, destination_region_id);

-- Filter active corridors quickly
CREATE INDEX IF NOT EXISTS idx_corridor_active
  ON logistics_schema.logistics_corridors (active_status);

-- GIN index for "contains region X" queries on intermediate array
CREATE INDEX IF NOT EXISTS idx_corridor_intermediates
  ON logistics_schema.logistics_corridors USING gin (intermediate_region_ids);


-- ============================================================
-- 4. Row Level Security — regions
-- ============================================================

ALTER TABLE logistics_schema.regions ENABLE ROW LEVEL SECURITY;

-- Admin/SuperAdmin: full CRUD
CREATE POLICY IF NOT EXISTS "Admin/superadmin full region access"
  ON logistics_schema.regions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM app.platform_roles pr
    WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.platform_roles pr
    WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
  ));

-- All authenticated users: read regions for lookup/context
CREATE POLICY IF NOT EXISTS "All authenticated users read regions"
  ON logistics_schema.regions FOR SELECT
  USING (active_status = true);


-- ============================================================
-- 5. Row Level Security — logistics_corridors
-- ============================================================

ALTER TABLE logistics_schema.logistics_corridors ENABLE ROW LEVEL SECURITY;

-- Admin/SuperAdmin: full CRUD
CREATE POLICY IF NOT EXISTS "Admin/superadmin full corridor access"
  ON logistics_schema.logistics_corridors FOR ALL
  USING (EXISTS (
    SELECT 1 FROM app.platform_roles pr
    WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.platform_roles pr
    WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
  ));

-- All authenticated users: read active corridors for assignment/display
CREATE POLICY IF NOT EXISTS "All authenticated users read corridors"
  ON logistics_schema.logistics_corridors FOR SELECT
  USING (active_status = true);


-- ============================================================
-- 6. Seed data — 7 countries
-- Currency convention:
--   MZ → MZN (primary operating country)
--   ZA → ZAR (southern cross-border connection)
--   SZ → ZAR (Maputo Corridor intermediate)
--   ZW, MW, ZM, BW → USD (other currently supported countries)
-- ============================================================

INSERT INTO logistics_schema.regions (region_id, name, country_code, default_language, supported_languages, currency_code)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Mozambique',    'MZ', 'pt', '{pt,en}', 'MZN'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'South Africa',  'ZA', 'en', '{pt,en}', 'ZAR'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Zimbabwe',      'ZW', 'en', '{pt,en}', 'USD'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Malawi',        'MW', 'en', '{pt,en}', 'USD'),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'Zambia',        'ZM', 'en', '{pt,en}', 'USD'),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'Eswatini',      'SZ', 'en', '{pt,en}', 'ZAR'),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'Botswana',      'BW', 'en', '{pt,en}', 'USD')
ON CONFLICT (country_code) DO NOTHING;

DO $$
DECLARE
  mz_id    UUID := 'a1b2c3d4-0001-4000-8000-000000000001';
  za_id    UUID := 'a1b2c3d4-0002-4000-8000-000000000002';
  zw_id    UUID := 'a1b2c3d4-0003-4000-8000-000000000003';
  mw_id    UUID := 'a1b2c3d4-0004-4000-8000-000000000004';
  zm_id    UUID := 'a1b2c3d4-0005-4000-8000-000000000005';
  sz_id    UUID := 'a1b2c3d4-0006-4000-8000-000000000006';
  bw_id    UUID := 'a1b2c3d4-0007-4000-8000-000000000007';
BEGIN
-- ============================================================
-- 6. Row Level Security — regions
-- ============================================================

ALTER TABLE logistics_schema.regions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'regions' AND schemaname = 'logistics_schema' AND policyname = 'Admin/superadmin full region access'
  ) THEN
    CREATE POLICY "Admin/superadmin full region access"
      ON logistics_schema.regions FOR ALL
      USING (EXISTS (
        SELECT 1 FROM app.platform_roles pr
        WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM app.platform_roles pr
        WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'regions' AND schemaname = 'logistics_schema' AND policyname = 'All authenticated users read regions'
  ) THEN
    CREATE POLICY "All authenticated users read regions"
      ON logistics_schema.regions FOR SELECT
      USING (active_status = true);
  END IF;
END $$;


-- ============================================================
-- 7. Row Level Security — logistics_corridors
-- ============================================================

ALTER TABLE logistics_schema.logistics_corridors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'logistics_corridors' AND schemaname = 'logistics_schema' AND policyname = 'Admin/superadmin full corridor access'
  ) THEN
    CREATE POLICY "Admin/superadmin full corridor access"
      ON logistics_schema.logistics_corridors FOR ALL
      USING (EXISTS (
        SELECT 1 FROM app.platform_roles pr
        WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM app.platform_roles pr
        WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'logistics_corridors' AND schemaname = 'logistics_schema' AND policyname = 'All authenticated users read corridors'
  ) THEN
    CREATE POLICY "All authenticated users read corridors"
      ON logistics_schema.logistics_corridors FOR SELECT
      USING (active_status = true);
  END IF;
END $$;


-- ============================================================
-- 8. Corridor ID reconciliation — cross_border_compliance_records
-- Change VARCHAR(50) → UUID with FK to canonical corridor table.
-- Preserves nullability (no existing rows — count is 0).
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'logistics_schema'
      AND table_name = 'cross_border_compliance_records'
      AND column_name = 'corridor_id'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE logistics_schema.cross_border_compliance_records
      ALTER COLUMN corridor_id TYPE UUID USING NULL;

    ALTER TABLE logistics_schema.cross_border_compliance_records
      ADD CONSTRAINT cross_border_compliance_records_corridor_id_fkey
      FOREIGN KEY (corridor_id) REFERENCES logistics_schema.logistics_corridors(corridor_id)
      ON DELETE SET NULL;

    RAISE NOTICE 'Reconciled cross_border_compliance_records.corridor_id: VARCHAR(50) -> UUID with FK';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'cross_border_compliance_records'
      AND a.attname = 'corridor_id'
      AND c.confrelid = (SELECT oid FROM pg_class WHERE relname = 'logistics_corridors')
  ) THEN
    ALTER TABLE logistics_schema.cross_border_compliance_records
      ADD CONSTRAINT cross_border_compliance_records_corridor_id_fkey
      FOREIGN KEY (corridor_id) REFERENCES logistics_schema.logistics_corridors(corridor_id)
      ON DELETE SET NULL;
    RAISE NOTICE 'Added FK to cross_border_compliance_records.corridor_id (type already UUID)';
  ELSE
    RAISE NOTICE 'cross_border_compliance_records.corridor_id already reconciled (UUID + FK)';
  END IF;
END $$;


-- ============================================================
-- 9. Corridor ID reconciliation — shipments
-- Add FK constraint to shipments.corridor_id (already UUID, nullable).
-- Does not change column type.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'logistics_schema'
      AND table_name = 'shipments'
      AND column_name = 'corridor_id'
      AND data_type = 'uuid'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE t.relname = 'shipments'
        AND a.attname = 'corridor_id'
        AND c.confrelid = (SELECT oid FROM pg_class WHERE relname = 'logistics_corridors')
    ) THEN
      ALTER TABLE logistics_schema.shipments
        ADD CONSTRAINT shipments_corridor_id_fkey
        FOREIGN KEY (corridor_id) REFERENCES logistics_schema.logistics_corridors(corridor_id)
        ON DELETE SET NULL;
      RAISE NOTICE 'Added FK constraint to shipments.corridor_id';
    ELSE
      RAISE NOTICE 'shipments.corridor_id FK already exists';
    END IF;
  ELSE
    RAISE NOTICE 'shipments.corridor_id column type mismatch or missing';
  END IF;
END $$;


-- ============================================================
-- Verification queries (uncomment to run after migration):
--
-- SELECT country_code, name, currency_code FROM logistics_schema.regions ORDER BY country_code;
--
-- SELECT code, name,
--   o.name AS origin, d.name AS destination
--   FROM logistics_schema.logistics_corridors lc
--   JOIN logistics_schema.regions o ON lc.origin_region_id = o.region_id
--   JOIN logistics_schema.regions d ON lc.destination_region_id = d.region_id
--   ORDER BY lc.code;
