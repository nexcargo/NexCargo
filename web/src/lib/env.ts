// NexCargo Environment Variables — Type-safe env access per ESS-007
// This module validates and exposes environment variables to the application.
// NEVER import process.env directly in application code.

/** Supabase configuration */
const _url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const _key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (typeof window === 'undefined') {
  if (!_url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
}

export const DATABASE_URL = _url!;
export const SUPABASE_ANON_KEY = _key || '';

/**
 * Service-role key — server-only, bypasses RLS.
 * Deliberately NOT defaulted: callers must fail closed when it is absent rather than
 * silently substitute the public anon key.
 */
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Deployment origin used for origin checking and trusted redirect URLs. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export const IS_PRODUCTION = (process.env.NODE_ENV || 'development') === 'production';

/** Application configuration */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'NexCargo';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
export const NODE_ENV = process.env.NODE_ENV || 'development';

/** API base URL (for external integrations) */
export const API_BASE_URL = process.env.EXTERNAL_API_BASE_URL || '';
