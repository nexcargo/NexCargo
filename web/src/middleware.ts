import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import createMiddleware from 'next-intl/middleware';

const locales = ['pt', 'en'] as const;
const defaultLocale = 'pt';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export async function middleware(request: NextRequest) {
  // API routes are not locale-prefixed. Running next-intl over them would redirect
  // POST /api/... to /pt/api/... and lose the request body, so they bypass it.
  const response = request.nextUrl.pathname.startsWith('/api/')
    ? NextResponse.next({ request })
    : intlMiddleware(request);

  // Session refresh has to write onto the response that is actually returned.
  return updateSession(request, response);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
