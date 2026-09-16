-- NexCargo Migration — Support & Dispute Resolution Foundation (C7-Increment 004 / MOD-015)
-- Creates 7 tables in logistics_schema for MOD-015 Support & Dispute Resolution Module.
--
-- Owner: MOD-015 Support & Dispute Resolution Module
-- Scope: Database persistence + RLS policies only
-- Does NOT implement notification delivery, evidence attachment storage, or bank execution logic.
--
-- Tables:
--   1. support_tickets              — Support ticket registry per MOD-015 §4.1
--   2. dispute_cases                — Dispute case registry per MOD-015 §4.2
--   3. shipment_incidents           — Shipment incident tracking per MOD-015 §4.3
--   4. escalations                  — Escalation workflow per MOD-015 §4.4
--   5. operational_exceptions       — Operational exception tracking per MOD-015 §4.5
--   6. refund_coordinations         — Refund coordination workflow per MOD-015 §4.6
--   7. investigations               — Investigation registry per MOD-015 §4.8
--
-- Security Functions:
--   _moderator_can_access_escrow_state(p_user_id, p_escrow_id)    — Moderator escrow access check (§4.8)
--   _investigator_can_query_cross_module(p_investigation_id)      — Cross-module investigation access (§4.8)
--
-- Notes:
--   - All tables use UUID primary keys consistent with BaseEntity convention.
--   - Business IDs use VARCHAR(100) UNIQUE columns (ticket_id, case_number, etc.)
--   - CHECK constraints enforce status enum values on every table.
--   - RLS policies follow chain-based access via shipment_tracking_records → bookings joins.
--   - Platform team visibility uses app.platform_roles checks with roles DISPATCHER, MODERATOR, ADMIN, SUPER_ADMIN.
--   - Each table has an update trigger function to maintain updated_at timestamp.

-- ============================================================
-- PART 0: UPDATE TRIGGER FUNCTION
-- Per established pattern: sets updated_at = now() on row modification
-- ============================================================

CREATE OR REPLACE FUNCTION logistics_schema._set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. support_tickets — Support ticket registry
-- Per MOD-015 §4.1: unique identifier, requester info, category, priority, SLA tracking
-- Status lifecycle: OPEN → IN_PROGRESS → PENDING → RESOLVED → CLOSED
-- Requester roles: SHIPPER, TRANSPORTER, DRIVER
-- Categories: SHIPMENT, PAYMENT, ACCOUNT, TECHNICAL, OPERATIONAL
-- Priority levels: LOW, MEDIUM, HIGH, CRITICAL
-- Channels: IN_APP, EMAIL, SMS, CALL, API
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(100) NOT NULL UNIQUE,
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  requester_role VARCHAR(30) NOT NULL
    CHECK (requester_role IN ('SHIPPER', 'TRANSPORTER', 'DRIVER')),
  case_id VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL
    CHECK (category IN ('SHIPMENT', 'PAYMENT', 'ACCOUNT', 'TECHNICAL', 'OPERATIONAL')),
  priority_level VARCHAR(20) NOT NULL
    CHECK (priority_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'::VARCHAR
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED')),
  assigned_agent_id UUID REFERENCES auth.users(id),
  channel VARCHAR(20) NOT NULL
    CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'CALL', 'API')),
  sla_breach BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  correlation_id VARCHAR(100),
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_tickets_requester ON logistics_schema.support_tickets(requester_id);
CREATE INDEX idx_support_tickets_status ON logistics_schema.support_tickets(status);
CREATE INDEX idx_support_tickets_category ON logistics_schema.support_tickets(category);
CREATE INDEX idx_support_tickets_priority ON logistics_schema.support_tickets(priority_level);
CREATE INDEX idx_support_tickets_assigned ON logistics_schema.support_tickets(assigned_agent_id);
CREATE INDEX idx_support_tickets_case_id ON logistics_schema.support_tickets(case_id);

