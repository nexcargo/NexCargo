// NexCargo — Register Page
// C6-I Public Web + Authentication Implementation
// Implements registration with role selection per HAO-H-03 directive
// "NexCargo" is the authorised principal brand name (HAO-H-11)
// C6-05: i18n — useTranslations, SkipNav, ErrorBanner, LanguageSwitcher, consistent container

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SkipNav, ErrorBanner } from '@/shared/ui';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const t = useTranslations('Register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!selectedRole) {
      setError(t('select_role_error'));
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t('password_length_error'));
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('password_mismatch'));
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: selectedRole },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!signUpData?.user) {
        setError('Unable to create account. Please try again.');
        return;
      }

      if (signUpData.session) {
        const rolePaths: Record<string, string> = { SHIPPER: '/shipper', TRANSPORTER: '/transporter', DRIVER: '/driver' };
        window.location.href = rolePaths[selectedRole] || '/dispatcher';
      } else {
        setSuccessMessage(t('success_message'));
      }
    } catch {
      setError(t('unexpected_error'));
    } finally {
      setIsLoading(false);
    }
  }

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
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <ErrorBanner message={error} />
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
              <div className="mt-4 text-center">
                <Link href="/sign-in" className="text-sm font-medium text-green-700 underline hover:text-green-900 dark:text-green-300 dark:hover:text-green-100">
                  {t('sign_in_link')} →
                </Link>
              </div>
            </div>
          )}

          {!successMessage && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#0A1628] dark:text-white mb-1">{t('email_label')}</label>
                  <input
                    id="email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('email_placeholder')}
                    className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[#0A1628] placeholder-zinc-500 shadow-sm transition-colors focus:border-[#1A5C9E] focus:outline-none focus:ring-2 focus:ring-[#1A5C9E]/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[#0A1628] dark:text-white mb-1">{t('password_label')}</label>
                  <input
                    id="password" type="password" autoComplete="new-password" required minLength={6}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('password_placeholder')}
                    className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[#0A1628] placeholder-zinc-500 shadow-sm transition-colors focus:border-[#1A5C9E] focus:outline-none focus:ring-2 focus:ring-[#1A5C9E]/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#0A1628] dark:text-white mb-1">{t('confirm_password_label')}</label>
                  <input
                    id="confirmPassword" type="password" autoComplete="new-password" required
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
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
                        className={`relative flex cursor-pointer flex-col rounded-lg border p-4 shadow-sm transition-all ${
                          selectedRole === roleOption.value
                            ? 'border-[#1A5C9E] bg-[#F8F6F3] dark:border-[#1A5C9E] dark:bg-zinc-800'
                            : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <input
                          type="radio" name="role" value={roleOption.value}
                          checked={selectedRole === roleOption.value}
                          onChange={() => setSelectedRole(roleOption.value)}
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
                type="submit" disabled={isLoading}
                className="flex w-full justify-center rounded-full bg-[#1A5C9E] px-6 py-2.5 text-white font-medium transition-colors hover:bg-[#164878] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? t('submitting') : t('submit_button')}
              </button>
            </form>
          )}

          {/* Sign In Link */}
          {!successMessage && (
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              {t('already_have_account')}{' '}
              <Link href="/sign-in" className="font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                {t('sign_in_link')}
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
