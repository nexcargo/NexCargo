import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getTrustedOrigins,
  isTrustedOriginRequest,
  isWellFormedEmail,
  safeRedirect,
  trustedRedirectUrl,
} from '@/lib/auth/request-guard';

// I-1 §7 — trust comes from configuration and the request's own origin, never from forwarded
// headers. These fixtures vary the two configuration inputs through live getters.
let configuredSiteUrl = 'https://app.nexcargo.example';
let isProduction = true;

vi.mock('@/lib/env', () => ({
  get DATABASE_URL() {
    return 'https://configured.supabase.co';
  },
  get SUPABASE_ANON_KEY() {
    return 'anon';
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return '';
  },
  get SITE_URL() {
    return configuredSiteUrl;
  },
  get IS_PRODUCTION() {
    return isProduction;
  },
}));

function post(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: 'POST', headers });
}

function get(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe('request-guard (I-1 §7)', () => {
  it('trusts the configured site URL and nothing else in production', () => {
    const request = get(`${configuredSiteUrl}/api/auth/login`);
    expect(getTrustedOrigins(request)).toEqual([configuredSiteUrl]);
  });

  it('accepts a same-origin authentication POST', () => {
    const request = post(`${configuredSiteUrl}/api/auth/login`, {
      origin: configuredSiteUrl,
      'sec-fetch-site': 'same-origin',
    });
    expect(isTrustedOriginRequest(request)).toBe(true);
  });

  it('accepts a same-origin POST that carries only an Origin header', () => {
    const request = post(`${configuredSiteUrl}/api/auth/register`, { origin: configuredSiteUrl });
    expect(isTrustedOriginRequest(request)).toBe(true);
  });

  it('accepts a same-origin POST identified only by its Referer', () => {
    const request = post(`${configuredSiteUrl}/api/auth/logout`, {
      referer: `${configuredSiteUrl}/dashboard`,
    });
    expect(isTrustedOriginRequest(request)).toBe(true);
  });

  it('rejects an untrusted Origin', () => {
    const request = post(`${configuredSiteUrl}/api/auth/login`, {
      origin: 'https://evil.example',
    });
    expect(isTrustedOriginRequest(request)).toBe(false);
  });

  it('rejects a cross-site Fetch-Metadata header even when the Origin looks trusted', () => {
    const request = post(`${configuredSiteUrl}/api/auth/login`, {
      origin: configuredSiteUrl,
      'sec-fetch-site': 'cross-site',
    });
    expect(isTrustedOriginRequest(request)).toBe(false);
  });

  it('rejects the opaque "null" Origin a browser sends from a sandboxed context', () => {
    const request = post(`${configuredSiteUrl}/api/auth/register`, { origin: 'null' });
    expect(isTrustedOriginRequest(request)).toBe(false);
  });

  it('rejects a state-changing request that identifies no origin at all', () => {
    const request = post(`${configuredSiteUrl}/api/auth/reset-password`);
    expect(isTrustedOriginRequest(request)).toBe(false);
  });

  it('rejects an untrusted referer standing in for a missing Origin', () => {
    const request = post(`${configuredSiteUrl}/api/auth/login`, {
      referer: 'https://evil.example/login',
    });
    expect(isTrustedOriginRequest(request)).toBe(false);
  });

  it('does not treat a same-host-but-different-port request as same-origin', () => {
    const request = post(`${configuredSiteUrl}/api/auth/login`, {
      origin: 'https://app.nexcargo.example:8443',
    });
    expect(isTrustedOriginRequest(request)).toBe(false);
  });

  it('trusts loopback only outside production', () => {
    isProduction = false;
    try {
      const request = post('http://localhost:3000/api/auth/login', { origin: 'http://localhost:3000' });
      expect(isTrustedOriginRequest(request)).toBe(true);
    } finally {
      isProduction = true;
    }

    const prod = post('http://localhost:3000/api/auth/login', { origin: 'http://localhost:3000' });
    expect(isTrustedOriginRequest(prod)).toBe(false);
  });

  it('builds emailed links from configuration, not from X-Forwarded-Host', () => {
    const request = post(`${configuredSiteUrl}/api/auth/register`, {
      origin: configuredSiteUrl,
      'x-forwarded-host': 'attacker.example',
      'x-forwarded-proto': 'http',
    });
    expect(trustedRedirectUrl(request, '/api/auth/callback')).toBe(
      `${configuredSiteUrl}/api/auth/callback`,
    );
  });

  it('falls back to the request origin when no site URL is configured — never a forwarded header', () => {
    configuredSiteUrl = '';
    try {
      isProduction = false;
      const request = post('http://localhost:3000/api/auth/register', {
        origin: 'http://localhost:3000',
        'x-forwarded-host': 'attacker.example',
      });
      expect(trustedRedirectUrl(request, '/api/auth/callback')).toBe(
        'http://localhost:3000/api/auth/callback',
      );
    } finally {
      configuredSiteUrl = 'https://app.nexcargo.example';
    }
  });

  it('normalises a relative path into a trusted absolute URL', () => {
    const request = post(`${configuredSiteUrl}/api/auth/register`, { origin: configuredSiteUrl });
    expect(trustedRedirectUrl(request, 'api/auth/callback')).toBe(
      `${configuredSiteUrl}/api/auth/callback`,
    );
  });

  it('honours a relative post-authentication destination', () => {
    const request = post(`${configuredSiteUrl}/api/auth/login`, { origin: configuredSiteUrl });
    expect(safeRedirect(request, '/dashboard').toString()).toBe(`${configuredSiteUrl}/dashboard`);
  });

  it('falls back to the local root for protocol-relative and untrusted destinations', () => {
    const request = post(`${configuredSiteUrl}/api/auth/login`, { origin: configuredSiteUrl });

    expect(safeRedirect(request, '//evil.example').toString()).toBe(`${configuredSiteUrl}/`);
    expect(safeRedirect(request, 'https://evil.example/steal').toString()).toBe(`${configuredSiteUrl}/`);
    expect(safeRedirect(request, 'javascript:alert(1)').toString()).toBe(`${configuredSiteUrl}/`);
    expect(safeRedirect(request, null).toString()).toBe(`${configuredSiteUrl}/`);
  });

  it('rejects an absolute destination on a host that merely contains the trusted hostname', () => {
    const request = post(`${configuredSiteUrl}/api/auth/login`, { origin: configuredSiteUrl });
    expect(safeRedirect(request, 'https://app.nexcargo.example.evil.example/x').toString()).toBe(
      `${configuredSiteUrl}/`,
    );
  });

  it('accepts an absolute destination that is genuinely on a trusted origin', () => {
    const request = post(`${configuredSiteUrl}/api/auth/login`, { origin: configuredSiteUrl });
    expect(safeRedirect(request, `${configuredSiteUrl}/dashboard/shipper`).pathname).toBe(
      '/dashboard/shipper',
    );
  });

  it('validates email shape without consulting any header', () => {
    expect(isWellFormedEmail('shipper@nexcargo.example')).toBe(true);
    expect(isWellFormedEmail('shipper@localhost')).toBe(false);
    expect(isWellFormedEmail('not-an-email')).toBe(false);
    expect(isWellFormedEmail('a b@c.example')).toBe(false);
    expect(isWellFormedEmail('')).toBe(false);
    expect(isWellFormedEmail(`${'a'.repeat(320)}@b.example`)).toBe(false);
  });
});
