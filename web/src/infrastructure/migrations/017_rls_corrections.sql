-- NexCargo Migration 017 -- RLS Correction: Driver Assignment + Dispatcher Transporter Scoping (Phase 3.2)
-- Authorized by HAO — Phase 3.2 Implementation Authorization
-- Purpose: Complete missing RLS corrections deferred from Migration 015
--
-- SECTION A: Helper function — transporterscope(p_user_id)
-- Resolves which Transporter boundary a user is scoped to.
-- Returns NULL if no Transporter delegation exists.
-- Used by Dispatcher RLS policies to enforce cross-Transporter isolation.
--
-- SECTION B: Driver assignment policy correction
-- Replaces incorrect: driver_id = auth.uid()
-- With correct: driver's platform_user_id resolution chain
--   (asset_assignments.driver_id → drivers.platform_user_id = auth.uid())
--
-- SECTION C: Dispatcher Transporter-scoped RLS policies
-- Replaces platform-wide read access with Transporter-boundary-scoped access
-- for DISPATCHER role. MODERATOR/ADMIN/SUPER_ADMIN retain full visibility.
-- Unmapped DISPATCHER (assigned_transporter_id IS NULL) = zero operational access.
--
-- Preserved:
--   - All existing Transporter-owner policies (fleet_id/ownerid = auth.uid())
--   - All existing Driver-read policies (platform_user_id = auth.uid())
--   - Moderator/Admin/SuperAdmin full visibility
--   - No Tracking Phase 1 tables (deferred)

-- ============================================================
-- SECTION A: transporterscope() helper
-- ============================================================

CREATE OR REPLACE FUNCTION logistics_schema.transporterscope(p_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT au.id FROM auth.users au
  JOIN app.platform_roles pr ON pr.user_id = au.id
  WHERE pr.role = 'DISPATCHER'
    AND pr.assigned_transporter_id IS NOT NULL
    AND pr.user_id = p_user_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION logistics_schema.transporterscope(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION logistics_schema.transporterscope(UUID) TO authenticated;

-- ============================================================
-- SECTION B: Driver assignment policy corrections
-- ============================================================

-- Driver views own assignments: fix incorrect driver_id = auth.uid()
-- Corrected to resolve through drivers.platform_user_id
DROP POLICY IF EXISTS "Driver views own assignments" ON logistics_schema.asset_assignments;
CREATE POLICY "Driver views own assignments"
  ON logistics_schema.asset_assignments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM logistics_schema.drivers d
    WHERE d.id = asset_assignments.driver_id::uuid AND d.platform_user_id = auth.uid()::uuid
  ));

-- Driver views vehicle compliance: fix incorrect driver_id = auth.uid()
-- Corrected to resolve through asset_assignments → drivers.platform_user_id
DROP POLICY IF EXISTS "Driver views vehicle compliance" ON logistics_schema.cross_border_compliance_records;
CREATE POLICY "Driver views vehicle compliance"
  ON logistics_schema.cross_border_compliance_records FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM logistics_schema.asset_assignments aa
    JOIN logistics_schema.drivers d ON d.id = aa.driver_id::uuid
    WHERE aa.vehicle_id = cross_border_compliance_records.vehicle_id
      AND d.platform_user_id = auth.uid()::uuid
      AND aa.status != 'CANCELLED'
  ));

-- ============================================================
-- SECTION C: Dispatcher Transporter-scoped RLS policies
-- ============================================================

-- Asset Assignments
DROP POLICY IF EXISTS "Platform team reads all assignments" ON logistics_schema.asset_assignments;
CREATE POLICY "Dispatcher Transporter-scope reads assignments"
  ON logistics_schema.asset_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

DROP POLICY IF EXISTS "Dispatcher admin manage assignments" ON logistics_schema.asset_assignments;
CREATE POLICY "Dispatcher Transporter-scope manage assignments"
  ON logistics_schema.asset_assignments
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN'))
    OR (EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('ADMIN', 'SUPER_ADMIN'))
    OR (EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL))
  );

-- Fleets
DROP POLICY IF EXISTS "Platform team reads all fleets" ON logistics_schema.fleets;
CREATE POLICY "Dispatcher Transporter-scope reads fleets"
  ON logistics_schema.fleets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Vehicles
