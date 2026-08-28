// NexCargo MOD-003 — Tracking Validation Services Tests
// Wave 2 — Stage 2B, Increment 1 — Authorized per HAOSTAGE2B-AUTH-001 (D-S2B-001)

import { describe, it, expect } from 'vitest';
import { validateShipmentTrackingRecord, validateGpsLocationUpdate, validateProofOfDelivery, assertPodMandatoryBeforeCompletion, validateDriverIdentityVerification, validateBorderCrossingEvent, validateVisibilitySnapshotRequest } from '../domain/services/tracking-services';
import { PodSubmissionMethod, VerificationMethod, VisibilityLevel } from '../domain/enums';

describe('MOD-003 Tracking Record Validation', () => {
  it('accepts valid tracking record with bookingId and contractId', () => {
    expect(() => validateShipmentTrackingRecord({
      bookingId: 'booking-123',
      contractId: 'contract-456',
      visibilityLevel: VisibilityLevel.INTERNAL,
    })).not.toThrow();
  });

  it('rejects empty bookingId', () => {
    expect(() => validateShipmentTrackingRecord({
      bookingId: '',
      contractId: 'contract-456',
      visibilityLevel: VisibilityLevel.INTERNAL,
    })).toThrow(/bookingId is required/);
  });

  it('rejects empty contractId', () => {
    expect(() => validateShipmentTrackingRecord({
      bookingId: 'booking-123',
      contractId: '',
      visibilityLevel: VisibilityLevel.INTERNAL,
    })).toThrow(/contractId is required/);
  });

  it('rejects whitespace-only IDs', () => {
    expect(() => validateShipmentTrackingRecord({
      bookingId: '   ',
      contractId: 'contract-456',
      visibilityLevel: VisibilityLevel.INTERNAL,
    })).toThrow(/bookingId is required/);
  });
});

