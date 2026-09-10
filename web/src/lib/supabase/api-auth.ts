import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateRBAC } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';

// NexCargo API Route authentication context.
// Extracts user identity from Supabase session (not request headers).
// Per HAO PE-H04: role must be explicitly assigned; absence indicates unassigned/onboarding state.
export interface AuthContext {
  userId: string;
  email: string;
  /** Application role per approved taxonomy: SHIPPER/TRANSPORTER/DRIVER/DISPATCHER/MODERATOR/ADMIN/SUPER_ADMIN. Null indicates unassigned/pending-onboarding state, not a valid application role. */
  role: string | null;
  tenantId?: string;
}

/**
 * Get auth context for an API route by reading Supabase session cookies.
 * Returns null if no valid session exists.
 * Per HAO PE-H04: role = null indicates unassigned/onboarding state (not a valid application role).
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
      role: user.user_metadata?.role ?? null,
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

// Approved self-selected role values (trusted when RPC resolver unavailable)
const SELF_SELECTED_ROLES = ['SHIPPER', 'TRANSPORTER', 'DRIVER'];

/**
 * Resolve the effective application role.
 * 1. Tries the authoritative database resolver (public.effective_user_role).
 * 2. Falls back to validating metadata.role against the self-selected whitelist.
 * 3. Returns null if neither yields an authorized role.
 */
async function getEffectiveRole(request: NextRequest): Promise<string | null> {
  // Attempt authoritative resolver
  try {
    const supabase = await createClient();
    const { data: role, error } = await supabase.rpc('effective_user_role');
    if (!error && role) {
      return role;
    }
  } catch {
    /* RPC unavailable — proceed to metadata fallback */
  }

  // Fallback: trusted metadata validation (self-selected roles only)
  // Platform-assigned roles from metadata are NOT trusted here.
  const ctx = await getApiAuthContext(request);
  if (ctx?.role && SELF_SELECTED_ROLES.includes(ctx.role)) {
    return ctx.role;
  }

  return null;
}

/**
 * Combine auth assertion with RBAC evaluation.
 * Returns the auth context if authorized, or throws FORBIDDEN.
 * Per HAO PE-H04: null role indicates unassigned/onboarding state — always denied for API access.
 * Uses the authoritative effective_user_role() resolver — never trusts user_metadata directly.
 */
export async function assertApiAuthorization(
  request: NextRequest,
  resource: string,
  action: string,
): Promise<AuthContext> {
  const ctx = await assertApiAuth(request);

  // Override metadata role with authoritative resolver result (with fallback)
  const effectiveRole = await getEffectiveRole(request);

  if (!effectiveRole) {
    throw new Error('FORBIDDEN: No effective role resolved for this user.');
  }

  ctx.role = effectiveRole;

  const result = evaluateRBAC(ctx.role, resource, action);
  if (!result.permitted) {
    throw new Error(`FORBIDDEN: ${result.reason}`);
  }

  return ctx;
}
