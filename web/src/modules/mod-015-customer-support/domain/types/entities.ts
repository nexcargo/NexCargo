// NexCargo MOD-015 — Customer Support & Dispute Resolution Module Domain Types
// Wave 3 — Increment 2 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)
// Reference: MOD-015 §4 Core Domain Entities (§§4.1–§4.9), §7 Rules of Operation
//
// CRITICAL CONSTRAINTS:
// - NO auto-resolution logic or dispute outcome decisions (§7.1, §7.5, §7.8)
// - All structures are design-time specification artifacts only
// - Evidence-based disputes require MOD-004 linkage (§7.2)
// - Separation of authority: moderators recommend, admins oversee, financial outcomes via MOD-013 (§7.3)

import type { BaseEntity } from '@/shared/base-classes/base-entity';
import type {
  SupportTicketStatus,
  DisputeStatus,
  DisputeType,
  IncidentSeverity,
  EscalationLevel,
  Channel,
  Category,
  Priority,
  RefundType,
  ApprovalStatus,
  IncidentType,
  DetectionSource,
  ExceptionType,
  ExceptionStatus,
  InvestigationStatus,
  SuggestionType,
  HumanApprovalStatus,
  SlaTimerStatus,
} from '../enums';

// ============================================================
// Sub-interfaces (non-entity, no BaseEntity extension)
// ============================================================

/** Structured evidence attachment linked to a dispute per MOD-015 §4.2, §7.2 */
export interface EvidenceAttachment {
  /** MOD-004 document reference identifier */
  documentRefId: string;
  /** Type of evidence being submitted */
  evidenceCategory: string;
  /** Description of evidence relevance */
  description: string;
  /** Timestamp when evidence was attached */
  attachedAt: Date;
}

/** SLA timer tracking per MOD-015 §4.4, §7.6 */
export interface SLATimer {
  /** Timer identifier */
  timerId: string;
  /** Associated case or escalation ID */
  relatedCaseId: string;
  /** Current SLA target in hours */
  targetHours: number;
  /** Elapsed time in hours */
  elapsedHours: number;
  /** Whether SLA has been breached */
  isBreached: boolean;
  /** Timestamp when SLA timer started */
  startedAt: Date;
  /** Optional breach timestamp */
  breachedAt?: Date;
  /** Status of the SLA timer */
  status: SlaTimerStatus;
}

/** Investigation note per MOD-015 §4.8 */
export interface InvestigationNote {
  /** Note identifier */
  noteId: string;
  /** Author investigator ID */
  authorId: string;
  /** Timestamp of note entry */
  createdAt: Date;
  /** Note content */
  content: string;
}

/** Audit trail action record per MOD-015 §7.4 */
export interface ActionAuditTrail {
  /** Unique action identifier */
  actionId: string;
  /** Actor who performed the action */
  actorId: string;
  /** Action type performed */
  actionType: string;
  /** Target entity affected */
  targetEntity: string;
  /** Previous state before action */
  previousState?: string;
  /** New state after action */
  newState: string;
  /** Timestamp of action */
  timestamp: Date;
  /** Justification comment (required for financial/legal actions) */
  justification?: string;
}

/** Compensation policy rule per MOD-015 §4.6, §3.6 */
export interface CompensationPolicyRule {
  /** Rule identifier */
  ruleId: string;
  /** Dispute type this rule applies to */
  applicableDisputeTypes: DisputeType[];
  /** Maximum compensation percentage */
  maxCompensationPercent: number;
  /** Minimum evidence threshold required */
  minEvidenceCount: number;
  /** Required approver level */
  requiredApproverLevel: EscalationLevel;
}

// ============================================================
// Entity types (extend BaseEntity with snake_case fields)
// Per BaseEntity: id, created_at, updated_at, version, bumpVersion(), toJSON()
// ============================================================

/**
 * Support Ticket Object — user or system support request.
 * Per MOD-015 §4.1
 * Must be role-aware (shipper, transporter, driver).
 * AI may assist but cannot finalize critical decisions.
 */
export interface SupportTicketObject extends BaseEntity {
  /** Unique identifier for this support ticket */
  ticketId: string;
  /** User or system requesting support */
  requesterId: string;
  /** Request category classification */
  category: Category;
  /** Urgency priority level */
  priorityLevel: Priority;
  /** Current lifecycle status */
  status: SupportTicketStatus;
  /** Assigned support agent ID */
  assignedAgentId?: string;
  /** Channel through which the request was received */
  channel: Channel;
  /** Whether the associated SLA timer has breached */
  slaBreach: boolean;
  /** Timestamp when the ticket was resolved (optional) */
  resolvedAt?: Date;
  /** Timestamp when the ticket was closed */
  closedAt?: Date;
  /** Structured SLA timer tracking */
  slaTimer: SLATimer;
  /** Case ID linking related interactions (all support interactions must link to a case ID) */
  caseId: string;
  /** Role context of requester (shipper, transporter, driver) */
  requesterRole: string;
}

