// NexCargo MOD-017 Domain Types — Structured Logging Infrastructure
// Authoritative source: MOD-017 §4.1 (Log Entry Object) + ESS-007 §16 (Logging Rule)
// Implements exit criteria X-07: Logger service with structured output, log levels, moduleId, correlationId

import type { AuditEvent } from '@/shared/standards/audit-event-format';

/**
 * Log level enum per MOD-017 §4.1
 */
export enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * Log entry structure conforming to MOD-017 §4.1 and Standard S-01 (Audit Event Format).
 * Aligns with both MOD-017 Log Entry Object and shared AuditEvent format.
 */
export interface LogEntry extends Omit<AuditEvent, 'actionType'> {
  // MOD-017 specific fields
  logLevel: LogLevel;
  message: string;
  moduleSource: 'MOD-010' | 'MOD-011' | 'MOD-017';
  userId?: string;
  serviceId?: string;
  environment: 'DEV' | 'STAGING' | 'PRODUCTION';
  metadata?: Record<string, unknown>;
}

/**
 * Logger service interface for structured logging across all Wave 0 modules.
 * Per MOD-017 §5.1 (Unified Telemetry Model): logs → event-level recording.
 * Per ESS-007 §16: All critical actions MUST log structured events with moduleId, correlationId.
 */
export interface LoggerService {
  /** Log an info-level message */
  info(message: string, context: { moduleId: string; correlationId: string; metadata?: Record<string, unknown> }): void;
  /** Log a warning-level message */
  warn(message: string, context: { moduleId: string; correlationId: string; metadata?: Record<string, unknown> }): void;
  /** Log an error-level message */
  error(message: string, context: { moduleId: string; correlationId: string; metadata?: Record<string, unknown> }): void;
  /** Log a critical-level message */
  critical(message: string, context: { moduleId: string; correlationId: string; metadata?: Record<string, unknown> }): void;
  /** Create a child logger with inherited context */
  child(context: Partial<{ moduleId: string; correlationId: string }>): LoggerService;
}

/**
 * Creates a structured log entry object.
 * @param params - Log entry parameters
 * @returns Complete LogEntry with generated ID and timestamp
 */
export function createLogEntry(params: Partial<LogEntry>): LogEntry {
  const now = new Date().toISOString();
  return {
    auditEventId: crypto.randomUUID(),
    timestamp: now,
    environment: 'DEV', // Default for development; overridden in production
    ...params,
  } as LogEntry;
}
