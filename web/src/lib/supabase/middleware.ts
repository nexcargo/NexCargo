import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_OPTIONS } from '@/lib/supabase/server'

/** Narrow the library's cookie attributes down to the ones Next.js ResponseCookies accepts. */
function toResponseCookieAttrs(options: CookieOptions) {
  return {
    path: options.path,
    domain: options.domain,
    secure: options.secure,
    httpOnly: options.httpOnly,
    maxAge: options.maxAge,
    sameSite:
      options.sameSite === 'strict' || options.sameSite === 'lax' || options.sameSite === 'none'
        ? options.sameSite
        : undefined,
  }
}

/**
 * Refresh the Supabase session for an incoming request and write the resulting cookies onto
 * `response` — the response that is actually returned to the browser. Passing a pre-built
 * response is what keeps a refreshed token from being silently discarded.
 *
 * Responses that set auth cookies must not be cacheable, so the headers supplied by
 * @supabase/ssr are copied onto the same response.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse = NextResponse.next({ request })
): Promise<NextResponse> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, toResponseCookieAttrs(options))
          )
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  await supabase.auth.getUser()

  return response
}
