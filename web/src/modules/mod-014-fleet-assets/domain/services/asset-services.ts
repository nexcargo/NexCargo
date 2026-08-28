// NexCargo MOD-014 — Asset Validation Services
// Wave 2 — Stage 2B, Increment 3 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)
// Reference: MOD-014 §4 Core Domain Entities validation rules, §7 Rules of Operation

import { ValidationError } from '@/shared/errors/app-errors';
import type { VehicleTypeExtended, FleetOperationalStatus, VehicleRegistrationStatus, DriverCertificationStatus, PermitType, PermitStatus, CrossBorderPermitStatus, BackhaulOpportunityStatus } from '../enums';
import { AssignmentStatus } from '../enums';

// ============================================================
// Constants for validation per MOD-014 specifications
// ============================================================

const MIN_CAPACITY_WEIGHT_KG = 0;
const MAX_CAPACITY_WEIGHT_KG = 500000; // 500 tonnes max
const MIN_CAPACITY_VOLUME_M3 = 0;
const MAX_CAPACITY_VOLUME_M3 = 200; // 200 cubic metres typical trailer max
const MIN_LICENSE_LENGTH = 3;
const MAX_LICENSE_NUMBER_LENGTH = 50;

/** Supported vehicle capacity ranges per MOD-014 §4.2 */
const VEHICLE_CAPACITY_RANGES: Record<string, { minWeight: number; maxWeight: number }> = {
  HEAVY_TRUCK: { minWeight: 10000, maxWeight: 50000 },
  LIGHT_DELIVERY: { minWeight: 500, maxWeight: 5000 },
  TRAILER: { minWeight: 5000, maxWeight: 40000 },
  REFRIGERATED: { minWeight: 1000, maxWeight: 30000 },
  SPECIALISED: { minWeight: 100, maxWeight: 10000 },
};

// ============================================================
// validateFleetRegistration — validates new fleet creation parameters
// Per MOD-014 §4.1: "Fleets must be linked to verified transporter accounts (MOD-010)."
// Per MOD-014 §7.2: "MOD-014 is the single source of truth for declared asset structure."
// ============================================================

export function validateFleetRegistration(input: {
  ownerId: string;
  fleetName: string;
  region: string;
}): void {
  if (!input.ownerId || input.ownerId.trim().length === 0) {
    throw new ValidationError('ownerId is required (must reference a verified transporter account)', { field: 'ownerId' });
  }
  if (!input.fleetName || input.fleetName.trim().length === 0) {
    throw new ValidationError('fleetName is required', { field: 'fleetName' });
  }
  if (!input.region || input.region.trim().length === 0) {
    throw new ValidationError('region is required (primary operating region)', { field: 'region' });
  }
}

// ============================================================
// validateVehicleAsset — validates vehicle registration and compliance fields
// Per MOD-014 §4.2: Each asset uniquely registered with compliance metadata.
// Per MOD-014 §7.5: Non-compliant vehicles restricted from cross-border assignments.
// ============================================================

