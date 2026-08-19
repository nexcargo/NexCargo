// NexCargo MOD-017 Domain Utils — Audit Event Emitter
// Authoritative source: MOD-017 §4.1 (Log Entry Object) + MOD-010 §4.5 (Audit Event Object)
// Coordinates audit event emission across MOD-010/MOD-011/MOD-017 using Standard S-01 (AuditEvent)
// and Standard S-02 (CorrelationContext) for consistent traceability.

import type { AuditEvent } from '@/shared/standards/audit-event-format';
import type { Wave0CorrelationContext } from '@/shared/standards/correlation-id-propagation';
import type { LogEntry, LogLevel } from '@/modules/mod-017-observability/domain/types/logging';

/**
 * Audit event emitter interface for coordinated event emission across Wave 0 modules.
 * Per MOD-017 §5.1 (Unified Telemetry Model): logs → event-level recording.
 * Per MOD-010 §7.4 (Audit Integrity Rule): Every module must emit audit events.
 */
export interface AuditEventEmitter {
  /** Emit an audit event with full context propagation */
  emit(event: Omit<AuditEvent, 'auditEventId' | 'timestamp'>): AuditEvent;
  /** Emit an audit event derived from a log entry */
  emitFromLog(logEntry: Omit<LogEntry, 'auditEventId' | 'timestamp'>): AuditEvent;
  /** Create a child emitter with inherited correlation context */
  child(context: Partial<{ moduleId: string; correlationId: string }>): AuditEventEmitter;
}

/**
 * Creates a default audit event emitter.
 * @param defaultModuleId - Default module source if not specified per event
 * @returns AuditEventEmitter instance
 */
export function createAuditEventEmitter(defaultModuleId: string): AuditEventEmitter {
  let currentCorrelationId = '';
  let currentModuleId = defaultModuleId;

  return {
    emit(event) {
      const auditEvent: AuditEvent = {
        ...event,
        auditEventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        moduleSource: event.moduleSource || currentModuleId,
        correlationId: event.correlationId || currentCorrelationId,
      };
      // In production, this would persist to audit log storage
      return auditEvent;
    },

    emitFromLog(logEntry) {
      const auditEvent: AuditEvent = {
        auditEventId: crypto.randomUUID(),
        eventType: `${logEntry.moduleSource.toLowerCase()}.${logEntry.logLevel.toLowerCase()}`,
        moduleSource: logEntry.moduleSource,
        userId: logEntry.userId,
        userRole: logEntry.userRole,
        timestamp: new Date().toISOString(),
        affectedEntityType: undefined,
        affectedEntityId: undefined,
        actionType: 'WRITE',
        metadata: logEntry.metadata,
        ipAddress: undefined,
        userAgent: undefined,
        correlationId: currentCorrelationId,
      };
      return auditEvent;
    },

    child(context) {
      if (context.correlationId) currentCorrelationId = context.correlationId;
      if (context.moduleId) currentModuleId = context.moduleId;
      return this;
    },
  };
}

/**
 * Validates that an AuditEvent has all required fields populated.
 * Per MOD-010 §7.4: Audit trail MUST be complete across all modules.
 * @param event - Audit event to validate
 * @returns true if the event passes completeness check
 */
export function isAuditEventComplete(event: AuditEvent): boolean {
  return !!(
    event.auditEventId &&
    event.eventType &&
    event.moduleSource &&
    event.timestamp &&
    event.actionType &&
    event.correlationId
  );
}
