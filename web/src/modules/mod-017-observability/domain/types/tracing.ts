// NexCargo MOD-017 Domain Types — Distributed Tracing Foundation
// Authoritative source: MOD-017 §4.3 (Trace Object) + §5.2–§5.3 (Cross-Module Visibility + Event Correlation)
// Implements exit criteria X-09: Correlation ID propagation across modules, trace span tracking

import type { Wave0CorrelationContext } from '@/shared/standards/correlation-id-propagation';

/**
 * Trace status enum per MOD-017 §4.3
 */
export enum TraceStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Module chain entry — represents a module's participation in a trace.
 */
export interface ModuleChainEntry {
  moduleId: string;         // e.g., "MOD-001"
  startTime: number;        // Performance.now() timestamp
  endTime?: number;         // Performance.now() timestamp
  latencyMs?: number;       // Computed latency in milliseconds
}

/**
 * Trace Object — represents request lifecycle across modules.
 * Per MOD-017 §4.3. Extends Wave0CorrelationContext for correlation propagation.
 */
export interface TraceObject extends Wave0CorrelationContext {
  // Core attributes from MOD-017 §4.3
  spanId: string;           // UUID v4
  parentSpanId?: string | null;
  moduleChain: ModuleChainEntry[];
  timestampStart: string;   // ISO 8601
  timestampEnd?: string;    // ISO 8601
  status: TraceStatus;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a new trace context at request entry point.
 * @param overrides - Optional context overrides
 * @returns New TraceObject with generated IDs and timestamps
 */
export function createTrace(overrides?: Partial<Wave0CorrelationContext>): TraceObject {
  const now = new Date().toISOString();
  return {
    correlationId: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
    spanId: crypto.randomUUID(),
    parentId: null,
    timestampStart: now,
    status: TraceStatus.SUCCESS,
    moduleChain: [],
    ...overrides,
  } as TraceObject;
}

/**
 * Adds a module chain entry to an existing trace.
 * @param trace - Existing trace object
 * @param moduleId - Module identifier
 * @returns Updated trace with new module chain entry
 */
export function addModuleToTrace(trace: TraceObject, moduleId: string): TraceObject {
  const updatedTrace = { ...trace };
  updatedTrace.moduleChain = [
    ...trace.moduleChain,
    {
      moduleId,
      startTime: performance?.now() ?? Date.now(),
    },
  ];
  return updatedTrace;
}
