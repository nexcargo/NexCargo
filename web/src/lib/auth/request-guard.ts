// NexCargo — Request guard for state-changing auth endpoints (I-1, §7)
//
// Protections are deliberately proportionate: a same-origin check plus the Fetch Metadata
// headers a browser already sends, and a redirect target that can only ever be one we trust.
// Forwarded headers (X-Forwarded-Host / X-Forwarded-Proto) are NOT consulted — they are
// attacker-controlled unless the edge sanitises them. Configuration supplies the trusted
// origins; the request's own URL supplies the same-origin comparison.

import { type NextRequest, NextResponse } from 'next/server';
import { IS_PRODUCTION, SITE_URL } from '@/lib/env';

/** Loopback origins are trusted only outside production so local runtime verification works. */
const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getTrustedOrigins(request: NextRequest): string[] {
  const origins: string[] = [];

  const configured = SITE_URL ? originOf(SITE_URL) : null;
  if (configured) {
    origins.push(configured);
  }

  // request.url is derived from the Host header, so in production it may only vouch for itself
  // when nothing is configured to vouch for it. Otherwise a same-origin test would be
  // self-asserting: whatever Host a request carries would be the origin it is checked against.
  const self = originOf(request.url);
  if (self && (!IS_PRODUCTION || configured === null)) {
    origins.push(self);
  }

  if (!IS_PRODUCTION) {
    origins.push(...DEV_ORIGINS);
  }

  return [...new Set(origins)];
}

/**
 * True when the request may be treated as coming from a trusted origin.
 *
 * Rejected: any Fetch-Metadata `Sec-Fetch-Site` that is not same-origin/same-site, and any
 * Origin/Referer whose origin is not trusted. A state-changing browser request always carries
 * at least one of them, so their joint absence is treated as untrusted.
 */
export function isTrustedOriginRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site') {
    return false;
  }

  const trusted = getTrustedOrigins(request);

  const origin = request.headers.get('origin');
  if (origin) {
    // "null" is what a browser sends for an opaque origin (sandboxed iframe, file://).
    if (origin === 'null') {
      return false;
    }
    const parsed = originOf(origin);
    return parsed !== null && trusted.includes(parsed);
  }

  const referer = request.headers.get('referer');
  if (referer) {
    const parsed = originOf(referer);
    return parsed !== null && trusted.includes(parsed);
  }

  return false;
}

/**
 * Absolute URL to place in an outgoing email (confirmation / recovery links).
 * Falls back to the request's own origin when no site URL is configured, so the link never
 * points at a host taken from a forwarded header.
 */
export function trustedRedirectUrl(request: NextRequest, path: string): string {
  const target = path.startsWith('/') ? path : `/${path}`;
  const configured = SITE_URL ? originOf(SITE_URL) : null;
  if (configured && getTrustedOrigins(request).includes(configured)) {
    return `${configured}${target}`;
  }
  return `${originOf(request.url) ?? configured ?? ''}${target}`;
}

/**
 * Post-authentication destination. Only a relative path on a trusted origin, or a trusted
 * absolute origin, is honoured; anything else falls back to `/`. This is what prevents the
 * login and logout handlers from becoming open redirects.
 */
export function safeRedirect(request: NextRequest, target: string | null | undefined): URL {
  const fallback = new URL('/', request.url);
  if (!target) {
    return fallback;
  }

  const trusted = getTrustedOrigins(request);
  const asAbsolute = target.startsWith('/') && !target.startsWith('//')
    ? `${new URL(request.url).origin}${target}`
    : target;

  const parsed = originOf(asAbsolute);
  if (!parsed || !trusted.includes(parsed)) {
    return fallback;
  }

  try {
    return new URL(asAbsolute);
  } catch {
    return fallback;
  }
}

/**
 * Redirect that establishes or clears a session must never be cached: a stored redirect would
 * serve one user's session cookies to the next requester.
 */
export function sessionRedirect(url: URL | string): NextResponse {
  return NextResponse.redirect(url instanceof URL ? url : new URL(url), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** Response used by the auth handlers when a request fails the origin check. */
export function rejectUntrustedOrigin(): NextResponse {
  return NextResponse.json(
    { error: { code: 'FORBIDDEN_ORIGIN', message: 'Request origin is not trusted.' } },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Read a field from a form-encoded auth request.
 * Returns '' for a missing or non-string value; callers trim what should be trimmed —
 * password fields must not be, since leading/trailing characters are part of the secret.
 */
export function fieldValue(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === 'string' ? value : '';
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export function isWellFormedEmail(value: string): boolean {
  return value.length <= 320 && EMAIL_PATTERN.test(value);
}
