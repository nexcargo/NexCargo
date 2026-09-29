'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import type { LinkProps } from 'next/link';

const AUTH_ROUTES = ['/', '/sign-in', '/register', '/forgot-password', '/reset-password'];

export function LocaleAwareLink({ href, ...rest }: LinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const pathname = usePathname();

  const computedHref = React.useMemo(() => {
    // Check if the target path needs locale prefixing
    const normalizedTarget = href.replace(/\/$/, '');
    if (!AUTH_ROUTES.includes(normalizedTarget)) return href;

    // Already prefixed? Don't double-prefix
    if (normalizedTarget.startsWith('/pt/') || normalizedTarget.startsWith('/en/')) return href;
    if (normalizedTarget === '/pt' || normalizedTarget === '/en') return href;

    // Extract locale from current pathname
    // Current pathname looks like /pt or /en or /pt/... or /en/...
    const firstSegment = pathname.split('/')[1];
    if (firstSegment && ['pt', 'en'].includes(firstSegment)) {
      return `/${firstSegment}${normalizedTarget}`;
    }

    return href;
  }, [href, pathname]);

  return <Link href={computedHref} {...rest} />;
}
