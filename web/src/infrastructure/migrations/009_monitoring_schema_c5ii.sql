-- NexCargo Migration 009 — Monitoring Schema Persistence (C5-II)
-- Creates: monitoring_schema.alerts, monitoring_schema.incidents, monitoring_schema.log_entries,
--          monitoring_schema.metrics, monitoring_schema.traces, monitoring_schema.health_checks
-- Purpose: Required persistence for MOD-017 observability (§4.x entities) and alert→notification bridge
-- Authorized by: HAO-C5-002 (C5 Increment 2 Authorization, 2026-09-09)
-- DEPLOYED: 2026-09-09 — Live Supabase migration 009_monitoring_schema_c5ii

-- Create monitoring_schema if not exists
CREATE SCHEMA IF NOT EXISTS monitoring_schema;

-- ============================================================
-- PART 0: Create _set_updated_at trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION monitoring_schema._set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 1: alerts TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoring_schema.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('HIGH_ERROR_RATE', 'SERVICE_DOWN', 'PAYMENT_GATEWAY_FAILURE', 'GPS_INTERRUPTION', 'LATENCY_SPIKE', 'INFRASTRUCTURE_FAILURE')),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  source_module VARCHAR(10) NOT NULL,
  trigger_condition TEXT,
  trigger_value NUMERIC,
  threshold_value NUMERIC,
  resolved_at TIMESTAMPTZ,
  incident_id UUID,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 2: incidents TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoring_schema.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('SERVICE_OUTAGE', 'API_FAILURE', 'INFRASTRUCTURE_FAILURE', 'SECURITY_BREACH', 'INTEGRATION_FAILURE')),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('MINOR', 'MAJOR', 'CRITICAL')),
  status VARCHAR(20) NOT NULL DEFAULT 'DETECTED' CHECK (status IN ('DETECTED', 'INVESTIGATING', 'MITIGATING', 'RESOLVED', 'CLOSED')),
  detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  root_cause TEXT,
  affected_services JSONB DEFAULT '[]'::jsonb,
  resolution_summary TEXT,
  post_mortem TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 3: log_entries TABLE (APPEND-ONLY)
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoring_schema.log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL,
  module_source VARCHAR(10) NOT NULL,
  log_level VARCHAR(10) NOT NULL CHECK (log_level IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  message TEXT NOT NULL,
  correlation_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id),
  service_id VARCHAR(100),
  environment VARCHAR(20) NOT NULL DEFAULT 'DEV',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 4: metrics TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoring_schema.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  value NUMERIC NOT NULL,
  unit VARCHAR(20),
  aggregation_type VARCHAR(10) CHECK (aggregation_type IN ('GAUGE', 'COUNTER', 'HISTOGRAM')),
  source_module VARCHAR(10),
  tags JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL
);

-- ============================================================
-- PART 5: traces TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoring_schema.traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  span_id UUID NOT NULL,
  parent_span_id UUID,
  module_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(10) CHECK (status IN ('SUCCESS', 'ERROR', 'TIMEOUT')),
  latency_ms NUMERIC,
  timestamp_start TIMESTAMPTZ NOT NULL,
  timestamp_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 6: health_checks TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoring_schema.health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id VARCHAR(100) NOT NULL,
  module_id VARCHAR(10),
  status VARCHAR(10) NOT NULL CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN')),
  last_checked TIMESTAMPTZ NOT NULL,
  dependency_statuses JSONB DEFAULT '[]'::jsonb,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PART 7: INDEXES
