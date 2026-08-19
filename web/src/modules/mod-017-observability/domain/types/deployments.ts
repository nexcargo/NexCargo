// NexCargo MOD-017 Domain Types — Deployment Event Recording
// Authoritative source: MOD-017 §4.7 (Deployment Event Object) + §3.7 (DevOps Observability Layer)
// Implements exit criteria X-13: Deployment event objects with environment tracking, rollback flags

/**
 * Deployment environment enum per MOD-017 §4.7
 */
export enum DeploymentEnvironment {
  DEV = 'DEV',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
}

/**
 * Deployment status enum per MOD-017 §4.7
 */
export enum DeploymentStatus {
  INITIATED = 'INITIATED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

/**
 * Deployment strategy enum per MOD-017 §3.7
 */
export enum DeploymentStrategy {
  BLUE_GREEN = 'BLUE_GREEN',
  CANARY = 'CANARY',
  ROLLING = 'ROLLING',
}

/**
 * Deployment Event Object — represents system deployment state.
 * Per MOD-017 §4.7.
 */
export interface DeploymentEventObject {
  // Core attributes from MOD-017 §4.7
  deploymentId: string;       // UUID v4
  version: string;            // Semantic versioning MAJOR.MINOR.PATCH
  environment: DeploymentEnvironment;
  status: DeploymentStatus;
  startedAt: string;          // ISO 8601
  completedAt?: string;       // ISO 8601 — optional
  deploymentStrategy: DeploymentStrategy;
  triggeredBy: string;        // User or system identifier
  rollbackFlag: boolean;      // Whether this deployment includes a rollback
  changelog?: string;         // Optional changelog description
}
