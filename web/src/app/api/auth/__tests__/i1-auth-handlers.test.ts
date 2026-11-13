import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// I-1 §4/§11 — handler-level behaviour for the four auth endpoints, the recovery callback,
// logout and the registration role rules.
const ORIGIN = 'https://app.nexcargo.example';

let authClient: any = {};
let adminClient: any = {};
let adminClientThrows = false;

vi.mock('@/lib/env', () => ({
  get DATABASE_URL() {
    return 'https://configured.supabase.co';
  },
  get SUPABASE_ANON_KEY() {
    return 'anon';
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return 'service-role-value';
  },
  get SITE_URL() {
    return ORIGIN;
  },
  get IS_PRODUCTION() {
    return true;
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => authClient),
  SESSION_COOKIE_OPTIONS: { path: '/', httpOnly: true, sameSite: 'lax', secure: true },
}));

vi.mock('@/infrastructure/database/supabase', () => ({
  createAdminClient: vi.fn(() => {
    if (adminClientThrows) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    return adminClient;
  }),
}));

import { POST as login } from '@/app/api/auth/login/route';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { GET as callback } from '@/app/api/auth/callback/route';

function formPost(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  const body = new URLSearchParams(fields).toString();
  return new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
    body,
  });
}

function locationOf(response: Response): string {
  return response.headers.get('location') ?? '';
}

describe('auth handlers — origin protection (I-1 §7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminClientThrows = false;
    authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
        updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
        exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        verifyOtp: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    adminClient = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
    };
  });

  it('rejects every state-changing auth endpoint from an untrusted origin', async () => {
    const fields = { email: 'a@b.co', password: 'password123', newPassword: 'password123', confirmPassword: 'password123' };

    const cases: Array<[string, (r: NextRequest) => Promise<Response>]> = [
      ['/api/auth/login', login],
      ['/api/auth/register', register],
      ['/api/auth/forgot-password', forgotPassword],
      ['/api/auth/reset-password', resetPassword],
      ['/api/auth/logout', logout],
    ];

    for (const [path, handler] of cases) {
      const response = await handler(formPost(path, fields, { origin: 'https://evil.example' }));
      expect(response.status, path).toBe(403);
      const body = await response.json();
      expect(body.error.code, path).toBe('FORBIDDEN_ORIGIN');
    }

    // Nothing reached the auth service for any rejected request.
    expect(authClient.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(authClient.auth.signUp).not.toHaveBeenCalled();
    expect(authClient.auth.updateUser).not.toHaveBeenCalled();
    expect(authClient.auth.signOut).not.toHaveBeenCalled();
  });

  it('lets a legitimate same-origin sign-in through the guard', async () => {
    const response = await login(formPost('/api/auth/login', { email: 'shipper@nexcargo.co', password: 'password123' }));
    expect(locationOf(response)).toBe(`${ORIGIN}/`);
    expect(authClient.auth.signInWithPassword).toHaveBeenCalledOnce();
  });
});

describe('login handler (I-1 §4.1)', () => {
  beforeEach(() => {
    authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      },
    };
  });

  it('returns one generic failure for a wrong password and an unknown account', async () => {
    authClient.auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid login credentials' } });
    const response = await login(formPost('/api/auth/login', { email: 'nobody@nexcargo.co', password: 'password123' }));
    expect(locationOf(response)).toContain('/sign-in?error=invalid_credentials');
  });

  it('does not echo the provider error message back to the browser', async () => {
    authClient.auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'Email not confirmed for user 7f3a-shipper' } });
    const response = await login(formPost('/api/auth/login', { email: 'shipper@nexcargo.co', password: 'password123' }));
    expect(locationOf(response)).not.toContain('7f3a');
    expect(locationOf(response)).not.toContain('Email not confirmed');
  });

  it('honours a trusted relative post-login destination and marks the redirect uncacheable', async () => {
    const response = await login(formPost('/api/auth/login?next=/dashboard', { email: 'shipper@nexcargo.co', password: 'password123' }));
    expect(locationOf(response)).toBe(`${ORIGIN}/dashboard`);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses to redirect off-site through the next parameter', async () => {
    const response = await login(
      formPost('/api/auth/login', { email: 'shipper@nexcargo.co', password: 'password123', next: 'https://evil.example/steal' }),
    );
    expect(locationOf(response)).toBe(`${ORIGIN}/`);
  });

  it('normalises the email but never the password', async () => {
    await login(formPost('/api/auth/login', { email: '  Shipper@NexCargo.co ', password: ' pad123 ' }));
    expect(authClient.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'shipper@nexcargo.co', password: ' pad123 ' });
  });

  it('fails closed when the auth service itself throws', async () => {
    authClient.auth.signInWithPassword.mockRejectedValue(new Error('network'));
    const response = await login(formPost('/api/auth/login', { email: 'shipper@nexcargo.co', password: 'password123' }));
    expect(locationOf(response)).toContain('error=auth_unavailable');
  });
});

