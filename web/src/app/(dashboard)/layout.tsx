// NexCargo — Authenticated Shell Layout
// C6-II + C6-III Authenticated Application Shell
// Implements SIDEBAR + TOPBAR per ESS-008 §3.3
// Role-aware navigation per MOD-007 §6.3 RBAC rules
// C6-III: Shipper-specific nav items when role === SHIPPER
// C6-02: Added SkipNav (ESS-008 §13 keyboard access), LanguageSwitcher (ESS-008 §17.2), page container width
// C6-03: Mobile hamburger menu via AuthNav client component
// C6-04: i18n — useTranslations for shell labels
// Dynamic rendering: session-dependent content cannot be statically generated

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button, Badge, LanguageSwitcher, SkipNav } from '@/shared/ui';
import type { ReactNode } from 'react';
import { getUserRoleFromSession } from './user-session';
import { AuthNav } from './auth-nav';

export const dynamic = 'force-dynamic';

export default async function DashboardShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <p className="text-lg mb-4">Please sign in to continue.</p>
        <Link href="/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  const role = await getUserRoleFromSession(user);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6F3] dark:bg-[#0A1628]">
      <SkipNav />

      {/* Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-[#E8E6E3] bg-white dark:border-zinc-800 dark:bg-[#0A1628]">
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg shrink-0 text-[#0A1628] dark:text-white">
            NexCargo
          </Link>
          <span className="ml-auto flex items-center gap-2">
            {role && (
              <Badge variant="info" size="sm">{role}</Badge>
            )}
            <LanguageSwitcher initialLocale="pt" />
            <LogoutButton />
          </span>
          {/* Email hidden on mobile to save space */}
          <span className="text-sm text-zinc-600 dark:text-zinc-400 hidden md:inline-block">
            {user.email}
          </span>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar Navigation — role-aware */}
        <AuthNav role={role} />

        {/* Main Content Area */}
        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        aria-label="Sign out"
      >
        Sign Out
      </button>
    </form>
  );
}
