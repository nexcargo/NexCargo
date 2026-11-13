// NexCargo Database Layer — Supabase configuration per PROMPT 1 + PROMPT 2
// Domain schemas: marketplace_schema, logistics_schema, financial_schema, ai_schema,
// compliance_schema, communication_schema, analytics_schema, platform_infrastructure_schema, localization_schema

import { createClient } from '@supabase/supabase-js';
import { DATABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from '@/lib/env';

/**
 * Server-side Supabase client for API routes and server actions.
 * Uses service role key where needed (server-only).
 *
 * Fail-closed: without the service-role key this throws instead of falling back to the
 * public anon key, which would silently run "admin" writes under RLS with no privileges.
 */
export function createAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — refusing to build an admin client from the public anon key.',
    );
  }

  return createClient(DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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
