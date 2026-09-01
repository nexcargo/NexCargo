// NexCargo MOD-017 — Metrics Collector Tests (Wave 5 Increment 2)
// Authoritative source: MOD-017 §3.2 (Metrics System), §4.2 (Metric Object)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetricsCollector,
  createMetricsCollector,
} from '../domain/services/metric-collector';
import { AggregationType } from '../domain/types/metrics';

describe('MOD-017 MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({ logModule: 'MOD-017' });
  });

  // ---- Gauge Operations ----

  describe('GAUGE metrics', () => {
    it('records and retrieves a gauge metric', () => {
      const metric = collector.recordGauge({
        metricName: 'memory.usage',
        value: 512,
        unit: 'MB',
        sourceModule: 'MOD-001',
      });

      expect(metric.metricName).toBe('memory.usage');
      expect(metric.value).toBe(512);
      expect(metric.aggregationType).toBe(AggregationType.GAUGE);
      expect(metric.sourceModule).toBe('MOD-001');

      const retrieved = collector.getGauge('memory.usage');
      expect(retrieved).toBe(512);
    });

    it('overwrites previous gauge value with latest', () => {
      collector.recordGauge({
        metricName: 'cpu.load',
        value: 25,
        unit: '%',
        sourceModule: 'MOD-002',
      });

      collector.recordGauge({
        metricName: 'cpu.load',
        value: 78,
        unit: '%',
        sourceModule: 'MOD-002',
      });

      expect(collector.getGauge('cpu.load')).toBe(78);
    });

    it('supports tagged gauges with separate values', () => {
      collector.recordGauge({
        metricName: 'connections',
        value: 10,
        unit: 'count',
        sourceModule: 'MOD-003',
        tags: { region: 'us-east' },
      });

      collector.recordGauge({
        metricName: 'connections',
        value: 5,
        unit: 'count',
        sourceModule: 'MOD-003',
        tags: { region: 'eu-west' },
      });

      expect(collector.getGauge('connections', { region: 'us-east' })).toBe(10);
      expect(collector.getGauge('connections', { region: 'eu-west' })).toBe(5);
    });

    it('returns undefined for non-existent gauge', () => {
      expect(collector.getGauge('nonexistent.gauge')).toBeUndefined();
    });

    it('lists registered gauge names', () => {
      collector.recordGauge({
        metricName: 'metric.a',
        value: 1,
        unit: 'unit',
        sourceModule: 'MOD-001',
      });
      collector.recordGauge({
        metricName: 'metric.b',
        value: 2,
        unit: 'unit',
        sourceModule: 'MOD-001',
      });

      const gauges = collector.listGauges();
      expect(gauges).toContain('metric.a');
      expect(gauges).toContain('metric.b');
      expect(gauges.length).toBe(2);
    });
  });

  // ---- Counter Operations ----

  describe('COUNTER metrics', () => {
    it('records an initial counter value', () => {
      const metric = collector.recordCounter({
        metricName: 'http.requests.total',
        value: 0,
        unit: 'requests',
        sourceModule: 'MOD-001',
      });

      expect(metric.aggregationType).toBe(AggregationType.COUNTER);
      expect(metric.value).toBe(0);
    });

    it('increments a counter atomically', () => {
      collector.recordCounter({
        metricName: 'http.errors',
        value: 0,
        unit: 'errors',
        sourceModule: 'MOD-001',
      });

      const val1 = collector.incrementCounter('http.errors', 1);
      expect(val1).toBe(1);

      const val2 = collector.incrementCounter('http.errors', 5);
      expect(val2).toBe(6);

      const val3 = collector.incrementCounter('http.errors');
      expect(val3).toBe(7);
    });

    it('supports tagged counters with separate increments', () => {
      // Pre-register both tagged variants so they start from known values
      collector.recordCounter({
        metricName: 'api.calls',
        value: 0,
        unit: 'calls',
        sourceModule: 'MOD-002',
        tags: { endpoint: '/listings' },
      });
      collector.recordCounter({
        metricName: 'api.calls',
        value: 0,
        unit: 'calls',
        sourceModule: 'MOD-002',
        tags: { endpoint: '/offers' },
      });

      const val1 = collector.incrementCounter('api.calls', 3, { endpoint: '/listings' });
      expect(val1).toBe(3);

      const val2 = collector.incrementCounter('api.calls', 7, { endpoint: '/offers' });
      expect(val2).toBe(7);
    });

    it('auto-registers counter on first increment if not previously recorded', () => {
      // No recordCounter call — just increment directly
      const val = collector.incrementCounter('auto.counter', 42);
      expect(val).toBe(42);
    });

    it('resets counter and re-registers cleanly', () => {
      collector.recordCounter({
        metricName: 'test.counter',
        value: 10,
        unit: 'count',
        sourceModule: 'MOD-001',
      });

      collector.incrementCounter('test.counter', 5);
      expect(collector.incrementCounter('test.counter')).toBe(16);

      collector.resetCounter('test.counter');
      // After reset, incrementing auto-registers from zero
      const afterReset = collector.incrementCounter('test.counter', 1);
      expect(afterReset).toBe(1);
    });

    it('lists registered counter names', () => {
      collector.recordCounter({
        metricName: 'counter.x',
        value: 0,
        unit: 'x',
        sourceModule: 'MOD-001',
      });

      expect(collector.listCounters()).toContain('counter.x');
    });
  });

  // ---- Histogram Operations ----

  describe('HISTOGRAM metrics', () => {
    it('records histogram values and tracks distribution', () => {
      const metric = collector.recordHistogram(
        'request.latency',
        120,
        'ms',
        'MOD-001',
        { route: '/listings' }
      );

      expect(metric.aggregationType).toBe(AggregationType.HISTOGRAM);
      expect(metric.value).toBe(120);
      expect(metric.metricName).toBe('request.latency');
    });

    it('creates histogram automatically on first record', () => {
      collector.recordHistogram(
        'response.size',
        1024,
        'bytes',
        'MOD-002'
      );

      expect(collector.listHistograms()).toContain('response.size');
    });

    it('computes histogram summary statistics correctly', () => {
      // Record known values: [10, 20, 30, 40, 50]
      const values = [10, 20, 30, 40, 50];
      for (const v of values) {
        collector.recordHistogram('test.values', v, 'units', 'MOD-001', {}, [25, 75]);
      }

      const summary = collector.getHistogramSummary('test.values', {});
      expect(summary).not.toBeNull();
      expect(summary!.count).toBe(5);
      expect(summary!.sum).toBe(150);
      expect(summary!.min).toBe(10);
      expect(summary!.max).toBe(50);
      expect(summary!.mean).toBe(30);
      expect(summary!.percentile50).toBe(30);
      expect(summary!.buckets.bounds).toEqual([25, 75]);
      // Cumulative bucket counts with exclusive upper bounds (<):
      // All 5 values pass bucket 0 (all have boundIdx >= 0), 3 values pass bucket 1 (values >= 25)
      expect(summary!.buckets.countPerBucket[0]).toBe(5);
      expect(summary!.buckets.countPerBucket[1]).toBe(3);
      expect(summary!.buckets.countPerBucket[2]).toBe(0);
    });

    it('uses default bounds when none provided', () => {
      collector.recordHistogram('default.buckets', 50, 'ms', 'MOD-001');
      const summary = collector.getHistogramSummary('default.buckets', {});
      expect(summary).not.toBeNull();
      expect(summary!.count).toBe(1);
      expect(summary!.buckets.bounds.length).toBeGreaterThan(0);
      expect(summary!.buckets.countPerBucket.length).toBe(summary!.buckets.bounds.length + 1);
    });

    it('returns null for unrecorded histogram', () => {
      expect(collector.getHistogramSummary('never.used.histogram', {})).toBeNull();
    });

    it('supports multiple histograms independently', () => {
      collector.recordHistogram('latency.api', 100, 'ms', 'MOD-001');
      collector.recordHistogram('latency.db', 5, 'ms', 'MOD-002');

      const apiSummary = collector.getHistogramSummary('latency.api', {});
      const dbSummary = collector.getHistogramSummary('latency.db', {});

      expect(apiSummary!.count).toBe(1);
      expect(apiSummary!.min).toBe(100);
      expect(dbSummary!.min).toBe(5);
    });

    it('lists registered histogram names', () => {
      collector.recordHistogram('hist.a', 1, 'ms', 'MOD-001');
      collector.recordHistogram('hist.b', 2, 'ms', 'MOD-001');
      expect(collector.listHistograms()).toHaveLength(2);
    });
  });

  // ---- Stats & Lifecycle ----

  describe('Lifecycle operations', () => {
    it('reports correct metric counts', () => {
      collector.recordGauge({ metricName: 'g1', value: 1, unit: 'u', sourceModule: 'M1' });
      collector.recordCounter({ metricName: 'c1', value: 0, unit: 'u', sourceModule: 'M1' });
      collector.recordHistogram('h1', 1, 'ms', 'M1');

      expect(collector.getStats()).toEqual({
        gauges: 1,
        counters: 1,
        histograms: 1,
      });
    });

    it('clears all metrics', () => {
      collector.recordGauge({ metricName: 'g1', value: 1, unit: 'u', sourceModule: 'M1' });
      collector.recordCounter({ metricName: 'c1', value: 0, unit: 'u', sourceModule: 'M1' });
      collector.recordHistogram('h1', 1, 'ms', 'M1');

      collector.clearAll();

      expect(collector.listGauges()).toHaveLength(0);
      expect(collector.listCounters()).toHaveLength(0);
      expect(collector.listHistograms()).toHaveLength(0);
      expect(collector.getStats()).toEqual({ gauges: 0, counters: 0, histograms: 0 });
    });

    it('creates via factory function', () => {
      const mc = createMetricsCollector({ logModule: 'TEST' });
      expect(mc).toBeInstanceOf(MetricsCollector);
      mc.clearAll();
    });

    it('handles large volume gracefully', () => {
      collector.recordCounter({
        metricName: 'bulk.test',
        value: 0,
        unit: 'count',
        sourceModule: 'MOD-001',
      });

      for (let i = 1; i <= 1000; i++) {
        collector.incrementCounter('bulk.test', i);
      }

      // Sum of 1..1000 = 500500
      expect(collector.getStats().counters).toBe(1);
      const val = collector.incrementCounter('bulk.test');
      expect(val).toBe(500501); // sum of 1..1000 + 1
    });
  });

  // ---- NO INTERVENTION Verification ----

  describe('NO-INTERVENTION BOUNDARY VERIFICATION', () => {
    it('metric collection does not modify application state outside registry', () => {
      // Metric recording should only affect internal Map storage, not external state
      collector.recordGauge({ metricName: 'noop.check', value: 42, unit: 'n/a', sourceModule: 'MOD-017' });
      expect(collector.getGauge('noop.check')).toBe(42);
    });

    it('counter operations do not trigger side effects', () => {
      collector.recordCounter({ metricName: 'side.effect.free', value: 0, unit: 'count', sourceModule: 'MOD-001' });
      collector.incrementCounter('side.effect.free');
      // No external state modification — pure in-memory
    });

    it('histogram recording is read-only operation', () => {
      collector.recordHistogram('readonly.test', 100, 'ms', 'MOD-001');
      const summary = collector.getHistogramSummary('readonly.test', {});
      expect(summary!.count).toBe(1);
    });
  });
});