describe('register handler (I-1 §3.5, §4.2)', () => {
  const valid = { email: 'new@nexcargo.co', password: 'password123', confirmPassword: 'password123', role: 'SHIPPER' };

  beforeEach(() => {
    authClient = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', identities: [{}] }, session: null },
          error: null,
        }),
      },
    };
    adminClient = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
    };
  });

  it.each(['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'DISPATCHER'])(
    'refuses self-selection of %s and writes no membership',
    async (role) => {
      const response = await register(formPost('/api/auth/register', { ...valid, role }));
      expect(locationOf(response)).toContain('error=role_not_selectable');
      expect(authClient.auth.signUp).not.toHaveBeenCalled();
      expect(adminClient.rpc).not.toHaveBeenCalled();
    },
  );

  it.each(['SHIPPER', 'TRANSPORTER'])('accepts the selectable role %s', async (role) => {
    const response = await register(formPost('/api/auth/register', { ...valid, role }));
    expect(locationOf(response)).toContain('/register?status=check_email');
    expect(adminClient.rpc).toHaveBeenCalledWith('record_marketplace_membership', {
      p_user_id: 'user-1',
      p_role: role,
    });
  });

  it('does not write the classification into user_metadata', async () => {
    await register(formPost('/api/auth/register', valid));
    const args = authClient.auth.signUp.mock.calls[0][0];
    expect(args.options?.data).toBeUndefined();
    expect(JSON.stringify(args)).not.toContain('SHIPPER');
  });

  it('creates the membership through the service-role writer, not the session client', async () => {
    await register(formPost('/api/auth/register', valid));
    expect(adminClient.rpc).toHaveBeenCalledOnce();
    expect(authClient.rpc).toBeUndefined();
  });

  it('writes no membership for an email that is already registered', async () => {
    authClient.auth.signUp.mockResolvedValue({
      data: { user: { id: 'victim-1', identities: [] }, session: null },
      error: null,
    });
    const response = await register(formPost('/api/auth/register', { ...valid, role: 'TRANSPORTER' }));
    expect(adminClient.rpc).not.toHaveBeenCalled();
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain('/register?status=check_email');
  });

  it('answers an existing account the same way as a new one — no enumeration oracle', async () => {
    authClient.auth.signUp.mockResolvedValue({
      data: { user: { id: 'victim-1', identities: [] }, session: null },
      error: null,
    });
    const duplicate = locationOf(await register(formPost('/api/auth/register', valid)));

    authClient.auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [{}] }, session: null },
      error: null,
    });
    const fresh = locationOf(await register(formPost('/api/auth/register', valid)));

    expect(duplicate).toBe(fresh);
  });

  // F-I1-RT-1 — GoTrue answers a pre-creation failure with its own message shape, and the
  // message differs by cause (duplicate, rejected domain, failed send, aborted insert). Branching
  // on it turned /api/auth/register into an enumeration oracle, so all of them must answer like
  // a successful signup and must not reach the membership writer.
  it.each([
    'Database error saving new user',
    'Error sending confirmation email',
    'Email address "i1.accept@nexcargo-verify.com" is invalid',
    'User already registered',
    'signup prevented',
  ])('answers provider failure %j with the same response as a fresh signup', async (message) => {
    authClient.auth.signUp.mockResolvedValue({
      data: { user: { id: 'victim-1', identities: [] }, session: null },
      error: { message },
    });
    const failed = locationOf(await register(formPost('/api/auth/register', valid)));
    expect(adminClient.rpc).not.toHaveBeenCalled();
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();

    authClient.auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [{}] }, session: null },
      error: null,
    });
    const fresh = locationOf(await register(formPost('/api/auth/register', valid)));

    expect(failed).toContain('/register?status=check_email');
    expect(failed).toBe(fresh);
  });

  it('keeps a non-enumerable answer when the provider reports only an error', async () => {
    authClient.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Database error saving new user' },
    });
    const response = await register(formPost('/api/auth/register', { ...valid, role: 'TRANSPORTER' }));
    expect(locationOf(response)).toContain('/register?status=check_email');
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });

  it('still reports registration_failed when the handler itself throws', async () => {
    authClient.auth.signUp.mockRejectedValue(new Error('network'));
    const response = await register(formPost('/api/auth/register', valid));
    expect(locationOf(response)).toContain('error=registration_failed');
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });

  it('compensates and reports a retryable failure when the membership write fails', async () => {
    adminClient.rpc.mockResolvedValue({ error: { message: 'permission denied for function' } });
    const response = await register(formPost('/api/auth/register', valid));
    expect(locationOf(response)).toContain('error=membership_unavailable');
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('user-1');
  });

  it('fails closed when no service-role key is configured', async () => {
    adminClientThrows = true;
    const response = await register(formPost('/api/auth/register', valid));
    expect(locationOf(response)).toContain('error=membership_unavailable');
  });

  it('rejects a weak or mismatched password before contacting the auth service', async () => {
    for (const fields of [
      { ...valid, password: 'short', confirmPassword: 'short' },
      { ...valid, password: 'password123', confirmPassword: 'password124' },
    ]) {
      const response = await register(formPost('/api/auth/register', fields));
      expect(locationOf(response)).toContain('error=password_rejected');
    }
    expect(authClient.auth.signUp).not.toHaveBeenCalled();
  });

  it('rejects a malformed email role-free', async () => {
    const response = await register(formPost('/api/auth/register', { ...valid, email: 'not-an-email' }));
    expect(locationOf(response)).toContain('error=invalid_email');
    expect(authClient.auth.signUp).not.toHaveBeenCalled();
  });

  it('signs the confirmation link back to the local callback route', async () => {
    await register(formPost('/api/auth/register', valid, { 'x-forwarded-host': 'attacker.example' }));
    expect(authClient.auth.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${ORIGIN}/api/auth/callback`,
    );
  });
});

describe('recovery handlers (I-1 §4.3)', () => {
  it('forgot-password always reports the same outcome', async () => {
    authClient = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    };
    const known = locationOf(await forgotPassword(formPost('/api/auth/forgot-password', { email: 'known@nexcargo.co' })));

    authClient.auth.resetPasswordForEmail.mockRejectedValue(new Error('smtp down'));
    const unknown = locationOf(await forgotPassword(formPost('/api/auth/forgot-password', { email: 'unknown@nexcargo.co' })));

    expect(known).toContain('/forgot-password?status=email_sent');
    expect(unknown).toContain('/forgot-password?status=email_sent');
  });

  it('points the recovery link at the callback with type=recovery on a trusted host', async () => {
    authClient = { auth: { resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }) } };
    await forgotPassword(formPost('/api/auth/forgot-password', { email: 'a@nexcargo.co' }));
    expect(authClient.auth.resetPasswordForEmail.mock.calls[0][1]).toEqual({
      redirectTo: `${ORIGIN}/api/auth/callback?type=recovery`,
    });
  });

  it('reset-password requires a real recovery session and accepts no token', async () => {
    authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: null }),
      },
    };
    const response = await resetPassword(
      formPost('/api/auth/reset-password', {
        newPassword: 'freshpassword1',
        confirmPassword: 'freshpassword1',
        token: 'attacker-supplied-token',
      }),
    );
    expect(locationOf(response)).toContain('/sign-in?error=recovery_required');
    expect(authClient.auth.updateUser).not.toHaveBeenCalled();
  });

  it('reset-password changes the password of the session established by the link', async () => {
    authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: null }),
      },
    };
    const response = await resetPassword(
      formPost('/api/auth/reset-password', { newPassword: 'freshpassword1', confirmPassword: 'freshpassword1' }),
    );
    expect(authClient.auth.updateUser).toHaveBeenCalledWith({ password: 'freshpassword1' });
    expect(locationOf(response)).toContain('/sign-in?status=password_updated');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('reset-password refuses a short or mismatched new password', async () => {
    authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: null }),
      },
    };
    const short = await resetPassword(formPost('/api/auth/reset-password', { newPassword: 'abc', confirmPassword: 'abc' }));
    const mismatch = await resetPassword(
      formPost('/api/auth/reset-password', { newPassword: 'longenough1', confirmPassword: 'longenough2' }),
    );
    expect(locationOf(short)).toContain('/reset-password?error=password_rejected');
    expect(locationOf(mismatch)).toContain('/reset-password?error=password_rejected');
    expect(authClient.auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('callback handler (I-1 §4.3)', () => {
  beforeEach(() => {
    authClient = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        verifyOtp: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      },
    };
  });

  it('exchanges a PKCE code for a session and marks the response uncacheable', async () => {
    const response = await callback(new NextRequest(`${ORIGIN}/api/auth/callback?code=abc123`));
    expect(authClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(locationOf(response)).toBe(`${ORIGIN}/`);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('sends a verified recovery link on to the reset form', async () => {
    const response = await callback(new NextRequest(`${ORIGIN}/api/auth/callback?code=abc&type=recovery`));
    expect(locationOf(response)).toBe(`${ORIGIN}/reset-password`);
  });

  it('falls back to token-hash verification for a link without a code', async () => {
    const response = await callback(new NextRequest(`${ORIGIN}/api/auth/callback?token_hash=deadbeef&type=recovery`));
    expect(authClient.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'deadbeef', type: 'recovery' });
    expect(locationOf(response)).toBe(`${ORIGIN}/reset-password`);
  });

  it('refuses an unrecognised verification type rather than trusting the query string', async () => {
    await callback(new NextRequest(`${ORIGIN}/api/auth/callback?token_hash=x&type=sms`));
    expect(authClient.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'x', type: 'email' });
  });

  it('treats an expired or reused link as a generic invalid link', async () => {
    authClient.auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { message: 'invalid code' } });
    const response = await callback(new NextRequest(`${ORIGIN}/api/auth/callback?code=bad`));
    expect(locationOf(response)).toContain('/sign-in?error=invalid_link');
  });

  it('redirects a link that carries its own error without contacting the auth service', async () => {
    const response = await callback(new NextRequest(`${ORIGIN}/api/auth/callback?error=otp_expired`));
    expect(locationOf(response)).toContain('/sign-in?error=invalid_link');
    expect(authClient.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(authClient.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('rejects a bare callback with no credential', async () => {
    const response = await callback(new NextRequest(`${ORIGIN}/api/auth/callback`));
    expect(locationOf(response)).toContain('/sign-in?error=invalid_link');
  });
});

describe('logout handler (I-1 §4.4)', () => {
  it('does not report success when sign-out fails', async () => {
    authClient = { auth: { signOut: vi.fn().mockResolvedValue({ error: { message: 'network' } }) } };
    const response = await logout(formPost('/api/auth/logout', {}));
    expect(locationOf(response)).toBe(`${ORIGIN}/?error=signout_failed`);
  });

  it('reports failure when the client cannot even be built', async () => {
    authClient = { auth: { signOut: vi.fn().mockRejectedValue(new Error('boom')) } };
    const response = await logout(formPost('/api/auth/logout', {}));
    expect(locationOf(response)).toContain('error=signout_failed');
  });

  it('redirects to the local root on a clean sign-out', async () => {
    authClient = { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } };
    const response = await logout(formPost('/api/auth/logout?next=https://evil.example', {}));
    expect(locationOf(response)).toBe(`${ORIGIN}/`);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
