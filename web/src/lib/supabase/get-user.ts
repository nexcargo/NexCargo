// NexCargo Auth User Helper — extracts authenticated user from Supabase session.
// Per HAO PE-H04: role = null indicates unassigned/onboarding state, not a valid application role.

import { createClient } from '@/lib/supabase/server';

/**
 * Extract authenticated user from Supabase session.
 * Returns null if no valid session exists.
 * This is the authoritative source of user identity — not request headers.
 * Per HAO PE-H04: role = null means unassigned / pending onboarding.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? '',
    /** Application role per approved taxonomy. Null when user has not completed role assignment. */
    role: user.user_metadata?.role ?? null,
    tenantId: user.user_metadata?.tenantId,
  };
}

/**
 * Assert that a user is authenticated, throwing UnauthorizedError if not.
 * Use this at the boundary of protected API routes.
 */
export async function requireAuth() {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}
