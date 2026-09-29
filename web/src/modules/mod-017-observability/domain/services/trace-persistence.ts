// NexCargo MOD-017 — Trace Persistence Service (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002 (2026-09-09)
// Purpose: Appends distributed trace spans to monitoring_schema.traces for cross-module visibility
//
// Authority: MOD-017 §4.3 (Trace Object), §3.3 (Distributed Tracing), §5.2–§5.3 (Cross-Module Visibility + Event Correlation)
//            C5 FINAL BOUNDARY §H (monitoring_schema.traces)
// NOTE: Trace records are IMMUTABLE once written — never UPDATE core fields (per migration column grants).

import { createClient } from '@supabase/supabase-js';
import type { TraceStatus, ModuleChainEntry } from '../../domain/types/tracing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Role Key must be configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Appends a trace span to persistent storage.
 * Per MOD-017 §4.3: Every request must have a trace ID with cross-module correlation.
 * 
 * CRITICAL: This function NEVER modifies existing trace records.
 * Database column grants REVOKE UPDATE on (trace_id, span_id, timestamp_start) enforce immutability.
 * 
 * @param params - Trace span parameters matching monitoring_schema.traces schema
 * @returns true if append succeeded
 */
export async function appendTraceSpan(params: {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  moduleChain: ModuleChainEntry[];
  status: TraceStatus;
  latencyMs?: number | null;
  timestampStart: string;
  timestampEnd?: string | null;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .schema('monitoring_schema')
      .from('traces')
      .insert({
        trace_id: params.traceId,
        span_id: params.spanId,
        parent_span_id: params.parentSpanId || null,
        module_chain: JSON.stringify(params.moduleChain),
        status: params.status,
        latency_ms: params.latencyMs || null,
        timestamp_start: params.timestampStart,
        timestamp_end: params.timestampEnd || null,
      });

    if (error) {
      console.error('[MOD-017 appendTraceSpan] Database error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[MOD-017 appendTraceSpan] Unexpected error:', err);
    return false;
  }
}