export function validateVehicleAsset(input: {
  vehicleId: string;
  fleetId: string;
  vehicleType: VehicleTypeExtended;
  registrationNumber: string;
  capacityWeight: number;
  capacityVolume: number;
  registrationStatus: VehicleRegistrationStatus;
  licenceJurisdiction: string;
  licencesValidNationwide: boolean;
  crossBorderPermitStatus: CrossBorderPermitStatus;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.vehicleId || input.vehicleId.trim().length === 0) {
    errors.push('vehicleId is required');
  }
  if (!input.fleetId || input.fleetId.trim().length === 0) {
    errors.push('fleetId is required (each asset must be linked to a fleet)');
  }
  if (!input.vehicleType) {
    errors.push('vehicleType is required');
  }
  if (!input.registrationNumber || input.registrationNumber.trim().length === 0) {
    errors.push('registrationNumber is required');
  }
  if (input.capacityWeight < MIN_CAPACITY_WEIGHT_KG || input.capacityWeight > MAX_CAPACITY_WEIGHT_KG) {
    errors.push(`capacityWeight must be between ${MIN_CAPACITY_WEIGHT_KG} and ${MAX_CAPACITY_WEIGHT_KG} kg`);
  }
  if (input.capacityVolume < MIN_CAPACITY_VOLUME_M3 || input.capacityVolume > MAX_CAPACITY_VOLUME_M3) {
    errors.push(`capacityVolume must be between ${MIN_CAPACITY_VOLUME_M3} and ${MAX_CAPACITY_VOLUME_M3} m³`);
  }
  if (!input.licenceJurisdiction || input.licenceJurisdiction.trim().length === 0) {
    errors.push('licenceJurisdiction is required');
  }

  // Mozambique nationwide licensing rule per §7.6
  if (input.licenceJurisdiction.toLowerCase() === 'mozambique' && !input.licencesValidNationwide) {
    errors.push('Licences issued in Mozambique are valid nationwide (licencesValidNationwide must be true)');
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateDriverRegistration — validates driver identity and certification fields
// Per MOD-014 §4.3: Drivers linked to verified fleet. Eligibility depends on licence/compliance.
// ============================================================

export function validateDriverRegistration(input: {
  fleetId: string;
  firstName: string;
  lastName: string;
  licenseType: string;
  licenseNumber: string;
  licenseExpiryDate: Date;
  certificationStatus: DriverCertificationStatus;
  contactNumber: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.fleetId || input.fleetId.trim().length === 0) {
    errors.push('fleetId is required (drivers must be linked to a verified fleet)');
  }
  if (!input.firstName || input.firstName.trim().length === 0) {
    errors.push('firstName is required');
  }
  if (!input.lastName || input.lastName.trim().length === 0) {
    errors.push('lastName is required');
  }
  if (!input.licenseType || input.licenseType.trim().length === 0) {
    errors.push('licenseType is required');
  }
  if (!input.licenseNumber || input.licenseNumber.trim().length === 0) {
    errors.push('licenseNumber is required');
  }
  if (input.licenseNumber.length < MIN_LICENSE_LENGTH || input.licenseNumber.length > MAX_LICENSE_NUMBER_LENGTH) {
    errors.push(`licenseNumber must be between ${MIN_LICENSE_LENGTH} and ${MAX_LICENSE_NUMBER_LENGTH} characters`);
  }
  if (!(input.licenseExpiryDate instanceof Date) || isNaN(input.licenseExpiryDate.getTime())) {
    errors.push('licenseExpiryDate must be a valid date');
  }
  if (!input.contactNumber || input.contactNumber.trim().length === 0) {
    errors.push('contactNumber is required');
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// assertNoDoubleBookingForAssignment — enforces double-booking prevention
// Per MOD-014 §7.3: "No double-booking of vehicles or drivers is permitted."
// ============================================================

export function assertNoDoubleBookingForAssignment(input: {
  existingAssignments: Array<{
    vehicleId: string;
    driverId: string;
    status: AssignmentStatus;
  }>;
  proposedVehicleId: string;
  proposedDriverId: string;
}): { isValid: boolean; errors: string[] } {
  const activeOrPlanned = [AssignmentStatus.ACTIVE, AssignmentStatus.PLANNED];
  const errors: string[] = [];

  const vehicleConflict = input.existingAssignments.find(
    a => a.vehicleId === input.proposedVehicleId && activeOrPlanned.includes(a.status),
  );
  if (vehicleConflict) {
    errors.push(`Vehicle ${input.proposedVehicleId} already has an ${vehicleConflict.status} assignment`);
  }

  const driverConflict = input.existingAssignments.find(
    a => a.driverId === input.proposedDriverId && activeOrPlanned.includes(a.status),
  );
  if (driverConflict) {
    errors.push(`Driver ${input.proposedDriverId} already has an ${driverConflict.status} assignment`);
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateCrossBorderCompliance — validates cross-border permit declarations
// Per MOD-014 §4.5: Vehicles meet country-specific regulatory requirements.
// D-S2B-002: corridorId:string remains provisional assumption.
// ============================================================

export function validateCrossBorderCompliance(input: {
  vehicleId: string;
  corridorId: string;
  countryCode: string;
  permitType: PermitType;
  permitNumber: string;
  expiryDate: Date;
  permitStatus: PermitStatus;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.vehicleId || input.vehicleId.trim().length === 0) {
    errors.push('vehicleId is required');
  }
  if (!input.corridorId || input.corridorId.trim().length === 0) {
    errors.push('corridorId is required (design-time string reference to MOD-009 corridors per D-S2B-002)');
  }
  if (!input.countryCode || input.countryCode.trim().length === 0) {
    errors.push('countryCode is required');
  }
  if (!input.permitType) {
    errors.push('permitType is required');
  }
  if (!input.permitNumber || input.permitNumber.trim().length === 0) {
    errors.push('permitNumber is required');
  }
  if (!(input.expiryDate instanceof Date) || isNaN(input.expiryDate.getTime())) {
    errors.push('expiryDate must be a valid date');
  }
  if (!input.permitStatus) {
    errors.push('permitStatus is required');
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================
// validateBackhaulOpportunity — validates backhaul optimisation data
// Per MOD-014 §4.6: AI suggests return loads based on route matching (MOD-006).
// ============================================================

export function validateBackhaulOpportunity(input: {
  shipmentId: string;
  vehicleId: string;
  currentLocation: string;
  destination: string;
  estimatedCostRecovery: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.shipmentId || input.shipmentId.trim().length === 0) {
    errors.push('shipmentId is required');
  }
  if (!input.vehicleId || input.vehicleId.trim().length === 0) {
    errors.push('vehicleId is required');
  }
  if (!input.currentLocation || input.currentLocation.trim().length === 0) {
    errors.push('currentLocation is required');
  }
  if (!input.destination || input.destination.trim().length === 0) {
    errors.push('destination is required');
  }
  if (input.estimatedCostRecovery < 0 || input.estimatedCostRecovery > 100) {
    errors.push('estimatedCostRecovery must be between 0 and 100 percent');
  }

  return { isValid: errors.length === 0, errors };
}
