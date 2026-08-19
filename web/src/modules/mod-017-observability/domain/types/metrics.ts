// NexCargo MOD-017 Domain Types — Metrics Collection Framework
// Authoritative source: MOD-017 §4.2 (Metric Object) + §3.2 (Metrics System)
// Implements exit criteria X-08: Metric recording with GAUGE/COUNTER/HISTOGRAM types, real-time emission

/**
 * Aggregation type enum per MOD-017 §4.2
 */
export enum AggregationType {
  GAUGE = 'GAUGE',       // Single value at a point in time (e.g., memory usage)
  COUNTER = 'COUNTER',    // Monotonically increasing value (e.g., request count)
  HISTOGRAM = 'HISTOGRAM', // Distribution of values (e.g., response latency)
}

/**
 * Metric Object — represents system or performance metric.
 * Per MOD-017 §4.2.
 */
export interface MetricObject {
  // Core attributes from MOD-017 §4.2
  metricId: string;           // UUID v4
  metricName: string;
  value: number;
  unit: string;               // e.g., "ms", "bytes", "requests"
  timestamp: string;          // ISO 8601
  sourceModule: string;       // Module identifier (MOD-001 through MOD-018)
  tags?: Record<string, string>; // Key-value pairs for segmentation
  aggregationType: AggregationType;
}

/**
 * Records a metric value.
 * @param params - Metric parameters
 * @returns Complete MetricObject with generated ID and timestamp
 */
export function recordMetric(params: Partial<MetricObject>): MetricObject {
  return {
    metricId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...params,
  } as MetricObject;
}
