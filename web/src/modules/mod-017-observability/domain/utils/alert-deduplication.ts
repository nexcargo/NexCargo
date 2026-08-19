// NexCargo MOD-017 Domain Utils — Alert Deduplication
// Authoritative source: MOD-017 §4.5 (Alert Object) + §7.6 (Alerting Rule)
// Prevents duplicate alerts by tracking recent alert signatures.
// Per MOD-017 §3.5: False positive suppression is required.

import type { AlertObject, AlertType, AlertSeverity } from '@/modules/mod-017-observability/domain/types/alerts';

/**
 * Deduplication window in milliseconds (default: 5 minutes).
 * Alerts with the same type and source within this window are suppressed.
 */
export const DEFAULT_DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Generates a deduplication signature for an alert.
 * Alerts with identical signatures within the dedup window are considered duplicates.
 * @param alert - Alert to generate signature for
 * @returns Signature string combining alert type and source module
 */
export function generateAlertSignature(alert: Pick<AlertObject, 'alertType' | 'sourceModule'>): string {
  return `${alert.sourceModule}:${alert.alertType}`;
}

/**
 * In-memory alert deduplication tracker.
 * Tracks which alert signatures have been seen recently.
 */
export class AlertDeduplicator {
  private readonly seenSignatures: Map<string, number>; // signature -> timestamp
  private readonly dedupWindowMs: number;

  /**
   * Creates a new AlertDeduplicator.
   * @param dedupWindowMs - Window in milliseconds for deduplication (default: 5 minutes)
   */
  constructor(dedupWindowMs: number = DEFAULT_DEDUP_WINDOW_MS) {
    this.seenSignatures = new Map();
    this.dedupWindowMs = dedupWindowMs;
  }

  /**
   * Checks whether an alert should be suppressed based on recent history.
   * @param alert - Alert to check
   * @returns true if the alert is a duplicate and should be suppressed
   */
  isDuplicate(alert: Pick<AlertObject, 'alertType' | 'sourceModule'>): boolean {
    const signature = generateAlertSignature(alert);
    const now = Date.now();

    // Clean expired entries
    this.cleanupExpired(now);

    const lastSeen = this.seenSignatures.get(signature);
    if (lastSeen !== undefined && now - lastSeen < this.dedupWindowMs) {
      return true;
    }

    // Record this alert
    this.seenSignatures.set(signature, now);
    return false;
  }

  /**
   * Records an alert as seen (for manual tracking).
   * @param alert - Alert to record
   */
  record(alert: Pick<AlertObject, 'alertType' | 'sourceModule'>): void {
    const signature = generateAlertSignature(alert);
    this.seenSignatures.set(signature, Date.now());
  }

  /**
   * Removes expired entries from the deduplication map.
   * @param now - Current timestamp
   */
  private cleanupExpired(now: number): void {
    for (const [signature, timestamp] of this.seenSignatures.entries()) {
      if (now - timestamp >= this.dedupWindowMs) {
        this.seenSignatures.delete(signature);
      }
    }
  }

  /**
   * Returns the count of currently tracked signatures.
   */
  get activeCount(): number {
    return this.seenSignatures.size;
  }
}
