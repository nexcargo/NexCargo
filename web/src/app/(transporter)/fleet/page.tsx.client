'use client';

// NexCargo — Fleet Registry (Transporter)
// Displays fleet summary, vehicles, and drivers in a unified view.
// C6-04: i18n — useTranslations for all user-facing strings

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/shared/ui/components/card';
import { Badge } from '@/shared/ui/components/badge';
import { Button, Spinner, ErrorBanner } from '@/shared/ui';
import Link from 'next/link';

interface FleetSummary {
  id: string;
  fleetId: string;
  name: string;
  region: string | null;
  operationalStatus: string;
}

interface VehicleSummary {
  id: string;
  vehicleId: string;
  type: string;
  registrationNumber: string;
  availabilityState: string;
  capacityWeightKg: number;
}

interface DriverSummary {
  id: string;
  driverId: string;
  firstName: string;
  lastName: string;
  certificationStatus: string;
  availabilityState: string;
  licenseNumber: string | null;
}

export default function FleetRegistryPage() {
  const t = useTranslations('FleetRegistry');
  const [loading, setLoading] = useState(true);
  const [fleets, setFleets] = useState<FleetSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [activeTab, setActiveTab] = useState<'fleets' | 'vehicles' | 'drivers'>('fleets');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/fleet?entity=fleets&limit=10'),
      fetch('/api/fleet?entity=vehicles&limit=50'),
      fetch('/api/fleet?entity=drivers&limit=50'),
    ])
      .then(async ([fleetRes, vehicleRes, driverRes]) => {
        setFleets((await fleetRes.json()).data || []);
        setVehicles((await vehicleRes.json()).data || []);
        setDrivers((await driverRes.json()).data || []);
        setLoading(false);
      })
      .catch(() => {
        setError(t('error_message'));
        setLoading(false);
      });
  }, [t]);

  const getStatusVariant = (status: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'default' => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'AVAILABLE': return 'info';
      case 'VERIFIED': return 'success';
      case 'ASSIGNED': return 'warning';
      case 'PENDING': return 'warning';
      case 'INACTIVE': return 'neutral';
      case 'SUSPENDED': return 'danger';
      case 'EXPIRED': return 'danger';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="mr-3 h-5 w-5" />
        <span className="text-muted-foreground">{t('loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <ErrorBanner message={error} onRetry={() => window.location.reload()} />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <Link href="/transporter/fleet/vehicles/new">
          <Button variant="primary">{t('register_vehicle')}</Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        {[
          { key: 'fleets' as const, labelKey: 'fleets_tab' },
          { key: 'vehicles' as const, labelKey: 'vehicles_tab' },
          { key: 'drivers' as const, labelKey: 'drivers_tab' },
        ].map(({ key, labelKey }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(labelKey)}
            <span className="ml-1 text-xs opacity-60">
              ({key === 'fleets' ? fleets.length : key === 'vehicles' ? vehicles.length : drivers.length})
            </span>
          </button>
        ))}
      </div>

      {/* Fleets Tab */}
      {activeTab === 'fleets' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fleets.map((fleet) => (
            <Card key={fleet.id}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{fleet.name}</h3>
                  <Badge variant={getStatusVariant(fleet.operationalStatus)}>
                    {fleet.operationalStatus}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">ID: {fleet.fleetId}</p>
                {fleet.region && <p className="text-sm text-muted-foreground">Region: {fleet.region}</p>}
              </div>
            </Card>
          ))}
          {fleets.length === 0 && (
            <div className="col-span-full flex flex-col items-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">{t('no_fleets')}</p>
              <p className="mt-1 text-sm">{t('register_first_fleet')}</p>
            </div>
          )}
        </div>
      )}

      {/* Vehicles Tab */}
      {activeTab === 'vehicles' && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Vehicle ID</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Registration</th>
                <th className="px-4 py-3 font-medium">Capacity (kg)</th>
                <th className="px-4 py-3 font-medium">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-mono text-xs">{v.vehicleId}</td>
                  <td className="px-4 py-3">{v.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 font-mono text-xs">{v.registrationNumber}</td>
                  <td className="px-4 py-3">{Number(v.capacityWeightKg).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(v.availabilityState)}>
                      {v.availabilityState}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vehicles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <p className="font-medium">{t('no_vehicles')}</p>
            </div>
          )}
        </div>
      )}

      {/* Drivers Tab */}
      {activeTab === 'drivers' && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Driver ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">License</th>
                <th className="px-4 py-3 font-medium">Certification</th>
                <th className="px-4 py-3 font-medium">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {drivers.map((d) => (
                <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-mono text-xs">{d.driverId}</td>
                  <td className="px-4 py-3">{d.firstName} {d.lastName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.licenseNumber ?? '\u2014'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(d.certificationStatus)}>
                      {d.certificationStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(d.availabilityState)}>
                      {d.availabilityState}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {drivers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <p className="font-medium">{t('no_drivers')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
