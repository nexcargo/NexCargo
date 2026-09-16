-- NexCargo Migration — Document Management Foundation (C7-Increment 002 / MOD-004)
-- Creates 7 tables in logistics_schema for MOD-004 document persistence layer.
--
-- Owner: MOD-004 Document Management Module
-- Scope: Database persistence + RLS policies only
-- Does NOT implement OCR engine, AI intelligence, or notification delivery.
-- Storage bucket (nexcargow-documents) and policies created separately.
--
-- Tables:
--   1. documents                      — Core document entity per MOD-004 §4.1
--   2. document_versions              — Immutable version snapshots per MOD-004 §4.2
--   3. document_approvals             — Approval flow records per MOD-004 §4.3
--   4. document_linkages              — Entity linkage for traceability per MOD-004 §4.4
--   5. ocr_results                    — OCR extraction results per MOD-004 §4.5
--   6. digital_signatures             — Digital signature records per MOD-004 §4.6
--   7. document_expiry_records        — Expiry monitoring per MOD-004 §4.7
--
-- NOTE: Driver access policies require logistics_schema.driver_assignments (MOD-002).
-- Since that table does not exist on Supabase yet, this migration creates all other
-- policies and leaves the driver path covered by platform-team visibility only.
-- When MOD-002 applies its driver_assignments migration, add a supplemental migration
-- with the driver-specific SELECT policies here using:
--   WHERE da.booking_id = linked_entity_id AND da.driver_id = auth.uid()
-- on the linked-entity-type = 'booking' read policies.