describe('MOD-003 GPS Location Update Validation', () => {
  const validInput = {
    trackingId: 'track-001',
    latitude: -15.4,
    longitude: 28.3,
    speedKmh: 60,
    accuracyMetres: 10,
    batteryLevel: 75,
    isOffline: false,
  };

  it('accepts valid GPS coordinates in Southern Africa', () => {
    const result = validateGpsLocationUpdate(validInput);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts GPS at equator / prime meridian', () => {
    const result = validateGpsLocationUpdate({
      ...validInput,
      latitude: 0,
      longitude: 0,
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects out-of-range latitude (too high)', () => {
    const result = validateGpsLocationUpdate({ ...validInput, latitude: 91 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Latitude'))).toBe(true);
  });

  it('rejects out-of-range latitude (too low)', () => {
    const result = validateGpsLocationUpdate({ ...validInput, latitude: -91 });
    expect(result.isValid).toBe(false);
  });

  it('rejects out-of-range longitude (too high)', () => {
    const result = validateGpsLocationUpdate({ ...validInput, longitude: 181 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Longitude'))).toBe(true);
  });

  it('rejects out-of-range longitude (too low)', () => {
    const result = validateGpsLocationUpdate({ ...validInput, longitude: -181 });
    expect(result.isValid).toBe(false);
  });

  it('rejects negative speed', () => {
    const result = validateGpsLocationUpdate({ ...validInput, speedKmh: -10 });
    expect(result.isValid).toBe(false);
  });

  it('rejects excessive speed above max', () => {
    const result = validateGpsLocationUpdate({ ...validInput, speedKmh: 300 });
    expect(result.isValid).toBe(false);
  });

  it('rejects negative accuracy metres', () => {
    const result = validateGpsLocationUpdate({ ...validInput, accuracyMetres: -1 });
    expect(result.isValid).toBe(false);
  });

  it('rejects battery level below minimum', () => {
    const result = validateGpsLocationUpdate({ ...validInput, batteryLevel: -1 });
    expect(result.isValid).toBe(false);
  });

  it('rejects battery level above maximum', () => {
    const result = validateGpsLocationUpdate({ ...validInput, batteryLevel: 101 });
    expect(result.isValid).toBe(false);
  });

  it('allows missing optional fields gracefully', () => {
    const result = validateGpsLocationUpdate({
      trackingId: 'track-001',
      latitude: -15.4,
      longitude: 28.3,
      isOffline: true,
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects missing trackingId', () => {
    const result = validateGpsLocationUpdate({
      ...validInput,
      trackingId: '',
    });
    expect(result.isValid).toBe(false);
  });
});

describe('MOD-003 Proof of Delivery Validation', () => {
  const validPod = {
    trackingId: 'track-001',
    bookingId: 'booking-001',
    recipientName: 'John Doe',
    signatureHashOrReference: 'sig-hash-abc123',
    photographCount: 2,
    hasCoordinates: true,
    submissionMethod: PodSubmissionMethod.ONLINE,
  };

  it('accepts valid POD with all required evidence', () => {
    const result = validateProofOfDelivery(validPod);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing recipientName', () => {
    const result = validateProofOfDelivery({ ...validPod, recipientName: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing signature reference', () => {
    const result = validateProofOfDelivery({ ...validPod, signatureHashOrReference: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects zero photographs', () => {
    const result = validateProofOfDelivery({ ...validPod, photographCount: 0 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('photograph'))).toBe(true);
  });

  it('rejects missing coordinates', () => {
    const result = validateProofOfDelivery({ ...validPod, hasCoordinates: false });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing trackingId', () => {
    const result = validateProofOfDelivery({ ...validPod, trackingId: '' });
    expect(result.isValid).toBe(false);
  });

  it('accepts POD with single photograph (minimum)', () => {
    const result = validateProofOfDelivery({ ...validPod, photographCount: 1 });
    expect(result.isValid).toBe(true);
  });

  it('accepts offline submission method', () => {
    const result = validateProofOfDelivery({
      ...validPod,
      submissionMethod: PodSubmissionMethod.OFFLINE,
    });
    expect(result.isValid).toBe(true);
  });
});

describe('MOD-003 POD Mandatory Before Completion Rule', () => {
  it('passes when POD exists', () => {
    expect(() => assertPodMandatoryBeforeCompletion(true)).not.toThrow();
  });

  it('passes when POD missing but adminOverride is true', () => {
    expect(() => assertPodMandatoryBeforeCompletion(false, true)).not.toThrow();
  });

  it('throws when POD missing and no admin override', () => {
    expect(() => assertPodMandatoryBeforeCompletion(false, false))
      .toThrow(/Proof of Delivery is mandatory/);
  });

  it('throws clear error message mentioning exceptional circumstances path', () => {
    try {
      assertPodMandatoryBeforeCompletion(false, false);
    } catch (e) {
      expect((e as Error).message).toContain('exceptional circumstances');
    }
  });
});

describe('MOD-003 Driver Identity Verification Validation', () => {
  const validVerification = {
    trackingId: 'track-001',
    assignedDriverId: 'driver-001',
    verificationMethod: VerificationMethod.QR_CODE,
    attemptCount: 1,
  };

  it('accepts valid QR code verification', () => {
    const result = validateDriverIdentityVerification(validVerification);
    expect(result.isValid).toBe(true);
  });

  it('accepts OTP verification', () => {
    const result = validateDriverIdentityVerification({
      ...validVerification,
      verificationMethod: VerificationMethod.OTP,
    });
    expect(result.isValid).toBe(true);
  });

  it('accepts secure PIN verification', () => {
    const result = validateDriverIdentityVerification({
      ...validVerification,
      verificationMethod: VerificationMethod.SECURE_PIN,
    });
    expect(result.isValid).toBe(true);
  });

  it('accepts biometric verification', () => {
    const result = validateDriverIdentityVerification({
      ...validVerification,
      verificationMethod: VerificationMethod.BIOMETRIC,
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects missing trackingId', () => {
    const result = validateDriverIdentityVerification({
      ...validVerification,
      trackingId: '',
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing assignedDriverId', () => {
    const result = validateDriverIdentityVerification({
      ...validVerification,
      assignedDriverId: '',
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects zero attemptCount', () => {
    const result = validateDriverIdentityVerification({
      ...validVerification,
      attemptCount: 0,
    });
    expect(result.isValid).toBe(false);
  });
});

describe('MOD-003 Border Crossing Event Validation', () => {
  const validBorder = {
    trackingId: 'track-001',
    borderPostId: 'border-post-zambesi',
    entryTimestamp: '2026-08-27T10:00:00Z',
  };

  it('accepts valid border crossing event', () => {
    const result = validateBorderCrossingEvent(validBorder);
    expect(result.isValid).toBe(true);
  });

  it('accepts border crossing with exit timestamp after entry', () => {
    const result = validateBorderCrossingEvent({
      ...validBorder,
      exitTimestamp: '2026-08-27T11:30:00Z',
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects exit timestamp before entry timestamp', () => {
    const result = validateBorderCrossingEvent({
      ...validBorder,
      exitTimestamp: '2026-08-27T09:00:00Z',
    });
    expect(result.isValid).toBe(false);
  });

  it('accepts custom geofence radius', () => {
    const result = validateBorderCrossingEvent({
      ...validBorder,
      geofenceRadius: 8000, // 8km
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects non-positive geofence radius', () => {
    const result = validateBorderCrossingEvent({
      ...validBorder,
      geofenceRadius: 0,
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing borderPostId', () => {
    const result = validateBorderCrossingEvent({
      ...validBorder,
      borderPostId: '',
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing entryTimestamp', () => {
    const result = validateBorderCrossingEvent({
      ...validBorder,
      entryTimestamp: '',
    });
    expect(result.isValid).toBe(false);
  });
});

describe('MOD-003 Visibility Snapshot Request Validation', () => {
  const validRequest = {
    trackingId: 'track-001',
    visibilityLevel: VisibilityLevel.PUBLIC,
  };

  it('accepts valid snapshot request', () => {
    const result = validateVisibilitySnapshotRequest(validRequest);
    expect(result.isValid).toBe(true);
  });

  it('accepts PUBLIC visibility level', () => {
    const result = validateVisibilitySnapshotRequest({
      ...validRequest,
      visibilityLevel: VisibilityLevel.PUBLIC,
    });
    expect(result.isValid).toBe(true);
  });

  it('accepts RESTRICTED visibility level', () => {
    const result = validateVisibilitySnapshotRequest({
      ...validRequest,
      visibilityLevel: VisibilityLevel.RESTRICTED,
    });
    expect(result.isValid).toBe(true);
  });

  it('accepts INTERNAL visibility level', () => {
    const result = validateVisibilitySnapshotRequest({
      ...validRequest,
      visibilityLevel: VisibilityLevel.INTERNAL,
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects missing trackingId', () => {
    const result = validateVisibilitySnapshotRequest({
      ...validRequest,
      trackingId: '',
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects limit < 1', () => {
    const result = validateVisibilitySnapshotRequest({
      ...validRequest,
      limit: 0,
    });
    expect(result.isValid).toBe(false);
  });

  it('accepts limit = 1', () => {
    const result = validateVisibilitySnapshotRequest({
      ...validRequest,
      limit: 1,
    });
    expect(result.isValid).toBe(true);
  });
});
