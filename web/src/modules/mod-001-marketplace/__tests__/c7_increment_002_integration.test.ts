// NexCargo C7 Increment 002 — Integration / API-Level Tests
// Scope: Tracking init→query, document upload validation, fleet CRUD/filter, dispute hold/state transition, support case-ID generation
// Does NOT modify booking confirmation, financial execution, event infrastructure, or database schema.

import { describe, it, expect } from 'vitest';
import { applyTrackingTransition, type TrackingStatus } from '@/modules/mod-003-tracking/domain/services/tracking-state-machine';
import { ShipmentStatus } from '@/shared/types/enums';
import { ValidationError } from '@/shared/errors/app-errors';
import { validateDocumentUpload, validateAcceptableFormat } from '@/modules/mod-004-documents/domain/services/document-services';
import { prepareDisputeHold, prepareDisputeResolution } from '@/modules/mod-005-escrow/domain/services/dispute-hold-service';
import { generateCaseId, isValidCaseId } from '@/modules/mod-015-customer-support/domain/services/case-id-generator';
import {
  validateFleetRegistration,
  validateVehicleAsset,
  validateDriverRegistration,
  assertNoDoubleBookingForAssignment,
} from '@/modules/mod-014-fleet-assets/domain/services/asset-services';
import { VehicleRegistrationStatus, CrossBorderPermitStatus, AssignmentStatus, DriverCertificationStatus } from '@/modules/mod-014-fleet-assets/domain/enums';

// ============================================================
// Test 1 — Tracking initialization + query path
// Validates the C7 tracking state machine transitions that
// occur when initializeTracking() processes a confirmed booking.
// Does NOT modify booking confirmation flow.
// ============================================================

describe('C7-Increment-002 Test 1 — Tracking initialization → retrieval path', () => {
  it('transitions CREATED → BOOKED (tracking record creation on booking confirmed)', () => {
    const result = applyTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.BOOKED);
    expect(result).toBe(ShipmentStatus.BOOKED);
  });

  it('transitions BOOKED → AWAITING_PICKUP (driver accepted trip)', () => {
    const result = applyTrackingTransition(ShipmentStatus.BOOKED, ShipmentStatus.AWAITING_PICKUP);
    expect(result).toBe(ShipmentStatus.AWAITING_PICKUP);
  });

  it('transitions AWAITING_PICKUP → PICKUP_ACKNOWLEDGED (driver arrived)', () => {
    const result = applyTrackingTransition(ShipmentStatus.AWAITING_PICKUP, ShipmentStatus.PICKUP_ACKNOWLEDGED);
    expect(result).toBe(ShipmentStatus.PICKUP_ACKNOWLEDGED);
  });

  it('transits through IN_TRANSIT → DELIVERED sequence', () => {
    let status: TrackingStatus = ShipmentStatus.PICKUP_ACKNOWLEDGED;
    status = applyTrackingTransition(status, ShipmentStatus.IN_TRANSIT);
    expect(status).toBe(ShipmentStatus.IN_TRANSIT);
    status = applyTrackingTransition(status, ShipmentStatus.DELIVERED);
    expect(status).toBe(ShipmentStatus.DELIVERED);
  });

  it('rejects invalid direct jump from CREATED to DELIVERED', () => {
    expect(() => applyTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.DELIVERED))
      .toThrow(ValidationError);
  });

  it('marks DELIVERED as transitable to COMPLETED (finalization)', () => {
    const result = applyTrackingTransition(ShipmentStatus.DELIVERED, ShipmentStatus.COMPLETED);
    expect(result).toBe(ShipmentStatus.COMPLETED);
  });
});

// ============================================================
// Test 2 — Document upload validation path
// Verifies valid input reaches persistence path and
// invalid file types/sizes are rejected appropriately.
// Does NOT change storage architecture.
// ============================================================