ALTER TABLE logistics_schema.support_tickets ENABLE ROW LEVEL SECURITY;

-- SHIPPER: read own tickets
CREATE POLICY "Shipper reads own support tickets"
  ON logistics_schema.support_tickets FOR SELECT
  USING (requester_id = auth.uid());

-- TRANSPORTER: read own tickets
CREATE POLICY "Transporter reads own support tickets"
  ON logistics_schema.support_tickets FOR SELECT
  USING (requester_id = auth.uid());

-- DRIVER: view own tickets
CREATE POLICY "Driver views own support tickets"
  ON logistics_schema.support_tickets FOR SELECT
  USING (requester_id = auth.uid());

-- User creates own tickets
CREATE POLICY "User creates own support tickets"
  ON logistics_schema.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Dispatchers/Moderators read all tickets
CREATE POLICY "Dispatcher/Moderator reads all support tickets"
  ON logistics_schema.support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid() AND pr.role IN ('DISPATCHER', 'MODERATOR')
    )
  );

-- Admin/SuperAdmin full CRUD access
CREATE POLICY "Admin/SuperAdmin full support ticket access"
  ON logistics_schema.support_tickets FOR ALL
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
-- 2. dispute_cases — Dispute case registry
-- Per MOD-015 §4.2: linked to shipment/contract/escrow, dispute type, investigator assignment
-- Status lifecycle: SUBMITTED → UNDER_REVIEW → ESCALATED → RESOLVED → CLOSED
-- Dispute types: PAYMENT, DELIVERY, DAMAGE, DELAY, CONTRACT
-- Evidence references stored as JSON array text [{documentRefId, evidenceCategory, description, attachedAt}]
-- Resolution tracked with decision_maker, decision_timestamp, resolution_summary
-- Access controlled via shipment → bookings chain join for shipper/transporter visibility
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.dispute_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(100) NOT NULL UNIQUE,
  related_shipment_id UUID REFERENCES logistics_schema.shipment_tracking_records(id),
  related_contract_id UUID REFERENCES logistics_schema.contracts(id),
  related_escrow_id UUID REFERENCES financial_schema.escrow_records(id),
  dispute_type VARCHAR(30) NOT NULL
    CHECK (dispute_type IN ('PAYMENT', 'DELIVERY', 'DAMAGE', 'DELAY', 'CONTRACT')),
  initiator_id UUID NOT NULL REFERENCES auth.users(id),
  respondent_id UUID NOT NULL REFERENCES auth.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'::VARCHAR
    CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED')),
  evidence_references TEXT,
  resolution_outcome TEXT,
  decision_maker_id UUID REFERENCES auth.users(id),
  decision_timestamp TIMESTAMPTZ,
  resolution_summary TEXT,
  case_id VARCHAR(100) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  correlation_id VARCHAR(100),
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dispute_cases_shipment ON logistics_schema.dispute_cases(related_shipment_id);
CREATE INDEX idx_dispute_cases_contract ON logistics_schema.dispute_cases(related_contract_id);
CREATE INDEX idx_dispute_cases_initiator ON logistics_schema.dispute_cases(initiator_id);
CREATE INDEX idx_dispute_cases_respondent ON logistics_schema.dispute_cases(respondent_id);
CREATE INDEX idx_dispute_cases_status ON logistics_schema.dispute_cases(status);
CREATE INDEX idx_dispute_cases_case_number ON logistics_schema.dispute_cases(case_id);
CREATE INDEX idx_dispute_cases_type ON logistics_schema.dispute_cases(dispute_type);

ALTER TABLE logistics_schema.dispute_cases ENABLE ROW LEVEL SECURITY;

-- SHIPPER: view disputes related to their shipments (chain via shipment_tracking_records → bookings)
CREATE POLICY "Shippers view related disputes"
  ON logistics_schema.dispute_cases FOR SELECT
  USING (
    related_shipment_id IS NULL
    OR related_shipment_id IN (
      SELECT str.id FROM logistics_schema.shipment_tracking_records str
      JOIN logistics_schema.bookings b ON b.id = str.booking_id
      WHERE b.shipper_id = auth.uid()
    )
  );

