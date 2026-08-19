// NexCargo Shared — Wave 0 Correlation Context Middleware Utilities
// Authoritative source: MOD-017 §5.2–§5.3 (Cross-Module Visibility + Event Correlation)
// Standard S-02 (Correlation ID Propagation) utilities for request-level context management.
// Provides reusable patterns for Next.js App Router server actions and API routes.

import type { Wave0CorrelationContext } from '@/shared/standards/correlation-id-propagation';

/**
 * Extracts correlation context from HTTP headers.
 * Per Standard S-02: If no correlationId exists in incoming request data, generates one.
 * @param headers - Request headers object
 * @returns Wave0CorrelationContext with resolved correlation ID
 */
export function extractCorrelationContextFromHeaders(
  headers: Record<string, string>
): Wave0CorrelationContext {
  const headerCorrelationId = headers['x-correlation-id'] || headers['X-Correlation-Id'];
  const headerTraceId = headers['x-trace-id'] || headers['X-Trace-Id'];
  const headerSpanId = headers['x-span-id'] || headers['X-Span-Id'];

  return {
    correlationId: headerCorrelationId || crypto.randomUUID(),
    traceId: headerTraceId || crypto.randomUUID(),
    spanId: headerSpanId || crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Builds response headers that propagate correlation context downstream.
 * Used by API routes to pass correlation IDs to downstream services.
 * @param context - Wave0CorrelationContext to include in response headers
 * @returns Record of header name → value pairs
 */
export function buildResponseHeaders(context: Wave0CorrelationContext): Record<string, string> {
  return {
    'x-correlation-id': context.correlationId,
    'x-trace-id': context.traceId ?? '',
    'x-span-id': context.spanId ?? '',
  };
}

/**
 * Creates a new child correlation context from a parent.
 * Generates a new spanId while preserving the parent's correlationId and traceId.
 * Per Standard S-02: parentId field tracks parent-child relationships in call chains.
 * @param parent - Parent correlation context
 * @returns New Wave0CorrelationContext with inherited fields
 */
export function createChildCorrelationContext(parent: Wave0CorrelationContext): Wave0CorrelationContext {
  return {
    correlationId: parent.correlationId,
    traceId: parent.traceId,
    spanId: crypto.randomUUID(),
    requestId: parent.requestId,
    timestamp: new Date().toISOString(),
    moduleId: parent.moduleId,
    parentId: parent.spanId ?? null,
  };
}
