import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/infrastructure/database/supabase';

// I-1 §6 / SB-3 finding 9.11 — the admin client must fail closed. Silently substituting the
// public anon key would run "admin" writes under RLS with no privileges and no error.
let serviceRoleKey = '';

vi.mock('@/lib/env', () => ({
  get DATABASE_URL() {
    return 'https://configured.supabase.co';
  },
  get SUPABASE_ANON_KEY() {
    return 'public-anon-key';
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return serviceRoleKey;
  },
  get SITE_URL() {
    return '';
  },
  get IS_PRODUCTION() {
    return false;
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ __brand: 'supabase-client' })),
}));

describe('createAdminClient fail-closed behaviour (I-1 §6)', () => {
  beforeEach(() => {
    serviceRoleKey = '';
    vi.mocked(createClient).mockClear();
  });

  it('throws instead of building a client when the service-role key is absent', () => {
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY is not set/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('names the missing variable and leaks no key material in the error', () => {
    serviceRoleKey = 'do-not-print-me';
    expect(() => createAdminClient()).not.toThrow();

    serviceRoleKey = '';
    let message = '';
    try {
      createAdminClient();
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(message).not.toContain('do-not-print-me');
    expect(message).not.toContain('public-anon-key');
  });

  it('authenticates with the service-role key, never the anon key', () => {
    serviceRoleKey = 'service-role-value';

    createAdminClient();

    expect(createClient).toHaveBeenCalledWith(
      'https://configured.supabase.co',
      'service-role-value',
      expect.objectContaining({ db: { schema: 'public' } }),
    );
    const usedKey = vi.mocked(createClient).mock.calls[0][1];
    expect(usedKey).not.toBe('public-anon-key');
  });

  it('disables token refresh and session persistence on the admin client', () => {
    serviceRoleKey = 'service-role-value';

    createAdminClient();

    const options = vi.mocked(createClient).mock.calls[0][2];
    expect(options).toEqual({
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it('still refuses to build a client for an empty-string key', () => {
    serviceRoleKey = '   '.trim();

    expect(() => createAdminClient()).toThrow(/refusing to build an admin client/);
    expect(createClient).not.toHaveBeenCalled();
  });
});
