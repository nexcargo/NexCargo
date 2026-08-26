// NexCargo MOD-002 — Offer/Listing Alignment Validator Tests
// Authorized directive: HAO-WAVE2-AUTH-001 (2026-08-25) — Wave 2 authorized
// Increment: MOD-002 Increment 1 (Phase 1 — Core Contract Formation)
// Reference: MOD-002 §3.5, §7.4 (Alignment Rule)

import { describe, it, expect } from 'vitest';
import {
  validateOfferListingAlignment,
  assertAlignment,
} from '@/modules/mod-002-booking/domain/services/offer-listing-alignment';
import { ValidationError } from '@/shared/errors/app-errors';

// ============================================================
// Test data factories
// ============================================================

function createListingRequirements(overrides = {}): Parameters<typeof validateOfferListingAlignment>[0] {
  return {
    requiredWeightKg: 5000,
    requiredVolumeM3: 15,
    acceptedVehicleTypes: ['HEAVY_TRUCK', 'TRAILER'],
    ...overrides,
  };
}

function createOfferDetails(overrides = {}): Parameters<typeof validateOfferListingAlignment>[1] {
  return {
    declaredWeightKg: 6000,
    declaredVolumeM3: 20,
    vehicleType: 'HEAVY_TRUCK',
    ...overrides,
  };
}

// ============================================================
// Weight check tests
// ============================================================

describe('MOD-002 Offer/Listing Alignment — Weight Check', () => {
  it('passes when offer weight >= listing requirement (equal)', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements({ requiredWeightKg: 5000 }),
      createOfferDetails({ declaredWeightKg: 5000 }),
    );
    expect(result.isAligned).toBe(true);
    expect(result.weightCheck.passes).toBe(true);
  });

  it('passes when offer weight > listing requirement', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements({ requiredWeightKg: 5000 }),
      createOfferDetails({ declaredWeightKg: 7500 }),
    );
    expect(result.isAligned).toBe(true);
    expect(result.weightCheck.variancePercentage).toBeGreaterThan(0);
  });

  it('fails when offer weight < listing requirement', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements({ requiredWeightKg: 5000 }),
      createOfferDetails({ declaredWeightKg: 4000 }),
    );
    expect(result.isAligned).toBe(false);
    expect(result.weightCheck.passes).toBe(false);
  });
});

// ============================================================
// Volume check tests
// ============================================================

describe('MOD-002 Offer/Listing Alignment — Volume Check', () => {
  it('passes when offer volume >= listing requirement', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements(),
      createOfferDetails({ declaredVolumeM3: 15 }),
    );
    expect(result.isAligned).toBe(true);
    expect(result.volumeCheck?.passes).toBe(true);
  });

  it('fails when offer volume < listing requirement', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements(),
      createOfferDetails({ declaredVolumeM3: 10 }),
    );
    expect(result.isAligned).toBe(false);
    expect(result.volumeCheck?.passes).toBe(false);
  });

  it('skips volume check when listing has no volume requirement', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements({ requiredVolumeM3: undefined }),
      createOfferDetails({ declaredVolumeM3: 10 }),
    );
    expect(result.isAligned).toBe(true);
    expect(result.volumeCheck).toBeNull();
  });
});

// ============================================================
// Vehicle type check tests
// ============================================================

describe('MOD-002 Offer/Listing Alignment — Vehicle Type Check', () => {
  it('passes when offer vehicle type is in accepted list', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements({ acceptedVehicleTypes: ['HEAVY_TRUCK', 'LIGHT_DELIVERY'] }),
      createOfferDetails({ vehicleType: 'HEAVY_TRUCK' }),
    );
    expect(result.isAligned).toBe(true);
    expect(result.vehicleTypeCheck.passes).toBe(true);
  });

  it('passes when offer vehicle type matches last in accepted list', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements({ acceptedVehicleTypes: ['TRAILER'] }),
      createOfferDetails({ vehicleType: 'TRAILER' }),
    );
    expect(result.isAligned).toBe(true);
  });

  it('fails when offer vehicle type is not in accepted list', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements({ acceptedVehicleTypes: ['HEAVY_TRUCK'] }),
      createOfferDetails({ vehicleType: 'LIGHT_DELIVERY' }),
    );
    expect(result.isAligned).toBe(false);
    expect(result.vehicleTypeCheck.passes).toBe(false);
  });
});

// ============================================================
// Combined alignment tests
// ============================================================

describe('MOD-002 Offer/Listing Alignment — Combined Checks', () => {
  it('isAligned is true when all checks pass', () => {
    const result = validateOfferListingAlignment(createListingRequirements(), createOfferDetails());
    expect(result.isAligned).toBe(true);
  });

  it('isAligned is false if any single check fails', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements({ acceptedVehicleTypes: ['LIGHT_DELIVERY'] }), // vehicle mismatch
      createOfferDetails(), // everything else OK
    );
    expect(result.isAligned).toBe(false);
    expect(result.details.length).toBeGreaterThanOrEqual(1);
  });

  it('multiple failures produce multiple detail messages', () => {
    const result = validateOfferListingAlignment(
      createListingRequirements(),
      createOfferDetails({ declaredWeightKg: 1000, vehicleType: 'LIGHT_DELIVERY' }),
    );
    expect(result.isAligned).toBe(false);
    expect(result.details).toContainEqual(expect.stringContaining('Weight mismatch'));
    expect(result.details).toContainEqual(expect.stringContaining('Vehicle type mismatch'));
  });
});

// ============================================================
// assertAlignment error throwing tests
// ============================================================

describe('MOD-002 Offer/Listing Alignment — assertAlignment', () => {
  it('assertAlignment throws ValidationError when alignment fails', () => {
    expect(() =>
      assertAlignment(
        createListingRequirements({ requiredWeightKg: 5000 }),
        createOfferDetails({ declaredWeightKg: 3000 }),
      ),
    ).toThrow(ValidationError);
  });

  it('assertAlignment does NOT throw when alignment passes', () => {
    expect(() =>
      assertAlignment(
        createListingRequirements({ requiredWeightKg: 5000 }),
        createOfferDetails({ declaredWeightKg: 6000 }),
      ),
    ).not.toThrow();
  });

  it('assertAlignment includes detail messages in error', () => {
    try {
      assertAlignment(
        createListingRequirements({ acceptedVehicleTypes: ['SPECIALISED'] }),
        createOfferDetails({ vehicleType: 'HEAVY_TRUCK' }),
      );
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.details).toEqual(expect.objectContaining({
          details: expect.arrayContaining([
            expect.stringContaining('Vehicle type mismatch'),
          ]),
        }));
      }
    }
  });
});
