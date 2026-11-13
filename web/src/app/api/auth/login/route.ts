// NexCargo — Sign-In API Route Handler (I-1)
// Establishes the Supabase session server-side; the browser never holds the password beyond
// this POST, and no second session mechanism is introduced.

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEffectiveRoles } from '@/lib/auth/role-authority';
import {
  fieldValue,
  isTrustedOriginRequest,
  isWellFormedEmail,
  rejectUntrustedOrigin,
  safeRedirect,
  sessionRedirect,
} from '@/lib/auth/request-guard';

export const dynamic = 'force-dynamic';

// Mirrors the locale set declared in src/middleware.ts; kept here so this handler never
// redirects to a prefix next-intl would rewrite away.
const LOCALES = ['pt', 'en'];
const DEFAULT_LOCALE = 'pt';

function currentLocale(request: NextRequest): string {
  const cookie = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookie && LOCALES.includes(cookie)) return cookie;
  const refererSegment = request.headers.get('referer')?.split('/')[3];
  return refererSegment && LOCALES.includes(refererSegment) ? refererSegment : DEFAULT_LOCALE;
}

export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) {
    return rejectUntrustedOrigin();
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.redirect(new URL('/sign-in?error=invalid_request', request.url));
  }

  const email = fieldValue(form, 'email').trim().toLowerCase();
  const password = fieldValue(form, 'password');

  if (!isWellFormedEmail(email) || password.length === 0) {
    return NextResponse.redirect(new URL('/sign-in?error=invalid_credentials', request.url));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // One message for "no such account" and "wrong password": the endpoint must not
      // become an account-enumeration oracle.
      return NextResponse.redirect(new URL('/sign-in?error=invalid_credentials', request.url));
    }

    // Without an explicit ?next= a marketplace member would land on the locale landing page, which has no
    // dashboard entry point. Only this default is specialised: every other role keeps the pre-existing
    // fallback, and an explicit target always wins. I-5 added the TRANSPORTER half of the same rule, so the
    // role is resolved once for both branches.
    let target = fieldValue(form, 'next') || request.nextUrl.searchParams.get('next');
    if (!target) {
      const { marketplace } = await resolveEffectiveRoles(supabase);
      if (marketplace === 'SHIPPER') {
        target = `/${currentLocale(request)}/shipper/dashboard`;
      } else if (marketplace === 'TRANSPORTER') {
        target = `/${currentLocale(request)}/transporter/dashboard`;
      }
    }
    return sessionRedirect(safeRedirect(request, target));
  } catch {
    return NextResponse.redirect(new URL('/sign-in?error=auth_unavailable', request.url));
  }
}
