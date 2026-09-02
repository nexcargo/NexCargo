// NexCargo MOD-015 — Enum & Type Definition Tests
// Wave 3 — Increment 2 — Authorized per HAO-WAVE3-AUTH-001 and HAO-WAVE3-MOD015-018-AUTH-001 (D-S3-001)

import { describe, it, expect } from 'vitest';
import type {
  SupportTicketObject,
  DisputeCaseObject,
  ShipmentIncidentObject,
  EscalationObject,
  OperationalExceptionObject,
  RefundCoordinationObject,
  AISupportInteractionObject,
  InvestigationRecord,
} from '../domain/types/entities';
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
  IncidentType,
  DetectionSource,
  ExceptionType,
  ExceptionStatus,
  InvestigationStatus,
  SuggestionType,
  HumanApprovalStatus,
  SlaTimerStatus,
} from '../domain/enums';

const now = new Date('2026-08-31T10:00:00Z');

// ============================================================
// Enum value tests
// ============================================================

describe('MOD-015 SupportTicketStatus enum', () => {
  it('contains all required statuses', () => {
    expect(SupportTicketStatus.OPEN).toBe('OPEN');
    expect(SupportTicketStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(SupportTicketStatus.PENDING).toBe('PENDING');
    expect(SupportTicketStatus.RESOLVED).toBe('RESOLVED');
    expect(SupportTicketStatus.CLOSED).toBe('CLOSED');
  });
});

describe('MOD-015 DisputeStatus enum', () => {
  it('contains all dispute statuses', () => {
    expect(DisputeStatus.SUBMITTED).toBe('SUBMITTED');
    expect(DisputeStatus.UNDER_REVIEW).toBe('UNDER_REVIEW');
    expect(DisputeStatus.ESCALATED).toBe('ESCALATED');
    expect(DisputeStatus.RESOLVED).toBe('RESOLVED');
    expect(DisputeStatus.CLOSED).toBe('CLOSED');
  });
});

describe('MOD-015 DisputeType enum', () => {
  it('contains all dispute types', () => {
    expect(DisputeType.PAYMENT).toBe('PAYMENT');
    expect(DisputeType.DELIVERY).toBe('DELIVERY');
    expect(DisputeType.DAMAGE).toBe('DAMAGE');
    expect(DisputeType.DELAY).toBe('DELAY');
    expect(DisputeType.CONTRACT).toBe('CONTRACT');
  });
});

describe('MOD-015 IncidentSeverity enum', () => {
  it('contains all severity levels', () => {
    expect(IncidentSeverity.MINOR).toBe('MINOR');
    expect(IncidentSeverity.MODERATE).toBe('MODERATE');
    expect(IncidentSeverity.MAJOR).toBe('MAJOR');
    expect(IncidentSeverity.CRITICAL).toBe('CRITICAL');
  });
});

describe('MOD-015 EscalationLevel enum', () => {
  it('contains all escalation levels', () => {
    expect(EscalationLevel.L1_SUPPORT).toBe('L1_SUPPORT');
    expect(EscalationLevel.L2_SUPERVISOR).toBe('L2_SUPERVISOR');
    expect(EscalationLevel.L3_ADMIN_MODERATOR).toBe('L3_ADMIN_MODERATOR');
  });
});

describe('MOD-015 Channel enum', () => {
  it('contains all support channels', () => {
    expect(Channel.IN_APP).toBe('IN_APP');
    expect(Channel.EMAIL).toBe('EMAIL');
    expect(Channel.SMS).toBe('SMS');
    expect(Channel.CALL).toBe('CALL');
    expect(Channel.API).toBe('API');
  });
});

describe('MOD-015 Category enum', () => {
  it('contains all categories', () => {
    expect(Category.SHIPMENT).toBe('SHIPMENT');
    expect(Category.PAYMENT).toBe('PAYMENT');
    expect(Category.ACCOUNT).toBe('ACCOUNT');
    expect(Category.TECHNICAL).toBe('TECHNICAL');
    expect(Category.OPERATIONAL).toBe('OPERATIONAL');
  });
});

describe('MOD-015 Priority enum', () => {
  it('contains all priority levels', () => {
    expect(Priority.LOW).toBe('LOW');
    expect(Priority.MEDIUM).toBe('MEDIUM');
    expect(Priority.HIGH).toBe('HIGH');
    expect(Priority.CRITICAL).toBe('CRITICAL');
  });
});

describe('MOD-015 Refund enums', () => {
  it('contains refund types', () => {
    expect(RefundType.FULL).toBe('FULL');
    expect(RefundType.PARTIAL).toBe('PARTIAL');
    expect(RefundType.COMPENSATION).toBe('COMPENSATION');
  });

  it('contains approval statuses', () => {
    expect(ApprovalStatus.PENDING).toBe('PENDING');
    expect(ApprovalStatus.APPROVED).toBe('APPROVED');
    expect(ApprovalStatus.REJECTED).toBe('REJECTED');
    expect(ApprovalStatus.EXECUTED).toBe('EXECUTED');
  });
});

describe('MOD-015 IncidentType enum', () => {
  it('contains all incident types', () => {
    expect(IncidentType.VEHICLE_BREAKDOWN).toBe('VEHICLE_BREAKDOWN');
    expect(IncidentType.BORDER_DELAY).toBe('BORDER_DELAY');
    expect(IncidentType.CARGO_DAMAGE).toBe('CARGO_DAMAGE');
    expect(IncidentType.ROUTE_DEVIATION).toBe('ROUTE_DEVIATION');
    expect(IncidentType.THEFT_LOSS).toBe('THEFT_LOSS');
    expect(IncidentType.WEATHER).toBe('WEATHER');
    expect(IncidentType.CONGESTION).toBe('CONGESTION');
  });
});

describe('MOD-015 DetectionSource enum', () => {
  it('contains all detection sources', () => {
    expect(DetectionSource.MOD_017).toBe('MOD_017');
    expect(DetectionSource.MOD_006).toBe('MOD_006');
    expect(DetectionSource.USER_REPORT).toBe('USER_REPORT');
    expect(DetectionSource.MANUAL).toBe('MANUAL');
  });
});

describe('MOD-015 Exception enums', () => {
  it('contains exception types', () => {
    expect(ExceptionType.MINOR_DELAY).toBe('MINOR_DELAY');
    expect(ExceptionType.ROUTE_CHANGE).toBe('ROUTE_CHANGE');
    expect(ExceptionType.WEATHER).toBe('WEATHER');
    expect(ExceptionType.CONGESTION).toBe('CONGESTION');
  });

  it('contains exception statuses', () => {
    expect(ExceptionStatus.ACTIVE).toBe('ACTIVE');
    expect(ExceptionStatus.RESOLVED).toBe('RESOLVED');
    expect(ExceptionStatus.ESCALATED).toBe('ESCALATED');
  });
});

describe('MOD-015 InvestigationStatus enum', () => {
  it('contains all investigation statuses', () => {
    expect(InvestigationStatus.OPEN).toBe('OPEN');
    expect(InvestigationStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(InvestigationStatus.COMPLETED).toBe('COMPLETED');
    expect(InvestigationStatus.CLOSED).toBe('CLOSED');
  });
});

describe('MOD-015 AI interaction enums', () => {
  it('contains suggestion types', () => {
    expect(SuggestionType.CLASSIFICATION).toBe('CLASSIFICATION');
    expect(SuggestionType.RESOLUTION_PROPOSAL).toBe('RESOLUTION_PROPOSAL');
    expect(SuggestionType.ESCALATION_RECOMMENDATION).toBe('ESCALATION_RECOMMENDATION');
    expect(SuggestionType.EVIDENCE_SUGGESTION).toBe('EVIDENCE_SUGGESTION');
  });

  it('contains human approval statuses', () => {
    expect(HumanApprovalStatus.PENDING).toBe('PENDING');
    expect(HumanApprovalStatus.APPROVED).toBe('APPROVED');
    expect(HumanApprovalStatus.REJECTED).toBe('REJECTED');
  });
});

describe('MOD-015 SlaTimerStatus enum', () => {
  it('contains all SLA timer statuses', () => {
    expect(SlaTimerStatus.RUNNING).toBe('RUNNING');
    expect(SlaTimerStatus.BREACHED).toBe('BREACHED');
    expect(SlaTimerStatus.EXPIRED).toBe('EXPIRED');
    expect(SlaTimerStatus.SUSPENDED).toBe('SUSPENDED');
  });
});

// ============================================================
// BC Contract Interface Tests
// ============================================================

describe('MOD-015 BC Contract Interface Integrity', () => {
  it('can import bc-contract module without circular dependency errors', async () => {
    const mod = await import('../domain/types/bc-contract');
    expect(mod).toBeDefined();
  });
});
