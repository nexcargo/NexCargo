'use client';

import Link from 'next/link';
import { useState } from 'react';
import { NexCargoLogo } from '../nex-cargo-logo';
import { NexCargoSymbol } from '../nex-cargo-symbol';
import { LanguageSwitcher } from '../language-switcher';
import { useTranslations } from 'next-intl';

interface PublicHeaderProps {
  locale: string;
}

export function PublicHeader({ locale }: PublicHeaderProps) {
  const t = useTranslations('Navigation');
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: `/${locale}/`, label: t('public') },
    { href: `/${locale}/sign-in`, label: t('sign_in') },
    { href: `/${locale}/register`, label: t('register') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E8E6E3] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-[#0A1628]/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Desktop: wordmark logo */}
          <div className="hidden md:flex">
            <NexCargoLogo href={`/${locale}`} variant="default" />
          </div>

          {/* Mobile: symbol logo */}
          <div className="md:hidden">
            <NexCargoSymbol href={`/${locale}`} />
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6" aria-label={t('public')}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[#2D2A27] hover:text-[#1A5C9E] transition-colors dark:text-zinc-300 dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <LanguageSwitcher initialLocale={locale} />
          </nav>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-expanded={mobileOpen}
            aria-label={t('public')}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#E8E6E3] dark:border-zinc-800 bg-white dark:bg-[#0A1628]">
          <nav className="flex flex-col px-4 py-3 space-y-1" aria-label={t('public')}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium px-3 py-2 rounded-md text-[#2D2A27] hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {link.label}
              </Link>
            ))}
            <div className="px-3 py-2">
              <LanguageSwitcher initialLocale={locale} />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