-- Helper function: safe driver lookup that handles missing driver_assignments table
CREATE OR REPLACE FUNCTION logistics_schema._driver_can_read_document(p_driver_id UUID, p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, logistics_schema, public, auth
AS $$
BEGIN
  -- Only check driver_assignments if it exists (lazy check via information_schema)
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'logistics_schema' 
             AND table_name = 'driver_assignments') THEN
    RETURN EXISTS (
      SELECT 1 FROM logistics_schema.driver_assignments da
      WHERE da.booking_id = p_booking_id AND da.driver_id = p_driver_id
    );
  END IF;
  RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION logistics_schema._driver_can_read_document(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION logistics_schema._driver_can_read_document(UUID, UUID) TO authenticated;

-- ============================================================
-- 1. documents — Core document entity
-- Per MOD-004 §4.1: unique identifier, linked to system entity, encrypted at rest
-- Status lifecycle: UPLOADED → VALIDATED → ACTIVE → [OCR] → REVIEW → SIGNED|APPROVED → ARCHIVED
-- Parallel expiry: ACTIVE → EXPIRING → EXPIRED → RENEWED → ACTIVE
-- Terminal states: ARCHIVED, REJECTED (no outgoing transitions)
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(100) NOT NULL UNIQUE,
  document_type VARCHAR(80) NOT NULL,
  linked_entity_type VARCHAR(40) NOT NULL CHECK (linked_entity_type IN ('shipment', 'booking', 'contract', 'user', 'vehicle', 'driver')),
  linked_entity_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED'::VARCHAR
    CHECK (status IN (
      'UPLOADED', 'VALIDATED', 'ACTIVE', 'REVIEW', 'SIGNED', 'APPROVED',
      'REJECTED', 'EXPIRING', 'EXPIRED', 'RENEWED', 'ARCHIVED'
    )),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  file_reference TEXT NOT NULL,
  file_hash VARCHAR(256) NOT NULL,
  expiry_date TIMESTAMPTZ,
  issue_date TIMESTAMPTZ,
  correlation_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_documents_linked_entity ON logistics_schema.documents(linked_entity_type, linked_entity_id);
CREATE INDEX idx_documents_status ON logistics_schema.documents(status);
CREATE INDEX idx_documents_document_type ON logistics_schema.documents(document_type);
CREATE INDEX idx_documents_created_by ON logistics_schema.documents(created_by);
CREATE INDEX idx_documents_expiry ON logistics_schema.documents(expiry_date) WHERE expiry_date IS NOT NULL;

ALTER TABLE logistics_schema.documents ENABLE ROW LEVEL SECURITY;

-- SHIPPER: read documents linked to their bookings/contracts
CREATE POLICY "Shipper reads own documents"
  ON logistics_schema.documents FOR SELECT
  USING (
    linked_entity_type = 'booking'
    AND linked_entity_id IN (
      SELECT b.id FROM logistics_schema.bookings b WHERE b.shipper_id = auth.uid() AND b.is_deleted = FALSE
    )
  );

-- TRANSPORTER: read documents linked to their bookings
CREATE POLICY "Transporter reads own documents"
  ON logistics_schema.documents FOR SELECT
  USING (
    linked_entity_type = 'booking'
    AND linked_entity_id IN (
      SELECT b.id FROM logistics_schema.bookings b WHERE b.transporter_id = auth.uid() AND b.is_deleted = FALSE
    )
  );

-- DRIVER: read documents via driver_assignments (when available)
CREATE POLICY "Driver reads assigned documents"
  ON logistics_schema.documents FOR SELECT
  USING (
    linked_entity_type = 'booking'
    AND logistics_schema._driver_can_read_document(auth.uid(), linked_entity_id)
  );

-- USER type documents: creator can read their own
CREATE POLICY "User reads own user documents"
  ON logistics_schema.documents FOR SELECT
  USING (
    linked_entity_type = 'user'
    AND linked_entity_id = auth.uid()
  );

-- Contract-type documents: shipper/transporter of booking can read
CREATE POLICY "Contract-linked document readers"
  ON logistics_schema.documents FOR SELECT
  USING (
    linked_entity_type = 'contract'
    AND linked_entity_id IN (
      SELECT c.id FROM logistics_schema.contracts c
      JOIN logistics_schema.bookings b ON b.id = c.booking_id
      WHERE b.shipper_id = auth.uid() OR b.transporter_id = auth.uid()
    )
  );

-- PLATFORM TEAM: full operational visibility
CREATE POLICY "Platform team reads all operational documents"
  ON logistics_schema.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin: full CRUD access
CREATE POLICY "Admin superadmin full document access"
  ON logistics_schema.documents FOR ALL
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

-- SHIPPER/TRANSPORTER: upload (INSERT) their own documents
CREATE POLICY "Shipper transporter upload documents"
  ON logistics_schema.documents FOR INSERT
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM app.platform_roles pr
        WHERE pr.user_id = auth.uid() AND pr.role IN ('SHIPPER', 'TRANSPORTER')
      )
      AND
      (
        (linked_entity_type = 'booking' AND linked_entity_id IN (
          SELECT b.id FROM logistics_schema.bookings b WHERE b.shipper_id = auth.uid() AND b.is_deleted = FALSE
        ))
        OR
        (linked_entity_type = 'user' AND linked_entity_id = auth.uid())
      )
    )
  );

-- ============================================================
-- 2. document_versions — Immutable version snapshots
-- Per MOD-004 §4.2: once approved/sign'd, CANNOT modify; updates MUST create new version
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id VARCHAR(100) NOT NULL UNIQUE,
  document_id VARCHAR(100) NOT NULL REFERENCES logistics_schema.documents(document_id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  content_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT NOT NULL DEFAULT ''::text,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_document_versions_document ON logistics_schema.document_versions(document_id);
CREATE INDEX idx_document_versions_number ON logistics_schema.document_versions(document_id, version_number DESC);

ALTER TABLE logistics_schema.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document version readers via parent"
  ON logistics_schema.document_versions FOR SELECT
  USING (
    document_id IN (
      SELECT d.document_id FROM logistics_schema.documents d WHERE
        d.linked_entity_type = 'booking'
        AND d.linked_entity_id IN (
          SELECT b.id FROM logistics_schema.bookings b WHERE
            b.shipper_id = auth.uid() OR b.transporter_id = auth.uid()
        )
    )
  );

CREATE POLICY "Document version platform team read"
  ON logistics_schema.document_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Platform inserts document versions"
  ON logistics_schema.document_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN', 'DISPATCHER', 'MODERATOR')
    )
  );

