// NexCargo — Register Page (Server Component for Build Compatibility)
// C6-I Public Web + Authentication Implementation
// Implements registration with role selection per HAO-H-03 directive

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SkipNav } from '@/shared/ui';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const t = await getTranslations('Register');

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F6F3] dark:bg-[#0A1628]">
      <SkipNav />
      <main className="flex flex-1 w-full items-center justify-center px-8 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="mb-8 text-3xl font-display font-bold text-[#0A1628] dark:text-white">NexCargo</h1>
            <h2 className="mt-6 text-2xl font-semibold text-[#0A1628] dark:text-white">{t('title')}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
          </div>

          {/* Form */}
          <form action="/api/auth/register" method="POST" className="space-y-6">
            <div className="space-y-4">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#0A1628] dark:text-white mb-1">{t('email_label')}</label>
                <input
                  id="email" name="email" type="email" autoComplete="email" required
                  placeholder={t('email_placeholder')}
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[#0A1628] placeholder-zinc-500 shadow-sm transition-colors focus:border-[#1A5C9E] focus:outline-none focus:ring-2 focus:ring-[#1A5C9E]/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#0A1628] dark:text-white mb-1">{t('password_label')}</label>
                <input
                  id="password" name="password" type="password" autoComplete="new-password" required minLength={6}
                  placeholder={t('password_placeholder')}
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

              {/* Role Selection */}
              <div>
                <span className="block text-sm font-medium text-[#0A1628] dark:text-white mb-2">{t('role_selection_title')}</span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { value: 'SHIPPER', labelKey: 'shipper_option', descKey: 'shipper_description' },
                    { value: 'TRANSPORTER', labelKey: 'transporter_option', descKey: 'transporter_description' },
                    { value: 'DRIVER', labelKey: 'driver_option', descKey: 'driver_description' },
                  ].map((roleOption) => (
                    <label
                      key={roleOption.value}
                      className="relative flex cursor-pointer flex-col rounded-lg border border-zinc-300 p-4 shadow-sm transition-all hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      <input
                        type="radio" name="role" value={roleOption.value} required
                        className="sr-only"
                      />
                      <span className="flex flex-1 flex-col">
                        <span className="text-sm font-medium text-[#0A1628] dark:text-white">
                          {t(roleOption.labelKey)}
                        </span>
                        <span className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                          {t(roleOption.descKey)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
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

          {/* Sign In Link */}
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            {t('already_have_account')}{' '}
            <Link href="/sign-in" className="font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
              {t('sign_in_link')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
