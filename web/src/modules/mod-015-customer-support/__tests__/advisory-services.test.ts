// NexCargo MOD-015 — Advisory Services Tests
// Wave 3 — Increment 2 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import type { SupportTicketObject, DisputeCaseObject, ShipmentIncidentObject, EscalationObject, RefundCoordinationObject, AISupportInteractionObject, InvestigationRecord } from '../domain/types/entities';
import { SupportTicketStatus, DisputeStatus, DisputeType, Priority, Channel, Category, DetectionSource, IncidentSeverity, EscalationLevel, ApprovalStatus, RefundType, SuggestionType, HumanApprovalStatus, InvestigationStatus, SlaTimerStatus } from '../domain/enums';
import { enforceNoDecisionAuthority, enforceEvidenceRequirement, validateIncidentClassification, validateEscalationHierarchy, validateRefundCoordination, validateAISupportInteraction, validateInvestigationRecord } from '../domain/services/advisory-services';

const now = new Date('2026-08-31T10:00:00Z');

function stubEntity() {
  return { id: 'stub', created_at: now, updated_at: now, version: 1, bumpVersion: () => {}, toJSON: () => ({}) };
}

function buildValidTicket(): SupportTicketObject {
  return { ...stubEntity(), ticketId: 'TKT-001', requesterId: 'user-001', category: Category.SHIPMENT, priorityLevel: Priority.HIGH, status: SupportTicketStatus.OPEN, assignedAgentId: 'agent-001', channel: Channel.IN_APP, slaBreach: false, caseId: 'CASE-001', requesterRole: 'SHIPPER', slaTimer: { timerId: 'SLA-001', relatedCaseId: 'CASE-001', targetHours: 24, elapsedHours: 2, isBreached: false, startedAt: now, status: SlaTimerStatus.RUNNING }, created_at: now, updated_at: now, version: 1 };
}

function buildInvalidTicketNoCaseId(): SupportTicketObject {
  const t = buildValidTicket();
  t.caseId = '';
  return t;
}

function buildValidDispute(): DisputeCaseObject {
  return { ...stubEntity(), disputeId: 'DSP-001', relatedShipmentId: 'shipment-001', relatedContractId: 'contract-001', relatedEscrowId: 'escrow-001', disputeType: DisputeType.PAYMENT, initiatorId: 'user-001', respondentId: 'user-002', status: DisputeStatus.SUBMITTED, evidenceReferences: [{ documentRefId: 'doc-001', evidenceCategory: 'PAYMENT_RECEIPT', description: 'Payment proof', attachedAt: now }], slaTimer: { timerId: 'SLA-002', relatedCaseId: 'CASE-002', targetHours: 72, elapsedHours: 0, isBreached: false, startedAt: now, status: SlaTimerStatus.RUNNING }, caseId: 'CASE-002' };
}

function buildValidDisputeResolved(): DisputeCaseObject {
  const d = buildValidDispute();
  d.status = DisputeStatus.RESOLVED;
  d.decisionMakerId = 'moderator-001';
  d.resolutionSummary = 'Payment confirmed via receipt analysis.';
  return d;
}

function buildDisputeNoEvidence(): DisputeCaseObject {
  const d = buildValidDispute();
  d.evidenceReferences = [];
  return d;
}

function buildValidIncident(): ShipmentIncidentObject {
  return { ...stubEntity(), incidentId: 'INC-001', shipmentId: 'shipment-001', incidentType: 'VEHICLE_BREAKDOWN' as never, severityLevel: IncidentSeverity.MAJOR, detectionSource: DetectionSource.MOD_006, status: 'DETECTED', affectedModules: ['MOD-003', 'MOD-017'], detectedAt: now, description: 'Vehicle breakdown on corridor maputo-beira.' };
}

function buildValidEscalation(): EscalationObject {
  return { ...stubEntity(), escalationId: 'ESC-001', sourceCaseId: 'CASE-001', escalationLevel: EscalationLevel.L2_SUPERVISOR, assignedRole: 'SUPERVISOR', assignedUserId: 'supervisor-001', reason: 'SLA approaching breach threshold.', timestamp: now, status: 'ACTIVE', slaTimerStartedAt: now, slaTimer: { timerId: 'SLA-003', relatedCaseId: 'CASE-001', targetHours: 48, elapsedHours: 30, isBreached: false, startedAt: now, status: SlaTimerStatus.RUNNING } };
}

function buildValidRefund(): RefundCoordinationObject {
  return { ...stubEntity(), refundCoordinationId: 'RFD-001', disputeId: 'DSP-001', shipmentId: 'shipment-001', refundType: RefundType.PARTIAL, amount: 500, currency: 'MZN', recipientId: 'user-001', approvalStatus: ApprovalStatus.PENDING, notes: 'Partial refund for delivery delay.' };
}

function buildValidAIInteraction(): AISupportInteractionObject {
  return { ...stubEntity(), interactionId: 'AI-001', caseId: 'CASE-001', aiSuggestion: 'Consider escalating to supervisor due to payment discrepancy pattern.', confidenceScore: 85, suggestionType: SuggestionType.ESCALATION_RECOMMENDATION, humanApprovalStatus: HumanApprovalStatus.PENDING, timestamp: now };
}

function buildValidInvestigation(): InvestigationRecord {
  return { ...stubEntity(), investigationId: 'INV-001', caseId: 'CASE-001', investigatorId: 'admin-001', shipmentTimelineView: {}, gpsReplayReference: 'gp1', financialFlowInspection: {}, documentVerificationAccess: [], userBehaviorAnalysis: [], notes: 'Initial investigation notes.', startedAt: now, completedAt: undefined, status: InvestigationStatus.OPEN };
}

