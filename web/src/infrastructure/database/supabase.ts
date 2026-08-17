// NexCargo Database Layer — Supabase configuration per PROMPT 1 + PROMPT 2
// Domain schemas: marketplace_schema, logistics_schema, financial_schema, ai_schema,
// compliance_schema, communication_schema, analytics_schema, platform_infrastructure_schema, localization_schema

import { createClient } from '@supabase/supabase-js';
import { DATABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

/**
 * Server-side Supabase client for API routes and server actions.
 * Uses service role key where needed (server-only).
 */
export function createAdminClient() {
  return createClient(DATABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
    db: {
      schema: 'public',
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Standard Supabase client for server-side operations.
 * Respects RLS policies.
 */
export function createServerSupabaseClient() {
  return createClient(DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY);
}
