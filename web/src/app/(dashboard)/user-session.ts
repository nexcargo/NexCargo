// NexCargo — User Session Utility
// C6-II Authenticated Shell Infrastructure
// Extracts user role from Supabase user_metadata for display purposes.
// Authorization uses the authoritative effective_user_role() resolver via assertApiAuthorization().
// Platform-assigned roles (DISPATCHER/MODERATOR/ADMIN/SUPER_ADMIN) must be resolved from app.platform_roles.

import type { User } from '@supabase/supabase-js';

/**
 * Extract and validate user role from Supabase session metadata.
 * Returns a valid self-selected UserRole string or null.
 * Platform-assigned roles are NOT validated here — they must come from app.platform_roles.
 */
export async function getUserRoleFromSession(user: User): Promise<string | null> {
  const role = user.user_metadata?.role;
  
  // Only self-selected roles are valid in metadata; platform roles require app.platform_roles
  const validSelfSelectedRoles = ['SHIPPER', 'TRANSPORTER', 'DRIVER'];
  
  if (role && validSelfSelectedRoles.includes(role)) {
    return role;
  }
  
  // Fail-closed: null role → denied access, never default to a privileged role
  return null;
}