// ============================================================
// No Decision Authority tests (§7.1)
// ============================================================

describe('enforceNoDecisionAuthority — MOD-015 §7.1', () => {
  it('validates a proper support ticket', () => {
    const result = enforceNoDecisionAuthority(buildValidTicket());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects ticket missing case ID', () => {
    const result = enforceNoDecisionAuthority(buildInvalidTicketNoCaseId());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CASE_ID_REQUIRED')).toBe(true);
  });

  it('rejects ticket without requester role', () => {
    const t = buildValidTicket();
    t.requesterRole = '';
    const result = enforceNoDecisionAuthority(t);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'REQUESTER_ROLE_REQUIRED')).toBe(true);
  });

  it('rejects closed ticket with breached SLA (auto-close prevention)', () => {
    const t = buildValidTicket();
    t.status = SupportTicketStatus.CLOSED;
    t.slaBreach = true;
    const result = enforceNoDecisionAuthority(t);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SLA_BREACH_NO_AUTO_CLOSE')).toBe(true);
  });
});

// ============================================================
// Evidence requirement tests (§7.2)
// ============================================================

describe('enforceEvidenceRequirement — MOD-015 §7.2', () => {
  it('validates a proper submitted dispute with evidence', () => {
    const result = enforceEvidenceRequirement(buildValidDispute());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects dispute with no evidence', () => {
    const result = enforceEvidenceRequirement(buildDisputeNoEvidence());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'EVIDENCE_REQUIRED')).toBe(true);
  });

  it('validates resolved dispute has decision maker and summary', () => {
    const result = enforceEvidenceRequirement(buildValidDisputeResolved());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects resolved dispute without decision maker', () => {
    const d = buildValidDisputeResolved();
    d.decisionMakerId = undefined;
    const result = enforceEvidenceRequirement(d);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DECISION_MAKER_REQUIRED_FOR_RESOLUTION')).toBe(true);
  });

  it('rejects dispute without shipment reference', () => {
    const d = buildValidDispute();
    d.relatedShipmentId = '';
    const result = enforceEvidenceRequirement(d);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SHIPMENT_REFERENCE_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Incident classification tests (§4.3)
// ============================================================

describe('validateIncidentClassification — MOD-015 §4.3', () => {
  it('validates a proper incident', () => {
    const result = validateIncidentClassification(buildValidIncident());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects incident without shipment reference', () => {
    const inc = buildValidIncident();
    inc.shipmentId = '';
    const result = validateIncidentClassification(inc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SHIPMENT_REFERENCE_REQUIRED')).toBe(true);
  });

  it('rejects incident without description', () => {
    const inc = buildValidIncident();
    inc.description = '';
    const result = validateIncidentClassification(inc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DESCRIPTION_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Escalation hierarchy tests (§4.4)
// ============================================================

describe('validateEscalationHierarchy — MOD-015 §4.4', () => {
  it('validates a proper escalation', () => {
    const result = validateEscalationHierarchy(buildValidEscalation());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects escalation without reason', () => {
    const esc = buildValidEscalation();
    esc.reason = '';
    const result = validateEscalationHierarchy(esc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'ESCALATION_REASON_REQUIRED')).toBe(true);
  });

  it('rejects escalation without source case', () => {
    const esc = buildValidEscalation();
    esc.sourceCaseId = '';
    const result = validateEscalationHierarchy(esc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SOURCE_CASE_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Refund coordination tests (§4.6)
// ============================================================

describe('validateRefundCoordination — MOD-015 §4.6', () => {
  it('validates a proper refund coordination', () => {
    const result = validateRefundCoordination(buildValidRefund());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects refund without dispute reference', () => {
    const r = buildValidRefund();
    r.disputeId = '';
    const result = validateRefundCoordination(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DISPUTE_REFERENCE_REQUIRED')).toBe(true);
  });

  it('rejects refund with zero amount', () => {
    const r = buildValidRefund();
    r.amount = 0;
    const result = validateRefundCoordination(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'AMOUNT_MUST_BE_POSITIVE')).toBe(true);
  });

  it('rejects executed refund without execution timestamp', () => {
    const r = buildValidRefund();
    r.approvalStatus = ApprovalStatus.EXECUTED;
    r.executedAt = undefined;
    const result = validateRefundCoordination(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'EXECUTED_REQUIRES_TIMESTAMP')).toBe(true);
  });
});

// ============================================================
// AI interaction validation tests (§4.7)
// ============================================================

describe('validateAISupportInteraction — MOD-015 §4.7', () => {
  it('validates a proper AI interaction', () => {
    const result = validateAISupportInteraction(buildValidAIInteraction());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects AI interaction without case reference', () => {
    const ai = buildValidAIInteraction();
    ai.caseId = '';
    const result = validateAISupportInteraction(ai);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'CASE_REFERENCE_REQUIRED')).toBe(true);
  });
});

// ============================================================
// Investigation record tests (§4.8)
// ============================================================

describe('validateInvestigationRecord — MOD-015 §4.8', () => {
  it('validates a proper investigation', () => {
    const result = validateInvestigationRecord(buildValidInvestigation());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects investigation without investigator', () => {
    const inv = buildValidInvestigation();
    inv.investigatorId = '';
    const result = validateInvestigationRecord(inv);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVESTIGATOR_REQUIRED')).toBe(true);
  });
});
