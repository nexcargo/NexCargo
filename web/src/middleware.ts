import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import createMiddleware from 'next-intl/middleware';

const locales = ['pt', 'en'] as const;
const defaultLocale = 'pt';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export async function middleware(request: NextRequest) {
  // Redirect bare root '/' to default locale ('pt' per ESS-008) only on first visit
  // Once user has locale preference set, let as-needed handle routing naturally
  if (request.nextUrl.pathname === '/') {
    const existingLocale = request.cookies.get('NEXT_LOCALE')?.value;
    if (!existingLocale || !['pt', 'en'].includes(existingLocale)) {
      return NextResponse.redirect(new URL('/pt', request.url));
    }
  }
  await updateSession(request);
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
