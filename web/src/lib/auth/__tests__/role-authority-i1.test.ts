import { describe, it, expect, vi } from 'vitest';
import {
  MARKETPLACE_ROLES,
  PLATFORM_ROLES,
  resolveEffectiveRoles,
} from '@/lib/auth/role-authority';

type RpcValue = string | null | 'error' | 'throw';

function client(marketplace: RpcValue, platform: RpcValue) {
  const outcome = (value: RpcValue) => {
    if (value === 'throw') return Promise.reject(new Error('network'));
    if (value === 'error') return Promise.resolve({ data: null, error: { message: 'denied' } });
    return Promise.resolve({ data: value, error: null });
  };

  return {
    rpc: vi.fn(async (fn: string) =>
      outcome(fn === 'effective_marketplace_role' ? marketplace : platform),
    ),
  } as any;
}

describe('role-authority (I-1 §3)', () => {
  it('exposes exactly the two authority domains', () => {
    expect(MARKETPLACE_ROLES).toEqual(['SHIPPER', 'TRANSPORTER']);
    // I-2 PART A adjudication (6 Nov 2026): DISPATCHER is operational, not a governance tier, so it is no
    // longer resolvable from app.platform_roles. PROMPT 0 v1.3:1161 is the authority.
    expect(PLATFORM_ROLES).toEqual(['MODERATOR', 'ADMIN', 'SUPER_ADMIN']);
    expect(PLATFORM_ROLES).not.toContain('DISPATCHER');
    expect(MARKETPLACE_ROLES).not.toContain('DRIVER');
  });

  it('takes marketplace authority from the marketplace resolver', async () => {
    const roles = await resolveEffectiveRoles(client('TRANSPORTER', null));
    expect(roles).toEqual({ marketplace: 'TRANSPORTER', platform: null, effective: 'TRANSPORTER' });
  });

  it('takes platform authority from the platform resolver and lets it win', async () => {
    const roles = await resolveEffectiveRoles(client('SHIPPER', 'ADMIN'));
    expect(roles).toEqual({ marketplace: 'SHIPPER', platform: 'ADMIN', effective: 'ADMIN' });
  });

  it('queries each domain through its own resolver, keyed on auth.uid() server-side', async () => {
    const supabase = client('SHIPPER', 'MODERATOR');
    await resolveEffectiveRoles(supabase);

    expect(supabase.rpc).toHaveBeenCalledWith('effective_user_role');
    expect(supabase.rpc).toHaveBeenCalledWith('effective_marketplace_role');
    // No caller-supplied user id is ever passed.
    for (const call of supabase.rpc.mock.calls) expect(call.length).toBe(1);
  });

  it('denies rather than falling back when a resolver errors', async () => {
    expect(await resolveEffectiveRoles(client('error', 'error'))).toEqual({
      marketplace: null,
      platform: null,
      effective: null,
    });
  });

  it('denies when a resolver call itself throws', async () => {
    expect(await resolveEffectiveRoles(client('throw', 'throw'))).toEqual({
      marketplace: null,
      platform: null,
      effective: null,
    });
  });

  it('rejects a role outside the marketplace domain, including DRIVER', async () => {
    for (const value of ['DRIVER', 'ADMIN', 'CONTRIBUTOR', 'shipper-admin']) {
      const roles = await resolveEffectiveRoles(client(value, null));
      expect(roles.marketplace, value).toBeNull();
    }
  });

  it('rejects a role outside the platform domain', async () => {
    // DISPATCHER belongs here now: a legacy app.platform_roles row carrying it grants no governance reach.
    for (const value of ['DRIVER', 'SHIPPER', 'TRANSPORTER', 'OWNER', 'DISPATCHER']) {
      const roles = await resolveEffectiveRoles(client(null, value));
      expect(roles.platform, value).toBeNull();
      expect(roles.effective, value).toBeNull();
    }
  });

  it('treats an empty or non-string resolver payload as no authority', async () => {
    expect((await resolveEffectiveRoles(client('', null))).effective).toBeNull();
    expect((await resolveEffectiveRoles(client(undefined as any, null))).effective).toBeNull();
    expect((await resolveEffectiveRoles(client(['SHIPPER'] as any, null))).effective).toBeNull();
  });

  it('normalises casing without widening the allowed set', async () => {
    expect((await resolveEffectiveRoles(client('shipper', null))).marketplace).toBe('SHIPPER');
    expect((await resolveEffectiveRoles(client(null, 'super_admin'))).platform).toBe('SUPER_ADMIN');
  });
});
