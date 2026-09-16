// NexCargo — Driver Home Page
// C7-001 Phase 2 — Tracking UI / Driver Experience
// C6-04: i18n — useTranslations for all user-facing strings
'use client';

import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/ui/components/card';

export default function DriverHomePage() {
  const t = useTranslations('DriverHome');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('subtitle')}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Active Shipments card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('active_shipments_card')}</CardTitle>
            <CardDescription>{t('active_shipments_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('active_shipments_empty')}
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('quick_actions_card')}</CardTitle>
            <CardDescription>{t('quick_actions_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('quick_actions_empty')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

