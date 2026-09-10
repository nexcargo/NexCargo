// NexCargo — Register Page
// C6-I Public Web + Authentication Implementation
// Implements registration with role selection per HAO-H-03 directive
// "NexCargo" is the authorised principal brand name (HAO-H-11)
// Role selection: SHIPPER / TRANSPORTER / DRIVER are application roles for new users

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const USER_ROLES = [
  { value: 'SHIPPER', label: 'Shipper', description: 'I have cargo to transport' },
  { value: 'TRANSPORTER', label: 'Transporter', description: 'I transport cargo' },
  { value: 'DRIVER', label: 'Driver', description: 'I drive vehicles' },
];

export default function RegisterPage() {
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
      setError('Please select a role to continue.');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // Sign up user via Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: selectedRole,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // Check if user already exists with same email
      if (!signUpData?.user) {
        setError('Unable to create account. Please try again.');
        return;
      }

      // If the user's email domain matches a trusted carrier domain, we can skip email confirmation
      // For now, inform the user about email verification
      if (signUpData.session) {
        // User is confirmed (typically happens when disable_confirm_email is true in Supabase)
        const rolePaths: Record<string, string> = { SHIPPER: '/shipper', TRANSPORTER: '/transporter', DRIVER: '/driver' };
        window.location.href = rolePaths[selectedRole] || '/dashboard';
      } else {
        setSuccessMessage(
          'Account created successfully! Please check your email to confirm your address before signing in.'
        );
      }
    } catch (err: unknown) {
      setError('An unexpected error occurred. Please try again later.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full items-center justify-center px-8 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold text-foreground dark:text-white">
                NexCargo
              </h1>
            </Link>
            <h2 className="mt-6 text-2xl font-semibold text-foreground dark:text-white">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground dark:text-zinc-400">
              Join the logistics marketplace
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
              <div className="mt-4 text-center">
                <Link
                  href="/auth/sign-in"
                  className="text-sm font-medium text-green-700 underline hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
                >
                  Go to Sign In →
                </Link>
              </div>
            </div>
          )}

          {!successMessage && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                {/* Email Field */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground dark:text-white mb-1"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-foreground placeholder-zinc-500 shadow-sm transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground dark:text-white mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-foreground placeholder-zinc-500 shadow-sm transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-foreground dark:text-white mb-1"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-foreground placeholder-zinc-500 shadow-sm transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                {/* Role Selection Fields */}
                <div>
                  <span className="block text-sm font-medium text-foreground dark:text-white mb-2">
                    What best describes your business?
                  </span>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {USER_ROLES.map((roleOption) => (
                      <label
                        key={roleOption.value}
                        className={`relative flex cursor-pointer flex-col rounded-lg border p-4 shadow-sm transition-all ${
                          selectedRole === roleOption.value
                            ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                            : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={roleOption.value}
                          checked={selectedRole === roleOption.value}
                          onChange={() => setSelectedRole(roleOption.value)}
                          className="sr-only"
                        />
                        <span className="flex flex-1 flex-col">
                          <span className="text-sm font-medium text-foreground dark:text-white">
                            {roleOption.label}
                          </span>
                          <span className="mt-1 text-xs text-muted-foreground dark:text-zinc-400">
                            {roleOption.description}
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
                disabled={isLoading}
                className="flex w-full justify-center rounded-full bg-foreground px-6 py-2.5 text-background font-medium transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-300 dark:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          )}

          {/* Sign In Link */}
          {!successMessage && (
            <p className="text-center text-sm text-muted-foreground dark:text-zinc-400">
              Already have an account?{' '}
              <Link
                href="/auth/sign-in"
                className="font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              >
                Sign in here
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
