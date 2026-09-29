// NexCargo MOD-017 — Metric Persistence Service (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002 (2026-09-09)
// Purpose: Appends metric data points to monitoring_schema.metrics with immutability controls
//
// Authority: MOD-017 §4.2 (Metric Object), §3.2 (Metrics System), §5.1 (Unified Telemetry Model)
//            C5 FINAL BOUNDARY §H (monitoring_schema.metrics)
// NOTE: Metrics are IMMUTABLE once written — never UPDATE recorded values (per migration column grants).

import { createClient } from '@supabase/supabase-js';
import type { AggregationType } from '../../domain/types/metrics';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Role Key must be configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Appends a single metric data point to persistent storage.
 * Per MOD-017 §4.2: Metrics must be collected in real time and persist for historical analysis.
 * 
 * CRITICAL: This function NEVER modifies existing metric records.
 * Database column grants REVOKE UPDATE on (metric_name, value, timestamp) enforce immutability.
 * 
 * @param params - Metric parameters matching monitoring_schema.metrics schema
 * @returns true if append succeeded
 */
export async function appendMetric(params: {
  metricName: string;
  value: number;
  unit?: string | null;
  aggregationType?: AggregationType | null;
  sourceModule?: string | null;
  tags?: Record<string, string> | null;
  timestamp: string;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .schema('monitoring_schema')
      .from('metrics')
      .insert({
        metric_name: params.metricName,
        value: params.value,
        unit: params.unit || null,
        aggregation_type: params.aggregationType || null,
        source_module: params.sourceModule || null,
        tags: params.tags || '{}',
        timestamp: params.timestamp,
      });

    if (error) {
      console.error('[MOD-017 appendMetric] Database error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[MOD-017 appendMetric] Unexpected error:', err);
    return false;
  }
}
