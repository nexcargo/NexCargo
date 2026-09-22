// NexCargo — Reset Password Page (Server Component for Build Compatibility)
// C6-I Public Web + Authentication Implementation
// Handles password reset via token from email link

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SkipNav } from '@/shared/ui';
import { Suspense } from 'react';

export default async function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordForm />} key="reset">
      <ResetPasswordForm />
    </Suspense>
  );
}

async function ResetPasswordForm() {
  const t = await getTranslations('ResetPassword');

  // Parse URL params to check if we're in an error state
  // This component can receive ?error=expired or ?token=xxx query params
  
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F6F3] dark:bg-[#0A1628]">
      <SkipNav />
      <main className="flex flex-1 w-full items-center justify-center px-8 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-display font-bold text-[#0A1628] dark:text-white">NexCargo</h1>
            </Link>
            <h2 className="mt-6 text-2xl font-semibold text-[#0A1628] dark:text-white">{t('title')}</h2>
          </div>

          {/* Form */}
          <form action="/api/auth/reset-password" method="POST" className="space-y-6">
            <div className="space-y-4">
              {/* New Password Field */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-[#0A1628] dark:text-white mb-1">{t('new_password_label')}</label>
                <input
                  id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={6}
                  placeholder={t('new_password_placeholder')}
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[#0A1628] placeholder-zinc-500 shadow-sm transition-colors focus:border-[#1A5C9E] focus:outline-none focus:ring-2 focus:ring-[#1A5C9E]/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                />
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#0A1628] dark:text-white mb-1">{t('confirm_password_label')}</label>
                <input
                  id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required
                  placeholder={t('confirm_password_placeholder')}
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[#0A1628] placeholder-zinc-500 shadow-sm transition-colors focus:border-[#1A5C9E] focus:outline-none focus:ring-2 focus:ring-[#1A5C9E]/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="flex w-full justify-center rounded-full bg-[#1A5C9E] px-6 py-2.5 text-white font-medium transition-colors hover:bg-[#164878]"
            >
              {t('submit_button')}
            </button>
          </form>

          {/* Back to Sign In */}
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/sign-in" className="font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
              {t('back_to_sign_in')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
