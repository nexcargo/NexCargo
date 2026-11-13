// NexCargo I-4 §3A/§10(1) — the post-login landing target.
//
// A Shipper must reach their dashboard on authenticating; the locale landing page carries no
// dashboard entry point, so the login handler's default target is resolved from the marketplace
// membership. Non-shippers and every explicit ?next= keep the I-1 behaviour untouched.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGIN = 'https://app.nexcargo.example';
let authClient: any = {};

vi.mock('@/lib/env', () => ({
  get DATABASE_URL() { return 'https://configured.supabase.co'; },
  get SUPABASE_ANON_KEY() { return 'anon'; },
  get SUPABASE_SERVICE_ROLE_KEY() { return 'service-role-value'; },
  get SITE_URL() { return ORIGIN; },
  get IS_PRODUCTION() { return true; },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => authClient),
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

import { POST as login } from '@/app/api/auth/login/route';

function formPost(path: string, fields: Record<string, string>, cookie?: string) {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(fields).toString(),
  });
}

const locationOf = (response: Response) => response.headers.get('location') ?? '';

describe('login post-authentication landing (I-4 §10 criterion 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'shipper-1' }, error: null } }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      },
      rpc: vi.fn(async (fn: string) =>
        fn === 'effective_marketplace_role' ? { data: 'SHIPPER', error: null } : { data: null, error: null }),
    };
  });

  it('sends a SHIPPER to the localized shipper dashboard', async () => {
    const response = await login(formPost('/api/auth/login', { email: 'a@nexcargo.co', password: 'p123' }));
    expect(locationOf(response)).toBe(`${ORIGIN}/pt/shipper/dashboard`);
  });

  it('keeps the locale the browser is already using', async () => {
    const response = await login(formPost('/api/auth/login', { email: 'a@nexcargo.co', password: 'p123' }, 'NEXT_LOCALE=en'));
    expect(locationOf(response)).toBe(`${ORIGIN}/en/shipper/dashboard`);
  });

  it('sends a TRANSPORTER to the localized transporter dashboard (I-5 §10 criterion 1)', async () => {
    // This case pinned the pre-I-5 fallback (the locale landing page) for a TRANSPORTER. I-5 gave the
    // Transporter the same dashboard entry point the Shipper has, so that fallback no longer applies to
    // it; the fallback itself is still covered by the no-membership case at the end of this file.
    authClient.rpc = vi.fn(async (fn: string) =>
      fn === 'effective_marketplace_role' ? { data: 'TRANSPORTER', error: null } : { data: null, error: null });
    const response = await login(formPost('/api/auth/login', { email: 't@nexcargo.co', password: 'p123' }));
    expect(locationOf(response)).toBe(`${ORIGIN}/pt/transporter/dashboard`);
  });

  it('never overrides an explicit destination', async () => {
    const response = await login(formPost('/api/auth/login?next=/tracking/live', { email: 'a@nexcargo.co', password: 'p123' }));
    expect(locationOf(response)).toBe(`${ORIGIN}/tracking/live`);
  });

  it('still refuses an off-site destination for a SHIPPER', async () => {
    const response = await login(formPost('/api/auth/login', { email: 'a@nexcargo.co', password: 'p123', next: 'https://evil.example/steal' }));
    expect(locationOf(response)).toBe(`${ORIGIN}/`);
  });

  it('falls back when role resolution finds no membership', async () => {
    authClient.rpc = vi.fn(async () => ({ data: null, error: null }));
    const response = await login(formPost('/api/auth/login', { email: 'a@nexcargo.co', password: 'p123' }));
    expect(locationOf(response)).toBe(`${ORIGIN}/`);
  });
});
