// NexCargo MOD-014 — Asset Validation Services Tests
// Wave 2 — Stage 2B, Increment 3 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)

import { describe, it, expect } from 'vitest';
import { validateFleetRegistration, validateVehicleAsset, validateDriverRegistration, assertNoDoubleBookingForAssignment, validateCrossBorderCompliance, validateBackhaulOpportunity } from '../domain/services/asset-services';
import { FleetOperationalStatus, VehicleRegistrationStatus, DriverCertificationStatus, CrossBorderPermitStatus, PermitType, PermitStatus, AssignmentStatus, BackhaulOpportunityStatus } from '../domain/enums';

describe('MOD-014 Fleet Registration Validation', () => {
  it('accepts valid fleet registration', () => {
    expect(() => validateFleetRegistration({
      ownerId: 'transporter-001',
      fleetName: 'TransZambezi Fleet',
      region: 'MZ-SA Corridor',
    })).not.toThrow();
  });

  it('rejects empty ownerId', () => {
    expect(() => validateFleetRegistration({
      ownerId: '',
      fleetName: 'Test Fleet',
      region: 'MZ',
    })).toThrow(/ownerId is required/);
  });

  it('rejects empty fleetName', () => {
    expect(() => validateFleetRegistration({
      ownerId: 'transporter-001',
      fleetName: '',
      region: 'MZ',
    })).toThrow(/fleetName is required/);
  });

  it('rejects empty region', () => {
    expect(() => validateFleetRegistration({
      ownerId: 'transporter-001',
      fleetName: 'Test Fleet',
      region: '',
    })).toThrow(/region is required/);
  });
});