-- TRANSPORTER: view disputes related to their shipments (chain via shipment_tracking_records → bookings)
CREATE POLICY "Transporters view related disputes"
  ON logistics_schema.dispute_cases FOR SELECT
  USING (
    related_shipment_id IS NULL
    OR related_shipment_id IN (
      SELECT str.id FROM logistics_schema.shipment_tracking_records str
      JOIN logistics_schema.bookings b ON b.id = str.booking_id
      WHERE b.transporter_id = auth.uid()
    )
  );

-- INITIATOR: view their own disputes
CREATE POLICY "Dispute initiator views own cases"
  ON logistics_schema.dispute_cases FOR SELECT
  USING (initiator_id = auth.uid());

-- PLATFORM TEAM: read all disputes
CREATE POLICY "Platform team reads all disputes"
  ON logistics_schema.dispute_cases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin full CRUD override
CREATE POLICY "Admin/SuperAdmin full dispute access"
  ON logistics_schema.dispute_cases FOR ALL
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
-- 3. shipment_incidents — Shipment incident tracking
-- Per MOD-015 §4.3: links to shipment, incident classification, detection source
-- Incident types: VEHICLE_BREAKDOWN, BORDER_DELAY, CARGO_DAMAGE, ROUTE_DEVIATION, THEFT_LOSS, WEATHER, CONGESTION
-- Severity levels: MINOR, MODERATE, MAJOR, CRITICAL
-- Detection sources: MOD_017, MOD_006, USER_REPORT, MANUAL
-- Status: DETECTED → UNDER_INVESTIGATION → CONTAINED → RESOLVED
-- Linked to dispute_cases if escalated; affected_modules tracks which modules impacted
-- Access controlled via shipment_tracking_records → bookings chain join
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.shipment_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id VARCHAR(100) NOT NULL UNIQUE,
  shipment_id UUID NOT NULL REFERENCES logistics_schema.shipment_tracking_records(id),
  incident_type VARCHAR(30) NOT NULL
    CHECK (incident_type IN ('VEHICLE_BREAKDOWN', 'BORDER_DELAY', 'CARGO_DAMAGE', 'ROUTE_DEVIATION', 'THEFT_LOSS', 'WEATHER', 'CONGESTION')),
  severity_level VARCHAR(20) NOT NULL
    CHECK (severity_level IN ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL')),
  detection_source VARCHAR(20) NOT NULL
    CHECK (detection_source IN ('MOD_017', 'MOD_006', 'USER_REPORT', 'MANUAL')),
  status VARCHAR(30) NOT NULL DEFAULT 'DETECTED'::VARCHAR
    CHECK (status IN ('DETECTED', 'UNDER_INVESTIGATION', 'CONTAINED', 'RESOLVED')),
  affected_modules TEXT,
  resolution_tracking_id VARCHAR(100),
  dispute_id UUID REFERENCES logistics_schema.dispute_cases(id),
  detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  correlation_id VARCHAR(100),
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_incidents_shipment ON logistics_schema.shipment_incidents(shipment_id);
CREATE INDEX idx_incidents_type ON logistics_schema.shipment_incidents(incident_type);
CREATE INDEX idx_incidents_severity ON logistics_schema.shipment_incidents(severity_level);
CREATE INDEX idx_incidents_status ON logistics_schema.shipment_incidents(status);
CREATE INDEX idx_incidents_detection_source ON logistics_schema.shipment_incidents(detection_source);
CREATE INDEX idx_incidents_dispute ON logistics_schema.shipment_incidents(dispute_id);

ALTER TABLE logistics_schema.shipment_incidents ENABLE ROW LEVEL SECURITY;

-- SHIPPER: view incidents on their shipments (chain via shipment_tracking_records → bookings)
CREATE POLICY "Shippers view related incidents"
  ON logistics_schema.shipment_incidents FOR SELECT
  USING (
    shipment_id IN (
      SELECT str.id FROM logistics_schema.shipment_tracking_records str
      JOIN logistics_schema.bookings b ON b.id = str.booking_id
      WHERE b.shipper_id = auth.uid()
    )
  );

-- TRANSPORTER: view incidents on their shipments (chain via shipment_tracking_records → bookings)
CREATE POLICY "Transporters view related incidents"
  ON logistics_schema.shipment_incidents FOR SELECT
  USING (
    shipment_id IN (
      SELECT str.id FROM logistics_schema.shipment_tracking_records str
      JOIN logistics_schema.bookings b ON b.id = str.booking_id
      WHERE b.transporter_id = auth.uid()
    )
  );

-- PLATFORM TEAM: read all incidents
CREATE POLICY "Platform team reads all incidents"
  ON logistics_schema.shipment_incidents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin full CRUD override
CREATE POLICY "Admin/SuperAdmin full incident access"
  ON logistics_schema.shipment_incidents FOR ALL
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
-- 4. escalations — Escalation workflow
-- Per MOD-015 §4.4: cross-case escalation between support entities
-- Source entity types: TICKET, DISPUTE, INCIDENT, EXCEPTION
-- Escalation levels: L1_SUPPORT, L2_SUPERVISOR, L3_ADMIN_MODERATOR
-- Assigned role defines who must handle the escalation
-- SLA timer tracking via sla_timer_started_at / sla_timer_expired_at
-- Access: platform team reads all; assigned user can update; admin/superadmin full CRUD
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id VARCHAR(100) NOT NULL UNIQUE,
  source_case_id VARCHAR(100) NOT NULL,
  source_entity_type VARCHAR(30) NOT NULL
    CHECK (source_entity_type IN ('TICKET', 'DISPUTE', 'INCIDENT', 'EXCEPTION')),
  escalation_level VARCHAR(30) NOT NULL
    CHECK (escalation_level IN ('L1_SUPPORT', 'L2_SUPERVISOR', 'L3_ADMIN_MODERATOR')),
  assigned_role VARCHAR(30) NOT NULL,
  assigned_user_id UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'::VARCHAR
    CHECK (status IN ('ACTIVE', 'COMPLETED', 'OVERRIDDEN')),
  sla_timer_started_at TIMESTAMPTZ NOT NULL,
  sla_timer_expired_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  correlation_id VARCHAR(100),
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_escalations_source ON logistics_schema.escalations(source_case_id, source_entity_type);
CREATE INDEX idx_escalations_assigned_user ON logistics_schema.escalations(assigned_user_id);
CREATE INDEX idx_escalations_status ON logistics_schema.escalations(status);
CREATE INDEX idx_escalations_level ON logistics_schema.escalations(escalation_level);
CREATE INDEX idx_escalations_sla_expired ON logistics_schema.escalations(sla_timer_expired_at) WHERE sla_timer_expired_at IS NOT NULL;

ALTER TABLE logistics_schema.escalations ENABLE ROW LEVEL SECURITY;

-- PLATFORM TEAM: read all escalations
CREATE POLICY "Platform team reads all escalations"
  ON logistics_schema.escalations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Assigned user can update their escalation assignment
CREATE POLICY "Assigned user updates their escalation"
  ON logistics_schema.escalations FOR UPDATE
  USING (assigned_user_id = auth.uid())
  WITH CHECK (assigned_user_id = auth.uid());

-- Admin/SuperAdmin full CRUD override
CREATE POLICY "Admin/SuperAdmin full escalation access"
  ON logistics_schema.escalations FOR ALL
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
-- 5. operational_exceptions — Operational exception tracking
-- Per MOD-015 §4.5: lightweight exceptions that may escalate to disputes
-- Exception types: MINOR_DELAY, ROUTE_CHANGE, WEATHER, CONGESTION
-- Detection sources: MOD_006, MOD_017, USER
-- Status: ACTIVE → RESOLVED / ESCALATED
-- If escalated to dispute, links to dispute_cases via escalated_to_dispute_id
-- Access controlled via shipment_tracking_records → bookings chain join
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.operational_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id VARCHAR(100) NOT NULL UNIQUE,
  shipment_id UUID NOT NULL REFERENCES logistics_schema.shipment_tracking_records(id),
  exception_type VARCHAR(30) NOT NULL
    CHECK (exception_type IN ('MINOR_DELAY', 'ROUTE_CHANGE', 'WEATHER', 'CONGESTION')),
  detected_at TIMESTAMPTZ NOT NULL,
  detection_source VARCHAR(20) NOT NULL
    CHECK (detection_source IN ('MOD_006', 'MOD_017', 'USER')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'::VARCHAR
    CHECK (status IN ('ACTIVE', 'RESOLVED', 'ESCALATED')),
  description TEXT NOT NULL,
  escalated_to_dispute_id UUID REFERENCES logistics_schema.dispute_cases(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  correlation_id VARCHAR(100),
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exceptions_shipment ON logistics_schema.operational_exceptions(shipment_id);
CREATE INDEX idx_exceptions_type ON logistics_schema.operational_exceptions(exception_type);
CREATE INDEX idx_exceptions_status ON logistics_schema.operational_exceptions(status);
CREATE INDEX idx_exceptions_detected ON logistics_schema.operational_exceptions(detected_at);
CREATE INDEX idx_exceptions_escalated ON logistics_schema.operational_exceptions(escalated_to_dispute_id);

ALTER TABLE logistics_schema.operational_exceptions ENABLE ROW LEVEL SECURITY;

-- SHIPPER: view exceptions on their shipments (chain via shipment_tracking_records → bookings)
CREATE POLICY "Shippers view related exceptions"
  ON logistics_schema.operational_exceptions FOR SELECT
  USING (
    shipment_id IN (
      SELECT str.id FROM logistics_schema.shipment_tracking_records str
      JOIN logistics_schema.bookings b ON b.id = str.booking_id
      WHERE b.shipper_id = auth.uid()
    )
  );

-- TRANSPORTER: view exceptions on their shipments (chain via shipment_tracking_records → bookings)
CREATE POLICY "Transporters view related exceptions"
  ON logistics_schema.operational_exceptions FOR SELECT
  USING (
    shipment_id IN (
      SELECT str.id FROM logistics_schema.shipment_tracking_records str
      JOIN logistics_schema.bookings b ON b.id = str.booking_id
      WHERE b.transporter_id = auth.uid()
    )
  );

-- PLATFORM TEAM: read all exceptions
CREATE POLICY "Platform team reads all exceptions"
  ON logistics_schema.operational_exceptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('DISPATCHER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin full CRUD override
CREATE POLICY "Admin/SuperAdmin full exception access"
  ON logistics_schema.operational_exceptions FOR ALL
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
-- 6. refund_coordinations — Refund coordination workflow
-- Per MOD-015 §4.6: coordinates refunds tied to resolved disputes
-- Refund types: FULL, PARTIAL, COMPENSATION
-- Approval flow: PENDING → APPROVED → EXECUTED (or REJECTED)
-- Only MODERATOR/ADMIN/SUPER_ADMIN can view and create — no self-created records
-- This is purely workflow/coordination — no bank_execution_reference, provider_reference_id, or payment_method
-- (those belong exclusively to MOD-013 financial_schema)
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.refund_coordinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_number VARCHAR(100) NOT NULL UNIQUE,
  dispute_id UUID NOT NULL REFERENCES logistics_schema.dispute_cases(id),
  shipment_id UUID REFERENCES logistics_schema.shipment_tracking_records(id),
  refund_type VARCHAR(20) NOT NULL
    CHECK (refund_type IN ('FULL', 'PARTIAL', 'COMPENSATION')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'MZN'::VARCHAR,
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'::VARCHAR
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED')),
  approved_by UUID REFERENCES auth.users(id),
  escrow_release_reference VARCHAR(100),
  executed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  correlation_id VARCHAR(100),
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_refunds_dispute ON logistics_schema.refund_coordinations(dispute_id);
CREATE INDEX idx_refunds_shipment ON logistics_schema.refund_coordinations(shipment_id);
CREATE INDEX idx_refunds_recipient ON logistics_schema.refund_coordinations(recipient_id);
CREATE INDEX idx_refunds_approval_status ON logistics_schema.refund_coordinations(approval_status);
CREATE INDEX idx_refunds_amount ON logistics_schema.refund_coordinations(amount);

ALTER TABLE logistics_schema.refund_coordinations ENABLE ROW LEVEL SECURITY;

-- Only MODERATOR/ADMIN/SUPER_ADMIN can view refund coordinations
CREATE POLICY "Moderator/Admin/SuperAdmin views all refund coordinations"
  ON logistics_schema.refund_coordinations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Only MODERATOR/ADMIN/SUPER_ADMIN can create/update refund coordinations
CREATE POLICY "Moderator/Admin/SuperAdmin manages refund coordinations"
  ON logistics_schema.refund_coordinations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- ============================================================
-- 7. investigations — Investigation registry
-- Per MOD-015 §4.8: cross-module investigation capability for dispute resolution
-- Investigator assignment provides accountability and audit trail
-- Fields include timeline snapshots, GPS replay references, financial flow inspection
-- document_verification_access and user_behavior_analysis are TEXT[] arrays
-- Restricted access: only assigned investigator or platform team (MODERATOR/ADMIN/SUPER_ADMIN)
-- ============================================================

CREATE TABLE IF NOT EXISTS logistics_schema.investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id VARCHAR(100) NOT NULL UNIQUE,
  case_id VARCHAR(100) NOT NULL,
  investigator_id UUID NOT NULL REFERENCES auth.users(id),
  shipment_timeline_view TEXT,
  gps_replay_reference VARCHAR(100),
  financial_flow_inspection TEXT,
  document_verification_access TEXT[],
  user_behavior_analysis TEXT[],
  notes TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  findings TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'::VARCHAR
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED')),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  correlation_id VARCHAR(100),
  is_deleted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_investigations_investigator ON logistics_schema.investigations(investigator_id);
CREATE INDEX idx_investigations_status ON logistics_schema.investigations(status);
CREATE INDEX idx_investigations_started ON logistics_schema.investigations(started_at);
CREATE INDEX idx_investigations_completed ON logistics_schema.investigations(completed_at) WHERE completed_at IS NOT NULL;

ALTER TABLE logistics_schema.investigations ENABLE ROW LEVEL SECURITY;

-- Assigned investigator can view their investigations
CREATE POLICY "Investigator views own investigations"
  ON logistics_schema.investigations FOR SELECT
  USING (investigator_id = auth.uid());

-- PLATFORM TEAM: read all investigations
CREATE POLICY "Platform team reads all investigations"
  ON logistics_schema.investigations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Admin/SuperAdmin full CRUD override
CREATE POLICY "Admin/SuperAdmin full investigation access"
  ON logistics_schema.investigations FOR ALL
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
-- TRIGGERS: Set updated_at on row modification for all tables
-- ============================================================

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON logistics_schema.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION logistics_schema._set_updated_at();

CREATE TRIGGER trg_dispute_cases_updated_at
  BEFORE UPDATE ON logistics_schema.dispute_cases
  FOR EACH ROW
  EXECUTE FUNCTION logistics_schema._set_updated_at();

CREATE TRIGGER trg_shipment_incidents_updated_at
  BEFORE UPDATE ON logistics_schema.shipment_incidents
  FOR EACH ROW
  EXECUTE FUNCTION logistics_schema._set_updated_at();

CREATE TRIGGER trg_escalations_updated_at
  BEFORE UPDATE ON logistics_schema.escalations
  FOR EACH ROW
  EXECUTE FUNCTION logistics_schema._set_updated_at();

CREATE TRIGGER trg_operational_exceptions_updated_at
  BEFORE UPDATE ON logistics_schema.operational_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION logistics_schema._set_updated_at();

CREATE TRIGGER trg_refund_coordinations_updated_at
  BEFORE UPDATE ON logistics_schema.refund_coordinations
  FOR EACH ROW
  EXECUTE FUNCTION logistics_schema._set_updated_at();

CREATE TRIGGER trg_investigations_updated_at
  BEFORE UPDATE ON logistics_schema.investigations
  FOR EACH ROW
  EXECUTE FUNCTION logistics_schema._set_updated_at();

-- ============================================================
-- SECURITY DEFINER FUNCTIONS
-- Per MOD-015 §4.8: helper functions for cross-module access control
-- ============================================================

-- 1. _moderator_can_access_escrow_state(p_user_id, p_escrow_id)
-- Allows MODERATOR/ADMIN/SUPER_ADMIN users to verify escrow state during dispute resolution
-- Returns TRUE if authenticated user has appropriate platform role AND the escrow exists
-- Used by moderation workflows to validate escrow release decisions
-- ============================================================

CREATE OR REPLACE FUNCTION logistics_schema._moderator_can_access_escrow_state(p_user_id UUID, p_escrow_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, logistics_schema, public, auth
AS $$
DECLARE
  v_role_count INTEGER;
BEGIN
  -- Check if user has MODERATOR, ADMIN, or SUPER_ADMIN platform role
  SELECT COUNT(*) INTO v_role_count
  FROM app.platform_roles pr
  WHERE pr.user_id = p_user_id
    AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN');

  -- Only proceed if user has appropriate platform role
  IF v_role_count = 0 THEN
    RETURN FALSE;
  END IF;

  -- Verify the escrow_id exists in financial_schema
  RETURN EXISTS (
    SELECT 1 FROM financial_schema.escrow_records er
    WHERE er.id = p_escrow_id AND er.is_deleted = FALSE
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION logistics_schema._moderator_can_access_escrow_state(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION logistics_schema._moderator_can_access_escrow_state(UUID, UUID) TO authenticated;

-- 2. _investigator_can_query_cross_module(p_investigation_id)
-- Allows investigators to access cross-module data during active investigations
-- Returns TRUE if authenticated user is the assigned investigator OR has platform role MODERATOR/ADMIN/SUPER_ADMIN
-- Uses platform_roles table to verify administrative privileges
-- Protects sensitive cross-module investigation data from unauthorized access
-- ============================================================

CREATE OR REPLACE FUNCTION logistics_schema._investigator_can_query_cross_module(p_investigation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, logistics_schema, public, auth
AS $$
DECLARE
  v_assigned_investigator UUID;
  v_is_platform_role BOOLEAN;
BEGIN
  -- Get the assigned investigator for this investigation
  SELECT i.investigator_id INTO v_assigned_investigator
  FROM logistics_schema.investigations i
  WHERE i.id = p_investigation_id AND i.is_deleted = FALSE;

  -- If investigation not found or not assigned, deny access
  IF v_assigned_investigator IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Grant access to assigned investigator
  IF auth.uid() = v_assigned_investigator THEN
    RETURN TRUE;
  END IF;

  -- Check if user has MODERATOR, ADMIN, or SUPER_ADMIN platform role
  SELECT EXISTS (
    SELECT 1 FROM app.platform_roles pr
    WHERE pr.user_id = auth.uid()
      AND pr.role IN ('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  ) INTO v_is_platform_role;

  RETURN v_is_platform_role;
END;
$$;

REVOKE EXECUTE ON FUNCTION logistics_schema._investigator_can_query_cross_module(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION logistics_schema._investigator_can_query_cross_module(UUID) TO authenticated;
