// NexCargo MOD-017 — Incident Persistence Service (C5-II)
// C5 Increment 2 — Authorized per HAO-C5-002 (2026-09-09)
// Purpose: Writes IncidentObject records to monitoring_schema.incidents with RLS enforcement
//
// Authority: MOD-017 §4.6 (Incident Object), §3.6 (Incident Management), §5.5 (Incident Lifecycle Model)

import { createClient } from '@supabase/supabase-js';
import type { IncidentObject } from '../../domain/types/incidents';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Role Key must be configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Writes an incident record to persistent storage.
 * Per MOD-017 §4.6: Every system-level incident must be persisted for lifecycle tracking.
 * 
 * @param incident - Complete IncidentObject
 * @returns true if persistence succeeded
 */
export async function persistIncident(incident: Omit<IncidentObject, 'resolvedAt' | 'rootCause' | 'resolutionSummary' | 'postMortem'>): Promise<boolean> {
  try {
    const affectedServicesJson = JSON.stringify(incident.affectedServices);
    
    const { error } = await supabase
      .schema('monitoring_schema')
      .from('incidents')
      .insert({
        incident_type: incident.incidentType,
        severity: incident.severity,
        status: incident.status,
        detected_at: incident.detectedAt,
        resolution_summary: null, // Optional, set during investigation
        post_mortem: null,       // Optional, set after resolution
        correlation_id: null,
        affected_services: affectedServicesJson,
      });

    if (error) {
      console.error('[MOD-017 persistIncident] Database error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[MOD-017 persistIncident] Unexpected error:', err);
    return false;
  }
}

/**
 * Updates incident fields during lifecycle progression.
 * Per MOD-017 §5.5: Incidents transition through DETECTED → INVESTIGATING → MITIGATING → RESOLVED → CLOSED
 * 
 * @param incidentId - UUID of incident
 * @param updates - Fields to update
 * @returns true if update succeeded
 */
export async function updateIncidentStatus(incidentId: string, updates: Partial<Record<'status' | 'resolved_at' | 'root_cause' | 'resolution_summary', unknown>>): Promise<boolean> {
  try {
    const { error } = await supabase
      .schema('monitoring_schema')
      .from('incidents')
      .update(updates)
      .eq('id', incidentId);

    if (error) {
      console.error('[MOD-017 updateIncidentStatus] Database error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[MOD-017 updateIncidentStatus] Unexpected error:', err);
    return false;
  }
}
