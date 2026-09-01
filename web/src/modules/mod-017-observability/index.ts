// NexCargo MOD-017 -- System Observability Module Barrel Export
// Wave 0 foundation + Wave 5 Increment 1 + Increment 2 runtime services.
// Authoritative source: MOD-017 specification + ESS-005/ESS-006.

// --- Wave 0 Foundation: Types ---
export { LogLevel, createLogEntry } from './domain/types/logging';
export type { LogEntry, LoggerService } from './domain/types/logging';
export { AlertType, AlertSeverity, ALERT_PRIORITY_ORDER, getAlertPriority } from './domain/types/alerts';
export type { AlertObject } from './domain/types/alerts';
export { AggregationType, recordMetric } from './domain/types/metrics';
export type { MetricObject } from './domain/types/metrics';
export type { TraceObject, ModuleChainEntry } from './domain/types/tracing';
export { createTrace, addModuleToTrace } from './domain/types/tracing';
export { HealthStatus, createHealthCheck } from './domain/types/health-check';
export type { DependencyHealthRef, HealthStatusObject } from './domain/types/health-check';
export { IncidentSeverity, IncidentStatus } from './domain/types/incidents';
export type { IncidentObject } from './domain/types/incidents';
export type { DeploymentEventObject } from './domain/types/deployments';
export { SLAType, SLAComplianceStatus } from './domain/types/sla-metrics';
export type { SLAMetricObject } from './domain/types/sla-metrics';
export type { PredictiveFailureIndicator } from './domain/types/predictive-failure';

// --- Wave 0 Foundation: Utilities ---
export { formatLogEntry, createLogContext, getLogPriority } from './domain/utils/structured-log-formatter';
export { DEFAULT_DEDUP_WINDOW_MS, AlertDeduplicator, generateAlertSignature } from './domain/utils/alert-deduplication';
export { aggregateDependencyHealth, summarizeDependencyHealth } from './domain/utils/dependency-health-aggregator';
export { createAuditEventEmitter, isAuditEventComplete } from './domain/utils/audit-event-emitter';
export type { AuditEventEmitter } from './domain/utils/audit-event-emitter';
export { isValidTransition, getNextPossibleStatuses, isTerminal as isIncidentTerminal, getIncidentPriority } from './domain/utils/incident-lifecycle';
export { computeSLACompliance, recordSLAMetric, SLAMetricRecorder } from './domain/utils/sla-metric-recorder';

// --- Wave 5 Increment 1: Runtime Services ---
export {
  maskSensitiveFields,
  validateNoSensitiveData,
  createRuntimeLogger,
} from './domain/services/runtime-logger';

export {
  AlertChannel,
  AlertEmitterService,
} from './domain/services/alert-emitter';
export type { AlertRoute } from './domain/services/alert-emitter';

export {
  CorrelationContextTracker,
  buildCorrelationChainSummary,
  validateCorrelationContext,
} from './domain/services/correlation-tracker';

// --- Wave 5 Increment 2: Metrics, Tracing & Health Runtime ---
export {
  MetricsCollector,
  createMetricsCollector,
} from './domain/services/metric-collector';
export type {
  HistogramBuckets,
  HistogramSummary,
  TimeWindowConfig,
} from './domain/services/metric-collector';

export {
  DistributedTracer,
  SpanStatus,
  createDistributedTracer,
} from './domain/services/distributed-tracer';
export type { SpanData } from './domain/services/distributed-tracer';

export {
  HealthChecker,
  createHealthChecker,
} from './domain/services/health-check-runtime';
export type {
  HealthCheckResult,
  SystemHealthReport,
} from './domain/services/health-check-runtime';
