// NexCargo — Sign-Out API Route Handler
// C6-II Authentication Infrastructure
// Implements session termination per PROMPT 7 auth boundaries
//
// I-1 §4.4: a failed sign-out is reported as failed. The handler no longer redirects to the
// landing page as though the session had ended, and its destination is always the local root —
// it does not read a caller-supplied redirect target, so it cannot become an open redirect.

import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isTrustedOriginRequest, rejectUntrustedOrigin, sessionRedirect } from '@/lib/auth/request-guard';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) {
    return rejectUntrustedOrigin();
  }

  let signOutFailed = false;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      signOutFailed = true;
    }
  } catch {
    signOutFailed = true;
  }

  const destination = new URL('/', request.url);

  if (signOutFailed) {
    destination.searchParams.set('error', 'signout_failed');
  }

  return sessionRedirect(destination);
}
