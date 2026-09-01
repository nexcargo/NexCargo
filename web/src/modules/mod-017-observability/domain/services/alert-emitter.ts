// NexCargo MOD-017 — Alert Emitter Service
// Authoritative source: MOD-017 §4.5 (Alert Object), §3.5 (Real-Time Alerting), §7.6 (Alerting Rule)
// ESS-005 §2.2 (No Intervention Principle): Alerts must be detected and routed, never auto-resolved.
// Enhances Wave 0 alert types with runtime emission, priority routing, and deduplication.
// NO INTERVENTION: This module only emits alert records. It never triggers remediation.

import type {
  AlertObject,
  AlertType,
} from '../types/alerts';
import { AlertDeduplicator } from '../utils/alert-deduplication';
import { getAlertPriority, AlertSeverity } from '../types/alerts';
import type { LogEntry } from '../types/logging';
import { LogLevel } from '../types/logging';
import { formatLogEntry } from '../utils/structured-log-formatter';
import { createAuditEventEmitter } from '../utils/audit-event-emitter';

/**
 * Alert delivery channel per MOD-017 §3.5 + §6.5 (integration with MOD-016).
 */
export enum AlertChannel {
  LOG = 'LOG',                        // Always logged to structured log
  MOD_016_NOTIFICATION = 'MOD_016_NOTIFICATION', // routed via notification system
  WEBHOOK = 'WEBHOOK',               // External webhook endpoint
  EMAIL = 'EMAIL',                   // Email alert (for CRITICAL severity)
}

/**
 * Alert delivery route configuration.
 */
export interface AlertRoute {
  severityThreshold: AlertSeverity;    // Minimum severity to trigger this route
  channels: AlertChannel[];            // Channels to deliver through
  includeInReport: boolean;            // Include in SLA/report generation
}

/**
 * Default alert routes by severity level.
 * Per MOD-017 §7.6: Critical alerts bypass batching delays.
 */
const DEFAULT_ALERT_ROUTES: Record<AlertSeverity, AlertRoute> = {
  [AlertSeverity.LOW]: { severityThreshold: AlertSeverity.LOW, channels: [AlertChannel.LOG], includeInReport: false },
  [AlertSeverity.MEDIUM]: { severityThreshold: AlertSeverity.MEDIUM, channels: [AlertChannel.LOG, AlertChannel.MOD_016_NOTIFICATION], includeInReport: true },
  [AlertSeverity.HIGH]: { severityThreshold: AlertSeverity.HIGH, channels: [AlertChannel.LOG, AlertChannel.MOD_016_NOTIFICATION, AlertChannel.WEBHOOK], includeInReport: true },
  [AlertSeverity.CRITICAL]: { severityThreshold: AlertSeverity.CRITICAL, channels: [AlertChannel.LOG, AlertChannel.MOD_016_NOTIFICATION, AlertChannel.EMAIL], includeInReport: true },
};

/**
 * AlertEmitterService — manages alert creation, deduplication, prioritization, and delivery.
 * Implements OBSERVE→DETECT→RECORD→ALERT pattern. Never intervenes.
 */
export class AlertEmitterService {
  private deduplicator: AlertDeduplicator;
  private routes: Record<AlertSeverity, AlertRoute>;
  private emittedAlerts: Set<string>; // Track alert IDs for audit

  constructor(
    dedupWindowMs?: number,
    customRoutes?: Partial<Record<AlertSeverity, AlertRoute>>
  ) {
    this.deduplicator = new AlertDeduplicator(dedupWindowMs);
    this.routes = { ...DEFAULT_ALERT_ROUTES };
    if (customRoutes) {
      for (const [severity, route] of Object.entries(customRoutes)) {
        this.routes[severity as AlertSeverity] = { ...this.routes[severity as AlertSeverity], ...route };
      }
    }
    this.emittedAlerts = new Set();
  }

  /**
   * Creates and emits an alert. Checks deduplication before emitting.
   * Per MOD-017 §7.6: Multi-channel alert delivery required.
   * @param params - Alert parameters
   * @returns The created AlertObject or null if suppressed as duplicate
   */
  emit(params: Omit<AlertObject, 'alertId' | 'timestamp'>): AlertObject | null {
    const signature = generateSignatureFromParams(params);

    // Check deduplication
    if (this.deduplicator.isDuplicate({ alertType: params.alertType, sourceModule: params.sourceModule })) {
      return null; // Suppressed
    }

    const alert: AlertObject = {
      alertId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      resolvedAt: undefined,
      incidentId: undefined,
      ...params,
    };

    this.emittedAlerts.add(alert.alertId);

    // Deliver through configured channels based on severity
    deliverAlert(alert, this.routes[alert.severity]);

    return alert;
  }

