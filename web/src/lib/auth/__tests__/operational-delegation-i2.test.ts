// NexCargo — I-2 PART A Regression Tests: operational (DISPATCHER) delegation
//
// The Lead Architect's adjudication of 6 Nov 2026 states that DISPATCHER is an operational role under a
// specific Transporter, "neither a marketplace participant nor a global platform role" (PROMPT 0 v1.3:1161),
// that app.platform_roles is a governance-tier table, and that delegation must be explicit, bounded,
// revocable, auditable and enforced through backend authorization as well as RLS.
//
// These tests pin four properties:
//   1. DISPATCHER resolves no governance authority from the platform resolver.
//   2. The delegation reader fails closed (error, absent session, revoked, or off-allowlist scope).
//   3. Delegation authorizes exactly the capabilities its scope covers — and never a financial,
//      administrative or driver-onboarding action.
//   4. A forged header or an asserted role has no part in any of it (identity is auth.uid() server-side).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as serverModule from '@/lib/supabase/server';
import {
  OPERATIONAL_SCOPES,
  PLATFORM_ROLES,
  requiredOperationalScope,
  resolveOperationalDelegation,
} from '@/lib/auth/role-authority';
import { assertApiAuthorization } from '@/lib/supabase/api-auth';

const PRINCIPAL = 'transporter-principal-001';
const sessionUser = { id: 'dispatcher-user-001', email: 'dispatch@example.com', user_metadata: {} };

type RpcPlan = (fn: string) => { data: unknown; error?: unknown };

// The three authority RPCs, plus whatever a plan decides. Anything unplanned answers "no authority",
// which is how a missing resolver is exercised rather than papered over.
function rpcFor(plan: Partial<Record<string, { data: unknown; error?: unknown }>>): RpcPlan {
  return (fn: string) => plan[fn] ?? { data: null, error: null };
}

function clientWith(user: unknown, plan: Parameters<typeof rpcFor>[0]) {
  const rpc = vi.fn(async (fn: string) => rpcFor(plan)(fn));
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) }, rpc } as any;
}

function delegationData(scopes: unknown[], principal: unknown = PRINCIPAL) {
  return { principal_transporter_user_id: principal, scopes };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => clientWith(sessionUser, {})),
}));

describe('I-2 PART A — role-authority operational domain', () => {
  it('removes DISPATCHER from the governance tier set', () => {
    expect(PLATFORM_ROLES).toEqual(['MODERATOR', 'ADMIN', 'SUPER_ADMIN']);
    expect(PLATFORM_ROLES).not.toContain('DISPATCHER');
  });

  it('publishes exactly the bounded scopes migration 043 allows', () => {
    expect([...OPERATIONAL_SCOPES].sort()).toEqual(['assignment_manage', 'operational_read', 'tracking_update']);
  });

  it('maps delegation onto operational actions only', () => {
    expect(requiredOperationalScope('matching', 'read')).toBe('operational_read');
    expect(requiredOperationalScope('tracking', 'read')).toBe('operational_read');
    expect(requiredOperationalScope('documents', 'read')).toBe('operational_read');
    expect(requiredOperationalScope('matching', 'execute')).toBe('assignment_manage');
    expect(requiredOperationalScope('tracking_status', 'status_update')).toBe('tracking_update');
  });

  it('offers no delegation path for financial, administrative or onboarding actions', () => {
    const forbidden: Array<[string, string]> = [
      ['bookings', 'confirm'],
      ['bookings', 'create'],
      ['pod', 'update'],
      ['documents', 'delete'],
      ['listings', 'create'],
      ['quotes', 'create'],
      ['payments', 'create'],
      ['settlements', 'create'],
      ['drivers', 'create'],
    ];
    for (const [resource, action] of forbidden) {
      expect(requiredOperationalScope(resource, action), resource + ':' + action).toBeNull();
    }
  });

  it('reads the delegation from its own resolver with no identity argument', async () => {
    const client = clientWith(sessionUser, {
      effective_operational_delegation: { data: delegationData(['tracking_update']), error: null },
    });
    expect(await resolveOperationalDelegation(client)).toEqual({
      principalTransporterUserId: PRINCIPAL,
      scopes: ['tracking_update'],
    });
    expect(client.rpc).toHaveBeenCalledWith('effective_operational_delegation');
    for (const call of client.rpc.mock.calls) expect(call.length).toBe(1);
  });

  it('fails closed on a resolver error or a thrown call', async () => {
    expect(await resolveOperationalDelegation(clientWith(sessionUser, {
      effective_operational_delegation: { data: null, error: { message: 'denied' } },
    }))).toBeNull();
    const throwing = { rpc: vi.fn(async () => { throw new Error('network'); }), auth: {} } as any;
    expect(await resolveOperationalDelegation(throwing)).toBeNull();
  });

  it('treats "no active delegation" as no authority', async () => {
    expect(await resolveOperationalDelegation(clientWith(sessionUser, {
      effective_operational_delegation: { data: null },
    }))).toBeNull();
    expect(await resolveOperationalDelegation(clientWith(sessionUser, {
      effective_operational_delegation: { data: delegationData([]) },
    }))).toBeNull();
    expect(await resolveOperationalDelegation(clientWith(sessionUser, {
      effective_operational_delegation: { data: delegationData(['tracking_update'], null) },
    }))).toBeNull();
  });

  it('drops a scope the delegation model does not recognise instead of honouring it', async () => {
    const result = await resolveOperationalDelegation(clientWith(sessionUser, {
      effective_operational_delegation: { data: delegationData(['tracking_update', 'escrow_release', 'platform_admin']) },
    }));
    expect(result).toEqual({ principalTransporterUserId: PRINCIPAL, scopes: ['tracking_update'] });
  });
});

