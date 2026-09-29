// NexCargo MOD-017 → MOD-016 Alert-to-Notification Bridge (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002 (2026-09-09)
// Purpose: Routes HIGH/CRITICAL alerts to MOD-016 notification persistence via Tier-1 trigger model
//
// Authority: MOD-017 §3.5 (Real-Time Alerting) + §6.5 (Alerting Structure)
//            MOD-016 §8 (Event Model — Tier-1 transitional trigger)
//            C5 FINAL BOUNDARY §F (MOD-016/MOD-017 Ownership), §E (Provider Boundary)
//
// CRITICAL CONSTRAINTS:
// - Only HIGH and CRITICAL severity alerts trigger notifications
// - Uses MOD-016 POST /api/notifications API (Tier-1 transitional model)
// - Preserves sourceModule=MOD-017, eventType from alert, correlationId if available
// - Does NOT execute business logic or modify system state
// - Does NOT make external network calls beyond what's required for Tier-1 API call

import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Gets a lazily-initialized Supabase client instance.
 */
function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return null;
    }
    
    const { createClient } = require('@supabase/supabase-js');
    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseInstance;
}

import type { AlertObject } from '../../domain/types/alerts';
import { AlertSeverity } from '../../domain/types/alerts';

/**
 * Severity levels that require notification dispatch per MOD-017 §7.6.
 */
const SEVERITY_NOTIFICATION_THRESHOLD = [AlertSeverity.HIGH, AlertSeverity.CRITICAL];

/**
 * Determines if an alert requires notification dispatch based on severity.
 * Per MOD-017 §7.6: Critical alerts bypass batching delays; HIGH also requires delivery.
 * 
 * @param severity - Alert severity level
 * @returns true if notification should be sent
 */
export function shouldDispatchNotification(severity: string): boolean {
  return SEVERITY_NOTIFICATION_THRESHOLD.includes(severity as AlertSeverity);
}

/**
 * Converts alert severity to notification priority level.
 * Maps MOD-017 AlertSeverity → MOD-016 PriorityLevel.
 * 
 * @param severity - MOD-017 alert severity
 * @returns MOD-016 priority level string
 */
function mapToNotificationPriority(severity: string): string {
  // Accept string input for flexibility with enum values
  return severity === 'CRITICAL' ? 'CRITICAL' :
         severity === 'HIGH' ? 'HIGH' :
         severity === 'MEDIUM' ? 'MEDIUM' :
         'LOW';
}

/**
 * Dispatches alert to MOD-016 notification persistence via Tier-1 API trigger.
 * Per C5 FINAL BOUNDARY §F:
 * - MOD-017 does NOT directly invoke MOD-016 internals
 * - Instead uses POST /api/notifications endpoint (Tier-1 transitional model)
 * - All event-equivalent fields included (eventType, correlationId, sourceModule)
 * 
 * IMPORTANT: This is explicitly TEMPORARY until canonical event emission is authorized.
 * When events are enabled, this layer will be refactored to consume events instead.
 * 
 * @param alert - AlertObject requiring notification dispatch
 * @returns true if notification was successfully queued for dispatch
 */
export async function dispatchAlertToNotifications(alert: AlertObject): Promise<boolean> {
  // Verify severity threshold before dispatch
  if (!shouldDispatchNotification(alert.severity)) {
    return false;
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      console.log('[MOD-017→MOD-016 bridge] Supabase not configured — skipping dispatch');
      return false;
    }
    
    const requestBody = {
      recipientId: 'SYSTEM_OBSERVABILITY', // Placeholder — real recipient routing deferred to C5-III+
      sourceModule: 'MOD-017',
      eventType: `alert_${alert.alertType.toLowerCase().replace(/_/g, '.')}`,
      title: `[${alert.severity}] ${alert.alertType} Alert`,
      body: `Alert: ${alert.triggerCondition}\nTrigger value: ${alert.triggerValue}\nThreshold: ${alert.thresholdValue}\nSource module: ${alert.sourceModule}`,
      priorityLevel: mapToNotificationPriority(alert.severity),
      channelType: 'IN_APP', // Default channel — multi-channel delivery deferred to provider integration
      correlationId: null, // Will be set when AlertObject includes correlation tracking
    };

    // Use RPC to call the notifications API route
    await supabase.rpc('call_notification_api', { payload: JSON.stringify(requestBody) });

    console.log(`[MOD-017→MOD-016 bridge] Alert ${alert.alertId} dispatched to notifications (severity: ${alert.severity})`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[MOD-017→MOD-016 bridge] Unexpected error during dispatch:', message);
    return false;
  }
}