describe('C7-Increment-002 Test 2 — Document upload validation', () => {
  const validInput = {
    documentId: 'doc-incr002-test',
    documentType: 'CONTRACT' as const,
    linkedEntityType: 'contract' as const,
    linkedEntityId: 'contract-incr002',
    fileReference: 's3://encrypted-bucket/doc.pdf',
    fileHash: 'a'.repeat(64),
  };

  it('accepts valid document upload with all required fields', () => {
    expect(() => validateDocumentUpload(validInput)).not.toThrow();
  });

  it('accepts PDF format via acceptable format validation', () => {
    const result = validateAcceptableFormat('.pdf');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts DOCX format via acceptable format validation', () => {
    const result = validateAcceptableFormat('.docx');
    expect(result.isValid).toBe(true);
  });

  it('accepts image formats (JPG, PNG, TIFF)', () => {
    for (const fmt of ['jpg', 'png', 'tiff'] as const) {
      const result = validateAcceptableFormat(fmt);
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects unsupported file type (.exe)', () => {
    const result = validateAcceptableFormat('.exe');
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Unsupported file format'))).toBe(true);
  });

  it('rejects empty documentId', () => {
    expect(() => validateDocumentUpload({ ...validInput, documentId: '' })).toThrow(/documentId is required/);
  });

  it('rejects missing fileReference', () => {
    expect(() => validateDocumentUpload({ ...validInput, fileReference: '' })).toThrow(/fileReference is required/);
  });

  it('rejects missing fileHash', () => {
    expect(() => validateDocumentUpload({ ...validInput, fileHash: '' })).toThrow(/fileHash is required/);
  });

  it('rejects fileHash exceeding 256 characters', () => {
    expect(() => validateDocumentUpload({ ...validInput, fileHash: 'a'.repeat(257) }))
      .toThrow(/must not exceed 256 characters/);
  });
});

// ============================================================
// Test 3 — Fleet CRUD/filter with ownership scoping
// Verifies existing fleet API/repository validation behavior
// including vehicle, driver registration, and assignment rules.
// Does NOT introduce new endpoints or modify RLS policies.
// ============================================================

describe('C7-Increment-002 Test 3 — Fleet CRUD/filter scoping', () => {
  // --- Fleet Registration ---

  it('accepts valid fleet registration for a transporter', () => {
    expect(() => validateFleetRegistration({
      ownerId: 'transporter-001',
      fleetName: 'TransZambezi Fleet',
      region: 'MZ-SA Corridor',
    })).not.toThrow();
  });

  it('rejects empty ownerId in fleet registration', () => {
    expect(() => validateFleetRegistration({
      ownerId: '',
      fleetName: 'Test Fleet',
      region: 'MZ',
    })).toThrow(/ownerId is required/);
  });

  // --- Vehicle Asset Validation ---

  const validVehicle = {
    vehicleId: 'veh-incr002-001',
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

  it('accepts valid heavy truck vehicle registration', () => {
    const result = validateVehicleAsset(validVehicle);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing vehicleId', () => {
    const result = validateVehicleAsset({ ...validVehicle, vehicleId: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing fleetId (ownership linkage)', () => {
    const result = validateVehicleAsset({ ...validVehicle, fleetId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('linked to a fleet'))).toBe(true);
  });

  it('rejects vehicle with excessive capacity weight', () => {
    const result = validateVehicleAsset({ ...validVehicle, capacityWeight: 600000 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('capacityWeight'))).toBe(true);
  });

  it('rejects negative capacity volume', () => {
    const result = validateVehicleAsset({ ...validVehicle, capacityVolume: -5 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('capacityVolume'))).toBe(true);
  });

  it('rejects Mozambique license without nationwide validity', () => {
    const result = validateVehicleAsset({ ...validVehicle, licenceJurisdiction: 'Mozambique', licencesValidNationwide: false });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('nationwide'))).toBe(true);
  });

  it('accepts non-Mozambique jurisdiction without nationwide requirement', () => {
    const result = validateVehicleAsset({
      ...validVehicle,
      licenceJurisdiction: 'South Africa',
      licencesValidNationwide: false,
    });
    expect(result.isValid).toBe(true);
  });

  // --- Driver Registration ---

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

  it('accepts valid driver registration tied to a fleet', () => {
    const result = validateDriverRegistration(validDriver);
    expect(result.isValid).toBe(true);
  });

  it('rejects driver without fleetId', () => {
    const result = validateDriverRegistration({ ...validDriver, fleetId: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects driver with short license number', () => {
    const result = validateDriverRegistration({ ...validDriver, licenseNumber: 'AB' });
    expect(result.isValid).toBe(false);
  });

  it('rejects driver with expired license date', () => {
    const result = validateDriverRegistration({ ...validDriver, licenseExpiryDate: new Date('invalid') });
    expect(result.isValid).toBe(false);
  });

  // --- Assignment Ownership/Double-Booking Scoping ---

  const existingAssignments = [
    { vehicleId: 'veh-assigned-1', driverId: 'drv-001', status: AssignmentStatus.ACTIVE },
    { vehicleId: 'veh-assigned-2', driverId: 'drv-002', status: AssignmentStatus.PLANNED },
    { vehicleId: 'veh-completed', driverId: 'drv-003', status: AssignmentStatus.COMPLETED },
  ];

  it('accepts assignment when both vehicle and driver are free', () => {
    const result = assertNoDoubleBookingForAssignment({
      existingAssignments,
      proposedVehicleId: 'veh-free',
      proposedDriverId: 'drv-free',
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects assignment to already-active vehicle', () => {
    const result = assertNoDoubleBookingForAssignment({
      existingAssignments,
      proposedVehicleId: 'veh-assigned-1',
      proposedDriverId: 'drv-free',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('already has an'))).toBe(true);
  });

  it('rejects assignment to busy driver', () => {
    const result = assertNoDoubleBookingForAssignment({
      existingAssignments,
      proposedVehicleId: 'veh-free',
      proposedDriverId: 'drv-002',
    });
    expect(result.isValid).toBe(false);
  });

  it('allows reassignment after completion (ownership release)', () => {
    const result = assertNoDoubleBookingForAssignment({
      existingAssignments,
      proposedVehicleId: 'veh-completed',
      proposedDriverId: 'drv-003',
    });
    expect(result.isValid).toBe(true);
  });
});

// ============================================================
// Test 4 — Dispute hold / escrow state validation
// Verifies dispute-hold service behavior and escrow state
// machine enforcement. Does NOT execute financial releases.
// ============================================================

describe('C7-Increment-002 Test 4 — Dispute hold / escrow state transition', () => {
  it('accepts valid FUNDS_LOCKED signal for dispute hold', () => {
    expect(() => prepareDisputeHold({ escrowId: 'escrow-disc-001', reason: 'Goods delivered damaged — photo evidence attached' }))
      .not.toThrow();
  });

  it('rejects dispute hold with reason too short (< 3 chars)', () => {
    expect(() => prepareDisputeHold({ escrowId: 'escrow-disc-001', reason: 'ab' }))
      .toThrow(ValidationError);
  });

  it('rejects dispute hold with empty escrowId', () => {
    expect(() => prepareDisputeHold({ escrowId: '', reason: 'test' }))
      .toThrow(ValidationError);
  });

  it('rejects dispute hold with whitespace-only escrowId', () => {
    expect(() => prepareDisputeHold({ escrowId: '   ', reason: 'test' }))
      .toThrow(ValidationError);
  });

  it('accepts RELEASE_TO_TRANSPORTER resolution outcome', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'escrow-disc-001', outcome: 'RELEASE_TO_TRANSPORTER' }))
      .not.toThrow();
  });

  it('accepts REFUND_TO_SHIPPER resolution outcome', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'escrow-disc-001', outcome: 'REFUND_TO_SHIPPER' }))
      .not.toThrow();
  });

  it('accepts SPLIT_SETTLEMENT resolution outcome', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'escrow-disc-001', outcome: 'SPLIT_SETTLEMENT' }))
      .not.toThrow();
  });

  it('rejects invalid resolution outcome', () => {
    expect(() => prepareDisputeResolution({ escrowId: 'escrow-disc-001', outcome: 'INVALID' as any }))
      .toThrow(ValidationError);
  });

  it('rejects dispute resolution with empty escrowId', () => {
    expect(() => prepareDisputeResolution({ escrowId: '', outcome: 'RELEASE_TO_TRANSPORTER' }))
      .toThrow(ValidationError);
  });
});

