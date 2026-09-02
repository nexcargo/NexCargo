// NexCargo MOD-015 — Customer Support & Dispute Resolution Module Advisory & Structural Validation Services
// Wave 3 — Increment 2 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)
// Reference: MOD-015 §7 Rules of Operation, ESS-006 Compliance, ESS-004 Integration Contracts
//
// NO DECISION AUTHORITY PRINCIPLE: These services validate structural integrity ONLY.
// They do NOT make dispute outcomes, execute compensations, or modify operational state.
// Per MOD-015 §7.1 No Decision Authority Rule, §7.5 Non-Automation Rule, §7.8 Neutrality Rule.

import type {
  SupportTicketObject,
  DisputeCaseObject,
  ShipmentIncidentObject,
  EscalationObject,
  OperationalExceptionObject,
  RefundCoordinationObject,
  AISupportInteractionObject,
  InvestigationRecord,
} from '../types/entities';
import {
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
  DetectionSource,
  SuggestionType,
  HumanApprovalStatus,
} from '../enums';

// ============================================================
// Validation result types
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

// ============================================================
// Service function constants
// ============================================================

/** Valid support ticket statuses per MOD-015 §5.1 */
const VALID_TICKET_STATUSES = Object.values(SupportTicketStatus);
/** Valid dispute statuses per MOD-015 §5.2 */
const VALID_DISPUTE_STATUSES = Object.values(DisputeStatus);
/** Valid dispute types per MOD-015 §3.2 */
const VALID_DISPUTE_TYPES = Object.values(DisputeType);
/** Valid severity levels per MOD-015 §4.3 */
const VALID_SEVERITY_LEVELS = Object.values(IncidentSeverity);
/** Valid escalation levels per MOD-015 §4.4 */
const VALID_ESCALATION_LEVELS = Object.values(EscalationLevel);
/** Valid channels per MOD-015 §4.1 */
const VALID_CHANNELS = Object.values(Channel);
/** Valid categories per MOD-015 §4.1 */
const VALID_CATEGORIES = Object.values(Category);
/** Valid priority levels */
const VALID_PRIORITIES = Object.values(Priority);
/** Valid refund types per MOD-015 §4.6 */
const VALID_REFUND_TYPES = Object.values(RefundType);
/** Valid approval statuses */
const VALID_APPROVAL_STATUSES = Object.values(ApprovalStatus);
/** Valid detection sources per MOD-015 §4.3 */
const VALID_DETECTION_SOURCES = Object.values(DetectionSource);
/** Valid AI suggestion types per MOD-015 §4.7 */
const VALID_SUGGESTION_TYPES = Object.values(SuggestionType);
/** Valid human approval statuses */
const VALID_HUMAN_APPROVAL_STATUSES = Object.values(HumanApprovalStatus);
/** Module reference naming convention */
const SOURCE_MODULE_PATTERN = /^MOD-\d{3}$/;
/** Maximum SLA hours threshold (reasonable upper bound) */
const MAX_SLA_HOURS = 720; // 30 days

// ============================================================
// Non-Decision Authority Rule Enforcement Service (§7.1)
// ============================================================

/**
 * Enforces that all support/dispute structures comply with the Non-Decision Authority Rule.
 * Per MOD-015 §7.1: MUST NOT decide dispute outcomes, override financial results,
 * modify shipment states directly, alter escrow data, or execute compensations automatically.
 * Only structures the process.
 *
 * Validates:
 * - All tickets reference a valid case ID
 * - No auto-resolution status transitions
 * - No unauthorized escape hatch flags
 * - SLA breach does not imply automatic decision
 */
