// NexCargo — Registration API Route Handler (I-1)
// Creates the auth account and the database-backed marketplace membership for it.
//
// The selected classification is NOT written into user_metadata: metadata is client-writable,
// and a value read back from it would be a self-granted role. app.marketplace_memberships,
// written through the service-role path, is the only record of the classification.

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/infrastructure/database/supabase';
import { IS_PRODUCTION } from '@/lib/env';
import {
  fieldValue,
  isTrustedOriginRequest,
  isWellFormedEmail,
  rejectUntrustedOrigin,
  trustedRedirectUrl,
} from '@/lib/auth/request-guard';

export const dynamic = 'force-dynamic';

/** Public registration may only establish a marketplace classification. */
const SELECTABLE_ROLES: readonly string[] = ['SHIPPER', 'TRANSPORTER'];

// ADMIN, SUPER_ADMIN, MODERATOR and DISPATCHER are platform tiers assigned by an administrator,
// and DRIVER is an operational classification assigned by a Transporter. None is selectable here.
const REJECTED_ROLES: readonly string[] = [
  'ADMIN',
  'SUPER_ADMIN',
  'MODERATOR',
  'DISPATCHER',
  'DRIVER',
];

function toError(request: NextRequest, reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/register?error=${reason}`, request.url));
}

export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) {
    return rejectUntrustedOrigin();
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return toError(request, 'invalid_request');
  }

  const email = fieldValue(form, 'email').trim().toLowerCase();
  const password = fieldValue(form, 'password');
  const confirmPassword = fieldValue(form, 'confirmPassword');
  const role = fieldValue(form, 'role').trim().toUpperCase();

  if (!isWellFormedEmail(email)) {
    return toError(request, 'invalid_email');
  }

  // A short password is still refused here rather than being forwarded to the auth service.
  if (password.length < 8 || password !== confirmPassword) {
    return toError(request, 'password_rejected');
  }

  if (!SELECTABLE_ROLES.includes(role)) {
    return toError(request, REJECTED_ROLES.includes(role) ? 'role_not_selectable' : 'invalid_role');
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: trustedRedirectUrl(request, '/api/auth/callback') },
    });

    const isNewAccount = Boolean(data.user?.identities && data.user.identities.length > 0);

    // Every pre-creation outcome answers identically. GoTrue reports a duplicate address either as
    // an "already registered" error or as a user with no identities, and a provider-side failure
    // (a rejected domain, a failed send, a database abort during the insert) surfaces as its own
    // distinct message. Distinguishing them would let this endpoint confirm whether an address is
    // registered, so none is distinguished here; the message is logged in development only.
    // No branch may write a membership: doing so would let anyone reclassify somebody else's
    // existing account.
    if (!isNewAccount) {
      if (error && !IS_PRODUCTION) {
        console.error('[auth/register] auth service declined the signup:', error.message);
      }
      return NextResponse.redirect(new URL('/register?status=check_email', request.url));
    }

    const userId = data.user!.id;

    try {
      const admin = createAdminClient();
      const { error: membershipError } = await admin.rpc('record_marketplace_membership', {
        p_user_id: userId,
        p_role: role,
      });

      if (membershipError) {
        // Compensate instead of leaving an account that can authenticate but has no authority:
        // the caller can retry, and the retry will create a fresh account.
        await admin.auth.admin.deleteUser(userId);
        return toError(request, 'membership_unavailable');
      }
    } catch {
      // createAdminClient() throws when the service-role key is absent — fail closed.
      return toError(request, 'membership_unavailable');
    }

    if (data.session) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.redirect(new URL('/register?status=check_email', request.url));
  } catch (error) {
    if (!IS_PRODUCTION) console.error('[auth/register] unexpected failure:', (error as Error)?.message ?? error);
    return toError(request, 'registration_failed');
  }
}
