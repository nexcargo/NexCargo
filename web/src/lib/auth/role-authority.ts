// NexCargo — Authoritative role resolution (I-1, corrected by I-2 PART A)
// Roles are read from the database resolvers only. auth.users.raw_user_meta_data is never an
// authority source: it is client-writable, so treating it as one allows privilege self-grant.
//
//   platform domain    -> public.effective_user_role()       (app.platform_roles)
//   marketplace domain -> public.effective_marketplace_role() (app.marketplace_memberships)
//   operational domain -> public.effective_operational_delegation() (app.operational_delegations)
//
// All three resolvers are SECURITY DEFINER, keyed on auth.uid(), and accept no caller-supplied user id.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Marketplace classifications a member can hold. Nothing else may resolve from this domain. */
export const MARKETPLACE_ROLES: readonly string[] = ['SHIPPER', 'TRANSPORTER'];

/**
 * Platform governance tiers held in app.platform_roles.
 * I-2 PART A: DISPATCHER was removed from this list. PROMPT 0 v1.3:1161 states a Dispatcher is "neither a
 * marketplace participant nor a global platform role", and the Lead Architect adjudicated D-6 accordingly.
 * A legacy app.platform_roles row still holding DISPATCHER therefore resolves to no governance authority;
 * operational access comes only from an explicit delegation, which is the provenance check PART A demands.
 */
export const PLATFORM_ROLES: readonly string[] = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'];

/** The bounded scopes an operational delegation may carry (migration 043 CHECK). */
export const OPERATIONAL_SCOPES = ['operational_read', 'assignment_manage', 'tracking_update'] as const;
export type OperationalScope = (typeof OPERATIONAL_SCOPES)[number];

export interface OperationalDelegation {
  /** The delegating Transporter. null when the record carries no principal, which cannot be acted on. */
  principalTransporterUserId: string | null;
  /** Active scopes. Empty when the caller holds no delegation. */
  scopes: string[];
}

export interface EffectiveRoles {
  /** SHIPPER | TRANSPORTER | null — marketplace authority. */
  marketplace: string | null;
  /** MODERATOR | ADMIN | SUPER_ADMIN | null — platform governance authority. */
  platform: string | null;
  /** Single value for existing consumers: platform tier when present, otherwise marketplace. */
  effective: string | null;
}

/**
 * A resolver error is a denial, not a reason to consult another source.
 * Returning null here is what makes the identity path fail closed.
 */
async function readRoleRpc(
  client: SupabaseClient,
  function_name: string,
  allowed: readonly string[],
): Promise<string | null> {
  try {
    const { data, error } = await client.rpc(function_name);
    if (error) {
      return null;
    }
    if (typeof data !== 'string' || data.length === 0) {
      return null;
    }
    const role = data.toUpperCase();
    return allowed.includes(role) ? role : null;
  } catch {
    return null;
  }
}

export async function resolveEffectiveRoles(client: SupabaseClient): Promise<EffectiveRoles> {
  const [platform, marketplace] = await Promise.all([
    readRoleRpc(client, 'effective_user_role', PLATFORM_ROLES),
    readRoleRpc(client, 'effective_marketplace_role', MARKETPLACE_ROLES),
  ]);

  return {
    platform,
    marketplace,
    effective: platform ?? marketplace,
  };
}

/**
 * The operational capability each bounded scope carries.
 *
 * These pairs are not invented here: each one restates a capability a live RLS policy already gates on
 * public.has_operational_scope(), so the API layer and the database layer accept the same delegations and
 * refuse the same ones. 017/024 gate the marketplace and tracking reads and writes; migration 045 Section B
 * gates reads of fleets, vehicles, drivers and assignments on 'operational_read' and manages assignments under
 * 'assignment_manage' — the fleet pairs below mirror those predicates exactly, policy for policy. Financial,
 * administrative and driver-onboarding capabilities are deliberately absent, which is what makes
 * "delegation cannot confer them" true by construction.
 */
const SCOPE_FOR_RESOURCE_ACTION: Record<string, OperationalScope> = {
  'matching:read': 'operational_read',
  'tracking:read': 'operational_read',
  'tracking_read:read': 'operational_read',
  'documents:read': 'operational_read',
  'fleet:read': 'operational_read',
  'fleet_vehicles:read': 'operational_read',
  'fleet_assignments:read': 'operational_read',
  'matching:execute': 'assignment_manage',
  'fleet_assignments:create': 'assignment_manage',
  'fleet_assignments:update': 'assignment_manage',
  'tracking_status:status_update': 'tracking_update',
};

/** The scope that authorizes this resource/action, or null when delegation is not an authority for it. */
export function requiredOperationalScope(resource: string, action: string): OperationalScope | null {
  return SCOPE_FOR_RESOURCE_ACTION[resource + ':' + action] ?? null;
}

/**
 * Read the caller's own active delegation. Fail-closed like the role resolvers: an error, a non-object
 * answer or an absent session yields null, which the caller must treat as "no operational authority".
 */
export async function resolveOperationalDelegation(client: SupabaseClient): Promise<OperationalDelegation | null> {
  try {
    const { data, error } = await client.rpc('effective_operational_delegation');
    if (error || !data || typeof data !== 'object') {
      return null;
    }
    const row = data as { principal_transporter_user_id?: unknown; scopes?: unknown };
    const scopes = Array.isArray(row.scopes)
      ? row.scopes.filter((s): s is string => typeof s === 'string' && (OPERATIONAL_SCOPES as readonly string[]).includes(s))
      : [];
    const principal = typeof row.principal_transporter_user_id === 'string' ? row.principal_transporter_user_id : null;
    if (scopes.length === 0 || principal === null) {
      return null;
    }
    return { principalTransporterUserId: principal, scopes };
  } catch {
    return null;
  }
}
