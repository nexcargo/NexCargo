// NexCargo MOD-017 Domain Utils — Predictive Failure Indicator Framework
// Authoritative source: MOD-017 §4.9 (PredictiveFailureIndicator Object) + §3.9 (Predictive Failure Detection)
// Provides infrastructure for AI-assisted predictive failure detection using Standard S-02 (CorrelationContext).
// Per MOD-017 §7.7 (Predictive Failure Rule): AI predictions are advisory only; no autonomous execution.

import type { Wave0CorrelationContext } from '@/shared/standards/correlation-id-propagation';

/**
 * Prediction type enum per MOD-017 §4.9
 */
export enum PredictionType {
  SERVICE_DEGRADATION = 'SERVICE_DEGRADATION',
  RESOURCE_EXHAUSTION = 'RESOURCE_EXHAUSTION',
  LATENCY_SPIKE = 'LATENCY_SPIKE',
  INTEGRATION_FAILURE = 'INTEGRATION_FAILURE',
}

/**
 * Predictive Failure Indicator Object — represents AI-predicted system failure.
 * Per MOD-017 §4.9. Advisory-only; never triggers autonomous remediation.
 */
export interface PredictiveFailureIndicator {
  // Core attributes from MOD-017 §4.9
  indicatorId: string;            // UUID v4
  predictionType: PredictionType;
  affectedService: string;        // Service or module identifier
  probabilityScore: number;       // 0–100 probability of predicted event
  confidenceScore: number;        // 0–100 confidence in prediction accuracy
  timeHorizon: string;            // ISO 8601 duration (e.g., "PT1H" = 1 hour)
  recommendation: string;         // Advisory recommendation text
  generatedAt: string;            // ISO 8601 timestamp
  validUntil: string;             // ISO 8601 when this prediction expires
  correlationId?: string;         // Optional correlation ID from request context
}

/**
 * Validates a predictive failure indicator against MOD-017 §4.9 constraints.
 * Per MOD-017 §7.7: Predictive indicators must be logged and reviewable.
 * @param indicator - Indicator to validate
 * @returns true if the indicator passes all constraint checks
 */
export function isPredictiveIndicatorValid(indicator: PredictiveFailureIndicator): boolean {
  // Probability score must be 0-100
  if (indicator.probabilityScore < 0 || indicator.probabilityScore > 100) {
    return false;
  }
  // Confidence score must be 0-100
  if (indicator.confidenceScore < 0 || indicator.confidenceScore > 100) {
    return false;
  }
  // Time horizon must be non-empty
  if (!indicator.timeHorizon || indicator.timeHorizon.trim().length === 0) {
    return false;
  }
  // Recommendation must be advisory text (non-empty)
  if (!indicator.recommendation || indicator.recommendation.trim().length === 0) {
    return false;
  }
  // Must have both timestamps
  if (!indicator.generatedAt || !indicator.validUntil) {
    return false;
  }
  return true;
}

/**
 * Creates a new predictive failure indicator with validation.
 * @param params - Partial indicator parameters
 * @returns Validated PredictiveFailureIndicator or null if invalid
 */
export function createPredictiveIndicator(params: Partial<PredictiveFailureIndicator>): PredictiveFailureIndicator | null {
  if (!params.predictionType || !params.affectedService) {
    return null;
  }

  const candidate: PredictiveFailureIndicator = {
    indicatorId: crypto.randomUUID(),
    predictionType: params.predictionType,
    affectedService: params.affectedService,
    probabilityScore: params.probabilityScore ?? 0,
    confidenceScore: params.confidenceScore ?? 0,
    timeHorizon: params.timeHorizon ?? 'PT1H',
    recommendation: params.recommendation ?? '',
    generatedAt: params.generatedAt || new Date().toISOString(),
    validUntil: params.validUntil || new Date(Date.now() + 3600000).toISOString(), // Default 1 hour
    correlationId: params.correlationId,
  };

  return isPredictiveIndicatorValid(candidate) ? candidate : null;
}

/**
 * Predictive Failure Indicator Registry — manages lifecycle of predictive indicators.
 * Per MOD-017 §7.7: All predictions must be logged and reviewable.
 */
export class PredictiveFailureRegistry {
  private readonly indicators: Map<string, PredictiveFailureIndicator>;

  constructor() {
    this.indicators = new Map();
  }

  /**
   * Registers a predictive failure indicator.
   * @param indicator - Indicator to register
   * @returns true if registration succeeded
   */
  register(indicator: PredictiveFailureIndicator): boolean {
    if (!isPredictiveIndicatorValid(indicator)) {
      return false;
    }
    this.indicators.set(indicator.indicatorId, indicator);
    return true;
  }

  /**
   * Retrieves an indicator by its ID.
   * @param indicatorId - Indicator identifier
   * @returns Indicator or undefined
   */
  get(indicatorId: string): PredictiveFailureIndicator | undefined {
    return this.indicators.get(indicatorId);
  }

  /**
   * Lists all active indicators filtered by prediction type.
   * @param predictionType - Optional prediction type filter
   * @returns Array of matching indicators
   */
  list(predictionType?: PredictionType): PredictiveFailureIndicator[] {
    const results = [...this.indicators.values()];
    if (predictionType) {
      return results.filter(i => i.predictionType === predictionType);
    }
    return results;
  }

  /**
   * Gets indicators that will expire soon (within the given milliseconds).
   * @param withinMs - Milliseconds threshold
   * @returns Array of expiring indicators
   */
  getExpiringSoon(withinMs: number): PredictiveFailureIndicator[] {
    const now = new Date().getTime();
    return this.list().filter(i => {
      const expiryTime = new Date(i.validUntil).getTime();
      return expiryTime >= now && expiryTime <= now + withinMs;
    });
  }

  /**
   * Removes expired indicators from the registry.
   * @returns Number of indicators removed
   */
  cleanupExpired(): number {
    const now = new Date().getTime();
    let removed = 0;
    for (const [id, indicator] of this.indicators.entries()) {
      const expiryTime = new Date(indicator.validUntil).getTime();
      if (expiryTime < now) {
        this.indicators.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /** Total number of registered indicators */
  get size(): number {
    return this.indicators.size;
  }
}
