import { createClient } from '@/lib/supabase/server';

/**
 * Extract authenticated user from Supabase session.
 * Returns null if no valid session exists.
 * This is the authoritative source of user identity — not request headers.
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
    role: user.user_metadata?.role ?? 'USER',
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
