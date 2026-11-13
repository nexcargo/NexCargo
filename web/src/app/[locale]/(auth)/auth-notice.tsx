// NexCargo — Auth outcome banner
// Renders the code returned by the /api/auth handlers as a visible outcome. Every auth form is a
// plain HTML form POST, so without this a rejected sign-in or a failed registration would look
// exactly like a successful one.

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'We could not sign you in. Check your email address and password.',
  invalid_request: 'That request could not be read. Please try again.',
  invalid_link: 'That link is not valid, or has already been used.',
  auth_unavailable: 'Sign-in is temporarily unavailable. Please try again shortly.',
  recovery_required: 'Start password recovery again before setting a new password.',
  password_updated: 'Your password has been updated. Sign in with the new one.',
  invalid_email: 'Enter a valid email address.',
  password_rejected: 'Passwords must match and be at least 8 characters.',
  role_not_selectable: 'That account type cannot be created by registration.',
  invalid_role: 'Choose either Shipper or Transporter.',
  registration_failed: 'Registration could not be completed. Please try again.',
  membership_unavailable: 'Registration could not be completed. Please try again.',
  email_sent: 'If an account exists for that address, a recovery link is on its way.',
  check_email: 'Confirm your email address to finish creating the account.',
  update_failed: 'The password could not be changed. Please try again.',
  signout_failed: 'You were not signed out. Please try again.',
  untrusted_origin: 'That request did not come from this site.',
};

export function AuthNotice({ code, kind }: { code?: string | null; kind: 'error' | 'status' }) {
  const text = code ? MESSAGES[code] : undefined;
  if (!text) {
    return null;
  }

  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={
        kind === 'error'
          ? 'rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
          : 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
      }
    >
      {text}
    </p>
  );
}