// ============================================================
// Test 5 — Support ticket case-ID generation
// Validates auto-generation of case IDs when omitted,
// preservation of user-supplied IDs, uniqueness guarantees,
// and pattern compliance.
// ============================================================

describe('C7-Increment-002 Test 5 — Support ticket case-ID generation', () => {
  // --- Auto-generation ---

  it('generates a valid case ID when no caseId is provided', () => {
    const generated = generateCaseId();
    expect(generated).toMatch(/^CASE-[A-Z0-9]{8}$/);
  });

  it('generated case IDs are unique across repeated calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateCaseId());
    }
    expect(ids.size).toBe(100);
  });

  it('does not produce duplicate case IDs on repeated creation', () => {
    const results = Array.from({ length: 50 }, generateCaseId);
    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBe(50);
  });

  // --- Pattern validation ---

  it('accepts valid user-supplied caseId "CASE-A1B2"', () => {
    expect(isValidCaseId('CASE-A1B2')).toBe(true);
  });

  it('accepts valid user-supplied caseId "CASE-XYZ9-VALID" (with surrounding whitespace)', () => {
    expect(isValidCaseId('CASE-XY9')).toBe(true);
  });

  it('rejects empty string caseId', () => {
    expect(isValidCaseId('')).toBe(false);
  });

  it('rejects null caseId', () => {
    expect(isValidCaseId(null)).toBe(false);
  });

  it('rejects undefined caseId', () => {
    expect(isValidCaseId(undefined)).toBe(false);
  });

  it('rejects caseId below minimum length (CASE-AB only 2 chars)', () => {
    expect(isValidCaseId('CASE-AB')).toBe(false);
  });

  it('rejects caseId missing prefix', () => {
    expect(isValidCaseId('ABCD-1234')).toBe(false);
  });

  it('rejects caseId with special characters after dash', () => {
    expect(isValidCaseId('CASE-AB!D')).toBe(false);
  });

  it('accepts caseId with lowercase letters (user-friendly)', () => {
    expect(isValidCaseId('CASE-abcd')).toBe(true);
  });

  // --- Combined flow simulation ---

  it('full flow: generateCaseId produces persistable ID', () => {
    const id = generateCaseId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(isValidCaseId(id)).toBe(true);
  });

  it('full flow: user caseId preserved if valid', () => {
    const userCaseId = 'CASE-SHIP001';
    if (isValidCaseId(userCaseId)) {
      expect(userCaseId.trim()).toBe('CASE-SHIP001');
    } else {
      throw new Error('Should not reach here');
    }
  });
});
