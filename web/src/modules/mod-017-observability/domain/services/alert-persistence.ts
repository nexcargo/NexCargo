// NexCargo MOD-017 — Alert Persistence Service (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002 (2026-09-09)
// Purpose: Writes AlertObject records to monitoring_schema.alerts with RLS enforcement
//
// Authority: MOD-017 §4.5 (Alert Object), §3.5 (Real-Time Alerting), §7.6 (Alerting Rule)
//            C5 FINAL BOUNDARY §H (Monitoring Schema Tables)
//            ESS-006 Golden Rule (RLS mandatory on all tables)

import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Gets a lazily-initialized Supabase client instance.
 * Only initializes when first called, allowing safe module imports in test environments.
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

/**
 * Writes an alert record to persistent storage.
 * Per MOD-017 §4.5: Every alert must be persisted with full attributes.
 * 
 * @param alert - Complete AlertObject with all required fields
 * @returns true if persistence succeeded, false otherwise (including when env vars not configured)
 */
export async function persistAlert(alert: Omit<import('../types/alerts').AlertObject, 'resolvedAt'>): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      console.log('[MOD-017 persistAlert] Supabase not configured — skipping persistence');
      return false;
    }
    
    await supabase.schema('monitoring_schema').from('alerts').insert({
      alert_type: alert.alertType as string,
      severity: alert.severity as string,
      source_module: alert.sourceModule,
      trigger_condition: alert.triggerCondition,
      trigger_value: alert.triggerValue,
      threshold_value: alert.thresholdValue,
      correlation_id: null,
    });

    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[MOD-017 persistAlert] Database error:', message);
    return false;
  }
}

/**
 * Resolves an alert by marking resolved_at timestamp.
 * Per MOD-017 §4.5: Alerts must track resolution state.
 * 
 * @param alertId - UUID of alert to resolve
 * @param resolvedAt - ISO 8601 timestamp (defaults to now)
 * @returns true if update succeeded
 */
export async function resolveAlert(alertId: string, resolvedAt?: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return false;
    }
    
    await supabase
      .schema('monitoring_schema')
      .from('alerts')
      .update({ resolved_at: resolvedAt || new Date().toISOString() })
      .eq('id', alertId);

    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[MOD-017 resolveAlert] Database error:', message);
    return false;
  }
}
