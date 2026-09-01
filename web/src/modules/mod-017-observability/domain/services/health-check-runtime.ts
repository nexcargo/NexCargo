// NexCargo MOD-017 — Health Check Runtime Infrastructure
// Authoritative source: MOD-017 §3.4 (Health Monitoring), §4.4 (Health Status Object), §5.2–§5.3
// Implements module/service health evaluation, dependency health tracking,
// and integration with existing dependency-health aggregation utilities.
// NO INTERVENTION: This module only reports health status. It never modifies system state.

import { HealthStatus, DependencyHealthRef, createHealthCheck } from '../types/health-check';
import type { HealthStatusObject } from '../types/health-check';
import { aggregateDependencyHealth, summarizeDependencyHealth } from '../utils/dependency-health-aggregator';
import { LogLevel, createLogEntry } from '../types/logging';
import type { LogEntry } from '../types/logging';
import { formatLogEntry, getLogPriority, createLogContext } from '../utils/structured-log-formatter';
import type { TraceObject } from '../types/tracing';

/**
 * Dependency check result from a registered health probe.
 */
interface DependencyProbeResult {
  serviceId: string;
  moduleId: string;
  status: HealthStatus;
  lastChecked: string;
  details?: string;
}

/**
 * Registered health probe for a module/dependency.
 */
interface HealthProbe {
  serviceId: string;
  moduleId: string;
  checkFn: () => Promise<HealthCheckResult>;
  timeoutMs: number;          // Probe timeout (default: 5000ms)
}

/**
 * Result of a single health check probe execution.
 */
export interface HealthCheckResult {
  status: HealthStatus;
  details?: string;           // Optional diagnostic detail
  latencyMs?: number;         // Time taken to execute the check
}

/**
 * System-wide health report aggregating all module statuses.
 */
export interface SystemHealthReport {
  overallStatus: HealthStatus;
  modules: Record<string, HealthStatusObject>;
  dependencies: DependencyHealthRef[];
  checkedAt: string;
}

/**
 * Default probe timeout in milliseconds.
 */
const DEFAULT_PROBE_TIMEOUT_MS = 5000;

/**
 * HealthChecker — runtime infrastructure for module and dependency health evaluation.
 * Per MOD-017 §3.4: Service health checks, dependency availability checks, readiness/liveness states.
 * Per MOD-017 §4.4: All services must expose health check endpoints with dependency availability tracking.
 * Per MOD-017 §7.5: ALL modules MUST emit observability signals; every service must expose health checks.
 * NO INTERVENTION: Reports facts only. Never triggers remediation or alters application state.
 */
export class HealthChecker {
  private probes: Map<string, HealthProbe> = new Map();     // key = "moduleId:serviceId"
  private healthCache: Map<string, HealthStatusObject> = new Map();
  private logModule: string;

  constructor(options?: { logModule?: string }) {
    this.logModule = options?.logModule ?? 'MOD-017';
  }

  /**
   * Registers a health probe for a specific service/module.
   * Per MOD-017 §4.4: All services must expose health check endpoints.
   * @param moduleId - Module identifier (e.g., "MOD-001")
   * @param serviceId - Service identifier within the module
   * @param checkFn - Async function that returns health status
   * @param timeoutMs - Optional timeout in milliseconds (default: 5000)
   */
  registerProbe(
    moduleId: string,
    serviceId: string,
    checkFn: () => Promise<HealthCheckResult>,
    timeoutMs?: number
  ): void {
    const key = `${moduleId}:${serviceId}`;
    this.probes.set(key, {
      serviceId,
      moduleId,
      checkFn,
      timeoutMs: timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS,
    });
  }

