// NexCargo — Sign-Out API Route Handler
// C6-II Authentication Infrastructure
// Implements session termination per PROMPT 7 auth boundaries

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Sign out from Supabase Auth
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Sign-out error:', error.message);
    }

    // Redirect to landing page
    return NextResponse.redirect(new URL('/', request.url));
  } catch (err) {
    console.error('Unexpected sign-out error:', err);
    // Still redirect on error — don't leave user stuck
    return NextResponse.redirect(new URL('/', request.url));
  }
}
