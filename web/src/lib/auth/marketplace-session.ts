// NexCargo I-5 — role-agnostic marketplace session resolver.
// I-4 resolved this path for the Shipper area; the Transporter area needs the same contract, so the
// implementation lives here once and each route group gates on `marketplaceRole` itself.
// Both inputs come from the Supabase session and from app.marketplace_memberships through the
// RLS-enforced session client — never from user_metadata or a client-supplied role claim (§4).

import { createClient } from '@/lib/supabase/server';
import { resolveEffectiveRoles } from '@/lib/auth/role-authority';

export interface MarketplaceContext {
  userId: string;
  email: string;
  marketplaceRole: string | null;
  platformRole: string | null;
  memberSince: string | null;
}

/**
 * Null when there is no session. `marketplaceRole` is null when the authenticated user holds no
 * marketplace membership, which is the state a layout must reject rather than default.
 */
export async function getMarketplaceContext(): Promise<MarketplaceContext | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;

    const roles = await resolveEffectiveRoles(supabase);

    const { data: membership } = await supabase
      .schema('app')
      .from('marketplace_memberships')
      .select('created_at')
      .eq('user_id', user.id)
      .single();

    return {
      userId: user.id,
      email: user.email ?? '',
      marketplaceRole: roles.marketplace,
      platformRole: roles.platform,
      memberSince: (membership?.created_at as string | undefined) ?? user.created_at ?? null,
    };
  } catch {
    // Fail closed: an unresolvable session is not a session.
    return null;
  }
}