  /**
   * Executes all registered probes and aggregates results.
   * Per MOD-017 §4.4: Dependency availability must be tracked continuously.
   * @returns SystemHealthReport with per-module health statuses
   */
  async evaluateAll(): Promise<SystemHealthReport> {
    const modules: Record<string, HealthStatusObject> = {};
    const dependencies: DependencyHealthRef[] = [];

    for (const probe of this.probes.values()) {
      const result = await this.executeWithTimeout(probe);
      const depRef: DependencyHealthRef = {
        serviceId: probe.serviceId,
        moduleId: probe.moduleId,
        status: result.status,
        lastChecked: new Date().toISOString(),
        details: result.details,
      };
      dependencies.push(depRef);

      // Aggregate per module
      if (!modules[probe.moduleId]) {
        modules[probe.moduleId] = createHealthCheck({
          serviceId: probe.moduleId,
          moduleId: probe.moduleId,
          status: HealthStatus.HEALTHY,
          dependencyStatus: [],
          lastChecked: new Date().toISOString(),
        });
      }

      modules[probe.moduleId].dependencyStatus.push(depRef);
      modules[probe.moduleId].lastChecked = new Date().toISOString();

      // Update module-level status based on its dependency health
      const depsForModule = dependencies.filter(d => d.moduleId === probe.moduleId);
      modules[probe.moduleId].status = aggregateDependencyHealth(depsForModule);
      modules[probe.moduleId].details = computeModuleDetails(depsForModule);

      // Emit structured log per MOD-017 §5.1 unified telemetry model
      emitHealthLog(this.logModule, modules[probe.moduleId], depRef);
    }

    return {
      overallStatus: aggregateDependencyHealth(dependencies),
      modules,
      dependencies,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluates health for a single registered module.
   * @param moduleId - Module identifier
   * @returns HealthStatusObject or undefined if no probe registered
   */
  async evaluateModule(moduleId: string): Promise<HealthStatusObject | undefined> {
    const relevantProbes = [...this.probes.values()].filter(p => p.moduleId === moduleId);
    if (relevantProbes.length === 0) return undefined;

    const results: DependencyHealthRef[] = [];
    for (const probe of relevantProbes) {
      const result = await this.executeWithTimeout(probe);
      results.push({
        serviceId: probe.serviceId,
        moduleId: probe.moduleId,
        status: result.status,
        lastChecked: new Date().toISOString(),
        details: result.details,
      });
    }

    const overallStatus = aggregateDependencyHealth(results);

    const healthObj = createHealthCheck({
      serviceId: moduleId,
      moduleId,
      status: overallStatus,
      dependencyStatus: results,
      lastChecked: new Date().toISOString(),
      details: computeModuleDetails(results),
    });

    return healthObj;
  }

  /**
   * Gets cached health status for a module without re-evaluating.
   * @param moduleId - Module identifier
   * @returns Cached HealthStatusObject or undefined
   */
  getCachedHealth(moduleId: string): HealthStatusObject | undefined {
    return this.healthCache.get(moduleId);
  }

  /**
   * Updates cache after successful evaluation.
   * @param moduleId - Module identifier
   * @param health - Evaluated health status object
   */
  updateCache(moduleId: string, health: HealthStatusObject): void {
    this.healthCache.set(moduleId, health);
  }

  /**
   * Returns summary of all registered probes.
   */
  getProbeSummary(): { moduleId: string; serviceId: string; timeoutMs: number }[] {
    return [...this.probes.values()].map(p => ({
      moduleId: p.moduleId,
      serviceId: p.serviceId,
      timeoutMs: p.timeoutMs,
    }));
  }

  /**
   * Returns total registered probe count.
   */
  getProbeCount(): number {
    return this.probes.size;
  }

  /**
   * Removes a registered probe.
   * @param moduleId - Module identifier
   * @param serviceId - Service identifier
   */
  removeProbe(moduleId: string, serviceId: string): void {
    const key = `${moduleId}:${serviceId}`;
    this.probes.delete(key);
    this.healthCache.delete(moduleId);
  }

  /**
   * Clears all probes and caches.
   */
  clearAll(): void {
    this.probes.clear();
    this.healthCache.clear();
  }

  // --- Private helpers ---

  private async executeWithTimeout(probe: HealthProbe): Promise<HealthCheckResult> {
    const startTime = performance?.now() ?? Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Health probe timeout: ${probe.moduleId}/${probe.serviceId}`)), probe.timeoutMs);
      });

      const result = await Promise.race([probe.checkFn(), timeoutPromise]);
      const latencyMs = (performance?.now() ?? Date.now()) - startTime;

      return { status: result.status, details: result.details, latencyMs };
    } catch (error) {
      const latencyMs = (performance?.now() ?? Date.now()) - startTime;
      return {
        status: HealthStatus.DOWN,
        details: error instanceof Error ? error.message : 'Unknown health check failure',
        latencyMs,
      };
    }
  }
}

// --- Module-scoped helper functions ---

/**
 * Computes a human-readable detail string from dependency results.
 */
function computeModuleDetails(deps: DependencyHealthRef[]): string {
  const healthy = deps.filter(d => d.status === HealthStatus.HEALTHY).length;
  const degraded = deps.filter(d => d.status === HealthStatus.DEGRADED).length;
  const down = deps.filter(d => d.status === HealthStatus.DOWN).length;
  const parts: string[] = [];
  if (degraded > 0) parts.push(`${degraded} degraded`);
  if (down > 0) parts.push(`${down} down`);
  if (parts.length === 0 && healthy > 0) parts.push('all healthy');
  if (deps.length === 0) parts.push('no dependencies');
  return parts.join(', ');
}

/**
 * Emits a structured health check log entry per MOD-017 §5.1 unified telemetry model.
 */
function emitHealthLog(logModule: string, health: HealthStatusObject, depRef: DependencyHealthRef): void {
  try {
    const message = `[HEALTH] ${depRef.moduleId}/${depRef.serviceId}: ${depRef.status}${depRef.details ? ` (${depRef.details})` : ''}`;
    const logEntry: LogEntry = createLogEntry({
      auditEventId: crypto.randomUUID(),
      eventType: 'mod-017.healthcheck',
      moduleSource: logModule as LogEntry['moduleSource'],
      timestamp: health.lastChecked,
      correlationId: '',
      logLevel: depRef.status === HealthStatus.DOWN ? LogLevel.CRITICAL :
                depRef.status === HealthStatus.DEGRADED ? LogLevel.WARNING : LogLevel.INFO,
      message,
      environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEV',
      metadata: {
        serviceId: depRef.serviceId,
        healthStatus: health.status,
        dependenciesCount: health.dependencyStatus.length,
      },
    });
    console.log(formatLogEntry(logEntry));
  } catch {
    // Health logging must never break application flow
  }
}

/**
 * Creates a HealthChecker instance with sensible defaults.
 */
export function createHealthChecker(options?: { logModule?: string }): HealthChecker {
  return new HealthChecker(options);
}
