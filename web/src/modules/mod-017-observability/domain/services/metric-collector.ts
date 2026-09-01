// NexCargo MOD-017 — Metrics Collection Pipeline
// Authoritative source: MOD-017 §3.2 (Metrics System), §4.2 (Metric Object), §5.1 (Unified Telemetry Model)
// Implements runtime metric collection with GAUGE/COUNTER/HISTOGRAM aggregation types,
// real-time recording, and historical aggregation.
// NO INTERVENTION: This module only records metrics. It never modifies system behavior.

import type { MetricObject } from '../types/metrics';
import { recordMetric, AggregationType } from '../types/metrics';
import { LogLevel, createLogEntry } from '../types/logging';
import type { LogEntry } from '../types/logging';
import { formatLogEntry, getLogPriority, createLogContext } from '../utils/structured-log-formatter';

/**
 * Histogram bucket boundaries for latency/threshold distributions.
 */
export interface HistogramBuckets {
  bounds: number[];        // Upper bounds for each bucket
  countPerBucket: number[]; // Count of values in each bucket
}

/**
 * Summary statistics computed from histogram data.
 */
export interface HistogramSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  percentile50: number;
  percentile90: number;
  percentile95: number;
  percentile99: number;
  buckets: HistogramBuckets;
}

/**
 * Time-series window configuration for historical aggregation.
 */
export interface TimeWindowConfig {
  windowMs: number;           // Window size in milliseconds
  maxWindows: number;         // Maximum number of windows to retain
}

/**
 * Default time window configuration: 60-second sliding window, 24 hours retention.
 */
export const DEFAULT_TIME_WINDOW_CONFIG: Required<TimeWindowConfig> = {
  windowMs: 60_000,
  maxWindows: 1440,
};

/**
 * Internal storage entry for a single metric series over time.
 */
interface MetricSeriesEntry {
  value: number;
  timestamp: string;
  tags: Record<string, string>;
}

/**
 * In-memory time-series storage per metric name + tag combination.
 */
interface MetricSeries {
  name: string;
  unit: string;
  aggregationType: AggregationType;
  sourceModule: string;
  defaultTags: Record<string, string>;
  entries: Map<string, MetricSeriesEntry>;  // key = "timestamp_window"
}

/**
 * Configured histogram with its bucket layout.
 */
interface HistogramConfig {
  name: string;
  unit: string;
  sourceModule: string;
  defaultTags: Record<string, string>;
  bounds: number[];
  currentCounts: number[];
  totalValues: number[];
  count: number;
  sum: number;
  min: number;
  max: number;
}

/**
 * Runtime MetricsCollector — records, aggregates, and queries metrics.
 * Per MOD-017 §3.2: Real-time and historical metric collection.
 * Per MOD-017 §4.2: Must support GAUGE / COUNTER / HISTOGRAM aggregation types.
 * NO INTERVENTION: Records facts only. Never triggers actions or alters state.
 */
export class MetricsCollector {
  private gauges: Map<string, MetricSeries> = new Map();
  private counters: Map<string, MetricSeries> = new Map();
  private histograms: Map<string, HistogramConfig> = new Map();
  private timeWindow: Required<TimeWindowConfig>;
  private logModule: string;

  constructor(options?: {
    timeWindow?: Partial<TimeWindowConfig>;
    logModule?: string;
  }) {
    this.timeWindow = { ...DEFAULT_TIME_WINDOW_CONFIG, ...options?.timeWindow };
    this.logModule = options?.logModule ?? 'MOD-017';
  }

  /**
   * Records a gauge metric — a single value at a point in time.
   * Examples: memory usage, CPU load, connection pool size.
   * @param params - Gauge metric parameters (metricId/timestamp auto-generated)
   * @returns Recorded MetricObject
   */
  recordGauge(params: Omit<Partial<MetricObject>, 'aggregationType'>): MetricObject {
    return this.recordMetricWithAggregation(
      params,
      AggregationType.GAUGE,
      this.gauges
    );
  }

  /**
   * Records a counter metric — monotonically increasing value.
   * Examples: request count, bytes transferred, errors processed.
   * @param params - Counter metric parameters (metricId/timestamp auto-generated)
   * @returns Recorded MetricObject
   */
  recordCounter(params: Omit<Partial<MetricObject>, 'aggregationType'>): MetricObject {
    return this.recordMetricWithAggregation(
      params,
      AggregationType.COUNTER,
      this.counters
    );
  }

