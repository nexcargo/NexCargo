// NexCargo I-5 §3B — Transporter business profile.
//
// The I-5 §7 inspection found no company/profile table: the operating identity a Transporter publishes lives
// on its fleet rows (logistics_schema.fleets.name / region / operational_status), and the account facts above
// it in the sidebar come from auth.users and app.marketplace_memberships through the session — which is why
// neither is editable here. This screen therefore edits the governed fleet identity through
// PATCH /api/fleet/[fleetId] and reports the capability the register actually holds, derived from the vehicle
// and driver rows. No regulatory certification or verification requirement is invented (§3B).

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { getTransporterContext } from '../../transporter-session';
import { FleetProfileEditor } from '../../profile-form';
import { fleetStatusVariant } from '../../presentation';

export const dynamic = 'force-dynamic';

export default async function TransporterProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const repo = new FleetRepository();
  const [fleets, vehicles, drivers] = await Promise.all([
    repo.listFleets(ctx.userId),
    repo.listVehicles(),
    repo.listDrivers(),
  ]);

  const capability = fleets.map((fleet) => {
    const fleetVehicles = vehicles.filter((vehicle) => vehicle.fleetId === fleet.id);
    const fleetDrivers = drivers.filter((driver) => driver.fleetId === fleet.id);
    return {
      fleet,
      vehiclesTotal: fleetVehicles.length,
      vehiclesAvailable: fleetVehicles.filter((vehicle) => vehicle.availabilityState === 'AVAILABLE').length,
      permitReady: fleetVehicles.filter(
        (vehicle) => vehicle.crossBorderPermitStatus === 'PRE_EXISTING' || vehicle.licencesValidNationwide,
      ).length,
      driversTotal: fleetDrivers.length,
      driversVerified: fleetDrivers.filter((driver) => driver.certificationStatus === 'VERIFIED').length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('profile_title')}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('profile_intro')}</p>
      </div>

      {fleets.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('profile_fleets_heading')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('no_fleet_profile_hint')}</p>
            <Button href={`/${locale}/transporter/fleet`} size="sm" variant="outline">
              {t('transporter_nav_fleet')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4" aria-labelledby="profile-fleets-heading">
          <h2 id="profile-fleets-heading" className="font-display text-lg font-semibold text-[#0A1628] dark:text-white">
            {t('profile_fleets_heading')}
          </h2>
          {capability.map(({ fleet, vehiclesTotal, vehiclesAvailable, permitReady, driversTotal, driversVerified }) => (
            <Card key={fleet.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{t('operating_identity_heading')}</CardTitle>
                <Badge variant={fleetStatusVariant(fleet.operationalStatus)}>
                  {t(`fleet_status_${fleet.operationalStatus}`)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('readiness_vehicles')}</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-[#0A1628] dark:text-white">{vehiclesTotal}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('readiness_vehicles_available')}</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-[#0A1628] dark:text-white">{vehiclesAvailable}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('readiness_permit_ready')}</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-[#0A1628] dark:text-white">{permitReady}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('readiness_drivers')}</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-[#0A1628] dark:text-white">{driversTotal}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('readiness_drivers_verified')}</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-[#0A1628] dark:text-white">{driversVerified}</dd>
                  </div>
                </dl>
                <FleetProfileEditor
                  fleet={{
                    fleetId: fleet.id,
                    name: fleet.name,
                    region: fleet.region ?? '',
                    operationalStatus: fleet.operationalStatus,
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href={`/${locale}/transporter/fleet`}
          className="font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
        >
          {t('fleet_register_link')}
        </Link>
      </p>
    </div>
  );
}
