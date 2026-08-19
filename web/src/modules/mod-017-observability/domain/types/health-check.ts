// NexCargo MOD-017 Domain Types — Health Check Endpoint Pattern
// Authoritative source: MOD-017 §4.4 (Health Status Object) + §3.4 (Health Monitoring)
// Implements exit criteria X-10: Standardized health check structure with dependency availability checks

/**
 * Service health status enum per MOD-017 §4.4
 */
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  DOWN = 'DOWN',
}

/**
 * Dependency health reference.
 */
export interface DependencyHealthRef {
  serviceId: string;
  moduleId: string;
  status: HealthStatus;
  lastChecked: string;        // ISO 8601
  details?: string;           // Optional detail message
}

/**
 * Health Status Object — represents system or service health.
 * Per MOD-017 §4.4.
 */
export interface HealthStatusObject {
  // Core attributes from MOD-017 §4.4
  serviceId: string;
  moduleId: string;
  status: HealthStatus;
  lastChecked: string;        // ISO 8601
  dependencyStatus: DependencyHealthRef[];
  region?: string;            // Optional geographic region
  details?: string;           // Optional diagnostic details
}

/**
 * Creates a standardized health check response.
 * @param params - Health status parameters
 * @returns HealthStatusObject ready for API response
 */
export function createHealthCheck(params: Partial<HealthStatusObject>): HealthStatusObject {
  return {
    lastChecked: new Date().toISOString(),
    status: HealthStatus.HEALTHY, // Default to healthy
    dependencyStatus: [],
    ...params,
  } as HealthStatusObject;
}
