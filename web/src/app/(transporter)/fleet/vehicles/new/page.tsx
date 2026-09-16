'use client';

// NexCargo — Vehicle Registration Form (Transporter)
// Register a new vehicle asset for the authenticated transporter.

import { useState } from 'react';
import { Button } from '@/shared/ui/components/button';
import { Card } from '@/shared/ui/components/card';
import { Input, Select, Textarea } from '@/shared/ui/components/form-controls';
import Link from 'next/link';

const VEHICLE_TYPES = [
  { value: 'HEAVY_TRUCK', label: 'Heavy Truck' },
  { value: 'LIGHT_DELIVERY', label: 'Light Delivery' },
  { value: 'TRAILER', label: 'Trailer' },
  { value: 'REFRIGERATED', label: 'Refrigerated' },
  { value: 'SPECIALISED', label: 'Specialised' },
];

const PERMIT_STATUSES = [
  { value: 'NONE', label: 'None' },
  { value: 'TEMPORARY_OBTAINABLE', label: 'Temporary Obtainable' },
  { value: 'PRE_EXISTING', label: 'Pre-existing' },
];

interface VehicleFormData {
  fleetId: string;
  type: string;
  registrationNumber: string;
  capacityWeightKg: string;
  capacityVolumeM3: string;
  availabilityState: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceValidUntil: string;
  licenceJurisdiction: string;
  licencesValidNationwide: boolean;
  crossBorderPermitStatus: string;
  complianceNotes: string;
}

export default function VehicleRegistrationPage() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState<VehicleFormData>({
    fleetId: '',
    type: '',
    registrationNumber: '',
    capacityWeightKg: '',
    capacityVolumeM3: '',
    availabilityState: 'AVAILABLE',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceValidUntil: '',
    licenceJurisdiction: '',
    licencesValidNationwide: false,
    crossBorderPermitStatus: 'NONE',
    complianceNotes: '',
  });

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleChange(e.target.name, e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/fleet/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          capacityWeightKg: parseFloat(formData.capacityWeightKg),
          capacityVolumeM3: formData.capacityVolumeM3 ? parseFloat(formData.capacityVolumeM3) : null,
          insuranceValidUntil: formData.insuranceValidUntil || null,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setMessage({ type: 'success', text: 'Vehicle registered successfully' });
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Registration failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/transporter/fleet" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Fleet Registry
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Register Vehicle</h1>
      </div>

      {message && (
        <div className={`rounded-lg p-4 ${message.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'}`}>
          {message.text}
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Fleet & Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fleetId" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Fleet ID</label>
              <Input
                id="fleetId"
                name="fleetId"
                value={formData.fleetId}
                onChange={(e) => handleChange('fleetId', e.target.value)}
                placeholder="Enter your fleet ID"
                required
              />
            </div>
            <div>
              <label htmlFor="type" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Vehicle Type</label>
              <Select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleSelectChange}
                required
              >
                <option value="">Select type...</option>
                {VEHICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>
          </div>

          {/* Registration & Capacity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="registrationNumber" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Registration Number</label>
              <Input
                id="registrationNumber"
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={(e) => handleChange('registrationNumber', e.target.value)}
                placeholder="Plate / registration number"
                required
              />
            </div>
            <div>
              <label htmlFor="capacityWeightKg" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Capacity (kg)</label>
              <Input
                id="capacityWeightKg"
                name="capacityWeightKg"
                type="number"
                step="0.01"
                value={formData.capacityWeightKg}
                onChange={(e) => handleChange('capacityWeightKg', e.target.value)}
                placeholder="Max weight in kg"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="capacityVolumeM3" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Volume (m³)</label>
              <Input
                id="capacityVolumeM3"
                name="capacityVolumeM3"
                type="number"
                step="0.01"
                value={formData.capacityVolumeM3}
                onChange={(e) => handleChange('capacityVolumeM3', e.target.value)}
                placeholder="Optional volume"
              />
            </div>
            <div>
              <label htmlFor="availabilityState" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Availability</label>
              <Select
                id="availabilityState"
                name="availabilityState"
                value={formData.availabilityState}
                onChange={handleSelectChange}
              >
                <option value="AVAILABLE">Available</option>
                <option value="INACTIVE">Inactive</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="SUSPENDED">Suspended</option>
              </Select>
            </div>
          </div>

          {/* Insurance */}
          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Insurance Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="insuranceProvider" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Provider</label>
                <Input
                  id="insuranceProvider"
                  name="insuranceProvider"
                  value={formData.insuranceProvider}
                  onChange={(e) => handleChange('insuranceProvider', e.target.value)}
                  placeholder="Insurance provider name"
                />
              </div>
              <div>
                <label htmlFor="insurancePolicyNumber" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Policy Number</label>
                <Input
                  id="insurancePolicyNumber"
                  name="insurancePolicyNumber"
                  value={formData.insurancePolicyNumber}
                  onChange={(e) => handleChange('insurancePolicyNumber', e.target.value)}
                  placeholder="Policy number"
                />
              </div>
              <div>
                <label htmlFor="insuranceValidUntil" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Valid Until</label>
                <Input
                  id="insuranceValidUntil"
                  name="insuranceValidUntil"
                  type="date"
                  value={formData.insuranceValidUntil}
                  onChange={(e) => handleChange('insuranceValidUntil', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Licensing */}
          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Licensing</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="licenceJurisdiction" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Licence Jurisdiction</label>
                <Input
                  id="licenceJurisdiction"
                  name="licenceJurisdiction"
                  value={formData.licenceJurisdiction}
                  onChange={(e) => handleChange('licenceJurisdiction', e.target.value)}
                  placeholder="e.g., Mozambique"
                />
              </div>
              <div>
                <label htmlFor="crossBorderPermitStatus" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cross-Border Permit Status</label>
                <Select
                  id="crossBorderPermitStatus"
                  name="crossBorderPermitStatus"
                  value={formData.crossBorderPermitStatus}
                  onChange={handleSelectChange}
                >
                  {PERMIT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="licencesValidNationwide"
                name="licencesValidNationwide"
                checked={formData.licencesValidNationwide}
                onChange={(e) => handleChange('licencesValidNationwide', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500"
              />
              <label htmlFor="licencesValidNationwide" className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
                Licence valid nationwide (Mozambique section 7.6 rule)
              </label>
            </div>
          </div>

          {/* Compliance Notes */}
          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div>
              <label htmlFor="complianceNotes" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Compliance Notes</label>
              <Textarea
                id="complianceNotes"
                name="complianceNotes"
                value={formData.complianceNotes}
                onChange={(e) => handleChange('complianceNotes', e.target.value)}
                placeholder="Optional notes about vehicle compliance status"
                rows={3}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4">
            <Link href="/transporter/fleet">
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Registering...' : 'Register Vehicle'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