DROP POLICY IF EXISTS "Platform team reads all vehicles" ON logistics_schema.vehicles;
CREATE POLICY "Dispatcher Transporter-scope reads vehicles"
  ON logistics_schema.vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Drivers
DROP POLICY IF EXISTS "Platform team reads all drivers" ON logistics_schema.drivers;
CREATE POLICY "Dispatcher Transporter-scope reads drivers"
  ON logistics_schema.drivers FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Cross-Border Compliance Records
DROP POLICY IF EXISTS "Platform team reads all compliance records" ON logistics_schema.cross_border_compliance_records;
CREATE POLICY "Dispatcher Transporter-scope reads compliance"
  ON logistics_schema.cross_border_compliance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Backhaul Opportunities
DROP POLICY IF EXISTS "Platform team reads all backhaul" ON logistics_schema.backhaul_opportunities;
CREATE POLICY "Dispatcher Transporter-scope reads backhaul"
  ON logistics_schema.backhaul_opportunities FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Documents
DROP POLICY IF EXISTS "Platform team reads all operational documents" ON logistics_schema.documents;
CREATE POLICY "Dispatcher Transporter-scope reads documents"
  ON logistics_schema.documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Digital Signatures
DROP POLICY IF EXISTS "Digital signature platform team read" ON logistics_schema.digital_signatures;
CREATE POLICY "Dispatcher Transporter-scope reads signatures"
  ON logistics_schema.digital_signatures FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- OCR Results
DROP POLICY IF EXISTS "OCR result platform team read" ON logistics_schema.ocr_results;
CREATE POLICY "Dispatcher Transporter-scope reads OCR"
  ON logistics_schema.ocr_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Document Approvals
DROP POLICY IF EXISTS "Document approval platform team read" ON logistics_schema.document_approvals;
CREATE POLICY "Dispatcher Transporter-scope reads approvals"
  ON logistics_schema.document_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Document Expiry Records
DROP POLICY IF EXISTS "Expiry record platform team read" ON logistics_schema.document_expiry_records;
CREATE POLICY "Dispatcher Transporter-scope reads expiry"
  ON logistics_schema.document_expiry_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Document Linkages
DROP POLICY IF EXISTS "Document linkage platform team read" ON logistics_schema.document_linkages;
CREATE POLICY "Dispatcher Transporter-scope reads linkages"
  ON logistics_schema.document_linkages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Document Versions
DROP POLICY IF EXISTS "Document version platform team read" ON logistics_schema.document_versions;
CREATE POLICY "Dispatcher Transporter-scope reads versions"
  ON logistics_schema.document_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Support Tickets
DROP POLICY IF EXISTS "Platform team reads all support tickets" ON logistics_schema.support_tickets;
CREATE POLICY "Dispatcher Transporter-scope reads tickets"
  ON logistics_schema.support_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Operational Exceptions
DROP POLICY IF EXISTS "Platform team reads all operational exceptions" ON logistics_schema.operational_exceptions;
CREATE POLICY "Dispatcher Transporter-scope reads exceptions"
  ON logistics_schema.operational_exceptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Dispute Cases
DROP POLICY IF EXISTS "Platform team reads all disputes" ON logistics_schema.dispute_cases;
CREATE POLICY "Dispatcher Transporter-scope reads disputes"
  ON logistics_schema.dispute_cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Shipment Incidents
DROP POLICY IF EXISTS "Platform team reads all shipment incidents" ON logistics_schema.shipment_incidents;
CREATE POLICY "Dispatcher Transporter-scope reads incidents"
  ON logistics_schema.shipment_incidents FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );

-- Shipment Tracking Records
DROP POLICY IF EXISTS "Dispatcher reads all tracking records" ON logistics_schema.shipment_tracking_records;
CREATE POLICY "Dispatcher Transporter-scope reads tracking"
  ON logistics_schema.shipment_tracking_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN'))
    OR EXISTS (SELECT 1 FROM app.platform_roles pr WHERE pr.user_id = auth.uid() AND pr.role = 'DISPATCHER' AND pr.assigned_transporter_id IS NOT NULL AND logistics_schema.transporterscope(auth.uid()) IS NOT NULL)
  );
