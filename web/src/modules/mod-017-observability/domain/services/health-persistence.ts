// NexCargo MOD-017 — Health Check Persistence Service (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002 (2026-09-09)
// Purpose: Persists health check snapshots to monitoring_schema.health_checks for continuous monitoring
//
// Authority: MOD-017 §4.4 (Health Status Object), §3.4 (Health Monitoring)
//            C5 FINAL BOUNDARY §H (monitoring_schema.health_checks)

import { createClient } from '@supabase/supabase-js';
import type { HealthStatus } from '../../domain/types/health-check';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Role Key must be configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Persists a health check snapshot to persistent storage.
 * Per MOD-017 §4.4: All services must expose health checks updated continuously.
 * 
 * @param params - Health check parameters matching monitoring_schema.health_checks schema
 * @returns true if persistence succeeded
 */
export async function persistHealthCheck(params: {
  serviceId: string;
  moduleId?: string | null;
  status: HealthStatus;
  lastChecked: string;
  dependencyStatuses?: unknown[] | null;
  details?: string | null;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .schema('monitoring_schema')
      .from('health_checks')
      .insert({
        service_id: params.serviceId,
        module_id: params.moduleId || null,
        status: params.status,
        last_checked: params.lastChecked,
        dependency_statuses: params.dependencyStatuses ? JSON.stringify(params.dependencyStatuses) : '[]',
        details: params.details || null,
      });

    if (error) {
      console.error('[MOD-017 persistHealthCheck] Database error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[MOD-017 persistHealthCheck] Unexpected error:', err);
    return false;
  }
}