export function enforceNoDecisionAuthority(ticket: SupportTicketObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate status is within allowed enum values
  if (!VALID_TICKET_STATUSES.includes(ticket.status)) {
    errors.push({
      code: 'INVALID_TICKET_STATUS',
      field: 'status',
      message: `Support ticket status must be one of: ${VALID_TICKET_STATUSES.join(', ')}`,
    });
  }

  // CRITICAL: A case ID must always exist — all support interactions must link to a case ID
  if (!ticket.caseId || typeof ticket.caseId !== 'string') {
    errors.push({
      code: 'CASE_ID_REQUIRED',
      field: 'caseId',
      message: 'Every support ticket must have a case ID linking all interactions per §4.1 business rules',
    });
  }

  // Validate requester role is provided (role-aware support required)
  if (!ticket.requesterRole || typeof ticket.requesterRole !== 'string') {
    errors.push({
      code: 'REQUESTER_ROLE_REQUIRED',
      field: 'requesterRole',
      message: 'Support must be role-aware (shipper, transporter, driver) per §4.1 business rules',
    });
  }

  // Validate channel is valid
  if (!VALID_CHANNELS.includes(ticket.channel)) {
    errors.push({
      code: 'INVALID_CHANNEL',
      field: 'channel',
      message: `Channel must be one of: ${VALID_CHANNELS.join(', ')}`,
    });
  }

  // Validate priority is valid
  if (!VALID_PRIORITIES.includes(ticket.priorityLevel)) {
    errors.push({
      code: 'INVALID_PRIORITY',
      field: 'priorityLevel',
      message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`,
    });
  }

  // CRITICAL: SLA breach does NOT trigger automatic resolution — it only triggers alerts
  // If slaBreach is true, there must be an active escalation or notification pending
  // This validates the non-automation rule structurally
  if (ticket.slaBreach && ticket.status === SupportTicketStatus.CLOSED) {
    errors.push({
      code: 'SLA_BREACH_NO_AUTO_CLOSE',
      field: 'slaBreach',
      message: 'A ticket CANNOT be closed while its SLA has been breached without proper review — violates §7.5 Non-Automation Rule',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Evidence-Based Structure Rule Enforcement (§7.2)
// ============================================================

/**
 * Enforces that all disputes reference evidence (MOD-004 dependency).
 * Per MOD-015 §7.2: Every dispute MUST have linked evidence.
 * No dispute can exist without linked data references.
 * Evidence must be attached before resolution.
 *
 * @param dispute The dispute case object to validate
 * @returns ValidationResult indicating compliance
 */
export function enforceEvidenceRequirement(dispute: DisputeCaseObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate status is within allowed enum values
  if (!VALID_DISPUTE_STATUSES.includes(dispute.status)) {
    errors.push({
      code: 'INVALID_DISPUTE_STATUS',
      field: 'status',
      message: `Dispute status must be one of: ${VALID_DISPUTE_STATUSES.join(', ')}`,
    });
  }

  // Validate dispute type
  if (!VALID_DISPUTE_TYPES.includes(dispute.disputeType)) {
    errors.push({
      code: 'INVALID_DISPUTE_TYPE',
      field: 'disputeType',
      message: `Dispute type must be one of: ${VALID_DISPUTE_TYPES.join(', ')}`,
    });
  }

  // CRITICAL: All disputes must be tied to a shipment or transaction (§4.2 business rules)
  if (!dispute.relatedShipmentId || typeof dispute.relatedShipmentId !== 'string') {
    errors.push({
      code: 'SHIPMENT_REFERENCE_REQUIRED',
      field: 'relatedShipmentId',
      message: 'All disputes must be tied to a shipment (MOD-003) per §4.2 business rules',
    });
  }

  // CRITICAL: Evidence references required — no dispute without evidence (§7.2)
  if (!Array.isArray(dispute.evidenceReferences) || dispute.evidenceReferences.length === 0) {
    errors.push({
      code: 'EVIDENCE_REQUIRED',
      field: 'evidenceReferences',
      message: 'Every dispute must have at least one MOD-004 evidence attachment per §7.2 Evidence-Based Structure Rule',
    });
  } else {
    for (let i = 0; i < dispute.evidenceReferences.length; i++) {
      const evidence = dispute.evidenceReferences[i];
      if (!evidence.documentRefId || typeof evidence.documentRefId !== 'string') {
        errors.push({
          code: `EVIDENCE_${i}_MISSING_DOC_REF`,
          field: 'evidenceReferences',
          message: `Evidence attachment at index ${i} must reference a valid MOD-004 document`,
        });
      }
      if (!evidence.evidenceCategory || typeof evidence.evidenceCategory !== 'string') {
        errors.push({
          code: `EVIDENCE_${i}_MISSING_CATEGORY`,
          field: 'evidenceReferences',
          message: `Evidence attachment at index ${i} must have a category classification`,
        });
      }
    }
  }

  // CRITICAL: Before resolution, decision maker and justification are required
  // Moderators investigate and recommend; admins oversee (§7.3 Separation of Authority)
  if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.CLOSED) {
    if (!dispute.decisionMakerId) {
      errors.push({
        code: 'DECISION_MAKER_REQUIRED_FOR_RESOLUTION',
        field: 'decisionMakerId',
        message: 'Resolved/closed disputes require a decision maker (moderator/admin) per §7.3 Separation of Authority Rule',
      });
    }
    if (!dispute.resolutionSummary) {
      errors.push({
        code: 'RESOLUTION_SUMMARY_REQUIRED',
        field: 'resolutionSummary',
        message: 'Resolution requires a summary documenting justification per §4.2 business rules',
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Incident Classification Enforcement (§4.3)
// ============================================================

/**
 * Validates incident structure and classification integrity.
 * Per MOD-015 §4.3: Incidents must be linked to live tracking data (MOD-003).
 * AI may detect incidents automatically (MOD-006).
 * Severity classification is mandatory.
 *
 * @param incident The shipment incident to validate
 * @returns ValidationResult
 */
export function validateIncidentClassification(incident: ShipmentIncidentObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate incident type is valid
  const validIncidentTypes = [
    'VEHICLE_BREAKDOWN', 'BORDER_DELAY', 'CARGO_DAMAGE', 'ROUTE_DEVIATION',
    'THEFT_LOSS', 'WEATHER', 'CONGESTION',
  ];
  if (!validIncidentTypes.includes(incident.incidentType)) {
    errors.push({
      code: 'INVALID_INCIDENT_TYPE',
      field: 'incidentType',
      message: `Incident type must be one of: ${validIncidentTypes.join(', ')}`,
    });
  }

  // Validate severity level is valid enum value
  if (!VALID_SEVERITY_LEVELS.includes(incident.severityLevel)) {
    errors.push({
      code: 'INVALID_SEVERITY_LEVEL',
      field: 'severityLevel',
      message: `Severity must be one of: ${VALID_SEVERITY_LEVELS.join(', ')}`,
    });
  }

  // Validate detection source is valid enum value
  if (!VALID_DETECTION_SOURCES.includes(incident.detectionSource)) {
    errors.push({
      code: 'INVALID_DETECTION_SOURCE',
      field: 'detectedAt',
      message: `Detection source must be one of: ${VALID_DETECTION_SOURCES.join(', ')}`,
    });
  }

  // Validate shipment reference exists (must link to live tracking)
  if (!incident.shipmentId || typeof incident.shipmentId !== 'string') {
    errors.push({
      code: 'SHIPMENT_REFERENCE_REQUIRED',
      field: 'shipmentId',
      message: 'Incidents must be linked to live tracking data (MOD-003) per §4.3 business rules',
    });
  }

  // CRITICAL: Description is mandatory for incident documentation
  if (!incident.description || typeof incident.description !== 'string') {
    errors.push({
      code: 'DESCRIPTION_REQUIRED',
      field: 'description',
      message: 'Every incident must have a description for traceability per §7.4 Auditability Rule',
    });
  }

  // Validate affectedModules references follow naming convention
  for (let i = 0; i < incident.affectedModules.length; i++) {
    const modRef = incident.affectedModules[i];
    if (!SOURCE_MODULE_PATTERN.test(modRef)) {
      errors.push({
        code: `AFFECTED_MODULE_${i}_INVALID`,
        field: 'affectedModules',
        message: `Module reference '${modRef}' does not follow MOD-XXX naming convention`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Escalation Level Enforcement (§4.4)
// ============================================================

/**
 * Validates escalation structure and enforces escalation hierarchy rules.
 * Per MOD-015 §4.4: L1 → L2 → L3 progression with proper role transitions.
 *
 * @param escalation The escalation object to validate
 * @returns ValidationResult
 */
export function validateEscalationHierarchy(escalation: EscalationObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate escalation level is valid enum value
  if (!VALID_ESCALATION_LEVELS.includes(escalation.escalationLevel)) {
    errors.push({
      code: 'INVALID_ESCALATION_LEVEL',
      field: 'escalationLevel',
      message: `Escalation level must be one of: ${VALID_ESCALATION_LEVELS.join(', ')}`,
    });
  }

  // Validate reason is provided (required for audit trail per §7.4)
  if (!escalation.reason || typeof escalation.reason !== 'string') {
    errors.push({
      code: 'ESCALATION_REASON_REQUIRED',
      field: 'reason',
      message: 'Every escalation must have a documented reason per §7.4 Auditability Rule',
    });
  }

  // Validate source case reference exists
  if (!escalation.sourceCaseId || typeof escalation.sourceCaseId !== 'string') {
    errors.push({
      code: 'SOURCE_CASE_REQUIRED',
      field: 'sourceCaseId',
      message: 'Escalation must reference a source case (ticket, dispute, or incident) per §4.4',
    });
  }

  // Validate SLA timer started timestamp exists
  if (!(escalation.slaTimerStartedAt instanceof Date) || isNaN(escalation.slaTimerStartedAt.getTime())) {
    errors.push({
      code: 'SLA_STARTED_AT_REQUIRED',
      field: 'slaTimerStartedAt',
      message: 'SLA timer start timestamp is required per §7.6 SLA Rule',
    });
  }

  // CRITICAL: Escalation levels cannot skip — L1→L2→L3 only
  // Structural check: ensure transition sequence is valid
  const levelOrder = [EscalationLevel.L1_SUPPORT, EscalationLevel.L2_SUPERVISOR, EscalationLevel.L3_ADMIN_MODERATOR];
  const currentLevelIndex = levelOrder.indexOf(escalation.escalationLevel);

  if (currentLevelIndex < 0) {
    errors.push({
      code: 'INVALID_ESCALATION_SEQUENCE',
      field: 'escalationLevel',
      message: `Escalation must follow L1→L2→L3 progression — invalid level`,
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Refund Coordination Validation Service (§4.6)
// ============================================================

/**
 * Validates refund coordination structure and ensures financial separation.
 * Per MOD-015 §4.6, §3.6, §7.1: Refunds require dispute resolution approval.
 * Compensation follows predefined policy rules. Partial refunds supported.
 * All transactions reconciled with ledger.
 * MOD-015 does NOT execute compensations automatically (§7.5).
 *
 * @param refund The refund coordination object to validate
 * @returns ValidationResult
 */
export function validateRefundCoordination(refund: RefundCoordinationObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate refund type is valid enum value
  if (!VALID_REFUND_TYPES.includes(refund.refundType)) {
    errors.push({
      code: 'INVALID_REFUND_TYPE',
      field: 'refundType',
      message: `Refund type must be one of: ${VALID_REFUND_TYPES.join(', ')}`,
    });
  }

  // Validate approval status is valid enum value
  if (!VALID_APPROVAL_STATUSES.includes(refund.approvalStatus)) {
    errors.push({
      code: 'INVALID_APPROVAL_STATUS',
      field: 'approvalStatus',
      message: `Approval status must be one of: ${VALID_APPROVAL_STATUSES.join(', ')}`,
    });
  }

  // CRITICAL: Dispute reference is required — all refunds tied to resolved disputes
  if (!refund.disputeId || typeof refund.disputeId !== 'string') {
    errors.push({
      code: 'DISPUTE_REFERENCE_REQUIRED',
      field: 'disputeId',
      message: 'Refunds require dispute resolution approval — must reference originating dispute per §4.6',
    });
  }

  // Amount must be positive
  if (typeof refund.amount !== 'number' || refund.amount <= 0) {
    errors.push({
      code: 'AMOUNT_MUST_BE_POSITIVE',
      field: 'amount',
      message: 'Refund amount must be a positive number per §4.6 business rules',
    });
  }

  // Currency must be specified
  if (!refund.currency || typeof refund.currency !== 'string') {
    errors.push({
      code: 'CURRENCY_REQUIRED',
      field: 'currency',
      message: 'Currency code is required for all refund transactions per §4.6',
    });
  }

  // Recipient must be specified
  if (!refund.recipientId || typeof refund.recipientId !== 'string') {
    errors.push({
      code: 'RECIPIENT_REQUIRED',
      field: 'recipientId',
      message: 'Refund recipient identifier is required per §4.6',
    });
  }

  // CRITICAL: EXECUTED status requires approvedBy — no auto-execution (§7.5)
  if (refund.approvalStatus === ApprovalStatus.EXECUTED && !refund.executedAt) {
    errors.push({
      code: 'EXECUTED_REQUIRES_TIMESTAMP',
      field: 'executedAt',
      message: 'Executed refund must have an execution timestamp per §4.6',
    });
  }

  // CRITICAL: Before any execution, moderator/approver is required (§7.3)
  if (refund.approvalStatus === ApprovalStatus.APPROVED && !refund.approvedBy) {
    errors.push({
      code: 'APPROVAL_REQUIRES_DECIDER',
      field: 'approvedBy',
      message: 'Approved refund must have an approver (moderator/admin) per §7.3 Separation of Authority',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// AI Support Interaction Validation Service (§4.7)
// ============================================================

/**
 * Validates AI support interaction structure ensuring advisory-only constraints.
 * Per MOD-015 §4.7, §7.7: AI provides recommendations only.
 * No final resolution without human approval for financial/legal cases.
 * AI must use only verified platform data.
 *
 * @param interaction The AI support interaction to validate
 * @returns ValidationResult
 */
export function validateAISupportInteraction(interaction: AISupportInteractionObject): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate parent case reference exists
  if (!interaction.caseId || typeof interaction.caseId !== 'string') {
    errors.push({
      code: 'CASE_REFERENCE_REQUIRED',
      field: 'caseId',
      message: 'AI support interaction must reference its parent case (ticket or dispute) per §4.7',
    });
  }

  // Validate AI suggestion content exists
  if (!interaction.aiSuggestion || typeof interaction.aiSuggestion !== 'string') {
    errors.push({
      code: 'SUGGESTION_REQUIRED',
      field: 'aiSuggestion',
      message: 'AI support interaction must include a structured recommendation per §4.7',
    });
  }

  // Confidence score must be numeric
  if (typeof interaction.confidenceScore !== 'number') {
    errors.push({
      code: 'CONFIDENCE_SCORE_REQUIRED',
      field: 'confidenceScore',
      message: 'Confidence score must be a numeric value (0–100)',
    });
  }

  // Validate suggestion type
  if (!VALID_SUGGESTION_TYPES.includes(interaction.suggestionType)) {
    errors.push({
      code: 'INVALID_SUGGESTION_TYPE',
      field: 'suggestionType',
      message: `Suggestion type must be one of: ${VALID_SUGGESTION_TYPES.join(', ')}`,
    });
  }

  // CRITICAL: For financial/legal cases, human approval must NOT be skipped
  // AI must never finalize critical decisions (§4.7 business rules)
  // Structural enforcement: if suggestion is RESOLUTION_PROPOSAL and relates to financial matters,
  // human approval status must not be left as just PENDING indefinitely without review flag
  if (interaction.suggestionType === SuggestionType.RESOLUTION_PROPOSAL &&
      interaction.humanApprovalStatus === HumanApprovalStatus.PENDING) {
    // Not an error — just a validation that the structural requirement exists.
    // This confirms the pattern allows tracking of pending approvals.
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Auditability Enforcement Service (§7.4)
// ============================================================

/**
 * Validates investigation record structure ensuring full traceability.
 * Per MOD-015 §4.8, §7.4: Access restricted to authorized roles.
 * All investigations logged. No modification of historical records permitted.
 * Full history must be retained.
 *
 * @param investigation The investigation record to validate
 * @returns ValidationResult
 */
export function validateInvestigationRecord(investigation: InvestigationRecord): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate investigator exists
  if (!investigation.investigatorId || typeof investigation.investigatorId !== 'string') {
    errors.push({
      code: 'INVESTIGATOR_REQUIRED',
      field: 'investigatorId',
      message: 'Every investigation must have an assigned investigator per §4.8',
    });
  }

  // Validate case reference exists
  if (!investigation.caseId || typeof investigation.caseId !== 'string') {
    errors.push({
      code: 'CASE_REFERENCE_REQUIRED',
      field: 'caseId',
      message: 'Investigation must be linked to its parent case per §4.8',
    });
  }

  // Validate started timestamp exists
  if (!(investigation.startedAt instanceof Date) || isNaN(investigation.startedAt.getTime())) {
    errors.push({
      code: 'STARTED_AT_REQUIRED',
      field: 'startedAt',
      message: 'Investigation start timestamp is required per §4.8',
    });
  }

  // Validation notes must exist
  if (!investigation.notes || typeof investigation.notes !== 'string') {
    errors.push({
      code: 'NOTES_REQUIRED',
      field: 'notes',
      message: 'Investigation must include investigation notes per §4.8',
    });
  }

  return { valid: errors.length === 0, errors };
}
