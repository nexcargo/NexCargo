// NexCargo MOD-017 — Correlation Context Propagation Enhancements
// Authoritative source: MOD-017 §5.2-§5.3 (Cross-Module Visibility + Event Correlation)
// S-02 Standard (Correlation ID Propagation), MOD-011 integration event mapping
// Enhances Wave 0 correlation context with module-wide propagation tracking.
// NO INTERVENTION: This module only tracks and propagates context data.

import type { Wave0CorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { createChildCorrelationContext } from '@/shared/standards/correlation-context-middleware';

/**
 * Tracks all correlation contexts created in the current session/request scope.
 * Used for diagnostic reporting to verify full traceability.
 */
export class CorrelationContextTracker {
  private readonly activeContexts: Map<string, Wave0CorrelationContext> = new Map();

  /** Register a new correlation context */
  register(context: Wave0CorrelationContext): void {
    this.activeContexts.set(context.correlationId, context);
  }

  /** Get a context by correlation ID */
  get(correlationId: string): Wave0CorrelationContext | undefined {
    return this.activeContexts.get(correlationId);
  }

  /** Check if a context exists */
  has(correlationId: string): boolean {
    return this.activeContexts.has(correlationId);
  }

  /** Get all registered contexts */
  getAll(): Wave0CorrelationContext[] {
    return [...this.activeContexts.values()];
  }

  /** Count of active contexts */
  get count(): number {
    return this.activeContexts.size;
  }

  /** Remove expired contexts (older than maxAgeMs milliseconds) */
  cleanup(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, ctx] of this.activeContexts.entries()) {
      const ctxTimestamp = new Date(ctx.timestamp).getTime();
      if (now - ctxTimestamp > maxAgeMs) {
        this.activeContexts.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /** Clear all tracked contexts */
  clear(): void {
    this.activeContexts.clear();
  }
}

/**
 * Builds a complete correlation chain summary from a root context through all children.
 * Per MOD-017 §5.3 (Event Correlation Model): Every observable signal MUST include correlationId.
 * @param rootContext - The initial/root correlation context
 * @param tracker - Active correlation context tracker
 * @returns Chain summary showing parent-child relationships
 */
export function buildCorrelationChainSummary(
  rootContext: Wave0CorrelationContext,
  tracker: CorrelationContextTracker
): {
  rootCorrelationId: string;
  totalContextsInChain: number;
  modulesInvolved: Set<string>;
  chainLength: number;
  rootTimestamp: string;
  latestTimestamp: string;
} {
  const allContexts = tracker.getAll();
  const chainContexts = allContexts.filter(ctx => {
    // Include contexts that share the same traceId or are child/grandchild of root
    return ctx.traceId === rootContext.traceId || isDescendantOf(ctx, rootContext, tracker);
  });

  const modules = new Set<string>(chainContexts.map(ctx => ctx.moduleId!).filter(Boolean) as string[]);

  return {
    rootCorrelationId: rootContext.correlationId,
    totalContextsInChain: chainContexts.length,
    modulesInvolved: modules,
    chainLength: chainContexts.length,
    rootTimestamp: rootContext.timestamp,
    latestTimestamp: chainContexts.reduce((latest, ctx) =>
      ctx.timestamp > latest ? ctx.timestamp : latest, rootContext.timestamp
    ),
  };
}

/**
 * Checks if a context is a descendant of a root context (direct or indirect).
 */
function isDescendantOf(
  ctx: Wave0CorrelationContext,
  root: Wave0CorrelationContext,
  tracker: CorrelationContextTracker
): boolean {
  if (ctx.parentId === root.spanId) return true;
  if (!ctx.parentId) return false;
  const parent = tracker.get(ctx.parentId);
  if (!parent) return false;
  return isDescendantOf(parent, root, tracker);
}

/**
 * Validates that correlation context has required fields populated.
 * Per MOD-017 §7.2 (Full Traceability Rule): No unlogged execution is allowed.
 * @param context - Context to validate
 * @returns Validation result
 */
export function validateCorrelationContext(context: Partial<Wave0CorrelationContext>): {
  valid: boolean;
  missingFields: string[];
} {
  const required: (keyof Wave0CorrelationContext)[] = ['correlationId', 'traceId', 'spanId', 'timestamp'];
  const missing: string[] = [];

  for (const field of required) {
    const value = context[field];
    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missingFields: missing,
  };
}