-- ============================================================
-- 3. document_approvals — Approval flow records
-- Per MOD-004 §4.3: approverRole, approvalStatus (PENDING/APPROVED/REJECTED), comments
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.document_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id VARCHAR(100) NOT NULL UNIQUE,
  document_id VARCHAR(100) NOT NULL REFERENCES logistics_schema.documents(document_id) ON DELETE CASCADE,
  approver_role VARCHAR(30) NOT NULL,
  approval_status VARCHAR(20) NOT NULL CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_document_approvals_document ON logistics_schema.document_approvals(document_id);
CREATE INDEX idx_document_approvals_status ON logistics_schema.document_approvals(approval_status);

ALTER TABLE logistics_schema.document_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document approval readers via parent"
  ON logistics_schema.document_approvals FOR SELECT
  USING (
    document_id IN (
      SELECT d.document_id FROM logistics_schema.documents d WHERE
        d.linked_entity_type = 'booking'
        AND d.linked_entity_id IN (
          SELECT b.id FROM logistics_schema.bookings b WHERE
            b.shipper_id = auth.uid() OR b.transporter_id = auth.uid()
        )
    )
  );

CREATE POLICY "Document approval platform team read"
  ON logistics_schema.document_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Authorized roles approve documents"
  ON logistics_schema.document_approvals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- ============================================================
-- 4. document_linkages — Entity linkage for traceability
-- Per MOD-004 §4.4: Every document MUST link to at least one entity; orphans invalid
-- moduleReference: MOD-001 through MOD-018; relationshipType: supports/derives/verifies/validates
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.document_linkages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkage_id VARCHAR(100) NOT NULL UNIQUE,
  document_id VARCHAR(100) NOT NULL REFERENCES logistics_schema.documents(document_id) ON DELETE CASCADE,
  module_reference VARCHAR(10) NOT NULL CHECK (module_reference ~ '^MOD-\d{3}$'),
  entity_reference TEXT NOT NULL,
  relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('supports', 'derives', 'verifies', 'validates')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_document_linkages_document ON logistics_schema.document_linkages(document_id);
CREATE INDEX idx_document_linkages_module ON logistics_schema.document_linkages(module_reference, entity_reference);

ALTER TABLE logistics_schema.document_linkages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document linkage readers via parent"
  ON logistics_schema.document_linkages FOR SELECT
  USING (
    document_id IN (
      SELECT d.document_id FROM logistics_schema.documents d WHERE
        d.linked_entity_type = 'booking'
        AND d.linked_entity_id IN (
          SELECT b.id FROM logistics_schema.bookings b WHERE
            b.shipper_id = auth.uid() OR b.transporter_id = auth.uid()
        )
    )
  );

CREATE POLICY "Document linkage platform team read"
  ON logistics_schema.document_linkages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Platform creates document linkages"
  ON logistics_schema.document_linkages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN', 'DISPATCHER', 'MODERATOR')
    )
  );

