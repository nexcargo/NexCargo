// NexCargo Wave 0 Shared Standard S-02: Correlation ID Propagation
// Authoritative source: MOD-017 §5.2–§5.3 (Cross-Module Visibility + Event Correlation)
// Aligns with existing CorrelationContext in shared/types/core.ts
// All Wave 0 modules MUST propagate correlationId through logs, metrics, traces, and audit events.

import type { CorrelationContext } from '@/shared/types/core';

/**
 * Extended correlation context for Wave 0 module coordination.
 * Extends core CorrelationContext with module-specific propagation fields.
 */
export interface Wave0CorrelationContext extends CorrelationContext {
  /** Module identifier producing this context */
  moduleId?: 'MOD-010' | 'MOD-011' | 'MOD-017';
  /** Parent span ID if this is a child operation */
  parentId?: string | null;
}

/**
 * Generates a new correlation context for a request entry point.
 * Must be called once at API route / server action entry.
 */
export function createCorrelationContext(overrides?: Partial<Wave0CorrelationContext>): Wave0CorrelationContext {
  return {
    correlationId: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
    spanId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Extracts or generates a correlationId from incoming request data.
 * If no correlationId exists, generates one (never returns null/empty).
 */
export function resolveCorrelationId(headers?: Record<string, string>): string {
  // Check for existing correlationId in headers
  const headerCorrelationId = headers?.['x-correlation-id'] || headers?.['X-Correlation-Id'];
  if (headerCorrelationId) {
    return headerCorrelationId;
  }
  // Generate new correlationId
  return crypto.randomUUID();
}

/**
 * Injects correlationId into outgoing request metadata.
 * Used by MOD-011 for external event mapping transformations.
 */
export function injectCorrelationId<T>(payload: T, correlationId: string): T & { correlationId: string } {
  return { ...payload, correlationId } as T & { correlationId: string };
}