  /**
   * Records a histogram metric — distribution of values across buckets.
   * Examples: response latency, payload sizes, queue depths.
   * Automatically creates histogram if not previously configured.
   * @param name - Histogram name
   * @param value - Observed value
   * @param unit - Measurement unit
   * @param sourceModule - Source module identifier
   * @param tags - Optional segmentation tags
   * @param bounds - Optional bucket boundaries (auto-configures histogram)
   * @returns Recorded MetricObject
   */
  recordHistogram(
    name: string,
    value: number,
    unit: string,
    sourceModule: string,
    tags?: Record<string, string>,
    bounds?: number[]
  ): MetricObject {
    const key = buildSeriesKey(name, tags);
    const now = new Date().toISOString();
    const entry = { value, timestamp: now, tags: tags ?? {} };

    if (!this.histograms.has(key)) {
      this.configureHistogram(key, name, unit, sourceModule, tags ?? {}, bounds ?? getDefaultBounds());
    }

    const hist = this.histograms.get(key)!;
    const boundIdx = findBucketIndex(hist.bounds, value);
    // Cumulative bucket counting: all buckets up to and including boundIdx get incremented
    for (let i = 0; i < hist.currentCounts.length; i++) {
      if (i <= boundIdx) {
        hist.currentCounts[i]++;
      }
    }
    hist.count++;
    hist.sum += value;
    if (hist.count === 1 || value < hist.min) hist.min = value;
    if (hist.count === 1 || value > hist.max) hist.max = value;
    hist.totalValues.push(value);

    const metric = recordMetric({
      metricId: crypto.randomUUID(),
      metricName: name,
      value,
      unit,
      timestamp: now,
      sourceModule,
      tags,
      aggregationType: AggregationType.HISTOGRAM,
    });

    // Emit structured log per MOD-017 §5.1 unified telemetry model
    emitMetricLog(this.logModule, metric);

    return metric;
  }

  /**
   * Gets the current gauge value for a metric name.
   * @param name - Gauge metric name
   * @param tags - Optional tag filter
   * @returns Latest gauge value or undefined
   */
  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    const key = buildSeriesKey(name, tags);
    const series = this.gauges.get(key);
    if (!series || series.entries.size === 0) return undefined;

    // Return most recent entry
    const entries = [...series.entries.values()];
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries[0].value;
  }

  /**
   * Gets the current counter value and increments it atomically.
   * Auto-registers counter if not previously recorded.
   * @param name - Counter metric name
   * @param increment - Amount to add (default: 1)
   * @param tags - Optional tag filter
   * @returns New counter value
   */
  incrementCounter(name: string, increment: number = 1, tags?: Record<string, string>): number {
    const key = buildSeriesKey(name, tags);
    let series = this.counters.get(key);
    if (!series) {
      // Auto-register counter with existing tags if available
      series = {
        name,
        unit: 'count',
        aggregationType: AggregationType.COUNTER,
        sourceModule: '',
        defaultTags: tags ?? {},
        entries: new Map(),
      };
      this.counters.set(key, series);
    }

    const lastEntry = getLastEntry(series);
    const baseValue = lastEntry ? lastEntry.value : 0;
    const newValue = baseValue + increment;
    const now = new Date().toISOString();
    series.entries.set(buildTimestampKey(now), { value: newValue, timestamp: now, tags: tags ?? {} });

    return newValue;
  }

  /**
   * Resets counter to zero (useful between test runs).
   * Clears all entries for the specified key.
   * @param name - Counter metric name
   * @param tags - Optional tag filter
   */
  resetCounter(name: string, tags?: Record<string, string>): void {
    const key = buildSeriesKey(name, tags);
    this.counters.delete(key);
  }

  /**
   * Gets summary statistics for a histogram.
   * @param name - Histogram name
   * @param tags - Optional tag filter
   * @returns HistogramSummary with percentiles and bucket breakdown
   */
  getHistogramSummary(name: string, tags?: Record<string, string>): HistogramSummary | null {
    const key = buildSeriesKey(name, tags);
    const hist = this.histograms.get(key);
    if (!hist || hist.count === 0) return null;

    const sortedValues = Array.from(hist.totalValues).sort((a, b) => a - b);
    const mean = hist.sum / hist.count;

    return {
      count: hist.count,
      sum: hist.sum,
      min: hist.min,
      max: hist.max,
      mean,
      percentile50: percentile(sortedValues, 50),
      percentile90: percentile(sortedValues, 90),
      percentile95: percentile(sortedValues, 95),
      percentile99: percentile(sortedValues, 99),
      buckets: {
        bounds: hist.bounds,
        countPerBucket: [...hist.currentCounts],
      },
    };
  }

  /**
   * Lists all registered gauge names.
   */
  listGauges(): string[] {
    return [...this.gauges.keys()];
  }

  /**
   * Lists all registered counter names.
   */
  listCounters(): string[] {
    return [...this.counters.keys()];
  }

  /**
   * Lists all registered histogram names.
   */
  listHistograms(): string[] {
    return [...this.histograms.keys()];
  }

  /**
   * Returns counts of all registered metrics.
   */
  getStats(): { gauges: number; counters: number; histograms: number } {
    return {
      gauges: this.gauges.size,
      counters: this.counters.size,
      histograms: this.histograms.size,
    };
  }

  /**
   * Clears all metric data (for testing between runs).
   */
  clearAll(): void {
    this.gauges.clear();
    this.counters.clear();
    this.histograms.clear();
  }

  // --- Private helpers ---

  private recordMetricWithAggregation(
    params: Partial<MetricObject>,
    aggregationType: AggregationType,
    registry: Map<string, MetricSeries>
  ): MetricObject {
    const metricName = params.metricName ?? '';
    const unit = params.unit ?? '';
    const sourceModule = params.sourceModule ?? '';
    const value = params.value ?? 0;
    const key = buildSeriesKey(metricName, params.tags);
    const now = new Date().toISOString();

    if (!registry.has(key)) {
      registry.set(key, {
        name: metricName,
        unit,
        aggregationType,
        sourceModule,
        defaultTags: params.tags ?? {},
        entries: new Map(),
      });
    }

    const series = registry.get(key)!;
    series.entries.set(buildTimestampKey(now), {
      value,
      timestamp: now,
      tags: params.tags ?? {},
    });

    const metric = recordMetric({
      ...params,
      aggregationType,
    });

    emitMetricLog(this.logModule, metric);
    return metric;
  }

  private configureHistogram(
    key: string,
    name: string,
    unit: string,
    sourceModule: string,
    tags: Record<string, string>,
    bounds: number[]
  ): void {
    this.histograms.set(key, {
      name,
      unit,
      sourceModule,
      defaultTags: tags,
      bounds,
      currentCounts: new Array(bounds.length + 1).fill(0),
      totalValues: [],
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
    });
  }
}