/**
 * Dispute Case Object — formal dispute record tied to shipment or transaction.
 * Per MOD-015 §4.2
 * All disputes must be tied to a shipment or transaction.
 * Escrow funds (MOD-013) may be frozen during disputes.
 * Moderator approval required for financial impact decisions.
 */
export interface DisputeCaseObject extends BaseEntity {
  /** Unique identifier for this dispute case */
  disputeId: string;
  /** MOD-003 shipment reference */
  relatedShipmentId: string;
  /** MOD-002 contract reference */
  relatedContractId: string;
  /** MOD-013 escrow reference */
  relatedEscrowId: string;
  /** Type of dispute */
  disputeType: DisputeType;
  /** Party initiating the dispute */
  initiatorId: string;
  /** Party responding to the dispute */
  respondentId: string;
  /** Current lifecycle status */
  status: DisputeStatus;
  /** Linked evidence documents from MOD-004 */
  evidenceReferences: EvidenceAttachment[];
  /** Optional final resolution outcome */
  resolutionOutcome?: string;
  /** Decision maker (moderator/admin) ID */
  decisionMakerId?: string;
  /** When the decision was made */
  decisionTimestamp?: Date;
  /** Summary of the resolution */
  resolutionSummary?: string;
  /** Structured SLA timer tracking */
  slaTimer: SLATimer;
  /** Case ID linking all dispute interactions */
  caseId: string;
}

/**
 * Shipment Incident Object — operational incidents affecting shipments.
 * Per MOD-015 §4.3
 * Must be linked to live tracking data (MOD-003).
 * AI may detect incidents automatically (MOD-006).
 * Incident severity classification is required.
 */
export interface ShipmentIncidentObject extends BaseEntity {
  /** Unique identifier for this incident */
  incidentId: string;
  /** MOD-003 shipment reference */
  shipmentId: string;
  /** Type of incident */
  incidentType: IncidentType;
  /** Severity level classification */
  severityLevel: IncidentSeverity;
  /** Source that detected the incident */
  detectionSource: DetectionSource;
  /** Current lifecycle status */
  status: string; // DETECTED / UNDER_INVESTIGATION / CONTAINED / RESOLVED
  /** Array of module references affected */
  affectedModules: string[];
  /** Optional resolution tracking reference */
  resolutionTrackingId?: string;
  /** Optional dispute ID if escalated to formal dispute */
  disputeId?: string;
  /** Timestamp when incident was detected */
  detectedAt: Date;
  /** When the incident was resolved (optional) */
  resolvedAt?: Date;
  /** Human-readable description of the incident */
  description: string;
}

/**
 * Escalation Object — structured escalation flow.
 * Per MOD-015 §4.4
 * Escalation levels: L1 → L2 → L3.
 * SLA timers start upon case creation.
 * Breach alerts must trigger notifications.
 */
export interface EscalationObject extends BaseEntity {
  /** Unique identifier for this escalation */
  escalationId: string;
  /** Source case ID (ticket, dispute, or incident reference) */
  sourceCaseId: string;
  /** Escalation level */
  escalationLevel: EscalationLevel;
  /** Role assigned to handle escalation */
  assignedRole: string;
  /** User assigned to handle escalation */
  assignedUserId?: string;
  /** Reason for escalation */
  reason: string;
  /** Timestamp of escalation */
  timestamp: Date;
  /** Current status */
  status: string; // ACTIVE / COMPLETED / OVERRIDDEN
  /** When SLA timer started */
  slaTimerStartedAt: Date;
  /** When SLA timer expired (optional) */
  slaTimerExpiredAt?: Date;
  /** Structured SLA timer tracking */
  slaTimer: SLATimer;
}

/**
 * Operational Exception Object — operational disruptions not formal disputes.
 * Per MOD-015 §4.5
 * Exceptions may escalate into disputes.
 * AI may auto-detect exceptions from tracking data.
 * Exceptions do NOT automatically trigger financial holds.
 */