describe('MOD-014 Vehicle Asset Validation', () => {
  const validVehicle = {
    vehicleId: 'veh-001',
    fleetId: 'fleet-001',
    vehicleType: 'HEAVY_TRUCK' as const,
    registrationNumber: 'ABC-123-456',
    capacityWeight: 25000,
    capacityVolume: 45,
    registrationStatus: VehicleRegistrationStatus.REGISTERED,
    licenceJurisdiction: 'Mozambique',
    licencesValidNationwide: true,
    crossBorderPermitStatus: CrossBorderPermitStatus.PRE_EXISTING,
  };

  it('accepts valid heavy truck registration with Mozambique nationwide licence', () => {
    const result = validateVehicleAsset(validVehicle);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing vehicleId', () => {
    const result = validateVehicleAsset({ ...validVehicle, vehicleId: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing fleetId', () => {
    const result = validateVehicleAsset({ ...validVehicle, fleetId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('linked to a fleet'))).toBe(true);
  });

  it('rejects missing registrationNumber', () => {
    const result = validateVehicleAsset({ ...validVehicle, registrationNumber: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects capacity weight exceeding maximum', () => {
    const result = validateVehicleAsset({ ...validVehicle, capacityWeight: 600000 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('capacityWeight'))).toBe(true);
  });

  it('rejects negative capacity volume', () => {
    const result = validateVehicleAsset({ ...validVehicle, capacityVolume: -5 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('capacityVolume'))).toBe(true);
  });

  it('rejects Mozambique licence with licencesValidNationwide=false', () => {
    const result = validateVehicleAsset({ ...validVehicle, licenceJurisdiction: 'Mozambique', licencesValidNationwide: false });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('nationwide'))).toBe(true);
  });

  it('accepts non-Mozambique jurisdiction without nationwide restriction', () => {
    const result = validateVehicleAsset({
      ...validVehicle,
      licenceJurisdiction: 'Zimbabwe',
      licencesValidNationwide: false,
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects missing licenceJurisdiction', () => {
    const result = validateVehicleAsset({ ...validVehicle, licenceJurisdiction: '' });
    expect(result.isValid).toBe(false);
  });

  it('accepts all valid vehicle types', () => {
    const types = ['HEAVY_TRUCK', 'LIGHT_DELIVERY', 'TRAILER', 'REFRIGERATED', 'SPECIALISED'] as const;
    for (const type of types) {
      const result = validateVehicleAsset({ ...validVehicle, vehicleType: type });
      expect(result.isValid).toBe(true);
    }
  });

  it('accepts all valid permit statuses', () => {
    const statuses = [CrossBorderPermitStatus.NONE, CrossBorderPermitStatus.TEMPORARY_OBTAINABLE, CrossBorderPermitStatus.PRE_EXISTING];
    for (const status of statuses) {
      const result = validateVehicleAsset({ ...validVehicle, crossBorderPermitStatus: status });
      expect(result.isValid).toBe(true);
    }
  });
});

describe('MOD-014 Driver Registration Validation', () => {
  const validDriver = {
    fleetId: 'fleet-001',
    firstName: 'Jose',
    lastName: 'Nhaca',
    licenseType: 'Class C',
    licenseNumber: 'DL-98765432',
    licenseExpiryDate: new Date('2027-12-31'),
    certificationStatus: DriverCertificationStatus.VERIFIED,
    contactNumber: '+258 84 123 4567',
  };

  it('accepts valid driver registration', () => {
    const result = validateDriverRegistration(validDriver);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing fleetId', () => {
    const result = validateDriverRegistration({ ...validDriver, fleetId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('verified fleet'))).toBe(true);
  });

  it('rejects missing firstName', () => {
    const result = validateDriverRegistration({ ...validDriver, firstName: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing lastName', () => {
    const result = validateDriverRegistration({ ...validDriver, lastName: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing licenseNumber', () => {
    const result = validateDriverRegistration({ ...validDriver, licenseNumber: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects license number too short', () => {
    const result = validateDriverRegistration({ ...validDriver, licenseNumber: 'AB' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('characters'))).toBe(true);
  });

  it('rejects license number too long', () => {
    const result = validateDriverRegistration({ ...validDriver, licenseNumber: 'A'.repeat(51) });
    expect(result.isValid).toBe(false);
  });

  it('rejects invalid licenseExpiryDate', () => {
    const result = validateDriverRegistration({
      ...validDriver,
      licenseExpiryDate: new Date('invalid'),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('valid date'))).toBe(true);
  });

  it('rejects missing contactNumber', () => {
    const result = validateDriverRegistration({ ...validDriver, contactNumber: '' });
    expect(result.isValid).toBe(false);
  });

  it('accepts all valid certification statuses', () => {
    const statuses = [DriverCertificationStatus.VERIFIED, DriverCertificationStatus.PENDING, DriverCertificationStatus.EXPIRED, DriverCertificationStatus.SUSPENDED];
    for (const status of statuses) {
      const result = validateDriverRegistration({ ...validDriver, certificationStatus: status });
      expect(result.isValid).toBe(true);
    }
  });
});

describe('MOD-014 Double Booking Prevention for Assignments', () => {
  const existingAssignments = [
    { vehicleId: 'veh-001', driverId: 'drv-001', status: AssignmentStatus.ACTIVE },
    { vehicleId: 'veh-002', driverId: 'drv-002', status: AssignmentStatus.PLANNED },
    { vehicleId: 'veh-003', driverId: 'drv-003', status: AssignmentStatus.COMPLETED },
    { vehicleId: 'veh-004', driverId: 'drv-004', status: AssignmentStatus.CANCELLED },
  ];

  it('accepts assignment when vehicle and driver are free', () => {
    const result = assertNoDoubleBookingForAssignment({
      existingAssignments,
      proposedVehicleId: 'veh-999',
      proposedDriverId: 'drv-999',
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects assignment with busy vehicle', () => {
    const result = assertNoDoubleBookingForAssignment({
      existingAssignments,
      proposedVehicleId: 'veh-001',
      proposedDriverId: 'drv-free',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('already has an'))).toBe(true);
  });

  it('rejects assignment with busy driver', () => {
    const result = assertNoDoubleBookingForAssignment({
      existingAssignments,
      proposedVehicleId: 'veh-free',
      proposedDriverId: 'drv-002',
    });
    expect(result.isValid).toBe(false);
  });

  it('allows reassignment after completion', () => {
    const result = assertNoDoubleBookingForAssignment({
      existingAssignments,
      proposedVehicleId: 'veh-003',
      proposedDriverId: 'drv-003',
    });
    expect(result.isValid).toBe(true);
  });

  it('allows reassignment after cancellation', () => {
    const result = assertNoDoubleBookingForAssignment({
      existingAssignments,
      proposedVehicleId: 'veh-004',
      proposedDriverId: 'drv-004',
    });
    expect(result.isValid).toBe(true);
  });
});

describe('MOD-014 Cross-Border Compliance Validation', () => {
  const validCompliance = {
    vehicleId: 'veh-001',
    corridorId: 'corridor-mz-za-001', // string type per D-S2B-002 provisional assumption
    countryCode: 'ZA',
    permitType: PermitType.INSURANCE,
    permitNumber: 'INS-ZA-2026-001',
    expiryDate: new Date('2027-06-30'),
    permitStatus: PermitStatus.VALID,
  };

  it('accepts valid cross-border compliance declaration', () => {
    const result = validateCrossBorderCompliance(validCompliance);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing vehicleId', () => {
    const result = validateCrossBorderCompliance({ ...validCompliance, vehicleId: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing corridorId (design-time string reference)', () => {
    const result = validateCrossBorderCompliance({ ...validCompliance, corridorId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('design-time string reference') || e.includes('corridorId'))).toBe(true);
  });

  it('rejects missing countryCode', () => {
    const result = validateCrossBorderCompliance({ ...validCompliance, countryCode: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing permitType', () => {
    const result = validateCrossBorderCompliance({ ...validCompliance, permitType: undefined as unknown as PermitType });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing permitNumber', () => {
    const result = validateCrossBorderCompliance({ ...validCompliance, permitNumber: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects invalid expiryDate', () => {
    const result = validateCrossBorderCompliance({ ...validCompliance, expiryDate: new Date('invalid') });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing permitStatus', () => {
    const result = validateCrossBorderCompliance({ ...validCompliance, permitStatus: undefined as unknown as PermitStatus });
    expect(result.isValid).toBe(false);
  });

  it('accepts all valid permit types', () => {
    const types = [PermitType.INSURANCE, PermitType.TRANSPORT_PERMIT, PermitType.CUSTOMS_BOND, PermitType.OPERATING_LICENSE];
    for (const type of types) {
      const result = validateCrossBorderCompliance({ ...validCompliance, permitType: type });
      expect(result.isValid).toBe(true);
    }
  });

  it('accepts all valid permit statuses', () => {
    const statuses = [PermitStatus.VALID, PermitStatus.EXPIRING, PermitStatus.EXPIRED, PermitStatus.PENDING_RENEWAL];
    for (const status of statuses) {
      const result = validateCrossBorderCompliance({ ...validCompliance, permitStatus: status });
      expect(result.isValid).toBe(true);
    }
  });
});

describe('MOD-014 Backhaul Opportunity Validation', () => {
  const validBackhaul = {
    shipmentId: 'ship-001',
    vehicleId: 'veh-001',
    currentLocation: 'Johannesburg, ZA',
    destination: 'Maputo, MZ',
    estimatedCostRecovery: 35,
  };

  it('accepts valid backhaul opportunity', () => {
    const result = validateBackhaulOpportunity(validBackhaul);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing shipmentId', () => {
    const result = validateBackhaulOpportunity({ ...validBackhaul, shipmentId: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing vehicleId', () => {
    const result = validateBackhaulOpportunity({ ...validBackhaul, vehicleId: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing currentLocation', () => {
    const result = validateBackhaulOpportunity({ ...validBackhaul, currentLocation: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing destination', () => {
    const result = validateBackhaulOpportunity({ ...validBackhaul, destination: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects cost recovery below zero', () => {
    const result = validateBackhaulOpportunity({ ...validBackhaul, estimatedCostRecovery: -10 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('between 0 and 100'))).toBe(true);
  });

  it('rejects cost recovery above 100', () => {
    const result = validateBackhaulOpportunity({ ...validBackhaul, estimatedCostRecovery: 150 });
    expect(result.isValid).toBe(false);
  });

  it('accepts 0% cost recovery', () => {
    const result = validateBackhaulOpportunity({ ...validBackhaul, estimatedCostRecovery: 0 });
    expect(result.isValid).toBe(true);
  });

  it('accepts 100% cost recovery', () => {
    const result = validateBackhaulOpportunity({ ...validBackhaul, estimatedCostRecovery: 100 });
    expect(result.isValid).toBe(true);
  });
});
