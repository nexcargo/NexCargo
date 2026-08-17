// NexCargo Environment Variables — Type-safe env access per ESS-007
// This module validates and exposes environment variables to the application.
// NEVER import process.env directly in application code.

/** Validate that required environment variables are set */
function validateEnv(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnv();

/** Supabase configuration */
export const DATABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Application configuration */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'NexCargo';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
export const NODE_ENV = process.env.NODE_ENV || 'development';

/** API base URL (for external integrations) */
export const API_BASE_URL = process.env.EXTERNAL_API_BASE_URL || '';
