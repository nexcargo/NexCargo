import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { IS_PRODUCTION } from '@/lib/env'

/**
 * Session cookie attributes for the auth cookie set by @supabase/ssr.
 * The library default is httpOnly: false, which would let any script in the page read a
 * refresh token; nothing in this app uses the browser client, so the cookies are HttpOnly.
 * SameSite=Lax keeps the cookie off cross-site POSTs while still allowing top-level navigation.
 * Shared with lib/supabase/middleware.ts so both cookie writers agree.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PRODUCTION,
  maxAge: 400 * 24 * 60 * 60,
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
