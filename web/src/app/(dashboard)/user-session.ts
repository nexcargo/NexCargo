// NexCargo — User Session Utility
// C6-II Authenticated Shell Infrastructure
// Resolves the signed-in user's role for the dashboard shell (badge + navigation branch).
//
// The value comes from the database resolvers, not from user_metadata. The metadata role is
// client-writable, and the shell decides which dashboard a user is shown, so it cannot trust it.
// API authorization is enforced separately by assertApiAuthorization().

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { resolveEffectiveRoles } from '@/lib/auth/role-authority';

/**
 * Effective role for the authenticated session, or null.
 * Null means unresolved (unassigned / onboarding) and callers must not show a role-bound view.
 */
export async function getUserRoleFromSession(user: User): Promise<string | null> {
  if (!user) {
    return null;
  }

  try {
    const supabase = await createClient();
    const roles = await resolveEffectiveRoles(supabase);
    return roles.effective;
  } catch {
    // Fail-closed: no resolved role, never a default to a privileged role.
    return null;
  }
}