// --- Module-scoped helper functions ---

/**
 * Build a unique series key from name + canonical tag string.
 */
function buildSeriesKey(name: string, tags?: Record<string, string>): string {
  if (!tags || Object.keys(tags).length === 0) return name;
  const tagStr = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(';');
  return `${name}:{${tagStr}}`;
}

/**
 * Build a deterministic timestamp key for deduplication within a time window.
 */
function buildTimestampKey(timestamp: string): string {
  return timestamp;
}

/**
 * Get the most recent entry from a metric series.
 */
function getLastEntry(series: MetricSeries): { value: number; timestamp: string; tags: Record<string, string> } {
  const entries = [...series.entries.values()];
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return entries[0];
}

/**
 * Find which histogram bucket index a value belongs to.
 */
function findBucketIndex(bounds: number[], value: number): number {
  for (let i = 0; i < bounds.length; i++) {
    if (value < bounds[i]) return i;
  }
  return bounds.length; // Overflow bucket
}

/**
 * Compute a percentile from sorted array using linear interpolation.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const fraction = idx - lower;
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

/**
 * Default histogram bucket boundaries for millisecond latency measurements.
 * Follows standard exponential-spaced latency buckets.
 */
function getDefaultBounds(): number[] {
  return [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
}

/**
 * Emits a structured log for every recorded metric per MOD-017 §5.1 Unified Telemetry Model.
 */
function emitMetricLog(logModule: string, metric: MetricObject): void {
  try {
    const logEntry: LogEntry = createLogEntry({
      auditEventId: crypto.randomUUID(),
      eventType: `mod-017.metric.${metric.aggregationType.toLowerCase()}`,
      moduleSource: logModule as LogEntry['moduleSource'],
      timestamp: metric.timestamp,
      correlationId: '',
      logLevel: LogLevel.INFO,
      message: `[METRIC] ${metric.aggregationType}: ${metric.metricName} = ${metric.value} ${metric.unit} (${metric.sourceModule})`,
      environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEV',
      metadata: {
        metricId: metric.metricId,
        tags: metric.tags,
      },
    });
    console.log(formatLogEntry(logEntry));
  } catch {
    // Metric logging must never break application flow — silently drop on failure
  }
}

/**
 * Creates a MetricsCollector instance with sensible defaults.
 * @param options - Configuration overrides
 * @ready instance ready for use
 */
export function createMetricsCollector(options?: { timeWindow?: Partial<TimeWindowConfig>; logModule?: string }): MetricsCollector {
  return new MetricsCollector(options);
}
