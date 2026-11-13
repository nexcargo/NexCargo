// NexCargo — Forgot Password API Route Handler (I-1)
// Requests a recovery link. The response is identical whether or not the address is registered,
// so this endpoint cannot be used to enumerate accounts.

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fieldValue,
  isTrustedOriginRequest,
  isWellFormedEmail,
  rejectUntrustedOrigin,
  trustedRedirectUrl,
} from '@/lib/auth/request-guard';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) {
    return rejectUntrustedOrigin();
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.redirect(new URL('/forgot-password?error=invalid_request', request.url));
  }

  const email = fieldValue(form, 'email').trim().toLowerCase();

  if (!isWellFormedEmail(email)) {
    return NextResponse.redirect(new URL('/forgot-password?error=invalid_email', request.url));
  }

  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: trustedRedirectUrl(request, '/api/auth/callback?type=recovery'),
    });
  } catch {
    // Reported the same way: a transport failure must not look like "this address is unknown".
  }

  return NextResponse.redirect(new URL('/forgot-password?status=email_sent', request.url));
}