export interface OperationalExceptionObject extends BaseEntity {
  /** Unique identifier for this exception */
  exceptionId: string;
  /** MOD-003 shipment reference */
  shipmentId: string;
  /** Type of exception */
  exceptionType: ExceptionType;
  /** When detected */
  detectedAt: Date;
  /** Source of detection */
  detectionSource: string; // MOD_006 / MOD_017 / USER
  /** Current status */
  status: ExceptionStatus;
  /** Human-readable description */
  description: string;
  /** Optional dispute ID if escalated */
  escalatedToDisputeId?: string;
}

/**
 * Refund Coordination Object — financial adjustment coordination with MOD-013.
 * Per MOD-015 §4.6, §3.6
 * Refunds require dispute resolution approval.
 * Compensation follows predefined policy rules.
 * Partial refunds supported.
 * All transactions reconciled with ledger.
 */
export interface RefundCoordinationObject extends BaseEntity {
  /** Unique identifier for refund coordination */
  refundCoordinationId: string;
  /** Related dispute ID */
  disputeId: string;
  /** Related shipment ID */
  shipmentId: string;
  /** Type of refund */
  refundType: RefundType;
  /** Refund amount */
  amount: number;
  /** Currency code */
  currency: string;
  /** Recipient of the refund */
  recipientId: string;
  /** Approval status */
  approvalStatus: ApprovalStatus;
  /** Approver ID (moderator/admin) */
  approvedBy?: string;
  /** MOD-013 escrow release reference */
  escrowReleaseReference?: string;
  /** When executed against escrow (optional) */
  executedAt?: Date;
  /** Additional notes */
  notes?: string;
  /** Structured compensation policy rule applied */
  appliedPolicyRule?: CompensationPolicyRule;
}

/**
 * AI Support Interaction Object — AI-assisted support interactions.
 * Per MOD-015 §4.7
 * AI provides recommendations only.
 * No final resolution without human approval for financial/legal cases.
 * AI uses only verified platform data.
 */
export interface AISupportInteractionObject extends BaseEntity {
  /** Unique identifier for this interaction */
  interactionId: string;
  /** Parent case ID (ticket or dispute reference) */
  caseId: string;
  /** AI-generated recommendation */
  aiSuggestion: string;
  /** Confidence score (0–100) */
  confidenceScore: number;
  /** Type of suggestion */
  suggestionType: SuggestionType;
  /** Human approval status */
  humanApprovalStatus: HumanApprovalStatus;
  /** Who approved (optional) */
  approvedBy?: string;
  /** When generated */
  timestamp: Date;
}

/**
 * Investigation Record — internal admin investigation structure.
 * Per MOD-015 §4.8, §3.7
 * Access restricted to authorized roles.
 * All investigations logged.
 * No modification of historical records permitted.
 */
export interface InvestigationRecord extends BaseEntity {
  /** Unique identifier for this investigation */
  investigationId: string;
  /** Related case ID */
  caseId: string;
  /** Investigator ID */
  investigatorId: string;
  /** Structured timeline snapshot of the shipment */
  shipmentTimelineView: Record<string, unknown>;
  /** MOD-003 GPS replay reference */
  gpsReplayReference?: string;
  /** Structured MOD-013 financial flow inspection data */
  financialFlowInspection: Record<string, unknown>;
  /** MOD-004 document verification references */
  documentVerificationAccess: string[];
  /** MOD-006 + MOD-012 user behavior analysis references */
  userBehaviorAnalysis: string[];
  /** Investigation notes */
  notes: string;
  /** When investigation started */
  startedAt: Date;
  /** When completed (optional) */
  completedAt?: Date;
  /** Investigation findings */
  findings?: string;
  /** Current status */
  status: InvestigationStatus;
}

/**
 * Resolution Analytics Record — support and dispute operational metrics.
 * Per MOD-015 §4.9, §3.8
 * Data sourced from MOD-012 analytics layer.
 * Used to improve platform reliability and AI models.
 */
export interface ResolutionAnalyticsRecord extends BaseEntity {
  /** Unique identifier for this analytics record */
  analyticsId: string;
  /** Period start */
  periodStart: Date;
  /** Period end */
  periodEnd: Date;
  /** Average resolution time in hours */
  averageResolutionTime: number;
  /** Dispute frequency by corridor (structured JSON) */
  disputeFrequencyByCorridor: Record<string, number>;
  /** SLA compliance rate as percentage */
  slaComplianceRate: number;
  /** Total compensation volume */
  compensationVolume: number;
  /** Incident classification trends (structured JSON) */
  incidentClassificationTrends: Record<string, number>;
  /** When generated */
  generatedAt: Date;
}
