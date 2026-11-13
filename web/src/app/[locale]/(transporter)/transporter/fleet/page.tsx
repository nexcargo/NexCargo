// NexCargo I-5 §3C — the Transporter's fleet and vehicle register.
//
// Reads go through the RLS-enforced session client, so the fleets listed are the ones whose `ownerid` is
// this user's id and the vehicles are the ones attached to those fleets (§4: no cross-Transporter access).
// Writes go to the MOD-014 routes, which re-check ownership under the same session; a fleet that is not
// the caller's answers 404 whether or not it exists. Identity-bearing vehicle facts (registration, capacity,
// insurance, licence jurisdiction) are shown read-only because MOD-014 §4.2 gives the Transporter authority
// to *declare* asset statuses, not a governed re-registration path for the rest.

import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { FleetRepository } from '@/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository';
import { getTransporterContext } from '../../transporter-session';
import { FleetRegistrar, VehicleRegistrar, VehicleStatusEditor, type FleetOption } from '../../fleet-manager';
import { fleetStatusVariant, formatWeight, permitStatusVariant, vehicleStateVariant } from '../../presentation';

export const dynamic = 'force-dynamic';

export default async function TransporterFleetPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('TransporterDashboard');
  const ctx = await getTransporterContext();
  if (!ctx) return null;

  const repo = new FleetRepository();
  const [fleets, vehicles] = await Promise.all([repo.listFleets(ctx.userId), repo.listVehicles()]);

  const options: FleetOption[] = fleets.map((fleet) => ({ fleetId: fleet.id, name: fleet.name }));
  const byFleet = new Map<string, typeof vehicles>();
  for (const vehicle of vehicles) {
    const list = byFleet.get(vehicle.fleetId) ?? [];
    list.push(vehicle);
    byFleet.set(vehicle.fleetId, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0A1628] dark:text-white">{t('fleet_title')}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('fleet_intro')}</p>
      </div>

      <FleetRegistrar />

      {fleets.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('fleets_heading')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">{t('no_fleets_hint')}</p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4" aria-labelledby="fleets-heading">
          <h2 id="fleets-heading" className="font-display text-lg font-semibold text-[#0A1628] dark:text-white">
            {t('fleets_heading')}
          </h2>
          {fleets.map((fleet) => {
            const fleetVehicles = byFleet.get(fleet.id) ?? [];
            return (
              <Card key={fleet.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-3">
                    <span>{fleet.name}</span>
                    <Badge variant={fleetStatusVariant(fleet.operationalStatus)}>
                      {t(`fleet_status_${fleet.operationalStatus}`)}
                    </Badge>
                    <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">
                      {fleet.region ?? t('region_unspecified')}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fleetVehicles.length === 0 ? (
                    <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">{t('no_vehicles_in_fleet')}</p>
                  ) : (
                    <ul className="divide-y divide-[#E8E6E3] dark:divide-zinc-800">
                      {fleetVehicles.map((vehicle) => (
                        <li key={vehicle.id} className="space-y-3 py-4 first:pt-0">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-medium text-[#0A1628] dark:text-white">
                              {vehicle.registrationNumber}
                            </span>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                              {t(`vehicle_${vehicle.type}`)}
                            </span>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                              {formatWeight(vehicle.capacityWeightKg, locale)}
                            </span>
                            <Badge variant={vehicleStateVariant(vehicle.availabilityState)}>
                              {t(`vehicle_state_${vehicle.availabilityState}`)}
                            </Badge>
                            <Badge variant={permitStatusVariant(vehicle.crossBorderPermitStatus)}>
                              {t(`permit_${vehicle.crossBorderPermitStatus}`)}
                            </Badge>
                          </div>
                          <VehicleStatusEditor
                            vehicle={{
                              vehicleId: vehicle.id,
                              availabilityState: vehicle.availabilityState,
                              crossBorderPermitStatus: vehicle.crossBorderPermitStatus,
                              complianceNotes: vehicle.complianceNotes ?? '',
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <VehicleRegistrar fleets={options} />
    </div>
  );
}
