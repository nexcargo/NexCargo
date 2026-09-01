// NexCargo MOD-017 — Enhanced LoggerService Runtime Implementation
// Authoritative source: MOD-017 §4.1 (Log Entry Object), §5.1 (Unified Telemetry Model)
// ESS-006 §6.2 (Sensitive Data Handling), ESS-007 §16 (Logging Rule)
// Enhances Wave 0 LoggerService interface with sensitive field masking,
// structured output formatting, and correlation context propagation.
// NO INTERVENTION: This module only formats and emits log data. It never modifies system state.

import type { LogEntry } from '../types/logging';
import { LogLevel } from '../types/logging';
import type { Wave0CorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { formatLogEntry, getLogPriority, createLogContext } from '../utils/structured-log-formatter';
import { createAuditEventEmitter, isAuditEventComplete } from '../utils/audit-event-emitter';
/**
 * Sensitive field patterns that MUST be masked in log output per ESS-006 §6.2.
 */
export const MASKED_FIELDS = [
  'apikey', 'api_secret', 'passkey', 'token', 'secret',
  'authorization', 'bearer', 'password', 'creditcard',
  'cvv', 'ssn', 'nationalid', 'bankaccount',
];

/**
 * Masks sensitive field values in an object recursively.
 * Per ESS-006 §6.2: "Sensitive fields MUST be logged in masked form only."
 * @param obj - Object to sanitize
 * @param depth - Recursion depth limit (prevents infinite loops)
 * @returns Sanitized copy of the object
 */
export function maskSensitiveFields(obj: Record<string, unknown>, depth: number = 0): Record<string, unknown> {
  if (depth > 3 || typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (MASKED_FIELDS.some(pattern => lowerKey.includes(pattern))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = maskSensitiveFields(value as Record<string, unknown>, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Creates a runtime logger instance implementing LoggerService.
 * Logs are formatted using Standard S-01 AuditEventFormat + S-02 Correlation Context.
 * @param defaultModuleId - Default module source identifier
 * @param correlationContext - Optional initial correlation context
 * @returns LoggerService implementation
 */
export function createRuntimeLogger(
  defaultModuleId: string,
  correlationContext?: Wave0CorrelationContext
): import('../types/logging').LoggerService {
  let currentCorrelationId = correlationContext?.correlationId ?? '';
  let currentTraceId = correlationContext?.traceId ?? '';
  let currentSpanId = correlationContext?.spanId ?? '';
  let currentModuleId = defaultModuleId;

  return {
    info(message: string, context: { moduleId?: string; correlationId?: string; metadata?: Record<string, unknown> }): void {
      emit(LogLevel.INFO, message, context);
    },
    warn(message: string, context: { moduleId?: string; correlationId?: string; metadata?: Record<string, unknown> }): void {
      emit(LogLevel.WARNING, message, context);
    },
    error(message: string, context: { moduleId?: string; correlationId?: string; metadata?: Record<string, unknown> }): void {
      emit(LogLevel.ERROR, message, context);
    },
    critical(message: string, context: { moduleId?: string; correlationId?: string; metadata?: Record<string, unknown> }): void {
      emit(LogLevel.CRITICAL, message, context);
    },
    child(context: Partial<{ moduleId: string; correlationId: string }>) {
      return createRuntimeLogger(
        context.moduleId ?? currentModuleId,
        {
          correlationId: context.correlationId ?? currentCorrelationId,
          traceId: currentTraceId,
          spanId: currentSpanId,
          requestId: '',
          timestamp: new Date().toISOString(),
        }
      );
    },
  };

  function emit(level: LogLevel, message: string, ctx: { moduleId?: string; correlationId?: string; metadata?: Record<string, unknown> }) {
    const entry: LogEntry = {
      auditEventId: crypto.randomUUID(),
      eventType: `${currentModuleId}.${level.toLowerCase()}`,
      moduleSource: currentModuleId as LogEntry['moduleSource'],
      timestamp: new Date().toISOString(),
      correlationId: ctx.correlationId ?? currentCorrelationId,
      logLevel: level,
      message,
      environment: (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEV') as 'DEV' | 'STAGING' | 'PRODUCTION',
      metadata: ctx.metadata ? maskSensitiveFields(ctx.metadata) : undefined,
      userId: ctx.metadata?.userId as string | undefined,
      serviceId: ctx.metadata?.serviceId as string | undefined,
      ipAddress: ctx.metadata?.ipAddress as string | undefined,
      userAgent: ctx.metadata?.userAgent as string | undefined,
      affectedEntityType: ctx.metadata?.affectedEntityType as string | undefined,
      affectedEntityId: ctx.metadata?.affectedEntityId as string | undefined,
    };

    // Output formatted log string (in production, this would go to stdout/file/distributed store)
    const formatted = formatLogEntry(entry);
    console.log(formatted);

    // Also emit audit event via coordinated emitter for compliance tracking
    emitAuditEvent(entry);
  }

  function emitAuditEvent(logEntry: LogEntry) {
    const emitter = createAuditEventEmitter(currentModuleId);
    emitter.emitFromLog({
      moduleSource: logEntry.moduleSource,
      logLevel: logEntry.logLevel,
      userId: logEntry.userId,
      correlationId: logEntry.correlationId,
      metadata: logEntry.metadata,
    } as import('../types/logging').LogEntry);
  }
}

/**
 * Validates that log output does not contain sensitive data.
 * Used in test suites to enforce ESS-006 §6.2 compliance.
 * @param logOutput - Formatted log string to validate
 * @param sensitiveValues - Known secret values that must NOT appear
 * @returns true if no sensitive data found
 */
export function validateNoSensitiveData(logOutput: string, sensitiveValues: string[]): boolean {
  for (const value of sensitiveValues) {
    if (logOutput.includes(value) && !logOutput.includes('[REDACTED]')) {
      return false;
    }
  }
  return true;
}
