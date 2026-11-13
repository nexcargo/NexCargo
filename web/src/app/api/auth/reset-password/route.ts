// NexCargo — Reset Password API Route Handler (I-1)
// Operates on the recovery session established by /api/auth/callback. It deliberately has no
// token parameter: a client-supplied reset token would be a credential we cannot validate, and
// the session cookie already proves the link was followed.

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fieldValue,
  isTrustedOriginRequest,
  rejectUntrustedOrigin,
  sessionRedirect,
} from '@/lib/auth/request-guard';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) {
    return rejectUntrustedOrigin();
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.redirect(new URL('/reset-password?error=invalid_request', request.url));
  }

  const password = fieldValue(form, 'newPassword');
  const confirmPassword = fieldValue(form, 'confirmPassword');

  if (password.length < 8 || password !== confirmPassword) {
    return NextResponse.redirect(new URL('/reset-password?error=password_rejected', request.url));
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // No session means the recovery link was never exchanged. Nothing is changed, and the
      // user is sent back to the flow that can create one.
      return NextResponse.redirect(new URL('/sign-in?error=recovery_required', request.url));
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return NextResponse.redirect(new URL('/reset-password?error=update_failed', request.url));
    }

    // The password is changed, not a login: the user returns to sign in with the new one.
    return sessionRedirect(new URL('/sign-in?status=password_updated', request.url));
  } catch {
    return NextResponse.redirect(new URL('/reset-password?error=update_failed', request.url));
  }
}
