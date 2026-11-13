// NexCargo I-5 §3D — the Transporter's driver register.
//
// Drivers are read through the session client, so only rows whose fleet belongs to this Transporter come
// back. A Driver here is an entry in the fleet register, not a marketplace member: the screen states that
// plainly and shows whether the row has been linked to a platform account (drivers.platform_user_id), which
// the I-2 operational delegation machinery sets — never this form. There is no driver login, no driver app
// and no public self-registration path here.

import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { getTransporterContext } from '../../transporter-session';
import { DriverRegistrar, DriverStatusEditor } from '../../driver-manager';
import type { FleetOption } from '../../fleet-manager';
import { driverAvailabilityVariant, driverCertificationVariant, formatDate } from '../../presentation';

export const dynamic = 'force-dynamic';

export default async function TransporterDriversPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const repo = new FleetRepository();
  const [fleets, drivers] = await Promise.all([repo.listFleets(ctx.userId), repo.listDrivers()]);

  const options: FleetOption[] = fleets.map((fleet) => ({ fleetId: fleet.id, name: fleet.name }));
  const names = new Map(fleets.map((fleet) => [fleet.id, fleet.name]));
  const byFleet = new Map<string, typeof drivers>();
  for (const driver of drivers) {
    const list = byFleet.get(driver.fleetId) ?? [];
    list.push(driver);
    byFleet.set(driver.fleetId, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('drivers_title')}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('drivers_intro')}</p>
      </div>

      <DriverRegistrar fleets={options} />

      {drivers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('drivers_heading')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">{t('no_drivers_hint')}</p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4" aria-labelledby="drivers-heading">
          <h2 id="drivers-heading" className="font-display text-lg font-semibold text-[#0A1628] dark:text-white">
            {t('drivers_heading')}
          </h2>
          {[...byFleet.entries()].map(([fleetId, fleetDrivers]) => (
            <Card key={fleetId}>
              <CardHeader>
                <CardTitle>{names.get(fleetId) ?? t('summary_none')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                  {fleetDrivers.map((driver) => (
                    <li key={driver.id} className="space-y-3 py-4 first:pt-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-medium text-[#0A1628] dark:text-white">
                          {driver.firstName} {driver.lastName}
                        </span>
                        <Badge variant={driverCertificationVariant(driver.certificationStatus)}>
                          {t(`driver_cert_${driver.certificationStatus}`)}
                        </Badge>
                        <Badge variant={driverAvailabilityVariant(driver.availabilityState)}>
                          {t(`driver_state_${driver.availabilityState}`)}
                        </Badge>
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {t(driver.platformUserId ? 'account_linked' : 'account_unlinked')}
                        </span>
                        {driver.licenseExpiryDate && (
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {t('licence_expires', { date: formatDate(driver.licenseExpiryDate, locale) })}
                          </span>
                        )}
                      </div>
                      <DriverStatusEditor
                        driver={{
                          driverId: driver.id,
                          certificationStatus: driver.certificationStatus,
                          availabilityState: driver.availabilityState,
                          licenseExpiryDate: driver.licenseExpiryDate,
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
