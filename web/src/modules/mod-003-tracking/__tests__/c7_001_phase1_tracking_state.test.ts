// NexCargo MOD-003 — Tracking State Machine Tests (C7-001 Phase 1)
import { describe, it, expect } from 'vitest';
import { applyTrackingTransition, isTrackingTerminal, validateTrackingTransition } from '@/modules/mod-003-tracking/domain/services/tracking-state-machine';
import { ShipmentStatus } from '@/shared/types/enums';

describe('tracking-state-machine', () => {
  describe('Valid transitions', () => {
    it('CREATED → BOOKED', () => {
      const result = applyTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.BOOKED);
      expect(result).toBe(ShipmentStatus.BOOKED);
    });

    it('BOOKED → AWAITING_PICKUP', () => {
      const result = applyTrackingTransition(ShipmentStatus.BOOKED, ShipmentStatus.AWAITING_PICKUP);
      expect(result).toBe(ShipmentStatus.AWAITING_PICKUP);
    });

    it('AWAITING_PICKUP → PICKUP_ACKNOWLEDGED', () => {
      const result = applyTrackingTransition(ShipmentStatus.AWAITING_PICKUP, ShipmentStatus.PICKUP_ACKNOWLEDGED);
      expect(result).toBe(ShipmentStatus.PICKUP_ACKNOWLEDGED);
    });

    it('PICKUP_ACKNOWLEDGED → IN_TRANSIT', () => {
      const result = applyTrackingTransition(ShipmentStatus.PICKUP_ACKNOWLEDGED, ShipmentStatus.IN_TRANSIT);
      expect(result).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('IN_TRANSIT → AT_BORDER', () => {
      const result = applyTrackingTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.AT_BORDER);
      expect(result).toBe(ShipmentStatus.AT_BORDER);
    });

    it('AT_BORDER → IN_TRANSIT', () => {
      const result = applyTrackingTransition(ShipmentStatus.AT_BORDER, ShipmentStatus.IN_TRANSIT);
      expect(result).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('IN_TRANSIT → DELIVERED', () => {
      const result = applyTrackingTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED);
      expect(result).toBe(ShipmentStatus.DELIVERED);
    });

    it('DELIVERED → COMPLETED', () => {
      const result = applyTrackingTransition(ShipmentStatus.DELIVERED, ShipmentStatus.COMPLETED);
      expect(result).toBe(ShipmentStatus.COMPLETED);
    });

    it('Any active state → CANCELLED', () => {
      expect(() => applyTrackingTransition(ShipmentStatus.BOOKED, 'CANCELLED' as `${ShipmentStatus}`)).not.toThrow();
      expect(() => applyTrackingTransition(ShipmentStatus.DELAYED, 'CANCELLED' as `${ShipmentStatus}`)).not.toThrow();
    });

    it('Delayed recovers to multiple states', () => {
      expect(() => applyTrackingTransition(ShipmentStatus.DELAYED, ShipmentStatus.IN_TRANSIT)).not.toThrow();
      expect(() => applyTrackingTransition(ShipmentStatus.DELAYED, ShipmentStatus.DELIVERED)).not.toThrow();
      expect(() => applyTrackingTransition(ShipmentStatus.DELAYED, 'CANCELLED' as `${ShipmentStatus}`)).not.toThrow();
    });
  });

  describe('Invalid transitions', () => {
    it('COMPLETED cannot transition further', () => {
      expect(() => applyTrackingTransition(ShipmentStatus.COMPLETED, ShipmentStatus.IN_TRANSIT)).toThrow();
    });

    it('CREATED → IN_TRANSIT directly', () => {
      expect(() => applyTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.IN_TRANSIT)).toThrow();
    });

    it('AWAITING_PICKUP → DELIVERED', () => {
      expect(() => applyTrackingTransition(ShipmentStatus.AWAITING_PICKUP, ShipmentStatus.DELIVERED)).toThrow();
    });

    it('Delivered → InTransit (backwards)', () => {
      expect(() => applyTrackingTransition(ShipmentStatus.DELIVERED, ShipmentStatus.IN_TRANSIT)).toThrow();
    });
  });

  describe('Terminal states', () => {
    it('COMPLETED is terminal', () => {
      expect(isTrackingTerminal(ShipmentStatus.COMPLETED)).toBe(true);
    });

    it('CANCELLED is terminal', () => {
      expect(isTrackingTerminal('CANCELLED')).toBe(true);
    });

    it('Active states are not terminal', () => {
      expect(isTrackingTerminal(ShipmentStatus.CREATED)).toBe(false);
      expect(isTrackingTerminal(ShipmentStatus.IN_TRANSIT)).toBe(false);
      expect(isTrackingTerminal(ShipmentStatus.DELIVERED)).toBe(false);
    });
  });

  describe('validateTrackingTransition throws on error', () => {
    it('throws ValidationError for invalid transition', () => {
      expect(() => validateTrackingTransition(ShipmentStatus.CREATED, ShipmentStatus.COMPLETED)).toThrow();
    });
  });
});