describe('I-2 PART A — assertApiAuthorization honours delegation and nothing else', () => {
  const request = () => new NextRequest('http://localhost:3000/api/tracking/T1/status', {
    headers: { 'x-user-role': 'SUPER_ADMIN' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admits a delegated tracking status update with no role at all', async () => {
    vi.mocked(serverModule.createClient).mockReturnValue(clientWith(sessionUser, {
      effective_operational_delegation: { data: delegationData(['tracking_update']), error: null },
    }));
    const ctx = await assertApiAuthorization(request(), 'tracking_status', 'status_update');
    expect(ctx.role).toBeNull();
    expect(ctx.delegation?.principalTransporterUserId).toBe(PRINCIPAL);
  });

  it('denies the same caller an action their scope does not cover', async () => {
    vi.mocked(serverModule.createClient).mockReturnValue(clientWith(sessionUser, {
      effective_operational_delegation: { data: delegationData(['tracking_update']), error: null },
    }));
    await expect(assertApiAuthorization(request(), 'matching', 'execute'))
      .rejects.toThrow('FORBIDDEN');
  });

  it('denies a revoked delegation', async () => {
    vi.mocked(serverModule.createClient).mockReturnValue(clientWith(sessionUser, {
      effective_operational_delegation: { data: null, error: null },
    }));
    await expect(assertApiAuthorization(request(), 'tracking_status', 'status_update'))
      .rejects.toThrow('FORBIDDEN: No effective role resolved for this user.');
  });

  it('grants no governance authority to a legacy platform_roles DISPATCHER row', async () => {
    vi.mocked(serverModule.createClient).mockReturnValue(clientWith(sessionUser, {
      effective_user_role: { data: 'DISPATCHER', error: null },
    }));
    await expect(assertApiAuthorization(request(), 'tracking_status', 'status_update'))
      .rejects.toThrow('FORBIDDEN: No effective role resolved for this user.');
  });

  it('never lets the forged x-user-role header act as the delegated identity', async () => {
    vi.mocked(serverModule.createClient).mockReturnValue(clientWith(sessionUser, {
      effective_operational_delegation: { data: delegationData(['operational_read']), error: null },
    }));
    const withHeader = await assertApiAuthorization(request(), 'tracking', 'read');
    const plain = new NextRequest('http://localhost:3000/api/tracking/T1');
    const withoutHeader = await assertApiAuthorization(plain, 'tracking', 'read');
    expect(withHeader.userId).toBe(withoutHeader.userId);
    await expect(assertApiAuthorization(request(), 'matching', 'execute')).rejects.toThrow('FORBIDDEN');
  });

  it('keeps governance tiers working through the role matrix', async () => {
    vi.mocked(serverModule.createClient).mockReturnValue(clientWith(
      { id: 'admin-user-001', email: 'admin@example.com', user_metadata: {} },
      { effective_user_role: { data: 'ADMIN', error: null } },
    ));
    const ctx = await assertApiAuthorization(request(), 'tracking_status', 'status_update');
    expect(ctx.role).toBe('ADMIN');
    expect(ctx.delegation).toBeNull();
  });
});
