// NexCargo MOD-017 Domain Types — Incident Lifecycle Structure
// Authoritative source: MOD-017 §4.6 (Incident Object) + §3.6 (Incident Management)
// Implements exit criteria X-12: Incident object with lifecycle states, root cause, post-mortem fields

/**
 * Incident type enum per MOD-017 §4.6
 */
export enum IncidentType {
  SERVICE_OUTAGE = 'SERVICE_OUTAGE',
  API_FAILURE = 'API_FAILURE',
  INFRASTRUCTURE_FAILURE = 'INFRASTRUCTURE_FAILURE',
  SECURITY_BREACH = 'SECURITY_BREACH',
  INTEGRATION_FAILURE = 'INTEGRATION_FAILURE',
}

/**
 * Incident severity enum per MOD-017 §4.6
 */
export enum IncidentSeverity {
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

/**
 * Incident lifecycle status enum per MOD-017 §5.5 (Incident Lifecycle Model).
 * ANOMALY DETECTED → ALERT GENERATED → INCIDENT CREATED → INVESTIGATION → MITIGATION → RESOLUTION → POST-MORTEM → CLOSED
 */
export enum IncidentStatus {
  DETECTED = 'DETECTED',
  INVESTIGATING = 'INVESTIGATING',
  MITIGATING = 'MITIGATING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

/**
 * Affected service reference for an incident.
 */
export interface AffectedServiceRef {
  serviceId: string;
  moduleId: string;
  impactDescription?: string;
}

/**
 * Incident Object — represents a system-level incident (not user dispute).
 * Per MOD-017 §4.6.
 */
export interface IncidentObject {
  // Core attributes from MOD-017 §4.6
  incidentId: string;         // UUID v4
  incidentType: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectedAt: string;         // ISO 8601
  resolvedAt?: string;        // ISO 8601 — optional
  rootCause?: string;         // Optional — determined during investigation
  affectedServices: AffectedServiceRef[];
  alertIds: string[];         // Array of alert references that led to this incident
  resolutionSummary?: string; // Optional — summary of how the incident was resolved
  postMortem?: string;        // Optional — post-mortem documentation
}
