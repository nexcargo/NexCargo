// NexCargo MOD-010 Domain Utils — Compliance Audit Trail
// Authoritative source: MOD-010 §4.5 (Audit Event Object) + §7.4 (Audit Integrity Rule)
// Coordinates compliance audit events across modules using Standard S-01 (AuditEvent).
// Per MOD-010 §7.4: Audit records MUST be immutable; no modification or deletion allowed.

import type { AuditEvent } from '@/shared/standards/audit-event-format';
import type { Wave0CorrelationContext } from '@/shared/standards/correlation-id-propagation';
import type { ComplianceRule, RegulationType, SeverityLevel } from '@/modules/mod-010-security/domain/types/compliance';

/**
 * Compliance audit event types per MOD-010 §8 (Event Model).
 */
export enum ComplianceAuditEventType {
  COMPLIANCE_RULE_EVALUATED = 'complianceRuleEvaluated',
  GOVERNANCE_VIOLATION_DETECTED = 'governanceViolationDetected',
  REGULATORY_COMPLIANCE_FAILED = 'regulatoryComplianceFailed',
}

/**
 * Creates a compliance audit event for rule evaluation.
 * @param params - Audit event parameters
 * @returns Complete AuditEvent documenting the compliance evaluation
 */
export function createComplianceEvaluationEvent(params: {
  moduleId: 'MOD-010' | 'MOD-011' | 'MOD-017';
  userId?: string;
  userRole?: string;
  regulationType: RegulationType;
  ruleId: string;
  result: 'PASS' | 'FAIL' | 'WARNING';
  correlationId: string;
}): AuditEvent {
  const eventType = params.result === 'FAIL'
    ? ComplianceAuditEventType.REGULATORY_COMPLIANCE_FAILED
    : ComplianceAuditEventType.COMPLIANCE_RULE_EVALUATED;

  return {
    auditEventId: crypto.randomUUID(),
    eventType,
    moduleSource: params.moduleId,
    userId: params.userId,
    userRole: params.userRole,
    timestamp: new Date().toISOString(),
    affectedEntityType: 'ComplianceRule',
    affectedEntityId: params.ruleId,
    actionType: 'READ',
    metadata: {
      regulationType: params.regulationType,
      result: params.result,
    },
    correlationId: params.correlationId,
  };
}

/**
 * Creates a governance violation detection audit event.
 * @param params - Audit event parameters
 * @returns Complete AuditEvent documenting the governance violation
 */
export function createGovernanceViolationEvent(params: {
  moduleId: 'MOD-010' | 'MOD-011' | 'MOD-017';
  userId?: string;
  userRole?: string;
  violationType: string;
  description: string;
  correlationId: string;
}): AuditEvent {
  return {
    auditEventId: crypto.randomUUID(),
    eventType: ComplianceAuditEventType.GOVERNANCE_VIOLATION_DETECTED,
    moduleSource: params.moduleId,
    userId: params.userId,
    userRole: params.userRole,
    timestamp: new Date().toISOString(),
    affectedEntityType: 'GovernancePolicy',
    affectedEntityId: undefined,
    actionType: 'WRITE',
    metadata: {
      violationType: params.violationType,
      description: params.description,
    },
    correlationId: params.correlationId,
  };
}

/**
 * Compliance Audit Trail — immutable log of compliance events.
 * Per MOD-010 §7.4: Immutable audit log structures; no UPDATE or DELETE operations.
 */
export class ComplianceAuditTrail {
  private readonly entries: AuditEvent[];

  constructor() {
    this.entries = [];
  }

  /**
   * Appends a compliance audit event to the trail.
   * Per MOD-010 §7.4: Audit records MUST be immutable once written.
   * @param event - Audit event to append
   * @returns true if appended successfully
   */
  append(event: AuditEvent): boolean {
    // Validate completeness per MOD-010 §7.4
    if (!event.auditEventId || !event.eventType || !event.moduleSource || !event.timestamp || !event.actionType || !event.correlationId) {
      return false;
    }
    this.entries.push(event);
    return true;
  }

  /**
   * Gets all audit events filtered by module.
   * @param moduleId - Module identifier filter
   * @returns Array of matching audit events
   */
  getByModule(moduleId: string): AuditEvent[] {
    return this.entries.filter(e => e.moduleSource === moduleId);
  }

  /**
   * Gets all audit events filtered by event type.
   * @param eventType - Optional event type filter
   * @returns Array of matching audit events
   */
  getByEventType(eventType?: string): AuditEvent[] {
    if (!eventType) return [...this.entries];
    return this.entries.filter(e => e.eventType === eventType);
  }

  /**
   * Gets the total count of audit events.
   */
  get count(): number {
    return this.entries.length;
  }
}
