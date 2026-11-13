import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateRBAC } from '@/modules/mod-001-marketplace/infrastructure/integrations/integration-wiring';
import {
  resolveEffectiveRoles,
  resolveOperationalDelegation,
  requiredOperationalScope,
  type OperationalDelegation,
} from '@/lib/auth/role-authority';

// NexCargo API Route authentication context.
// Identity comes from the Supabase session; authorization role comes from the database
// resolvers, never from auth.users.user_metadata (client-writable — see I-1 §3.6).
// Per HAO PE-H04: role must be explicitly assigned; absence indicates unassigned/onboarding state.
export interface AuthContext {
  userId: string;
  email: string;
  /**
   * Effective authorization role: platform governance tier when the user holds one, otherwise marketplace
   * membership, otherwise null. Resolved from app.platform_roles / app.marketplace_memberships.
   * Null indicates unassigned/pending-onboarding state, which is denied for API access.
   */
  role: string | null;
  /** SHIPPER | TRANSPORTER | null from app.marketplace_memberships. */
  marketplaceRole: string | null;
  /** MODERATOR | ADMIN | SUPER_ADMIN | null from app.platform_roles — governance tiers only since I-2 PART A. */
  platformRole: string | null;
  /**
   * I-2 PART A: the caller's active Dispatcher delegation, or null. Not a role and not a marketplace
   * membership: a bounded, revocable grant tied to one identifiable Transporter. Routes that act on it
   * must constrain their query to principalTransporterUserId; RLS enforces the same boundary.
   */
  delegation: OperationalDelegation | null;
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

    const [roles, delegation] = await Promise.all([
      resolveEffectiveRoles(supabase),
      resolveOperationalDelegation(supabase),
    ]);

    return {
      userId: user.id,
      email: user.email ?? '',
      role: roles.effective,
      marketplaceRole: roles.marketplace,
      platformRole: roles.platform,
      delegation,
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
 *
 * A user with no database-resolved role is denied. There is no metadata fallback and no
 * fallback when a resolver RPC errors: an unavailable resolver is a denial, not a downgrade.
 *
 * I-2 PART A adds one authority path beside the role matrix: a bounded operational delegation.
 * It is consulted only for a resource/action that the delegation model covers at all, so financial,
 * administrative and driver-onboarding actions stay unreachable through delegation by construction.
 */
export async function assertApiAuthorization(
  request: NextRequest,
  resource: string,
  action: string,
): Promise<AuthContext> {
  const ctx = await assertApiAuth(request);

  const scope = requiredOperationalScope(resource, action);
  if (scope && ctx.delegation && ctx.delegation.scopes.includes(scope)) {
    return ctx;
  }

  if (!ctx.role) {
    throw new Error('FORBIDDEN: No effective role resolved for this user.');
  }

  const result = evaluateRBAC(ctx.role, resource, action);
  if (!result.permitted) {
    throw new Error(`FORBIDDEN: ${result.reason}`);
  }

  return ctx;
}

/**
 * I-2 PART C item 6: the guards above signal a denial by error message, and several route handlers answer in
 * JSON instead of throwing. Without this mapping a 401 or 403 surfaced as a 500, which hid exactly the
 * requests the authorization audit cares about. Returns null when the error is not an auth signal, so the
 * caller keeps its own internal-error handling.
 */
export function authDenialResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) {
    return null;
  }
  if (error.message.includes('UNAUTHORIZED')) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Authentication required' },
      { status: 401 },
    );
  }
  if (error.message.startsWith('FORBIDDEN')) {
    return NextResponse.json(
      { error: 'forbidden', message: error.message.replace(/^FORBIDDEN:\s*/, '') },
      { status: 403 },
    );
  }
  return null;
}
