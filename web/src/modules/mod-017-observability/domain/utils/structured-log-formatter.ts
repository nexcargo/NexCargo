// NexCargo MOD-017 Domain Utils — Structured Log Formatter
// Authoritative source: MOD-017 §4.1 (Log Entry Object) + ESS-007 §16 (Logging Rule)
// Formats LogEntry objects into standardized JSON strings for output.
// Aligns with S-01 AuditEvent format for cross-module consistency.

import { LogEntry, LogLevel } from '@/modules/mod-017-observability/domain/types/logging';

/**
 * Serializes a LogEntry into a formatted JSON string for structured logging output.
 * Per ESS-007 §16: All critical actions MUST log structured events with moduleId, correlationId.
 * @param entry - LogEntry to serialize
 * @returns JSON string representation of the log entry
 */
export function formatLogEntry(entry: LogEntry): string {
  const json = {
    // Standard audit fields from S-01
    auditEventId: entry.auditEventId,
    eventType: entry.eventType,
    moduleSource: entry.moduleSource,
    userId: entry.userId ?? null,
    userRole: entry.userRole ?? null,
    timestamp: entry.timestamp,
    affectedEntityType: entry.affectedEntityType ?? null,
    affectedEntityId: entry.affectedEntityId ?? null,
    metadata: entry.metadata ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    correlationId: entry.correlationId,

    // MOD-017 specific fields
    logLevel: entry.logLevel,
    message: entry.message,
    serviceId: entry.serviceId ?? null,
    environment: entry.environment,
  };

  return JSON.stringify(json);
}

/**
 * Creates a structured log context object for use with LoggerService methods.
 * @param moduleId - Module identifier
 * @param correlationId - Correlation ID from request context
 * @param metadata - Optional additional metadata
 * @returns Context object compatible with LoggerService method signatures
 */
export function createLogContext(
  moduleId: string,
  correlationId: string,
  metadata?: Record<string, unknown>
): { moduleId: string; correlationId: string; metadata?: Record<string, unknown> } {
  return { moduleId, correlationId, metadata };
}

/**
 * Maps a severity level to a numeric priority for ordering.
 * Lower number = higher urgency = should be processed first.
 * Per MOD-017 §7.6 (Alerting Rule): Critical alerts must bypass batching delays.
 * @param level - Log level
 * @returns Numeric priority (1 = highest)
 */
export function getLogPriority(level: LogLevel): number {
  switch (level) {
    case LogLevel.CRITICAL:
      return 1;
    case LogLevel.ERROR:
      return 2;
    case LogLevel.WARNING:
      return 3;
    case LogLevel.INFO:
      return 4;
    default:
      return 5;
  }
}
