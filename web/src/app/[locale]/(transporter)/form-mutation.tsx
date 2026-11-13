// NexCargo I-5 §3C/§3D/§10(18) — the busy/error/success behaviour the Transporter write forms share.
// One implementation on purpose: a mutation is in flight, the server's governed reason surfaces verbatim if it
// failed, and on success the Server Component re-reads the rows so what is on screen is the stored state, not
// an optimistic copy of it.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorBanner } from '@/shared/ui';

export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, successText: string, reset?: () => void) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await action();
      setDone(successText);
      reset?.();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, done, run };
}

export function Outcome({ error, done }: { error: string | null; done: string | null }) {
  return (
    <>
      {error && <ErrorBanner message={error} />}
      {done && <p role="status" className="text-sm text-[#0F8B7A] dark:text-teal-400">{done}</p>}
    </>
  );
}

export const labelClass = 'block text-sm font-medium text-[#0A1628] dark:text-white mb-1';
export const inputClass = 'block w-full';
