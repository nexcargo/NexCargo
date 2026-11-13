'use client';

import { useTranslations } from 'next-intl';
import { Button, ErrorBanner } from '@/shared/ui';

export default function TransporterError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations('TransporterDashboard');

  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-bold text-[#0A1628] dark:text-white">{t('error_boundary_title')}</h1>
      <ErrorBanner message={t('error_boundary_desc')} />
      {error.digest && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{error.digest}</p>
      )}
      <Button onClick={retry} variant="outline" size="sm">{t('retry')}</Button>
    </div>
  );
}
