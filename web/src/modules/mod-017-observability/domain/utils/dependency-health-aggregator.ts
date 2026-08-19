// NexCargo MOD-017 Domain Utils — Dependency Health Aggregator
// Authoritative source: MOD-017 §4.4 (Health Status Object) + §3.4 (Health Monitoring)
// Aggregates individual dependency health checks into overall service health status.
// Per MOD-017 §4.4: All services must expose health check endpoints with dependency availability tracking.

import { HealthStatus, DependencyHealthRef } from '@/modules/mod-017-observability/domain/types/health-check';

/**
 * Aggregates dependency health statuses into an overall service health status.
 * Decision logic:
 * - If any dependency is DOWN → service is DEGRADED
 * - If more than 50% of dependencies are DOWN → service is DOWN
 * - Otherwise → service is HEALTHY
 * @param dependencies - Array of dependency health references
 * @returns Aggregated HealthStatus value
 */
export function aggregateDependencyHealth(dependencies: DependencyHealthRef[]): HealthStatus {
  if (dependencies.length === 0) {
    return HealthStatus.HEALTHY;
  }

  const downCount = dependencies.filter(d => d.status === HealthStatus.DOWN).length;
  const total = dependencies.length;

  // More than half of dependencies down → service is DOWN
  if (downCount > total / 2) {
    return HealthStatus.DOWN;
  }

  // Any dependency down → service is DEGRADED
  if (downCount > 0) {
    return HealthStatus.DEGRADED;
  }

  return HealthStatus.HEALTHY;
}

/**
 * Creates a summary report of dependency health.
 * @param dependencies - Array of dependency health references
 * @returns Summary object with counts and overall status
 */
export function summarizeDependencyHealth(dependencies: DependencyHealthRef[]): {
  healthy: number;
  degraded: number;
  down: number;
  total: number;
  overallStatus: HealthStatus;
  failedDependencies: string[];
} {
  const healthy = dependencies.filter(d => d.status === HealthStatus.HEALTHY).length;
  const degraded = dependencies.filter(d => d.status === HealthStatus.DEGRADED).length;
  const down = dependencies.filter(d => d.status === HealthStatus.DOWN).length;

  return {
    healthy,
    degraded,
    down,
    total: dependencies.length,
    overallStatus: aggregateDependencyHealth(dependencies),
    failedDependencies: dependencies
      .filter(d => d.status !== HealthStatus.HEALTHY)
      .map(d => `${d.moduleId}/${d.serviceId}`),
  };
}
