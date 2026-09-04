import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateRBAC } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';

/**
 * API Route authentication context.
 * Extracts user identity from Supabase session (not request headers).
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
}

/**
 * Get auth context for an API route by reading Supabase session cookies.
 * Returns null if no valid session exists.
 */
export async function getApiAuthContext(request: NextRequest): Promise<AuthContext | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email ?? '',
      role: user.user_metadata?.role ?? 'USER',
      tenantId: user.user_metadata?.tenantId,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication in an API route.
 * Throws an error with message 'UNAUTHORIZED' if not authenticated.
 * Used in try/catch blocks within route handlers.
 */
export async function assertApiAuth(request: NextRequest): Promise<AuthContext> {
  const ctx = await getApiAuthContext(request);
  if (!ctx) {
    throw new Error('UNAUTHORIZED');
  }
  return ctx;
}

/**
 * Combine auth assertion with RBAC evaluation.
 * Returns the auth context if authorized, or throws FORBIDDEN.
 */
export async function assertApiAuthorization(
  request: NextRequest,
  resource: string,
  action: string,
): Promise<AuthContext> {
  const ctx = await assertApiAuth(request);

  const result = evaluateRBAC(ctx.role, resource, action);
  if (!result.permitted) {
    throw new Error(`FORBIDDEN: ${result.reason}`);
  }

  return ctx;
}