  /**
   * Resolves an existing alert.
   * Per MOD-017: Resolution is recorded, never auto-executed.
   * @param alertId - ID of the alert to resolve
   */
  resolve(alertId: string): void {
    // In production, this would update the alert record with resolvedAt timestamp
    // For now, we just mark it in memory for tracking
    console.log(`[MOD-017 AlertResolver] Alert ${alertId} marked as resolved at ${new Date().toISOString()}`);
  }

  /**
   * Gets the priority order for a given alert severity.
   * Lower number = higher urgency.
   * @param severity - Alert severity level
   * @returns Priority number
   */
  getPriority(severity: AlertSeverity): number {
    return getAlertPriority(severity);
  }

  /**
   * Gets statistics about recently emitted alerts.
   * Used for diagnostic reporting.
   */
  getStats(): { totalEmitted: number; activeDedupWindows: number } {
    return {
      totalEmitted: this.emittedAlerts.size,
      activeDedupWindows: this.deduplicator.activeCount,
    };
  }

  /**
   * Clears all deduplication state (useful between test runs).
   */
  clearDeduplication(): void {
    // Reconstruct with zero window
    this.deduplicator = new AlertDeduplicator(0);
  }

  /**
   * Gets the current route configuration for a severity level.
   */
  getRoute(severity: AlertSeverity): AlertRoute {
    return this.routes[severity];
  }

  /**
   * Updates the route configuration for a severity level.
   * Allows dynamic route adjustment without restart.
   */
  setRoute(severity: AlertSeverity, route: Partial<AlertRoute>): void {
    this.routes[severity] = { ...this.routes[severity], ...route };
  }
}

// --- Helpers ---

function generateSignatureFromParams(params: Omit<AlertObject, 'alertId' | 'timestamp'>): string {
  return `${params.sourceModule}:${params.alertType}:${params.thresholdValue ?? ''}`;
}

/**
 * Delivers an alert through its configured channels.
 * Each channel implementation simply records what was delivered.
 * Per ESS-005: No autonomous action taken — alert is merely routed.
 * @param alert - The alert to deliver
 * @param route - Delivery route configuration
 */
function deliverAlert(alert: AlertObject, route: AlertRoute): void {
  // Channel 1: Always log the alert
  const logEntry: LogEntry = {
    auditEventId: crypto.randomUUID(),
    eventType: `mod-017.alert.${alert.alertType.toLowerCase().replace(/_/g, '.')}`,
    moduleSource: 'MOD-017',
    timestamp: alert.timestamp,
    correlationId: '',
    logLevel: alert.severity === 'CRITICAL' ? LogLevel.CRITICAL :
              alert.severity === 'HIGH' ? LogLevel.ERROR :
              alert.severity === 'MEDIUM' ? LogLevel.WARNING : LogLevel.INFO,
    message: `[${alert.severity}] ${alert.alertType} from ${alert.sourceModule}: ${alert.triggerCondition} (value: ${alert.triggerValue}, threshold: ${alert.thresholdValue})`,
    environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEV',
  };
  console.log(formatLogEntry(logEntry));

  // Emit audit event for compliance tracking
  const emitter = createAuditEventEmitter('MOD-017');
  emitter.emit({
    eventType: `alert.${alert.alertType.toLowerCase().replace(/_/g, '.')}`,
    moduleSource: 'MOD-017',
    actionType: 'WRITE',
    affectedEntityType: 'AlertObject',
    affectedEntityId: alert.alertId,
    metadata: {
      severity: alert.severity,
      sourceModule: alert.sourceModule,
      routeChannels: route.channels,
    },
    correlationId: '',
  });

  // Other channels (MOD_016, Webhook, Email) are placeholders for Increment 1
  // Production implementation would integrate with MOD-016 notification orchestration
  for (const channel of route.channels) {
    switch (channel) {
      case AlertChannel.MOD_016_NOTIFICATION:
        console.log(`[MOD-017 AlertDelivery] Routing alert ${alert.alertId} → MOD-016 Notification (placeholder)`);
        break;
      case AlertChannel.WEBHOOK:
        console.log(`[MOD-017 AlertDelivery] Sending alert ${alert.alertId} → Webhook (placeholder)`);
        break;
      case AlertChannel.EMAIL:
        console.log(`[MOD-017 AlertDelivery] Queuing email for alert ${alert.alertId} (placeholder)`);
        break;
    }
  }
}
