// NexCargo MOD-017 — Log Entry Persistence Service (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002 (2026-09-09)
// Purpose: Appends structured log records to monitoring_schema.log_entries (APPEND-ONLY)
//
// Authority: MOD-017 §4.1 (Log Entry Object), §7.2 (Full Traceability Rule)
//            ESS-006 Golden Rule (RLS mandatory on all tables)
//            ESS-009 (data governance, immutable logs principle)
//            C5 FINAL BOUNDARY §H (monitoring_schema.log_entries)
// NOTE: Log entries are IMMUTABLE once written — never UPDATE or DELETE (per migration column grants).

import { createClient } from '@supabase/supabase-js';
import type { LogLevel } from '../../domain/types/logging';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Role Key must be configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Append-only write of a structured log entry to persistent storage.
 * Per MOD-017 §4.1 + §7.2: All modules must emit structured logs; no unlogged execution permitted.
 * 
 * CRITICAL: This function NEVER modifies or deletes existing log records.
 * Database column grants REVOKE UPDATE on log_entries enforce immutability.
 * 
 * @param params - Log entry parameters matching monitoring_schema.log_entries schema
 * @returns true if append succeeded
 */
export async function appendLogEntry(params: {
  timestamp: string;
  moduleSource: string;
  logLevel: LogLevel;
  message: string;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
  userId?: string | null;
  serviceId?: string | null;
  environment: string;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .schema('monitoring_schema')
      .from('log_entries')
      .insert({
        timestamp: params.timestamp,
        module_source: params.moduleSource,
        log_level: params.logLevel,
        message: params.message,
        correlation_id: params.correlationId || null,
        metadata: params.metadata || '{}',
        user_id: params.userId || null,
        service_id: params.serviceId || null,
        environment: params.environment || 'DEV',
      });

    if (error) {
      console.error('[MOD-017 appendLogEntry] Database error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[MOD-017 appendLogEntry] Unexpected error:', err);
    return false;
  }
}
