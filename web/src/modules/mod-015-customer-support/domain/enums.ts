// NexCargo MOD-015 — Customer Support & Dispute Resolution Module Local Enums
// Wave 3 — Increment 2 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)
// Reference: MOD-015 §§4 Core Domain Entities (§§4.1–§4.9), §5 Lifecycle Models, §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO auto-decision logic or automatic dispute resolution (§7.1, §7.5)
// - All structures are design-time specification artifacts only
// - Enforcement of non-decision authority rules per §7.1, §7.8

/** Support ticket status lifecycle per MOD-015 §4.1, §5.1 */
export enum SupportTicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

/** Dispute case status lifecycle per MOD-015 §4.2, §5.2 */
export enum DisputeStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

/** Dispute categorization per MOD-015 §3.2 */
export enum DisputeType {
  PAYMENT = 'PAYMENT',
  DELIVERY = 'DELIVERY',
  DAMAGE = 'DAMAGE',
  DELAY = 'DELAY',
  CONTRACT = 'CONTRACT',
}

/** Incident severity classification per MOD-015 §4.3, §3.3 */
export enum IncidentSeverity {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

/** Escalation level hierarchy per MOD-015 §4.4, §3.4 */
export enum EscalationLevel {
  L1_SUPPORT = 'L1_SUPPORT',
  L2_SUPERVISOR = 'L2_SUPERVISOR',
  L3_ADMIN_MODERATOR = 'L3_ADMIN_MODERATOR',
}

/** Support channel per MOD-015 §4.1, §3.1 */
export enum Channel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  CALL = 'CALL',
  API = 'API',
}

/** Support request category per MOD-015 §4.1 */
export enum Category {
  SHIPMENT = 'SHIPMENT',
  PAYMENT = 'PAYMENT',
  ACCOUNT = 'ACCOUNT',
  TECHNICAL = 'TECHNICAL',
  OPERATIONAL = 'OPERATIONAL',
}

/** Priority levels for tickets and escalations per MOD-015 §4.1, §4.4 */
export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Refund type per MOD-015 §4.6, §3.6 */
export enum RefundType {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
  COMPENSATION = 'COMPENSATION',
}

/** Approval status for refund coordination per MOD-015 §4.6 */
export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
}

/** Shipment incident type per MOD-015 §4.3, §3.3 */
export enum IncidentType {
  VEHICLE_BREAKDOWN = 'VEHICLE_BREAKDOWN',
  BORDER_DELAY = 'BORDER_DELAY',
  CARGO_DAMAGE = 'CARGO_DAMAGE',
  ROUTE_DEVIATION = 'ROUTE_DEVIATION',
  THEFT_LOSS = 'THEFT_LOSS',
  WEATHER = 'WEATHER',
  CONGESTION = 'CONGESTION',
}

/** Incident detection source per MOD-015 §4.3, §5.3 */
export enum DetectionSource {
  MOD_017 = 'MOD_017',
  MOD_006 = 'MOD_006',
  USER_REPORT = 'USER_REPORT',
  MANUAL = 'MANUAL',
}

/** Operational exception type per MOD-015 §4.5, §3.5 */
export enum ExceptionType {
  MINOR_DELAY = 'MINOR_DELAY',
  ROUTE_CHANGE = 'ROUTE_CHANGE',
  WEATHER = 'WEATHER',
  CONGESTION = 'CONGESTION',
}

/** Operational exception status per MOD-015 §4.5 */
export enum ExceptionStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
}

/** Investigation status per MOD-015 §4.8, §3.7 */
export enum InvestigationStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

/** AI suggestion type per MOD-015 §4.7, §3.1 */
export enum SuggestionType {
  CLASSIFICATION = 'CLASSIFICATION',
  RESOLUTION_PROPOSAL = 'RESOLUTION_PROPOSAL',
  ESCALATION_RECOMMENDATION = 'ESCALATION_RECOMMENDATION',
  EVIDENCE_SUGGESTION = 'EVIDENCE_SUGGESTION',
}

/** Human approval status for AI suggestions per MOD-015 §4.7 */
export enum HumanApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Case status for SLA tracking per MOD-015 §7.6 */
export enum SlaTimerStatus {
  RUNNING = 'RUNNING',
  BREACHED = 'BREACHED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}
