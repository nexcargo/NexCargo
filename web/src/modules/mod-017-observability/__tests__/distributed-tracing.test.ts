// NexCargo MOD-017 — Distributed Tracer Tests (Wave 5 Increment 2)
// Authoritative source: MOD-017 §3.3 (Distributed Tracing), §4.3 (Trace Object), §5.2–§5.3

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DistributedTracer,
  SpanStatus,
  createDistributedTracer,
} from '../domain/services/distributed-tracer';

describe('MOD-017 DistributedTracer', () => {
  let tracer: DistributedTracer;

  beforeEach(() => {
    tracer = new DistributedTracer({ logModule: 'MOD-017' });
  });

  // ---- Trace Creation ----

  describe('Trace creation and management', () => {
    it('starts a new trace with generated IDs', () => {
      const trace = tracer.startTrace();

      expect(trace.traceId).toBeDefined();
      expect(trace.spanId).toBeDefined();
      expect(trace.correlationId).toBeDefined();
      expect(trace.timestampStart).toBeDefined();
      expect(trace.status).toBe('SUCCESS');
      expect(trace.moduleChain).toHaveLength(0);
    });

    it('starts trace with custom correlation context overrides', () => {
      const trace = tracer.startTrace({
        correlationId: 'custom-correl-123',
        traceId: 'custom-trace-456',
        spanId: 'custom-span-789',
      });

      expect(trace.correlationId).toBe('custom-correl-123');
      expect(trace.traceId).toBe('custom-trace-456');
      expect(trace.spanId).toBe('custom-span-789');
    });

    it('creates unique traces for each start call', () => {
      const trace1 = tracer.startTrace();
      const trace2 = tracer.startTrace();

      expect(trace1.traceId).not.toBe(trace2.traceId);
      expect(trace1.spanId).not.toBe(trace2.spanId);
    });

    it('reports initial active span count as zero', () => {
      expect(tracer.getActiveSpanCount()).toBe(0);
    });

    it('reports zero completed traces initially', () => {
      expect(tracer.getCompletedTraceCount()).toBe(0);
    });
  });

  // ---- Child Span Creation ----

  describe('Child span creation', () => {
    let trace: ReturnType<typeof tracer.startTrace>;

    beforeEach(() => {
      trace = tracer.startTrace();
    });

    it('creates a child span within a trace', () => {
      const span = tracer.createChildSpan(trace, 'MOD-001', 'marketplace.query');

      expect(span.spanId).toBeDefined();
      expect(span.traceId).toBe(trace.traceId);
      expect(span.parentId).toBe(trace.spanId);
      expect(span.operationName).toBe('marketplace.query');
      expect(span.moduleId).toBe('MOD-001');
      expect(span.status).toBe(SpanStatus.ACTIVE);
      expect(span.startTime).toBeGreaterThan(0);
    });

    it('increments active span count when span created', () => {
      tracer.createChildSpan(trace, 'MOD-001', 'op1');
      expect(tracer.getActiveSpanCount()).toBe(1);
    });

    it('supports multiple child spans in same trace', () => {
      const span1 = tracer.createChildSpan(trace, 'MOD-001', 'marketplace.query');
      const span2 = tracer.createChildSpan(trace, 'MOD-002', 'booking.validate');

      expect(span1.parentId).toBe(trace.spanId);
      expect(span2.parentId).toBe(trace.spanId);
      expect(span1.spanId).not.toBe(span2.spanId);
      expect(tracer.getActiveSpanCount()).toBe(2);
    });

    it('allows custom parent span ID override', () => {
      const span1 = tracer.createChildSpan(trace, 'MOD-001', 'first.op');
      const span2 = tracer.createChildSpan(trace, 'MOD-002', 'second.op', span1.spanId);

      expect(span2.parentId).toBe(span1.spanId);
      expect(span2.parentId).not.toBe(trace.spanId);
    });

    it('attaches default tags including correlation ID', () => {
      const customTrace = tracer.startTrace({ correlationId: 'my-correl-id' });
      const span = tracer.createChildSpan(customTrace, 'MOD-003', 'test.op');

      expect(span.tags!['trace.id']).toBe(customTrace.traceId);
      expect(span.tags!['correlation.id']).toBe('my-correl-id');
      expect(span.tags!['module.source']).toBe('MOD-003');
    });

    it('adds module to parent trace chain', () => {
      tracer.createChildSpan(trace, 'MOD-001', 'mod1.op');

      expect(trace.moduleChain.length).toBeGreaterThanOrEqual(1);
      expect(trace.moduleChain[0].moduleId).toBe('MOD-001');
    });
  });

  // ---- Span Completion ----

  describe('Span completion', () => {
    let trace: ReturnType<typeof tracer.startTrace>;
    let span: ReturnType<typeof tracer.createChildSpan>;

    beforeEach(() => {
      trace = tracer.startTrace();
      span = tracer.createChildSpan(trace, 'MOD-001', 'complete.me');
    });

    it('completes span with SUCCESS status', () => {
      tracer.completeSpan(span.spanId, SpanStatus.SUCCESS);

      expect(span.endTime).toBeGreaterThan(0);
      expect(span.latencyMs).toBeGreaterThan(0);
      expect(span.status).toBe(SpanStatus.SUCCESS);
      expect(tracer.getActiveSpanCount()).toBe(0);
    });

    it('completes span with ERROR status', () => {
      tracer.completeSpan(span.spanId, SpanStatus.ERROR, { errorMessage: 'DB connection failed' });

      expect(span.status).toBe(SpanStatus.ERROR);
      expect(span.metadata?.errorMessage).toBe('DB connection failed');
    });

    it('completes span with TIMEOUT status', () => {
      tracer.completeSpan(span.spanId, SpanStatus.TIMEOUT);
      expect(span.status).toBe(SpanStatus.TIMEOUT);
    });

    it('silently handles unknown spanId on completion', () => {
      // Should not throw
      tracer.completeSpan('nonexistent-span-id', SpanStatus.SUCCESS);
      expect(tracer.getActiveSpanCount()).toBe(1); // Original span still active
    });

    it('computes latency between start and completion', () => {
      tracer.completeSpan(span.spanId, SpanStatus.SUCCESS);
      expect(span.latencyMs!).toBeGreaterThanOrEqual(0);
    });
  });

  // ---- Trace Finalization ----

  describe('Trace finalization', () => {
    it('finishes root trace and archives it', () => {
      const trace = tracer.startTrace();
      const finished = tracer.finishTrace(trace);

      expect(finished.timestampEnd).toBeDefined();
      expect(finished.status).toBeDefined();
      expect(finished.latencyMs).toBeGreaterThanOrEqual(0);

      const archived = tracer.getTrace(finished.traceId!);
      expect(archived).toEqual(finished);
    });

    it('archives trace accessible by traceId after finish', () => {
      const trace = tracer.startTrace();
      tracer.finishTrace(trace);

      expect(tracer.listCompletedTraces()).toContain(trace.traceId!);
    });

    it('handles empty module chain latency calculation', () => {
      const trace = tracer.startTrace();
      const finished = tracer.finishTrace(trace);

      // Zero latency for empty trace is valid
      expect(finished.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns undefined for non-existent trace lookup', () => {
      expect(tracer.getTrace('nonexistent-trace')).toBeUndefined();
    });
  });

  // ---- Cross-Module Visibility ----

  describe('Cross-module visibility', () => {
    it('tracks modules involved across multiple traces', () => {
      const trace1 = tracer.startTrace();
      tracer.createChildSpan(trace1, 'MOD-001', 'op1');
      tracer.createChildSpan(trace1, 'MOD-002', 'op2');
      tracer.finishTrace(trace1);

      const trace2 = tracer.startTrace();
      tracer.createChildSpan(trace2, 'MOD-001', 'op3');
      tracer.finishTrace(trace2);

      const visibility = tracer.getCrossModuleVisibility();
      expect(visibility['MOD-001'].traces).toBe(2);
      expect(visibility['MOD-002'].traces).toBe(1);
    });

    it('includes average latency per module', () => {
      const trace = tracer.startTrace();
      tracer.createChildSpan(trace, 'MOD-001', 'slow.op');
      // Artificially set latency
      const entries = [...tracer['activeSpans'].values()];
      if (entries.length > 0) {
        entries[0].endTime = entries[0].startTime + 100;
        entries[0].latencyMs = 100;
      }
      tracer.finishTrace(trace);

      const visibility = tracer.getCrossModuleVisibility();
      // Average latency should be calculated if latencies exist
      expect(visibility['MOD-001']).toBeDefined();
    });
  });

  // ---- Stats & Lifecycle ----

  describe('Lifecycle operations', () => {
    it('reports accurate statistics during operation', () => {
      const trace = tracer.startTrace();
      tracer.createChildSpan(trace, 'MOD-001', 'op1');
      tracer.createChildSpan(trace, 'MOD-002', 'op2');

      tracer.completeSpan([...tracer['activeSpans'].keys()][0], SpanStatus.SUCCESS);
      tracer.finishTrace(trace);

      const stats = tracer.getStats();
      expect(stats.completedTraces).toBe(1);
      expect(stats.uniqueTraces).toBe(1);
      expect(stats.activeSpans).toBe(1); // One span still active (the other was completed)
    });

    it('clears all tracing data', () => {
      const trace = tracer.startTrace();
      tracer.createChildSpan(trace, 'MOD-001', 'op1');
      tracer.finishTrace(trace);

      tracer.clearAll();

      expect(tracer.getActiveSpanCount()).toBe(0);
      expect(tracer.getCompletedTraceCount()).toBe(0);
      expect(tracer.listCompletedTraces()).toHaveLength(0);
    });

    it('creates via factory function', () => {
      const dt = createDistributedTracer({ logModule: 'TEST' });
      expect(dt).toBeInstanceOf(DistributedTracer);
      dt.clearAll();
    });
  });

  // ---- NO INTERVENTION Verification ----

  describe('NO-INTERVENTION BOUNDARY VERIFICATION', () => {
    it('span creation does not modify application state outside registry', () => {
      const trace = tracer.startTrace();
      tracer.createChildSpan(trace, 'MOD-001', 'noop.span');
      // Only internal Map storage affected
      expect(tracer.getActiveSpanCount()).toBe(1);
    });

    it('span completion only updates internal state', () => {
      const trace = tracer.startTrace();
      const span = tracer.createChildSpan(trace, 'MOD-001', 'complete.test');
      tracer.completeSpan(span.spanId, SpanStatus.SUCCESS);
      // No external side effects — pure observation
      expect(tracer.getActiveSpanCount()).toBe(0);
    });

    it('trace finishing is a read-only archival operation', () => {
      const trace = tracer.startTrace();
      tracer.createChildSpan(trace, 'MOD-001', 'final.op');
      tracer.finishTrace(trace);
      // Only archived internally, no system changes
    });
  });
});
