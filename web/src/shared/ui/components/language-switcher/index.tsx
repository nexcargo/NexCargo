// NexCargo — LanguageSwitcher Component
// Switches locale by navigating between /{locale}/ routes (not cookie-only).
// Works reliably with next-intl createMiddleware + localePrefix:'always'.

'use client';

import { useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '../../utils';

const LOCALES = [
  { code: 'pt', label: 'Portugu\u00eas' },
  { code: 'en', label: 'English' },
];

export interface LanguageSwitcherProps {
  initialLocale?: string;
}

export function LanguageSwitcher({
  initialLocale = 'pt',
}: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Determine current locale from pathname segments
  const currentLocale = (() => {
    if (!pathname) return initialLocale;
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0 && ['pt', 'en'].includes(parts[0])) {
      return parts[0];
    }
    return initialLocale;
  })();

  const handleSwitch = useCallback((locale: string) => {
    setOpen(false);
    if (!pathname) return;

    // Replace the locale segment in the current path
    const parts = pathname.split('/').filter(Boolean);
    let newPathParts: string[];
    if (parts.length > 0 && ['pt', 'en'].includes(parts[0])) {
      newPathParts = [locale, ...parts.slice(1)];
    } else {
      newPathParts = [locale, ...parts];
    }
    const newUrl = '/' + newPathParts.join('/');
    router.replace(newUrl);
  }, [pathname, router]);

  const activeLabel = LOCALES.find((l) => l.code === currentLocale)?.label || 'PT';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1 rounded-md px-2 py-1 text-sm',
          'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
          'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          'transition-colors'
        )}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Language: ${activeLabel}. Click to change language.`}
      >
        {/* Globe icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
        </svg>
        <span className="hidden sm:inline">{activeLabel}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className={cn(
              'absolute right-0 z-50 mt-1 w-36 rounded-lg border border-zinc-200 bg-white shadow-lg',
              'dark:border-zinc-700 dark:bg-zinc-900',
              'py-1'
            )}
          >
            {LOCALES.map((locale) => (
              <button
                key={locale.code}
                type="button"
                role="menuitem"
                onClick={() => handleSwitch(locale.code)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  locale.code === currentLocale
                    ? 'bg-zinc-50 font-medium text-foreground dark:bg-zinc-800'
                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
                )}
              >
                {locale.code === currentLocale && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-foreground dark:text-white"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                <span>{locale.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
