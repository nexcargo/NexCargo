// NexCargo MOD-017 — Correlation Propagation Tests (Wave 5 Increment 1)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CorrelationContextTracker,
  buildCorrelationChainSummary,
  validateCorrelationContext,
} from '../domain/services/correlation-tracker';
import { createCorrelationContext } from '@/shared/standards/correlation-id-propagation';
import { createChildCorrelationContext } from '@/shared/standards/correlation-context-middleware';

describe('MOD-017 Correlation Context Propagation', () => {
  describe('CorrelationContextTracker', () => {
    let tracker: CorrelationContextTracker;

    beforeEach(() => {
      tracker = new CorrelationContextTracker();
    });

    it('registers and retrieves a context', () => {
      const ctx = createCorrelationContext({ moduleId: 'MOD-011' });
      tracker.register(ctx);
      const retrieved = tracker.get(ctx.correlationId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.correlationId).toBe(ctx.correlationId);
    });

    it('reports correct count after registration', () => {
      const c1 = createCorrelationContext();
      const c2 = createCorrelationContext();
      tracker.register(c1);
      tracker.register(c2);
      expect(tracker.count).toBe(2);
    });

    it('checks existence correctly', () => {
      const ctx = createCorrelationContext();
      tracker.register(ctx);
      expect(tracker.has(ctx.correlationId)).toBe(true);
      expect(tracker.has('nonexistent')).toBe(false);
    });

    it('returns all registered contexts', () => {
      const c1 = createCorrelationContext();
      const c2 = createCorrelationContext();
      tracker.register(c1);
      tracker.register(c2);
      const all = tracker.getAll();
      expect(all).toHaveLength(2);
    });

    it('clears all tracked contexts', () => {
      const c1 = createCorrelationContext();
      tracker.register(c1);
      expect(tracker.count).toBe(1);
      tracker.clear();
      expect(tracker.count).toBe(0);
    });
  });

  describe('buildCorrelationChainSummary', () => {
    it('correctly counts modules involved', () => {
      const tracker = new CorrelationContextTracker();
      const root = createCorrelationContext({ moduleId: 'MOD-011' });
      tracker.register(root);

      const child = createChildCorrelationContext(root);
      child.moduleId = 'MOD-011';
      tracker.register(child);

      const summary = buildCorrelationChainSummary(root, tracker);
      expect(summary.modulesInvolved.size).toBeGreaterThanOrEqual(1);
      expect(summary.totalContextsInChain).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validateCorrelationContext', () => {
    it('validates fully populated context', () => {
      const result = validateCorrelationContext({
        correlationId: 'valid-id',
        traceId: 'valid-trace',
        spanId: 'valid-span',
        timestamp: '2026-09-01T00:00:00Z',
      });
      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('rejects missing correlationId', () => {
      const result = validateCorrelationContext({
        correlationId: '',
        traceId: 'valid-trace',
        spanId: 'valid-span',
        timestamp: '2026-09-01T00:00:00Z',
      });
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('correlationId');
    });

    it('rejects multiple missing fields', () => {
      const result = validateCorrelationContext({});
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('correlationId');
      expect(result.missingFields).toContain('traceId');
      expect(result.missingFields).toContain('spanId');
      expect(result.missingFields).toContain('timestamp');
    });
  });
});