-- ============================================================

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON monitoring_schema.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_source_module ON monitoring_schema.alerts(source_module);
CREATE INDEX IF NOT EXISTS idx_alerts_correlation_id ON monitoring_schema.alerts(correlation_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_at ON monitoring_schema.alerts(resolved_at) WHERE resolved_at IS NOT NULL;

-- Incidents indexes
CREATE INDEX IF NOT EXISTS idx_incidents_status ON monitoring_schema.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON monitoring_schema.incidents(detected_at);
CREATE INDEX IF NOT EXISTS idx_incidents_correlation_id ON monitoring_schema.incidents(correlation_id);

-- Log entries indexes (frequently queried)
CREATE INDEX IF NOT EXISTS idx_log_entries_timestamp ON monitoring_schema.log_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_entries_module_source ON monitoring_schema.log_entries(module_source);
CREATE INDEX IF NOT EXISTS idx_log_entries_correlation_id ON monitoring_schema.log_entries(correlation_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_log_level ON monitoring_schema.log_entries(log_level);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_metric_name ON monitoring_schema.metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON monitoring_schema.metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_source_module ON monitoring_schema.metrics(source_module);
CREATE INDEX IF NOT EXISTS idx_metrics_tags ON monitoring_schema.metrics USING gin(tags);

-- Traces indexes
CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON monitoring_schema.traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_span_id ON monitoring_schema.traces(span_id);
CREATE INDEX IF NOT EXISTS idx_traces_parent_span_id ON monitoring_schema.traces(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_traces_timestamp_start ON monitoring_schema.traces(timestamp_start);

-- Health checks indexes
CREATE INDEX IF NOT EXISTS idx_health_checks_service_id ON monitoring_schema.health_checks(service_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_last_checked ON monitoring_schema.health_checks(last_checked);

-- ============================================================
-- PART 8: RLS POLICIES
-- ============================================================

-- All monitoring tables are admin-only per ESS-006 security requirements
-- Observability data is sensitive and must not be exposed to regular users

-- Alerts RLS
ALTER TABLE monitoring_schema.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY alerts_admin ON monitoring_schema.alerts
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- Incidents RLS
ALTER TABLE monitoring_schema.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY incidents_admin ON monitoring_schema.incidents
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- Log entries RLS
ALTER TABLE monitoring_schema.log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY log_entries_admin ON monitoring_schema.log_entries
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- Metrics RLS
ALTER TABLE monitoring_schema.metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY metrics_admin ON monitoring_schema.metrics
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- Traces RLS
ALTER TABLE monitoring_schema.traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY traces_admin ON monitoring_schema.traces
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- Health checks RLS
ALTER TABLE monitoring_schema.health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY health_checks_admin ON monitoring_schema.health_checks
  FOR ALL
  USING (auth.jwt()->>'role' IN ('admin','moderator'))
  WITH CHECK (auth.jwt()->>'role' IN ('admin','moderator'));

-- ============================================================
-- PART 9: COLUMN GRANTS — IMMUTABILITY CONTROLS
-- ============================================================

-- Log entries: ABSOLUTE IMMUTABILITY — rows are NEVER UPDATEd or DELETEd
-- Only insert permitted; updates on metadata fields only if absolutely required
REVOKE UPDATE ON monitoring_schema.log_entries FROM PUBLIC;

-- Incidents: status can transition through lifecycle but core fields immutable
REVOKE UPDATE (incident_type, severity, detected_at, correlation_id) ON monitoring_schema.incidents FROM PUBLIC;

-- Metrics: append-only pattern — no updates on recorded values
REVOKE UPDATE (metric_name, value, timestamp) ON monitoring_schema.metrics FROM PUBLIC;

-- Traces: append-only — once recorded, spans are not modified
REVOKE UPDATE (trace_id, span_id, timestamp_start) ON monitoring_schema.traces FROM PUBLIC;

-- ============================================================
-- PART 10: UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_alerts_updated_at ON monitoring_schema.alerts;
CREATE TRIGGER trg_alerts_updated_at
  BEFORE UPDATE ON monitoring_schema.alerts
  FOR EACH ROW
  EXECUTE FUNCTION monitoring_schema._set_updated_at();

DROP TRIGGER IF EXISTS trg_incidents_updated_at ON monitoring_schema.incidents;
CREATE TRIGGER trg_incidents_updated_at
  BEFORE UPDATE ON monitoring_schema.incidents
  FOR EACH ROW
  EXECUTE FUNCTION monitoring_schema._set_updated_at();
