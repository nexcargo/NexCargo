// NexCargo — Auth Callback API Route Handler (I-1)
// Target of the email confirmation and password recovery links. It turns the credential carried
// by the link into a server-side session cookie; the browser never has to present a token to any
// other endpoint, and /api/auth/reset-password never accepts one from a client.
//
// Two link shapes are handled because which one the project's mailer produces is a Supabase Auth
// setting this workspace cannot inspect:
//   ?code=...        PKCE exchange (the flowType createServerClient forces)
//   ?token_hash=...  direct token-hash verification, which also works when the link is opened in
//                    a different browser than the one that started the flow

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sessionRedirect } from '@/lib/auth/request-guard';

export const dynamic = 'force-dynamic';

const VERIFICATION_TYPES = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
] as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const tokenHash = params.get('token_hash') ?? params.get('token');
  const type = params.get('type') ?? '';
  const linkError = params.get('error') ?? params.get('error_description');

  if (linkError) {
    return NextResponse.redirect(new URL('/sign-in?error=invalid_link', request.url));
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL('/sign-in?error=invalid_link', request.url));
  }

  try {
    const supabase = await createClient();

    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: (VERIFICATION_TYPES as readonly string[]).includes(type) ? type : 'email',
        });

    if (result.error || !result.data.session) {
      // A stale or already-used link is the common cause. The message stays generic: the reason
      // an email link failed is not something an unrelated visitor should be told.
      return NextResponse.redirect(new URL('/sign-in?error=invalid_link', request.url));
    }

    if (type === 'recovery') {
      return sessionRedirect(new URL('/reset-password', request.url));
    }

    return sessionRedirect(new URL('/', request.url));
  } catch {
    return NextResponse.redirect(new URL('/sign-in?error=invalid_link', request.url));
  }
}
