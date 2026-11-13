// NexCargo Auth User Helper — extracts authenticated user from Supabase session.
// Per HAO PE-H04: role = null indicates unassigned/onboarding state, not a valid application role.

import { createClient } from '@/lib/supabase/server';
import { resolveEffectiveRoles } from '@/lib/auth/role-authority';

/**
 * Extract authenticated user from Supabase session.
 * Returns null if no valid session exists.
 * This is the authoritative source of user identity — not request headers.
 *
 * The role is resolved from the database (app.platform_roles / app.marketplace_memberships).
 * auth.users.user_metadata is not consulted for role: it is client-writable.
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

  const roles = await resolveEffectiveRoles(supabase);

  return {
    id: user.id,
    email: user.email ?? '',
    /** Effective authorization role (platform tier, else marketplace membership). Null when unresolved. */
    role: roles.effective,
    marketplaceRole: roles.marketplace,
    platformRole: roles.platform,
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