-- ============================================================
-- 5. ocr_results — OCR extraction results
-- Per MOD-004 §4.5: confidenceScore (0-100), fieldConfidenceScores, userCorrections
-- Advisory nature: manually corrected values supersede OCR output
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id VARCHAR(100) NOT NULL UNIQUE,
  document_id VARCHAR(100) NOT NULL REFERENCES logistics_schema.documents(document_id) ON DELETE CASCADE,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(5,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  field_confidence_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  user_corrections JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ocr_results_document ON logistics_schema.ocr_results(document_id);

ALTER TABLE logistics_schema.ocr_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OCR result readers via parent"
  ON logistics_schema.ocr_results FOR SELECT
  USING (
    document_id IN (
      SELECT d.document_id FROM logistics_schema.documents d WHERE
        d.linked_entity_type = 'booking'
        AND d.linked_entity_id IN (
          SELECT b.id FROM logistics_schema.bookings b WHERE
            b.shipper_id = auth.uid() OR b.transporter_id = auth.uid()
        )
    )
  );

CREATE POLICY "OCR result platform team read"
  ON logistics_schema.ocr_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "System inserts OCR results"
  ON logistics_schema.ocr_results FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- 6. digital_signatures — Digital signature records
-- Per MOD-004 §4.6: signerId, signerRole, signatureTimestamp, verificationMethod
-- Signed docs become immutable; duplicate signatures prevented
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.digital_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id VARCHAR(100) NOT NULL UNIQUE,
  document_id VARCHAR(100) NOT NULL REFERENCES logistics_schema.documents(document_id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES auth.users(id),
  signer_role VARCHAR(30) NOT NULL,
  signature_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_certificate TEXT NOT NULL,
  verification_method VARCHAR(30) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_digital_signatures_document ON logistics_schema.digital_signatures(document_id);
CREATE INDEX idx_digital_signatures_signer ON logistics_schema.digital_signatures(signer_id);

ALTER TABLE logistics_schema.digital_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Digital signature readers via parent"
  ON logistics_schema.digital_signatures FOR SELECT
  USING (
    document_id IN (
      SELECT d.document_id FROM logistics_schema.documents d WHERE
        d.linked_entity_type = 'booking'
        AND d.linked_entity_id IN (
          SELECT b.id FROM logistics_schema.bookings b WHERE
            b.shipper_id = auth.uid() OR b.transporter_id = auth.uid()
        )
    )
  );

CREATE POLICY "Digital signature platform team read"
  ON logistics_schema.digital_signatures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Signer or platform creates signatures"
  ON logistics_schema.digital_signatures FOR INSERT
  WITH CHECK (
    signer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
    )
  );

-- ============================================================
-- 7. document_expiry_records — Expiry monitoring
-- Per MOD-004 §4.7: issueDate, expiryDate, renewalStatus, reminderSentAt, operationalImpact
-- Lifecycle: ACTIVE → EXPIRING → EXPIRED → RENEWED → ACTIVE
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.document_expiry_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expiry_record_id VARCHAR(100) NOT NULL UNIQUE,
  document_id VARCHAR(100) NOT NULL REFERENCES logistics_schema.documents(document_id) ON DELETE CASCADE,
  document_type VARCHAR(80) NOT NULL,
  linked_entity_id UUID NOT NULL,
  issue_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  renewal_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'::VARCHAR
    CHECK (renewal_status IN ('ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'RENEWAL_PENDING')),
  reminder_sent_at TEXT[] NOT NULL DEFAULT '{}'::text[],
  renewed_document_id VARCHAR(100),
  operational_impact VARCHAR(20) NOT NULL DEFAULT 'NONE'::VARCHAR
    CHECK (operational_impact IN ('NONE', 'WARNING', 'SUSPENDED', 'BLOCKED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expiry_records_document ON logistics_schema.document_expiry_records(document_id);
CREATE INDEX idx_expiry_records_expiry ON logistics_schema.document_expiry_records(expiry_date);
CREATE INDEX idx_expiry_records_status ON logistics_schema.document_expiry_records(renewal_status);

ALTER TABLE logistics_schema.document_expiry_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expiry record readers via parent"
  ON logistics_schema.document_expiry_records FOR SELECT
  USING (
    document_id IN (
      SELECT d.document_id FROM logistics_schema.documents d WHERE
        d.linked_entity_type = 'booking'
        AND d.linked_entity_id IN (
          SELECT b.id FROM logistics_schema.bookings b WHERE
            b.shipper_id = auth.uid() OR b.transporter_id = auth.uid()
        )
    )
  );

CREATE POLICY "Expiry record platform team read"
  ON logistics_schema.document_expiry_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "System manages expiry records"
  ON logistics_schema.document_expiry_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );
